import { AppError } from './errors.ts';

/**
 * 金流規則。
 *
 * 核心不變式：
 * 1. 瀏覽器返回成功頁不等於已收款，只有經驗證的伺服器通知才算。
 * 2. 回呼 parse 拒絕重複欄位，核對簽章、特店、訂單、金額、成功碼與模擬交易 flag。
 * 3. 同一平臺交易重送不重複扣庫存；不同交易號重複付同一訂單轉財務核對。
 * 4. 退款鎖定可退餘額，未知結果先查平臺，不以重送新交易號處理。
 */

export type PaymentProvider = 'ecpay' | 'mock';

export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  queryPayment(input: QueryPaymentInput): Promise<QueryPaymentResult>;
  verifyNotification(input: VerifyNotificationInput): Promise<VerifiedNotification>;
  requestRefund(input: RefundRequestInput): Promise<RefundResult>;
  reconcile(input: ReconcileInput): Promise<ReconcileResult>;
}

export interface CreatePaymentInput {
  readonly merchantTradeNo: string;
  readonly amountTwd: number;
  readonly itemName: string;
  readonly tradeDesc: string;
  readonly returnUrl: string;
  readonly clientBackUrl: string;
  readonly choosePayment: 'Credit' | 'ATM' | 'CVS' | 'ALL';
  readonly idempotencyKey: string;
}

export interface CreatePaymentResult {
  readonly providerTradeNo: string | null;
  readonly redirectUrl: string;
  readonly raw: Readonly<Record<string, string>>;
}

export interface QueryPaymentInput {
  readonly merchantTradeNo: string;
  readonly amountTwd: number;
}

export type QueryPaymentResult =
  | { readonly status: 'paid'; readonly providerTradeNo: string; readonly paidAt: string; readonly amountTwd: number }
  | { readonly status: 'unpaid' }
  | { readonly status: 'failed'; readonly reason: string }
  | { readonly status: 'unknown'; readonly reason: string };

export interface VerifyNotificationInput {
  /** 原始 request body 位元組，驗章必須用原始內容，不可先 JSON parse。 */
  readonly rawBody: Buffer;
  readonly contentType: string;
}

export interface VerifiedNotification {
  readonly merchantId: string;
  readonly merchantTradeNo: string;
  readonly providerTradeNo: string;
  readonly amountTwd: number;
  readonly currency: string;
  readonly success: boolean;
  readonly simulated: boolean;
  readonly paidAt: string;
  /** 事件唯一鍵，用於去重。 */
  readonly eventKey: string;
}

export interface RefundRequestInput {
  readonly merchantTradeNo: string;
  readonly providerTradeNo: string;
  readonly amountTwd: number;
  readonly reason: string;
  /** 冪等鍵：同一退款意圖重試不得產生第二筆退款。 */
  readonly requestKey: string;
}

export type RefundResult =
  | { readonly status: 'completed'; readonly refundTradeNo: string; readonly amountTwd: number }
  | { readonly status: 'pending'; readonly refundTradeNo: string }
  | { readonly status: 'failed'; readonly reason: string }
  | { readonly status: 'unknown'; readonly reason: string };

export interface ReconcileInput {
  readonly date: string;
}

export interface ReconcileResult {
  readonly date: string;
  readonly transactions: readonly {
    readonly merchantTradeNo: string;
    readonly providerTradeNo: string;
    readonly amountTwd: number;
    readonly feeTwd: number;
    readonly settlementTwd: number;
    readonly status: string;
  }[];
}

/**
 * 綠界 CheckMacValue 計算。
 *
 * 步驟：參數依 key 排序（大小寫視為相同）→ 前後加上 HashKey / HashIV →
 * 依 .NET HttpUtility.UrlEncode 規則編碼後轉小寫 → SHA256 → 轉大寫。
 */
export function ecpayCheckMacValue(
  params: Readonly<Record<string, string>>,
  hashKey: string,
  hashIv: string,
): string {
  const sortedKeys = Object.keys(params).sort((a, b) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0,
  );

  const body = sortedKeys.map((key) => `${key}=${params[key] ?? ''}`).join('&');
  const raw = `HashKey=${hashKey}&${body}&HashIV=${hashIv}`;

  const encoded = encodeURIComponent(raw)
    .toLowerCase()
    .replace(/%20/g, '+')
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');

  return sha256Hex(encoded).toUpperCase();
}

/** 以 Web Crypto 計算 SHA256，避免依賴 node:crypto，讓 domain 可在任何 runtime 執行。 */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const digest = sha256(bytes);
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 純 JS SHA-256（FIPS 180-4），供無 Web Crypto 的環境使用。 */
function sha256(message: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLength = message.length * 8;
  // 補位後長度必須是 64 位元組的倍數：訊息 + 0x80 + 8 位元組長度。
  const withPadding = new Uint8Array(Math.ceil((message.length + 9) / 64) * 64);
  withPadding.set(message);
  withPadding[message.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 4, bitLength >>> 0, false);
  view.setUint32(withPadding.length - 8, Math.floor(bitLength / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = (rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)) >>> 0;
      const s1 = (rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)) >>> 0;
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = [H[0] ?? 0, H[1] ?? 0, H[2] ?? 0, H[3] ?? 0, H[4] ?? 0, H[5] ?? 0, H[6] ?? 0, H[7] ?? 0];

    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = ((H[0] ?? 0) + a) >>> 0;
    H[1] = ((H[1] ?? 0) + b) >>> 0;
    H[2] = ((H[2] ?? 0) + c) >>> 0;
    H[3] = ((H[3] ?? 0) + d) >>> 0;
    H[4] = ((H[4] ?? 0) + e) >>> 0;
    H[5] = ((H[5] ?? 0) + f) >>> 0;
    H[6] = ((H[6] ?? 0) + g) >>> 0;
    H[7] = ((H[7] ?? 0) + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, H[i] ?? 0, false);
  }
  return out;
}

/**
 * 解析表單編碼的回呼內容，並拒絕重複欄位。
 * 重複欄位是常見的參數污染攻擊手法，必須直接拒絕。
 */
export function parseFormBody(rawBody: Buffer): Record<string, string> {
  const text = rawBody.toString('utf8');
  const result: Record<string, string> = {};
  if (text.trim() === '') return result;

  for (const pair of text.split('&')) {
    if (pair === '') continue;
    const index = pair.indexOf('=');
    const rawKey = index === -1 ? pair : pair.slice(0, index);
    const rawValue = index === -1 ? '' : pair.slice(index + 1);
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));

    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new AppError('VALIDATION_FAILED', `回呼包含重複欄位 ${key}，已拒絕`);
    }
    result[key] = value;
  }
  return result;
}

export interface VerifyEcpayNotificationInput {
  readonly rawBody: Buffer;
  readonly hashKey: string;
  readonly hashIv: string;
  readonly expectedMerchantId: string;
  readonly expectedMerchantTradeNo: string;
  readonly expectedAmountTwd: number;
  /** 正式環境必須拒絕模擬交易。 */
  readonly allowSimulated: boolean;
}

export function verifyEcpayNotification(input: VerifyEcpayNotificationInput): VerifiedNotification {
  const params = parseFormBody(input.rawBody);

  const received = params.CheckMacValue;
  if (!received) {
    throw new AppError('PAYMENT_SIGNATURE_INVALID', '回呼缺少 CheckMacValue');
  }

  const withoutMac: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'CheckMacValue') withoutMac[key] = value;
  }

  const expected = ecpayCheckMacValue(withoutMac, input.hashKey, input.hashIv);
  if (expected !== received.toUpperCase()) {
    throw new AppError('PAYMENT_SIGNATURE_INVALID', 'CheckMacValue 驗證失敗');
  }

  if (params.MerchantID !== input.expectedMerchantId) {
    throw new AppError('PAYMENT_SIGNATURE_INVALID', '特店編號不符');
  }
  if (params.MerchantTradeNo !== input.expectedMerchantTradeNo) {
    throw new AppError('PAYMENT_SIGNATURE_INVALID', '特店訂單編號不符');
  }

  const amountTwd = Number(params.TradeAmt);
  if (!Number.isInteger(amountTwd) || amountTwd !== input.expectedAmountTwd) {
    throw new AppError('PAYMENT_AMOUNT_MISMATCH', `回呼金額 ${params.TradeAmt} 與訂單金額不符`);
  }

  const simulated = params.SimulatePaid === '1';
  if (simulated && !input.allowSimulated) {
    throw new AppError('PAYMENT_SIGNATURE_INVALID', '正式環境不接受模擬付款通知');
  }

  const success = params.RtnCode === '1';
  const providerTradeNo = params.TradeNo ?? '';

  return {
    merchantId: params.MerchantID ?? '',
    merchantTradeNo: params.MerchantTradeNo ?? '',
    providerTradeNo,
    amountTwd,
    currency: 'TWD',
    success,
    simulated,
    paidAt: params.PaymentDate ?? '',
    eventKey: `${providerTradeNo}:${params.RtnCode ?? ''}:${params.PaymentDate ?? ''}`,
  };
}

/**
 * 同一平臺交易重送不重複扣庫存。
 * 不同交易號重複付同一訂單時轉財務核對。
 */
export type DuplicateDecision =
  | { readonly action: 'apply' }
  | { readonly action: 'ignore_duplicate' }
  | { readonly action: 'finance_review'; readonly reason: string };

export function decideDuplicatePayment(input: {
  readonly existingProviderTradeNo: string | null;
  readonly incomingProviderTradeNo: string;
  readonly orderAlreadyPaid: boolean;
}): DuplicateDecision {
  if (!input.orderAlreadyPaid) {
    return { action: 'apply' };
  }
  if (input.existingProviderTradeNo === input.incomingProviderTradeNo) {
    return { action: 'ignore_duplicate' };
  }
  return {
    action: 'finance_review',
    reason: `訂單已收款，但收到不同平臺交易號 ${input.incomingProviderTradeNo}`,
  };
}

/** 退款未知結果時先查平臺，不以重送新交易號處理。 */
export function decideRefundRetry(result: RefundResult): 'query_provider' | 'retry_same_key' | 'stop' {
  switch (result.status) {
    case 'unknown':
      return 'query_provider';
    case 'pending':
      return 'query_provider';
    case 'failed':
      return 'retry_same_key';
    case 'completed':
      return 'stop';
  }
}
