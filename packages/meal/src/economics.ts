/**
 * 單位經濟與損益兩平（計畫書第十三章）。
 *
 * 示範單筆模型（未稅管理口徑）：
 * 商品收入 200、商品成本 100、冷鏈配送 12、包材 5、站點服務 20、
 * 金流 4、耗損退款準備 6、推薦行銷 8，單筆貢獻 45。
 */

export interface UnitEconomicsInput {
  readonly revenueTwd: number;
  readonly productCostTwd: number;
  readonly coldChainTwd: number;
  readonly packagingTwd: number;
  readonly stationServiceTwd: number;
  readonly paymentTwd: number;
  readonly wasteReserveTwd: number;
  readonly referralTwd: number;
}

export interface UnitEconomics {
  readonly contributionTwd: number;
  readonly marginRate: number;
  readonly costs: Readonly<Record<keyof Omit<UnitEconomicsInput, 'revenueTwd'>, number>>;
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ECONOMICS_INVALID: ${label} 必須是非負有限數值，收到 ${value}`);
  }
}

export function unitEconomics(input: UnitEconomicsInput): UnitEconomics {
  for (const [key, value] of Object.entries(input)) assertNonNegative(value, key);
  const costs = {
    productCostTwd: input.productCostTwd,
    coldChainTwd: input.coldChainTwd,
    packagingTwd: input.packagingTwd,
    stationServiceTwd: input.stationServiceTwd,
    paymentTwd: input.paymentTwd,
    wasteReserveTwd: input.wasteReserveTwd,
    referralTwd: input.referralTwd,
  };
  const totalCost = Object.values(costs).reduce((acc, value) => acc + value, 0);
  const contributionTwd = input.revenueTwd - totalCost;
  return {
    contributionTwd,
    marginRate: input.revenueTwd > 0 ? contributionTwd / input.revenueTwd : 0,
    costs,
  };
}

export interface BreakEven {
  readonly ordersPerMonth: number;
  readonly ordersPerDay: number;
  readonly feasible: boolean;
}

/** 站點固定成本除以每筆站點服務收入。 */
export function stationBreakEven(fixedMonthlyTwd: number, serviceFeePerOrderTwd: number, daysPerMonth = 30): BreakEven {
  assertNonNegative(fixedMonthlyTwd, '站點月固定成本');
  assertNonNegative(serviceFeePerOrderTwd, '每筆站點服務收入');
  if (serviceFeePerOrderTwd <= 0) {
    return { ordersPerMonth: Number.POSITIVE_INFINITY, ordersPerDay: Number.POSITIVE_INFINITY, feasible: false };
  }
  const ordersPerMonth = Math.ceil(fixedMonthlyTwd / serviceFeePerOrderTwd);
  return {
    ordersPerMonth,
    ordersPerDay: Math.ceil(ordersPerMonth / daysPerMonth),
    feasible: Number.isFinite(ordersPerMonth),
  };
}

/** 總部固定費用除以每筆貢獻。 */
export function hqBreakEven(fixedMonthlyTwd: number, contributionPerOrderTwd: number, daysPerMonth = 30): BreakEven {
  assertNonNegative(fixedMonthlyTwd, '總部月固定費用');
  if (!Number.isFinite(contributionPerOrderTwd) || contributionPerOrderTwd <= 0) {
    return { ordersPerMonth: Number.POSITIVE_INFINITY, ordersPerDay: Number.POSITIVE_INFINITY, feasible: false };
  }
  const ordersPerMonth = Math.ceil(fixedMonthlyTwd / contributionPerOrderTwd);
  return {
    ordersPerMonth,
    ordersPerDay: Math.ceil(ordersPerMonth / daysPerMonth),
    feasible: true,
  };
}

export interface SensitivityRow {
  readonly contributionTwd: number;
  readonly ordersPerMonth: number;
  readonly ordersPerDay: number;
}

export function sensitivity(fixedMonthlyTwd: number, contributions: readonly number[], daysPerMonth = 30): readonly SensitivityRow[] {
  return contributions.map((contributionTwd) => {
    const result = hqBreakEven(fixedMonthlyTwd, contributionTwd, daysPerMonth);
    return { contributionTwd, ordersPerMonth: result.ordersPerMonth, ordersPerDay: result.ordersPerDay };
  });
}

/** 站點與總部兩端必須分別驗證，不以總部損益推論加盟站獲利。 */
export function twoSidedVerdict(station: BreakEven, hq: BreakEven): { readonly bothFeasible: boolean; readonly note: string } {
  const bothFeasible = station.feasible && hq.feasible;
  return {
    bothFeasible,
    note: bothFeasible
      ? '站點與總部兩端皆達損益兩平門檻；仍須以真實現金流驗證。'
      : '至少一端未達損益兩平；不得以另一端成果對外宣稱整體獲利。',
  };
}
