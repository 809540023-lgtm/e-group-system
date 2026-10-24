/**
 * 站點服務結算（計畫書第九章、第十五章）。
 *
 * 有效交付件數 × 服務單價 + 品質績效獎勵 - 有契約依據的扣款。
 * 相同服務不得重複計酬；取消、重複、自買刷單與未交付訂單不計。
 */

export interface SettlementInput {
  readonly stationId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deliveredOrderIds: readonly string[];
  readonly serviceFeePerOrderTwd: number;
  readonly qualityBonusTwd: number;
  readonly deductions: readonly { readonly reason: string; readonly amountTwd: number }[];
}

export interface Settlement {
  readonly stationId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly deliveredCount: number;
  readonly serviceFeeTwd: number;
  readonly qualityBonusTwd: number;
  readonly deductionsTwd: number;
  readonly netTwd: number;
  readonly issues: readonly string[];
}

export function computeSettlement(input: SettlementInput): Settlement {
  const issues: string[] = [];
  const uniqueOrders = new Set(input.deliveredOrderIds);
  if (uniqueOrders.size !== input.deliveredOrderIds.length) {
    issues.push('交付訂單重複，重複項目不計酬。');
  }
  if (!Number.isInteger(input.serviceFeePerOrderTwd) || input.serviceFeePerOrderTwd < 0) {
    throw new Error('SETTLEMENT_INVALID: 服務單價必須是非負整數。');
  }
  if (!Number.isInteger(input.qualityBonusTwd) || input.qualityBonusTwd < 0) {
    throw new Error('SETTLEMENT_INVALID: 品質獎勵必須是非負整數。');
  }
  for (const deduction of input.deductions) {
    if (!Number.isInteger(deduction.amountTwd) || deduction.amountTwd < 0) {
      throw new Error('SETTLEMENT_INVALID: 扣款金額必須是非負整數。');
    }
    if (deduction.reason.trim() === '') {
      throw new Error('SETTLEMENT_INVALID: 扣款必須有契約依據與原因。');
    }
  }

  const deliveredCount = uniqueOrders.size;
  const serviceFeeTwd = deliveredCount * input.serviceFeePerOrderTwd;
  const deductionsTwd = input.deductions.reduce((acc, d) => acc + d.amountTwd, 0);
  const netTwd = serviceFeeTwd + input.qualityBonusTwd - deductionsTwd;

  return {
    stationId: input.stationId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    deliveredCount,
    serviceFeeTwd,
    qualityBonusTwd: input.qualityBonusTwd,
    deductionsTwd,
    netTwd,
    issues,
  };
}

/** 同一訂單不得在兩個結算期間重複計酬。 */
export function assertNoDoubleSettlement(orderId: string, settledOrderIds: ReadonlySet<string>): void {
  if (settledOrderIds.has(orderId)) {
    throw new Error(`SETTLEMENT_DUPLICATE: 訂單 ${orderId} 已結算，不得重複計酬。`);
  }
}
