/**
 * 物流 adapter（規劃書 08、09、15 章；模組 10）。
 *
 * 支援臺灣現貨、日臺集貨預購、個人直寄及詢價。
 * 3kg/20天/NT380 只作有條件的方案，不能當通用價。
 * EZ WAY 真實認證與委任以物流商實際結果為準。
 */

import type { ShippingChannel, ShippingQuote, ShippingQuoteInput } from '@jp/domain';
import { quoteShipping, requiresInquiry } from '@jp/domain';
import { type AdapterCapability, type AdapterResult, err, notConfigured, ok, readEnv } from '../contract.ts';

export const SHIPPING_ENV_NAMES = ['SHIPPING_PROVIDER', 'SHIPPING_API_KEY', 'SHIPPING_API_BASE'] as const;

export interface TrackingUpdate {
  readonly trackingNo: string;
  readonly status: string;
  readonly occurredAt: string;
  readonly location: string | null;
  readonly note: string | null;
}

export interface CustomsRequirement {
  readonly required: boolean;
  readonly reasons: readonly string[];
  readonly ezWayRequired: boolean;
}

export interface ShippingAdapter {
  capability(): AdapterCapability;
  /** 依費率卡計算運費；純計算，不呼叫外部服務。 */
  quote(input: ShippingQuoteInput): AdapterResult<ShippingQuote>;
  /** 建立託運單；未設定物流商時回報 integration_pending。 */
  createShipment(input: {
    readonly orderCode: string;
    readonly channel: ShippingChannel;
    readonly recipientName: string;
    readonly recipientPhone: string;
    readonly address: string;
    readonly weightG: number;
    readonly idempotencyKey: string;
  }): Promise<AdapterResult<{ readonly trackingNo: string; readonly labelUrl: string | null }>>;
  /** 查詢追蹤事件；原始紀錄不覆蓋。 */
  fetchTracking(trackingNo: string): Promise<AdapterResult<readonly TrackingUpdate[]>>;
}

export interface ShippingAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly fixtures?: {
    readonly shipments?: Readonly<Record<string, { readonly trackingNo: string; readonly labelUrl: string | null }>>;
    readonly tracking?: Readonly<Record<string, readonly TrackingUpdate[]>>;
  };
}

/** 報關資料完整性檢查；未完成不得出貨。 */
export function evaluateCustomsRequirement(input: {
  readonly channel: ShippingChannel;
  readonly declaredValueTwd: number;
  readonly category: string;
  readonly hasRecipientIdNumber: boolean;
  readonly hasEzWayAppointment: boolean;
  readonly restrictedCategories: readonly string[];
}): CustomsRequirement {
  const reasons: string[] = [];
  if (input.channel === 'jp_direct' || input.channel === 'jp_consolidation') {
    reasons.push('日本進口需報關');
  }
  if (input.declaredValueTwd >= 2000) {
    reasons.push('完稅價格達新臺幣 2,000 元以上需課稅');
  }
  if (input.restrictedCategories.includes(input.category)) {
    reasons.push(`限制品類：${input.category}`);
  }
  const required = reasons.length > 0;
  const ezWayRequired = input.channel === 'jp_direct' || input.channel === 'jp_consolidation';
  return {
    required,
    reasons,
    ezWayRequired,
  };
}

export function assertCustomsComplete(input: {
  readonly requirement: CustomsRequirement;
  readonly hasRecipientIdNumber: boolean;
  readonly hasEzWayAppointment: boolean;
}): void {
  if (!input.requirement.required) return;
  if (!input.hasRecipientIdNumber) {
    throw new Error('報關需要收件人身分證號，未提供不得出貨。');
  }
  if (input.requirement.ezWayRequired && !input.hasEzWayAppointment) {
    throw new Error('EZ WAY 實名認證與委任未完成，不得出貨。');
  }
}

export function createShippingAdapter(options: ShippingAdapterOptions = {}): ShippingAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fixtures = options.fixtures;
  const { values, missing } = readEnv(SHIPPING_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;

  const capability = (): AdapterCapability => ({
    name: 'shipping',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；未接上實際物流商，外部驗收為 integration_pending。'
      : missing.length === 0
        ? `已設定物流商 ${values.SHIPPING_PROVIDER ?? ''}。`
        : '缺少物流商憑證，僅能使用 fixtures。',
  });

  return {
    capability,

    quote(input) {
      if (requiresInquiry({ dimensions: input.dimensions, actualWeightG: input.actualWeightG, category: input.category, rateCard: input.rateCard })) {
        return err('unsupported', '尺寸、重量或品類未知，需轉詢價，不得直接收款。', { retryable: false });
      }
      return ok(quoteShipping(input));
    },

    async createShipment(input) {
      if (mockMode) {
        const fixture = fixtures.shipments?.[input.idempotencyKey];
        if (fixture === undefined) {
          return err('not_found', `fixtures 無此託運單 ${input.idempotencyKey}`, { mode: 'mock' });
        }
        return ok(fixture, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', '實際物流商 API 需依當日官方文件實作；目前保留 disabled。', { retryable: false });
    },

    async fetchTracking(trackingNo) {
      if (mockMode) {
        return ok(fixtures.tracking?.[trackingNo] ?? [], 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      try {
        const response = await fetchImpl(`${values.SHIPPING_API_BASE ?? ''}/tracking/${encodeURIComponent(trackingNo)}`, {
          headers: { Authorization: `Bearer ${values.SHIPPING_API_KEY ?? ''}` },
        });
        if (!response.ok) {
          return err('provider_error', `追蹤回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        return ok((await response.json()) as readonly TrackingUpdate[]);
      } catch (cause) {
        return err('network_error', `追蹤查詢失敗：${String(cause)}`, { retryable: true });
      }
    },
  };
}

/** 顧客可見的到貨區間文字；不含內部成本。 */
export function deliveryWindowText(channel: ShippingChannel, businessDays: number): string {
  const label: Record<ShippingChannel, string> = {
    tw_stock: '臺灣現貨',
    jp_consolidation: '日臺集貨預購',
    jp_direct: '日本直寄',
    inquiry: '詢價後確認',
  };
  if (channel === 'inquiry') return `${label[channel]}：確認後提供到貨區間`;
  return `${label[channel]}：約 ${businessDays} 個工作天`;
}
