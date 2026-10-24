/**
 * 推薦獎勵（計畫書第九章）。
 *
 * 單層直接成交歸因；有效履約才計獎。
 * 取消、重複、自買刷單、未交付、退款觀察期內退款都不計獎。
 */

export interface ReferralClaim {
  readonly referrerCustomerId: string;
  readonly refereeCustomerId: string;
  readonly orderId: string;
  readonly orderPaid: boolean;
  readonly orderDelivered: boolean;
  readonly orderRefunded: boolean;
  readonly orderAmountTwd: number;
  readonly rewardTwd: number;
  readonly perOrderCapTwd: number;
  readonly monthlyBudgetRemainingTwd: number;
  readonly priorClaimsForOrder: number;
  readonly priorClaimsByReferee: number;
  readonly sameDevice: boolean;
  readonly samePhone: boolean;
  readonly sameAddress: boolean;
}

export interface ReferralDecision {
  readonly approved: boolean;
  readonly rewardTwd: number;
  readonly reasons: readonly string[];
}

export function evaluateReferral(claim: ReferralClaim): ReferralDecision {
  const reasons: string[] = [];

  if (claim.referrerCustomerId === claim.refereeCustomerId) reasons.push('自薦不可計獎。');
  if (claim.sameDevice) reasons.push('同一裝置不可計獎。');
  if (claim.samePhone) reasons.push('同一手機號碼不可計獎。');
  if (claim.sameAddress) reasons.push('同一地址且無其他佐證時不計獎。');
  if (!claim.orderPaid) reasons.push('訂單尚未付款。');
  if (!claim.orderDelivered) reasons.push('訂單尚未完成交付。');
  if (claim.orderRefunded) reasons.push('訂單已退款，獎勵應扣回。');
  if (claim.priorClaimsForOrder > 0) reasons.push('同一訂單已有推薦獎勵。');
  if (claim.priorClaimsByReferee > 0) reasons.push('被推薦人已有其他推薦歸因，僅接受單層直接成交。');
  if (claim.orderAmountTwd <= 0) reasons.push('訂單金額必須大於零。');
  if (claim.rewardTwd <= 0) reasons.push('獎勵金額必須大於零。');
  if (claim.rewardTwd > claim.perOrderCapTwd) reasons.push(`獎勵超過單筆上限 ${claim.perOrderCapTwd} 元。`);
  if (claim.rewardTwd > claim.monthlyBudgetRemainingTwd) reasons.push('本月推薦預算不足。');

  const approved = reasons.length === 0;
  return { approved, rewardTwd: approved ? claim.rewardTwd : 0, reasons };
}

/** 退款時扣回已發獎勵；不得重複扣回。 */
export function reverseReferral(rewardTwd: number, alreadyReversed: boolean): { readonly reversalTwd: number; readonly reason: string | null } {
  if (alreadyReversed) return { reversalTwd: 0, reason: '此獎勵已扣回，不重複扣回。' };
  if (rewardTwd <= 0) return { reversalTwd: 0, reason: '無可扣回獎勵。' };
  return { reversalTwd: rewardTwd, reason: null };
}
