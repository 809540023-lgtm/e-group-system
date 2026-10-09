import { AppError } from './errors.ts';
import { type Money, addMoney, allocate, money, sumMoney, twd } from './money.ts';
import type { SupplyMode } from './catalog.ts';

/**
 * 結帳與庫存保留規則。
 *
 * 核心不變式：
 * 1. 伺服器重新定價，前端傳來的價格、運費、總額一律不信。
 * 2. 訂單建立、明細與庫存保留在同一 transaction 完成。
 * 3. 多 SKU 按固定 SKU 順序鎖定庫存，避免兩張組合訂單形成相反鎖定順序而死鎖。
 * 4. 同一報價重試最多產生一張有效訂單（冪等）。
 * 5. 現貨、預購配額與詢價分開計算，不把預購當現貨扣庫存。
 */

export const QUOTE_TTL_MINUTES = 15;

export interface QuoteLineInput {
  readonly sku: string;
  readonly quantity: number;
}

export interface CatalogSnapshot {
  readonly sku: string;
  readonly productVersionId: string;
  /** 已核准臺幣售價，不得再加價。 */
  readonly saleTwd: number;
  readonly supplyMode: SupplyMode;
  readonly published: boolean;
  readonly complianceApproved: boolean;
  readonly sourceUpdatedAt: string | null;
  readonly weightG: number | null;
}

export interface InventorySnapshot {
  readonly sku: string;
  /** 現貨可售量。 */
  readonly onHand: number;
  /** 已被其他報價保留的數量。 */
  readonly reserved: number;
  /** 預購可採購配額，與現貨分開。 */
  readonly preorderQuota: number;
}

export interface ShippingOption {
  readonly code: string;
  readonly label: string;
  readonly feeTwd: number;
  /** 承諾到貨區間，例如「14-20 個工作天」。 */
  readonly promisedWindow: string;
  /** 是否可分批出貨。 */
  readonly allowsSplit: boolean;
}

export interface QuoteLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceTwd: number;
  readonly lineTotalTwd: number;
  readonly supplyMode: SupplyMode;
  readonly productVersionId: string;
}

export interface Quote {
  readonly quoteId: string;
  readonly quoteHash: string;
  readonly lines: readonly QuoteLine[];
  readonly subtotalTwd: number;
  readonly shippingFeeTwd: number;
  readonly totalTwd: number;
  readonly shippingOptionCode: string;
  readonly promisedWindow: string;
  readonly termsVersion: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** 需要人工詢價的 SKU，不得直接收款。 */
  readonly inquirySkus: readonly string[];
}

export interface BuildQuoteInput {
  readonly quoteId: string;
  readonly lines: readonly QuoteLineInput[];
  readonly catalog: ReadonlyMap<string, CatalogSnapshot>;
  readonly inventory: ReadonlyMap<string, InventorySnapshot>;
  readonly shippingOption: ShippingOption;
  readonly termsVersion: string;
  readonly now: Date;
  readonly staleHours?: number;
}

/** 固定 SKU 鎖定順序：所有交易都依此排序取得鎖，避免死鎖。 */
export function lockOrder(skus: readonly string[]): string[] {
  return [...new Set(skus)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function validateLineInputs(lines: readonly QuoteLineInput[]): void {
  if (lines.length === 0) {
    throw new AppError('VALIDATION_FAILED', '購物車為空');
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.sku || line.sku.trim() === '') {
      throw new AppError('VALIDATION_FAILED', '商品編號不可為空');
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new AppError('VALIDATION_FAILED', `數量必須是正整數，收到 ${line.quantity}`);
    }
    if (line.quantity > 999) {
      throw new AppError('VALIDATION_FAILED', '單一商品數量上限為 999');
    }
    if (seen.has(line.sku)) {
      throw new AppError('VALIDATION_FAILED', `重複的 SKU：${line.sku}，請先合併數量`);
    }
    seen.add(line.sku);
  }
}

function isStale(sourceUpdatedAt: string | null, now: Date, staleHours: number): boolean {
  if (!sourceUpdatedAt) return true;
  const updated = new Date(sourceUpdatedAt);
  if (Number.isNaN(updated.getTime())) return true;
  return (now.getTime() - updated.getTime()) / 3_600_000 > staleHours;
}

/**
 * 建立報價快照。伺服器重新讀取核准售價、版本、可售量與配送規則。
 */
export function buildQuote(input: BuildQuoteInput): Quote {
  const { quoteId, lines, catalog, inventory, shippingOption, termsVersion, now } = input;
  const staleHours = input.staleHours ?? 48;

  validateLineInputs(lines);

  const quoteLines: QuoteLine[] = [];
  const inquirySkus: string[] = [];

  for (const sku of lockOrder(lines.map((l) => l.sku))) {
    const line = lines.find((l) => l.sku === sku);
    if (!line) continue;

    const product = catalog.get(sku);
    if (!product) {
      throw new AppError('NOT_FOUND', `找不到商品 ${sku}`);
    }
    if (!product.published) {
      throw new AppError('PRODUCT_UNPUBLISHED', `商品 ${sku} 已下架，請重新選擇`);
    }
    if (!product.complianceApproved) {
      throw new AppError('COMPLIANCE_BLOCKED', `商品 ${sku} 尚未完成合法銷售審核`);
    }
    if (product.supplyMode === 'inquiry') {
      inquirySkus.push(sku);
      continue;
    }
    if (product.supplyMode === 'in_stock' && isStale(product.sourceUpdatedAt, now, staleHours)) {
      throw new AppError('SOURCE_STALE', `商品 ${sku} 來源超過 ${staleHours} 小時未更新，暫停即時供貨結帳`);
    }

    const stock = inventory.get(sku);
    if (!stock) {
      throw new AppError('OUT_OF_STOCK', `商品 ${sku} 無庫存紀錄`);
    }

    const available =
      product.supplyMode === 'in_stock'
        ? stock.onHand - stock.reserved
        : stock.preorderQuota;

    if (available < line.quantity) {
      throw new AppError(
        'OUT_OF_STOCK',
        product.supplyMode === 'in_stock'
          ? `商品 ${sku} 現貨僅剩 ${Math.max(available, 0)} 件`
          : `商品 ${sku} 預購配額僅剩 ${Math.max(available, 0)} 件`,
      );
    }

    const lineTotalTwd = product.saleTwd * line.quantity;
    quoteLines.push({
      sku,
      quantity: line.quantity,
      unitPriceTwd: product.saleTwd,
      lineTotalTwd,
      supplyMode: product.supplyMode,
      productVersionId: product.productVersionId,
    });
  }

  if (quoteLines.length === 0) {
    throw new AppError('VALIDATION_FAILED', '購物車內商品皆需人工詢價，請聯絡客服');
  }

  const subtotalTwd = quoteLines.reduce((acc, l) => acc + l.lineTotalTwd, 0);
  const totalTwd = subtotalTwd + shippingOption.feeTwd;
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MINUTES * 60_000).toISOString();

  const quoteHash = hashQuote({
    quoteId,
    lines: quoteLines,
    subtotalTwd,
    shippingFeeTwd: shippingOption.feeTwd,
    totalTwd,
    shippingOptionCode: shippingOption.code,
    termsVersion,
  });

  return {
    quoteId,
    quoteHash,
    lines: quoteLines,
    subtotalTwd,
    shippingFeeTwd: shippingOption.feeTwd,
    totalTwd,
    shippingOptionCode: shippingOption.code,
    promisedWindow: shippingOption.promisedWindow,
    termsVersion,
    issuedAt,
    expiresAt,
    inquirySkus,
  };
}

export function hashQuote(input: {
  quoteId: string;
  lines: readonly QuoteLine[];
  subtotalTwd: number;
  shippingFeeTwd: number;
  totalTwd: number;
  shippingOptionCode: string;
  termsVersion: string;
}): string {
  const parts = [
    input.quoteId,
    input.shippingOptionCode,
    input.termsVersion,
    String(input.subtotalTwd),
    String(input.shippingFeeTwd),
    String(input.totalTwd),
    ...input.lines
      .map((l) => `${l.sku}:${l.quantity}:${l.unitPriceTwd}:${l.productVersionId}`)
      .sort(),
  ];
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = parts.join('\u0001');
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function assertQuoteUsable(quote: Quote, now: Date): void {
  if (new Date(quote.expiresAt).getTime() <= now.getTime()) {
    throw new AppError('QUOTE_EXPIRED', '報價已過期，請重新整理購物車');
  }
}

export interface OrderLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceTwd: number;
  readonly lineTotalTwd: number;
  readonly productVersionId: string;
  readonly supplyMode: SupplyMode;
}

export interface Order {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly quoteId: string;
  readonly quoteHash: string;
  readonly lines: readonly OrderLine[];
  readonly subtotalTwd: number;
  readonly shippingFeeTwd: number;
  readonly totalTwd: number;
  readonly termsVersion: string;
  readonly status: OrderStatus;
  readonly createdAt: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'established'
  | 'pending_procurement'
  | 'preparing'
  | 'cancelled'
  | 'exception';

export type PaymentStatus =
  | 'unpaid'
  | 'processing'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'needs_review';

export type ShipmentStatus =
  | 'not_shipped'
  | 'shipped'
  | 'customs'
  | 'tw_delivery'
  | 'delivered'
  | 'delivery_exception';

export interface ReservationRequest {
  readonly sku: string;
  readonly quantity: number;
  readonly supplyMode: SupplyMode;
}

/**
 * 由報價產生庫存保留請求。現貨扣現貨、預購扣配額，兩者不混用。
 */
export function reservationRequestsFromQuote(quote: Quote): ReservationRequest[] {
  return lockOrder(quote.lines.map((l) => l.sku)).map((sku) => {
    const line = quote.lines.find((l) => l.sku === sku);
    if (!line) throw new AppError('INTERNAL', `報價缺少明細 ${sku}`);
    return { sku, quantity: line.quantity, supplyMode: line.supplyMode };
  });
}

/**
 * 付款方式對應的庫存保留期限。
 * 信用卡可短保留；ATM 或超商付款需數日，不能用 15 分鐘處理。
 */
export const RESERVATION_TTL_MINUTES: Readonly<Record<string, number>> = {
  credit_card: 15,
  atm: 3 * 24 * 60,
  cvs: 7 * 24 * 60,
};

export function reservationExpiry(paymentMethod: string, now: Date): Date {
  const minutes = RESERVATION_TTL_MINUTES[paymentMethod];
  if (minutes === undefined) {
    throw new AppError('VALIDATION_FAILED', `不支援的付款方式 ${paymentMethod}`);
  }
  return new Date(now.getTime() + minutes * 60_000);
}

/**
 * 逾期釋放前必須先確認金流是否可能已完成。
 * 逾期或取消後收到成功付款時保留款項紀錄，進入待處理佇列，不自動出貨。
 */
export type ReleaseDecision =
  | { readonly action: 'release' }
  | { readonly action: 'hold'; readonly reason: string };

export function decideReservationRelease(input: {
  readonly paymentStatus: PaymentStatus;
  readonly paymentQueryPending: boolean;
}): ReleaseDecision {
  if (input.paymentStatus === 'paid') {
    return { action: 'hold', reason: '付款已完成，保留轉為已售出' };
  }
  if (input.paymentStatus === 'processing' || input.paymentQueryPending) {
    return { action: 'hold', reason: '金流狀態未定，先查平臺再決定' };
  }
  return { action: 'release' };
}

/** 退款可退餘額：不得超過實際可退額，並發退款需鎖定。 */
export function availableRefundAmount(paidTwd: number, alreadyRefundedTwd: number): Money {
  const available = paidTwd - alreadyRefundedTwd;
  if (available < 0) {
    throw new AppError('INTERNAL', '已退款金額超過已收款金額，帳務資料異常');
  }
  return twd(available);
}

export function assertRefundWithinAvailable(requestedTwd: number, available: Money): void {
  if (!Number.isInteger(requestedTwd) || requestedTwd <= 0) {
    throw new AppError('VALIDATION_FAILED', '退款金額必須是正整數');
  }
  if (requestedTwd > available.amount) {
    throw new AppError('REFUND_EXCEEDS_AVAILABLE', `退款金額超過可退餘額 ${available.amount}`);
  }
}

/** 依明細金額權重分攤運費，保證各明細分攤加總等於運費總額。 */
export function allocateShippingFee(feeTwd: number, lines: readonly OrderLine[]): Money[] {
  const weights = lines.map((l) => l.lineTotalTwd);
  return allocate(twd(feeTwd), weights);
}

export function orderTotal(lines: readonly OrderLine[], shippingFeeTwd: number): Money {
  const lineTotals = lines.map((l) => twd(l.lineTotalTwd));
  return addMoney(sumMoney(lineTotals, 'TWD'), money(shippingFeeTwd, 'TWD'));
}
