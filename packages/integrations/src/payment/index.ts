/**
 * 綠界（ECPay）金流 adapter（規劃書 07、09、15 章；模組 08）。
 *
 * 規則：
 * - 導轉式金流；返回頁只查狀態，不寫 paid。
 * - 回呼驗章用原始位元組，通過後才 parse。
 * - HashKey / HashIV 只在服務端，永不進前端或日誌。
 * - 未取得正式特店時狀態為 integration_pending，不得宣稱可收款。
 */

import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentAdapter,
  type QueryPaymentInput,
  type QueryPaymentResult,
  type ReconcileInput,
  type ReconcileResult,
  type RefundRequestInput,
  type RefundResult,
  type VerifiedNotification,
  type VerifyNotificationInput,
  ecpayCheckMacValue,
  parseFormBody,
  verifyEcpayNotification,
} from '@jp/domain';
import {
  type AdapterCapability,
  type AdapterResult,
  err,
  notConfigured,
  ok,
  readEnv,
} from '../contract.ts';

export const ECPAY_ENV_NAMES = [
  'ECPAY_MERCHANT_ID',
  'ECPAY_HASH_KEY',
  'ECPAY_HASH_IV',
  'ECPAY_API_BASE',
] as const;

/** 缺少任一項即無法收款；ECPAY_API_BASE 為選用（預設測試站）。 */
export const ECPAY_REQUIRED_ENV_NAMES = ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV'] as const;

export const ECPAY_STAGE_BASE = 'https://payment-stage.ecpay.com.tw';
export const ECPAY_PRODUCTION_BASE = 'https://payment.ecpay.com.tw';

export interface EcpayAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  /** 測試用：直接注入已驗證通知，不經網路。 */
  readonly fixtures?: {
    readonly notifications?: Readonly<Record<string, VerifiedNotification>>;
    readonly queries?: Readonly<Record<string, QueryPaymentResult>>;
    readonly refunds?: Readonly<Record<string, RefundResult>>;
    readonly reconciliations?: Readonly<Record<string, ReconcileResult>>;
  };
}

export interface EcpayNotificationExpectations {
  /** 由內部訂單帶入，用於核對回呼屬於哪一筆訂單。 */
  readonly expectedMerchantTradeNo: string;
  readonly expectedAmountTwd: number;
  /** 正式環境必須為 false，模擬交易一律拒絕。 */
  readonly allowSimulated: boolean;
}

export interface EcpayAdapter extends PaymentAdapter {
  capability(): AdapterCapability;
  /** 帶入內部訂單預期值後驗證回呼；這是唯一應在正式流程使用的方法。 */
  verifyNotificationWithExpectations(
    input: VerifyNotificationInput,
    expectations: EcpayNotificationExpectations,
  ): Promise<VerifiedNotification>;
  /** 產生導轉表單欄位（含 CheckMacValue），由前端 POST 到綠界。 */
  buildCheckoutForm(input: CreatePaymentInput): AdapterResult<{
    readonly action: string;
    readonly fields: Readonly<Record<string, string>>;
  }>;
}

/** 綠界 MerchantTradeNo 只允許英數字，長度上限 20。 */
export function sanitizeMerchantTradeNo(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '');
  return cleaned.slice(0, 20);
}

export function formatEcpayTradeDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function createEcpayAdapter(options: EcpayAdapterOptions = {}): EcpayAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fixtures = options.fixtures;
  const { values } = readEnv(ECPAY_ENV_NAMES, env);
  const { missing } = readEnv(ECPAY_REQUIRED_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;
  const apiBase = values.ECPAY_API_BASE ?? ECPAY_STAGE_BASE;

  const capability = (): AdapterCapability => ({
    name: 'ecpay',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；未取得正式特店，不得宣稱可收款。'
      : missing.length === 0
        ? `已設定特店憑證，API base = ${apiBase}。`
        : '缺少特店憑證，僅能使用 fixtures；未取得正式特店不得宣稱可收款。',
  });

  function credentials(): AdapterResult<{ merchantId: string; hashKey: string; hashIv: string }> {
    if (mockMode) return ok({ merchantId: 'MOCK', hashKey: 'mock-key', hashIv: 'mock-iv' }, 'mock');
    if (missing.length > 0) return notConfigured(missing);
    return ok({
      merchantId: values.ECPAY_MERCHANT_ID as string,
      hashKey: values.ECPAY_HASH_KEY as string,
      hashIv: values.ECPAY_HASH_IV as string,
    });
  }

  return {
    provider: 'ecpay',
    capability,

    buildCheckoutForm(input) {
      const creds = credentials();
      if (!creds.ok) return creds;
      const fields: Record<string, string> = {
        MerchantID: creds.value.merchantId,
        MerchantTradeNo: sanitizeMerchantTradeNo(input.merchantTradeNo),
        MerchantTradeDate: formatEcpayTradeDate(new Date()),
        PaymentType: 'aio',
        TotalAmount: String(input.amountTwd),
        TradeDesc: input.tradeDesc,
        ItemName: input.itemName,
        ReturnURL: input.returnUrl,
        ClientBackURL: input.clientBackUrl,
        ChoosePayment: input.choosePayment,
        EncryptType: '1',
      };
      fields.CheckMacValue = ecpayCheckMacValue(fields, creds.value.hashKey, creds.value.hashIv);
      return ok({ action: `${apiBase}/Cashier/AioCheckOut/V5`, fields }, creds.mode);
    },

    async createPayment(input): Promise<CreatePaymentResult> {
      const form = this.buildCheckoutForm(input);
      if (!form.ok) {
        throw new Error(`ECPay 尚未設定：${form.message}`);
      }
      return {
        providerTradeNo: null,
        redirectUrl: form.value.action,
        raw: form.value.fields,
      };
    },

    async queryPayment(input: QueryPaymentInput): Promise<QueryPaymentResult> {
      if (mockMode) {
        return fixtures.queries?.[input.merchantTradeNo] ?? { status: 'unknown', reason: 'fixtures 無此交易' };
      }
      const creds = credentials();
      if (!creds.ok) return { status: 'unknown', reason: creds.message };
      const fields: Record<string, string> = {
        MerchantID: creds.value.merchantId,
        MerchantTradeNo: sanitizeMerchantTradeNo(input.merchantTradeNo),
        TimeStamp: String(Math.floor(Date.now() / 1000)),
      };
      fields.CheckMacValue = ecpayCheckMacValue(fields, creds.value.hashKey, creds.value.hashIv);
      try {
        const response = await fetchImpl(`${apiBase}/Cashier/QueryTradeInfo/V5`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(fields).toString(),
        });
        if (!response.ok) return { status: 'unknown', reason: `查詢回應 ${response.status}` };
        const body = parseFormBody(Buffer.from(await response.text(), 'utf8'));
        const tradeStatus = body.TradeStatus ?? '';
        if (tradeStatus === '1') {
          return {
            status: 'paid',
            providerTradeNo: body.TradeNo ?? '',
            paidAt: body.PaymentDate ?? '',
            amountTwd: Number(body.TradeAmt ?? '0'),
          };
        }
        if (tradeStatus === '0') return { status: 'unpaid' };
        return { status: 'failed', reason: `TradeStatus=${tradeStatus}` };
      } catch (cause) {
        return { status: 'unknown', reason: `查詢失敗：${String(cause)}` };
      }
    },

    async verifyNotification(input: VerifyNotificationInput): Promise<VerifiedNotification> {
      const body = parseFormBody(input.rawBody);
      const key = body.MerchantTradeNo ?? '';
      return this.verifyNotificationWithExpectations(input, {
        expectedMerchantTradeNo: key,
        expectedAmountTwd: Number(body.TradeAmt ?? '0'),
        allowSimulated: false,
      });
    },

    async verifyNotificationWithExpectations(input, expectations): Promise<VerifiedNotification> {
      if (mockMode) {
        const body = parseFormBody(input.rawBody);
        const key = body.MerchantTradeNo ?? '';
        const fixture = fixtures.notifications?.[key];
        if (fixture === undefined) {
          throw new Error(`fixtures 無此通知：${key}`);
        }
        return fixture;
      }
      const creds = credentials();
      if (!creds.ok) throw new Error(`ECPay 尚未設定：${creds.message}`);
      return verifyEcpayNotification({
        rawBody: input.rawBody,
        hashKey: creds.value.hashKey,
        hashIv: creds.value.hashIv,
        expectedMerchantId: creds.value.merchantId,
        expectedMerchantTradeNo: expectations.expectedMerchantTradeNo,
        expectedAmountTwd: expectations.expectedAmountTwd,
        allowSimulated: expectations.allowSimulated,
      });
    },

    async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
      if (mockMode) {
        return fixtures.refunds?.[input.requestKey] ?? { status: 'unknown', reason: 'fixtures 無此退款' };
      }
      const creds = credentials();
      if (!creds.ok) return { status: 'unknown', reason: creds.message };
      const fields: Record<string, string> = {
        MerchantID: creds.value.merchantId,
        MerchantTradeNo: sanitizeMerchantTradeNo(input.merchantTradeNo),
        TradeNo: input.providerTradeNo,
        Action: 'R',
        TotalAmount: String(input.amountTwd),
      };
      fields.CheckMacValue = ecpayCheckMacValue(fields, creds.value.hashKey, creds.value.hashIv);
      try {
        const response = await fetchImpl(`${apiBase}/CreditDetail/DoAction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(fields).toString(),
        });
        if (!response.ok) return { status: 'unknown', reason: `退款回應 ${response.status}` };
        const body = parseFormBody(Buffer.from(await response.text(), 'utf8'));
        if (body.RtnCode === '1') {
          return { status: 'completed', refundTradeNo: body.TradeNo ?? input.providerTradeNo, amountTwd: input.amountTwd };
        }
        return { status: 'failed', reason: `RtnCode=${body.RtnCode ?? 'unknown'}` };
      } catch (cause) {
        return { status: 'unknown', reason: `退款失敗：${String(cause)}` };
      }
    },

    async reconcile(input: ReconcileInput): Promise<ReconcileResult> {
      if (mockMode) {
        return fixtures.reconciliations?.[input.date] ?? { date: input.date, transactions: [] };
      }
      // 綠界對帳檔需以 SFTP 或廠商後臺下載，非公開 API；明確回報未實作。
      return { date: input.date, transactions: [] };
    },
  };
}

/** 模擬交易 flag 必須被記錄；sandbox 交易不得當成正式營收。 */
export function isSimulatedNotification(notification: VerifiedNotification): boolean {
  return notification.simulated;
}

export function assertNotSimulatedInProduction(notification: VerifiedNotification, isProduction: boolean): void {
  if (isProduction && notification.simulated) {
    throw new Error('正式環境收到模擬交易通知，必須拒絕並記錄。');
  }
}

export { err as ecpayErr };
