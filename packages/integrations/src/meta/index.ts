/**
 * Meta（Facebook / Instagram）廣告 adapter（規劃書 12、13、15、17 章；模組 13）。
 *
 * 規則：
 * - 版本與資產 ID 配置化，token 只在服務端。
 * - 先提供 Business Suite 人工草稿與報表匯入，再接可用 API。
 * - 資源先 paused；create 重試按官方 Idempotency 儲存，同一操作不得生成多資源。
 * - 沒有真實 API 資格時狀態明確 integration_pending。
 */

import { type AdapterCapability, type AdapterResult, err, notConfigured, ok, readEnv } from '../contract.ts';

export const META_ENV_NAMES = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_ACCESS_TOKEN',
  'META_AD_ACCOUNT_ID',
  'META_PIXEL_ID',
  'META_GRAPH_VERSION',
] as const;

export const META_DEFAULT_GRAPH_VERSION = 'v21.0';

export interface MetaCapability {
  readonly graphVersion: string;
  readonly adAccountId: string | null;
  readonly pixelId: string | null;
  readonly canCreateDraft: boolean;
  readonly canReadInsights: boolean;
  readonly canSendConversions: boolean;
}

export interface MetaAdDraft {
  readonly internalCampaignId: string;
  readonly name: string;
  readonly objective: string;
  readonly dailyBudgetMicros: number;
  readonly currency: string;
  readonly placements: readonly ('facebook' | 'instagram')[];
  readonly creativeIds: readonly string[];
  readonly status: 'PAUSED';
}

export interface MetaInsightRow {
  readonly date: string;
  readonly campaignId: string;
  readonly spendMicros: number;
  readonly currency: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly platformAttributedPurchases: number;
  readonly platformAttributedRevenueMicros: number;
}

export interface MetaConversionEvent {
  readonly eventName: 'Purchase' | 'InitiateCheckout' | 'AddToCart' | 'ViewContent';
  readonly eventId: string;
  readonly eventTime: number;
  readonly value: number;
  readonly currency: string;
  readonly orderCode: string;
  readonly consentGranted: boolean;
}

export interface MetaAdapter {
  capability(): AdapterCapability;
  describe(): MetaCapability;
  createPausedDraft(draft: MetaAdDraft, idempotencyKey: string): Promise<AdapterResult<{ readonly externalId: string; readonly status: 'PAUSED' }>>;
  fetchInsights(input: { readonly since: string; readonly until: string }): Promise<AdapterResult<readonly MetaInsightRow[]>>;
  sendConversions(events: readonly MetaConversionEvent[]): Promise<AdapterResult<{ readonly accepted: number; readonly skipped: number }>>;
}

export interface MetaAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly fixtures?: {
    readonly drafts?: Readonly<Record<string, { readonly externalId: string; readonly status: 'PAUSED' }>>;
    readonly insights?: readonly MetaInsightRow[];
  };
}

/** 未取得顧客同意不得送出轉換事件。 */
export function filterConsentedEvents(events: readonly MetaConversionEvent[]): {
  readonly accepted: readonly MetaConversionEvent[];
  readonly skipped: readonly MetaConversionEvent[];
} {
  const accepted: MetaConversionEvent[] = [];
  const skipped: MetaConversionEvent[] = [];
  for (const event of events) {
    if (event.consentGranted) accepted.push(event);
    else skipped.push(event);
  }
  return { accepted, skipped };
}

/** 幣別必須與廣告帳號一致，不得把臺幣值直接當美元。 */
export function assertCurrencyMatches(currency: string, accountCurrency: string): void {
  if (currency.toUpperCase() !== accountCurrency.toUpperCase()) {
    throw new Error(`幣別不符：事件為 ${currency}，廣告帳號為 ${accountCurrency}。`);
  }
}

export function createMetaAdapter(options: MetaAdapterOptions = {}): MetaAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fixtures = options.fixtures;
  const { values, missing } = readEnv(META_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;
  const graphVersion = values.META_GRAPH_VERSION ?? META_DEFAULT_GRAPH_VERSION;

  const capability = (): AdapterCapability => ({
    name: 'meta_ads',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；未取得 Meta API 資格，外部驗收為 integration_pending。'
      : missing.length === 0
        ? `已設定 Meta 資產，Graph ${graphVersion}。`
        : '缺少 Meta 憑證，僅能使用 fixtures。',
  });

  const describe = (): MetaCapability => ({
    graphVersion,
    adAccountId: values.META_AD_ACCOUNT_ID ?? null,
    pixelId: values.META_PIXEL_ID ?? null,
    canCreateDraft: !mockMode && missing.length === 0,
    canReadInsights: !mockMode && missing.length === 0,
    canSendConversions: !mockMode && missing.length === 0,
  });

  return {
    capability,
    describe,

    async createPausedDraft(draft, idempotencyKey) {
      if (draft.status !== 'PAUSED') {
        return err('unsupported', '資源必須先以 PAUSED 建立。', { retryable: false });
      }
      if (mockMode) {
        const fixture = fixtures.drafts?.[idempotencyKey];
        if (fixture === undefined) {
          return err('not_found', `fixtures 無此草稿 ${idempotencyKey}`, { mode: 'mock' });
        }
        return ok(fixture, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', 'Meta Marketing API 需依當日官方文件實作；目前保留 disabled。', { retryable: false });
    },

    async fetchInsights(input) {
      if (mockMode) {
        const rows = (fixtures.insights ?? []).filter((r) => r.date >= input.since && r.date <= input.until);
        return ok(rows, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      try {
        const url = `https://graph.facebook.com/${graphVersion}/act_${values.META_AD_ACCOUNT_ID ?? ''}/insights?time_range=${encodeURIComponent(JSON.stringify({ since: input.since, until: input.until }))}&access_token=${encodeURIComponent(values.META_ACCESS_TOKEN ?? '')}`;
        const response = await fetchImpl(url);
        if (!response.ok) {
          return err('provider_error', `Meta insights 回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        const body = (await response.json()) as { data?: readonly MetaInsightRow[] };
        return ok(body.data ?? []);
      } catch (cause) {
        return err('network_error', `Meta insights 失敗：${String(cause)}`, { retryable: true });
      }
    },

    async sendConversions(events) {
      const { accepted, skipped } = filterConsentedEvents(events);
      if (mockMode) {
        return ok({ accepted: accepted.length, skipped: skipped.length }, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', 'Meta CAPI 需依當日官方 payload 實作；目前保留 disabled。', { retryable: false });
    },
  };
}

/** 平臺歸因與網站實際成交分開顯示，不得直接加總。 */
export function separateAttributionFromActual(input: {
  readonly platformAttributedRevenueTwd: number;
  readonly actualNetRevenueTwd: number;
}): { readonly platformAttributedRevenueTwd: number; readonly actualNetRevenueTwd: number; readonly note: string } {
  return {
    platformAttributedRevenueTwd: input.platformAttributedRevenueTwd,
    actualNetRevenueTwd: input.actualNetRevenueTwd,
    note: '平臺歸因收入與網站實際成交分開顯示，不可加總為實際營收。',
  };
}
