/**
 * 電子發票 adapter（規劃書 07、09、15 章；模組 08）。
 *
 * 發票以 adapter 按實際銷售主體處理載具、統編、作廢與折讓。
 * 未取得正式發票服務時狀態為 integration_pending。
 */

import { type AdapterCapability, type AdapterResult, err, notConfigured, ok, readEnv } from '../contract.ts';

export const INVOICE_ENV_NAMES = ['INVOICE_PROVIDER', 'INVOICE_MERCHANT_ID', 'INVOICE_API_KEY'] as const;

export type CarrierType = 'mobile_barcode' | 'citizen_digital_certificate' | 'donation' | 'member' | 'paper';

export interface InvoiceIssueInput {
  readonly orderCode: string;
  readonly sellerTaxId: string;
  readonly buyerTaxId: string | null;
  readonly carrierType: CarrierType;
  readonly carrierId: string | null;
  readonly donationCode: string | null;
  readonly amountTwd: number;
  readonly taxType: 'taxable' | 'zero_rated' | 'exempt';
  readonly items: readonly { readonly name: string; readonly quantity: number; readonly unitPriceTwd: number }[];
  readonly idempotencyKey: string;
}

export interface InvoiceRecord {
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly randomCode: string;
  readonly amountTwd: number;
  readonly status: 'issued' | 'voided' | 'allowance';
}

export interface InvoiceAdapter {
  capability(): AdapterCapability;
  issue(input: InvoiceIssueInput): Promise<AdapterResult<InvoiceRecord>>;
  void(invoiceNumber: string, reason: string): Promise<AdapterResult<InvoiceRecord>>;
  allowance(input: { readonly invoiceNumber: string; readonly amountTwd: number; readonly reason: string }): Promise<AdapterResult<InvoiceRecord>>;
}

export interface InvoiceAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fixtures?: {
    readonly issues?: Readonly<Record<string, InvoiceRecord>>;
  };
}

/** 載具與統編互斥：有統編即為公司戶，不列印個人載具。 */
export function validateInvoiceCarrier(input: {
  readonly carrierType: CarrierType;
  readonly carrierId: string | null;
  readonly buyerTaxId: string | null;
  readonly donationCode: string | null;
}): void {
  if (input.buyerTaxId !== null && input.buyerTaxId.trim() !== '') {
    if (!/^\d{8}$/.test(input.buyerTaxId.trim())) {
      throw new Error('統一編號必須為 8 位數字。');
    }
    if (input.carrierType === 'mobile_barcode' || input.carrierType === 'citizen_digital_certificate') {
      throw new Error('公司戶統編與個人載具不得同時使用。');
    }
  }
  if (input.carrierType === 'mobile_barcode' && !/^\/[0-9A-Z.+-]{7}$/.test(input.carrierId ?? '')) {
    throw new Error('手機條碼載具格式錯誤，應為 / 加 7 碼英數字。');
  }
  if (input.carrierType === 'donation' && !/^\d{3,7}$/.test(input.donationCode ?? '')) {
    throw new Error('捐贈碼必須為 3 至 7 位數字。');
  }
}

export function createInvoiceAdapter(options: InvoiceAdapterOptions = {}): InvoiceAdapter {
  const env = options.env ?? process.env;
  const fixtures = options.fixtures;
  const { missing } = readEnv(INVOICE_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;

  const capability = (): AdapterCapability => ({
    name: 'invoice',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；未接上正式發票服務，外部驗收為 integration_pending。'
      : missing.length === 0
        ? '已設定發票服務。'
        : '缺少發票服務憑證，僅能使用 fixtures。',
  });

  return {
    capability,

    async issue(input) {
      validateInvoiceCarrier({
        carrierType: input.carrierType,
        carrierId: input.carrierId,
        buyerTaxId: input.buyerTaxId,
        donationCode: input.donationCode,
      });
      if (mockMode) {
        const fixture = fixtures.issues?.[input.idempotencyKey];
        if (fixture === undefined) {
          return err('not_found', `fixtures 無此發票 ${input.idempotencyKey}`, { mode: 'mock' });
        }
        return ok(fixture, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', '發票服務需依當日官方文件實作；目前保留 disabled。', { retryable: false });
    },

    async void(invoiceNumber, reason) {
      if (mockMode) {
        return ok(
          { invoiceNumber, invoiceDate: '', randomCode: '', amountTwd: 0, status: 'voided' as const },
          'mock',
        );
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', `作廢需依官方文件實作（原因：${reason}）。`, { retryable: false });
    },

    async allowance(input) {
      if (mockMode) {
        return ok(
          {
            invoiceNumber: input.invoiceNumber,
            invoiceDate: '',
            randomCode: '',
            amountTwd: input.amountTwd,
            status: 'allowance' as const,
          },
          'mock',
        );
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', '折讓需依官方文件實作。', { retryable: false });
    },
  };
}
