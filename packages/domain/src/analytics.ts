import { AppError } from './errors.ts';
import { type Money, addMoney, subMoney, twd } from './money.ts';

/**
 * 成交貢獻與管理報表。
 *
 * 核心不變式：
 * 1. 後臺營收以已確認款項扣退款，不用平臺歸因數字。
 * 2. 平臺 attribution window 與 time basis 與網站實際成交分開顯示，
 *    不能把多平臺歸因收入直接加總。
 * 3. UTC 儲存時間，臺北營運報表與日本作業時區明示。
 */

export interface RevenueFacts {
  readonly paidTwd: number;
  readonly refundedTwd: number;
  readonly paymentFeeTwd: number;
  readonly landedCostTwd: number;
  readonly shippingSubsidyTwd: number;
  readonly adSpendTwd: number;
}

export interface ContributionResult {
  readonly netRevenue: Money;
  readonly contribution: Money;
  readonly contributionRate: number;
}

/** 淨貢獻 = 已收款 − 退款 − 落地成本 − 金流費 − 運費補貼 − 廣告支出。 */
export function netContribution(facts: RevenueFacts): ContributionResult {
  const netRevenue = twd(facts.paidTwd - facts.refundedTwd);
  const contribution = twd(
    netRevenue.amount -
      facts.landedCostTwd -
      facts.paymentFeeTwd -
      facts.shippingSubsidyTwd -
      facts.adSpendTwd,
  );
  return {
    netRevenue,
    contribution,
    contributionRate: netRevenue.amount === 0 ? 0 : contribution.amount / netRevenue.amount,
  };
}

export interface PlatformAttribution {
  readonly platform: string;
  readonly attributedRevenueTwd: number;
  readonly attributedOrders: number;
  readonly spendTwd: number;
  readonly attributionWindowDays: number;
  readonly timeBasis: 'click' | 'view' | 'purchase';
}

export interface AttributionReport {
  readonly platforms: readonly PlatformAttribution[];
  /** 各平臺歸因收入合計，僅供參考，不等於實際營收。 */
  readonly summedAttributedRevenueTwd: number;
  /** 網站實際營收，以此為準。 */
  readonly actualRevenueTwd: number;
  readonly warning: string;
}

export function buildAttributionReport(
  platforms: readonly PlatformAttribution[],
  actualRevenueTwd: number,
): AttributionReport {
  const summed = platforms.reduce((acc, p) => acc + p.attributedRevenueTwd, 0);
  return {
    platforms,
    summedAttributedRevenueTwd: summed,
    actualRevenueTwd,
    warning: '各平臺歸因收入不可直接加總為實際營收；同一筆交易可能被多平臺認領。',
  };
}

export interface RoasResult {
  readonly roas: number | null;
  readonly cac: number | null;
  readonly note: string;
}

/** 零分母需明確回 null，不可回 Infinity 或 NaN。 */
export function computeRoasAndCac(input: {
  readonly revenueTwd: number;
  readonly spendTwd: number;
  readonly newCustomers: number;
}): RoasResult {
  const roas = input.spendTwd === 0 ? null : input.revenueTwd / input.spendTwd;
  const cac = input.newCustomers === 0 ? null : input.spendTwd / input.newCustomers;
  return {
    roas,
    cac,
    note: input.spendTwd === 0 ? '無廣告支出，ROAS 不適用' : input.newCustomers === 0 ? '無新客，CAC 不適用' : '',
  };
}

export interface FunnelMetrics {
  readonly visitors: number;
  readonly productViews: number;
  readonly addToCarts: number;
  readonly beginCheckouts: number;
  readonly paymentConfirmed: number;
}

export interface FunnelRates {
  readonly addToCartRate: number | null;
  readonly checkoutRate: number | null;
  readonly paymentSuccessRate: number | null;
}

export function computeFunnelRates(metrics: FunnelMetrics): FunnelRates {
  const safe = (numerator: number, denominator: number): number | null =>
    denominator === 0 ? null : numerator / denominator;
  return {
    addToCartRate: safe(metrics.addToCarts, metrics.productViews),
    checkoutRate: safe(metrics.beginCheckouts, metrics.addToCarts),
    paymentSuccessRate: safe(metrics.paymentConfirmed, metrics.beginCheckouts),
  };
}

/** 內部事件統一命名。 */
export type InternalEvent =
  | 'view_product'
  | 'search'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'payment_confirmed'
  | 'order_fulfilled'
  | 'refund_confirmed'
  | 'support_created';

export interface ConversionEvent {
  readonly eventName: InternalEvent;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly orderId: string | null;
  readonly valueTwd: number | null;
  readonly consentGranted: boolean;
}

/**
 * Purchase 只由已驗證付款及可計入收入的訂單產生，不能只看感謝頁。
 * 拒絕量測不影響購物或履行訂單。
 */
export function toPlatformPurchaseEvent(
  event: ConversionEvent,
  platform: string,
): { readonly send: boolean; readonly reason?: string } {
  if (platform.trim() === '') {
    return { send: false, reason: '未指定目標平臺' };
  }
  if (event.eventName !== 'payment_confirmed') {
    return { send: false, reason: '只有 payment_confirmed 可轉為 Purchase' };
  }
  if (!event.consentGranted) {
    return { send: false, reason: '顧客未同意量測，不送出轉換事件' };
  }
  if (event.valueTwd === null || event.valueTwd <= 0) {
    return { send: false, reason: '缺少可計入收入的金額' };
  }
  return { send: true };
}

/** 事件去重：同一 event_id 不重複送出。 */
export function dedupeEvents(
  delivered: ReadonlySet<string>,
  events: readonly ConversionEvent[],
): readonly ConversionEvent[] {
  const seen = new Set(delivered);
  const result: ConversionEvent[] = [];
  for (const event of events) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    result.push(event);
  }
  return result;
}

/** 跨月退款需歸屬到原交易月份，避免當月營收被扭曲。 */
export function attributeRefundToOriginalMonth(
  refund: { readonly amountTwd: number; readonly originalPaidAt: string; readonly refundedAt: string },
): { readonly month: string; readonly amountTwd: number; readonly crossMonth: boolean } {
  const originalMonth = refund.originalPaidAt.slice(0, 7);
  const refundMonth = refund.refundedAt.slice(0, 7);
  return {
    month: originalMonth,
    amountTwd: refund.amountTwd,
    crossMonth: originalMonth !== refundMonth,
  };
}

export interface ReconciliationDifference {
  readonly kind: 'paid_not_reported' | 'duplicate_payment' | 'refund_incomplete' | 'fee_difference' | 'settlement_delay';
  readonly referenceId: string;
  readonly amountTwd: number;
  readonly note: string;
}

export function classifyReconciliation(input: {
  readonly orderPaidTwd: number;
  readonly providerReportedTwd: number;
  readonly refundRequestedTwd: number;
  readonly refundCompletedTwd: number;
  readonly expectedFeeTwd: number;
  readonly actualFeeTwd: number;
  readonly settlementDays: number;
  readonly referenceId: string;
}): ReconciliationDifference[] {
  const differences: ReconciliationDifference[] = [];

  if (input.orderPaidTwd > input.providerReportedTwd) {
    differences.push({
      kind: 'paid_not_reported',
      referenceId: input.referenceId,
      amountTwd: input.orderPaidTwd - input.providerReportedTwd,
      note: '已收未回報，需向平臺查單',
    });
  }
  if (input.providerReportedTwd > input.orderPaidTwd) {
    differences.push({
      kind: 'duplicate_payment',
      referenceId: input.referenceId,
      amountTwd: input.providerReportedTwd - input.orderPaidTwd,
      note: '重複付款，轉財務核對',
    });
  }
  if (input.refundRequestedTwd > input.refundCompletedTwd) {
    differences.push({
      kind: 'refund_incomplete',
      referenceId: input.referenceId,
      amountTwd: input.refundRequestedTwd - input.refundCompletedTwd,
      note: '退款未完成',
    });
  }
  if (input.expectedFeeTwd !== input.actualFeeTwd) {
    differences.push({
      kind: 'fee_difference',
      referenceId: input.referenceId,
      amountTwd: input.actualFeeTwd - input.expectedFeeTwd,
      note: '手續費差異',
    });
  }
  if (input.settlementDays > 7) {
    differences.push({
      kind: 'settlement_delay',
      referenceId: input.referenceId,
      amountTwd: input.providerReportedTwd,
      note: `撥款延遲 ${input.settlementDays} 天`,
    });
  }

  return differences;
}

/** 報表可點回明細證據，匯出範圍與操作有紀錄。 */
export interface ReportExport {
  readonly reportId: string;
  readonly requestedBy: string;
  readonly scope: string;
  readonly purpose: string;
  readonly exportedAt: string;
  readonly rowCount: number;
}

export function assertExportHasPurpose(exportRequest: Pick<ReportExport, 'purpose' | 'scope'>): void {
  if (exportRequest.purpose.trim() === '') {
    throw new AppError('VALIDATION_FAILED', '資料匯出必須填寫用途');
  }
  if (exportRequest.scope.trim() === '') {
    throw new AppError('VALIDATION_FAILED', '資料匯出必須指定範圍');
  }
}

export function sumMoneySafe(values: readonly Money[]): Money {
  return values.reduce((acc, value) => addMoney(acc, value), twd(0));
}

export function subtractMoneySafe(a: Money, b: Money): Money {
  return subMoney(a, b);
}
