/**
 * 訂單狀態機與金額計算（計畫書第十五章核心驗收）。
 *
 * 伺服器重算價格；前端傳來的金額一律不信。
 * 付款、交付與帳務必須可對上。
 */

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'cancelled', 'refunded'],
  preparing: ['ready', 'cancelled', 'refunded'],
  ready: ['delivered', 'cancelled', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`ORDER_TRANSITION_INVALID: 訂單狀態不可由 ${from} 轉為 ${to}。`);
  }
}

export interface OrderLineInput {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceTwd: number;
}

export interface OrderTotals {
  readonly subtotalTwd: number;
  readonly deliveryFeeTwd: number;
  readonly stationFeeTwd: number;
  readonly totalTwd: number;
}

export function computeOrderTotals(
  lines: readonly OrderLineInput[],
  deliveryFeeTwd: number,
  stationFeeTwd: number,
): OrderTotals {
  if (lines.length === 0) throw new Error('ORDER_EMPTY: 訂單至少需要一項商品。');
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`ORDER_QUANTITY_INVALID: ${line.sku} 數量必須是正整數。`);
    }
    if (!Number.isInteger(line.unitPriceTwd) || line.unitPriceTwd < 0) {
      throw new Error(`ORDER_PRICE_INVALID: ${line.sku} 單價必須是非負整數。`);
    }
  }
  if (!Number.isInteger(deliveryFeeTwd) || deliveryFeeTwd < 0) throw new Error('ORDER_FEE_INVALID: 配送費必須是非負整數。');
  if (!Number.isInteger(stationFeeTwd) || stationFeeTwd < 0) throw new Error('ORDER_FEE_INVALID: 站點服務費必須是非負整數。');

  const subtotalTwd = lines.reduce((acc, line) => acc + line.unitPriceTwd * line.quantity, 0);
  return {
    subtotalTwd,
    deliveryFeeTwd,
    stationFeeTwd,
    totalTwd: subtotalTwd + deliveryFeeTwd + stationFeeTwd,
  };
}

/** 固定 SKU 鎖定順序，避免相反鎖定順序造成死鎖。 */
export function lockOrder(skus: readonly string[]): readonly string[] {
  return [...new Set(skus)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 可售量 = 現有量 - 已保留量；不得超賣。 */
export function availableQuantity(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

export function assertNoOversell(sku: string, requested: number, onHand: number, reserved: number): void {
  const available = availableQuantity(onHand, reserved);
  if (requested > available) {
    throw new Error(`OUT_OF_STOCK: ${sku} 可售量僅剩 ${available}，無法保留 ${requested}。`);
  }
}

/** 退款不得超過已付款且未退金額。 */
export function assertRefundable(paidTwd: number, alreadyRefundedTwd: number, requestedTwd: number): void {
  if (requestedTwd <= 0) throw new Error('REFUND_INVALID: 退款金額必須大於零。');
  const remaining = paidTwd - alreadyRefundedTwd;
  if (requestedTwd > remaining) {
    throw new Error(`REFUND_EXCEEDS_PAID: 可退餘額 ${remaining} 元，無法退款 ${requestedTwd} 元。`);
  }
}
