import { type Money, type FxRate, MoneyError, convert, money, roundHalfAwayFromZero, twd } from './money.ts';

/**
 * 定價規則。
 *
 * 關鍵區分：比例費率（金流手續費等隨售價變動的成本）與目標貢獻率是兩件事，
 * 不可把「目標貢獻率 25%」當成「成本加價 25%」。
 */

export interface PricingInputs {
  /** 固定型變動成本：日本購價換算、國際運費分攤、報關、包裝、臺灣配送補貼等不隨售價變動的部分。 */
  readonly fixedVariableCost: Money;
  /** 比例費率合計，例如金流 3% + 平臺 2% = 0.05。 */
  readonly proportionalRate: number;
  /** 目標貢獻率，例如 0.25。 */
  readonly targetContributionRate: number;
}

export interface PricingResult {
  readonly minimumSale: Money;
  readonly contribution: Money;
  readonly contributionRate: number;
  readonly proportionalFee: Money;
}

function assertRate(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new MoneyError(`${label} 必須介於 0（含）與 1（不含）之間，收到 ${value}`);
  }
}

/**
 * 最低售價 = 固定型變動成本 ÷ (1 − 比例費率 − 目標貢獻率)，向上取整元。
 * 例：固定成本 NT$250、比例費率 3%、目標貢獻率 25% → NT$348。
 */
export function minimumSalePrice(inputs: PricingInputs): PricingResult {
  const { fixedVariableCost, proportionalRate, targetContributionRate } = inputs;
  assertRate(proportionalRate, '比例費率');
  assertRate(targetContributionRate, '目標貢獻率');

  const denominator = 1 - proportionalRate - targetContributionRate;
  if (denominator <= 0) {
    throw new MoneyError(
      `比例費率 ${proportionalRate} 與目標貢獻率 ${targetContributionRate} 合計不可達 100%，無法計算最低售價`,
    );
  }
  if (fixedVariableCost.amount < 0) {
    throw new MoneyError('固定型變動成本不可為負數');
  }

  const raw = fixedVariableCost.amount / denominator;
  const minimumSale = money(Math.ceil(raw), fixedVariableCost.currency);
  const proportionalFee = money(roundHalfAwayFromZero(minimumSale.amount * proportionalRate), minimumSale.currency);
  const contribution = money(minimumSale.amount - fixedVariableCost.amount - proportionalFee.amount, minimumSale.currency);

  return {
    minimumSale,
    contribution,
    contributionRate: minimumSale.amount === 0 ? 0 : contribution.amount / minimumSale.amount,
    proportionalFee,
  };
}

export interface MaxPurchasePriceInputs {
  /** 可用的臺灣售價（已核准售價，不得再加價）。 */
  readonly salePrice: Money;
  /** 其他成本：臺灣配送補貼、包裝、金流比例費、預期行銷成本等。 */
  readonly otherCosts: Money;
  readonly targetContributionRate: number;
  /** 日圓 → 臺幣匯率版本。 */
  readonly fx: FxRate;
  /** 必要換算係數，例如含稅、代收服務費；預設 1。 */
  readonly conversionFactor?: number;
}

export interface MaxPurchasePriceResult {
  readonly maxPurchaseJpy: Money;
  readonly feasible: boolean;
  readonly reason?: string;
}

/**
 * 最高日本採購價 =（可用收入 − 其他成本 − 目標貢獻）÷ 採購匯率 ÷ 換算係數。
 * 結果為負數或進口條件未核准時不產生採購建議。
 */
export function maxPurchasePrice(inputs: MaxPurchasePriceInputs): MaxPurchasePriceResult {
  const { salePrice, otherCosts, targetContributionRate, fx } = inputs;
  const conversionFactor = inputs.conversionFactor ?? 1;
  assertRate(targetContributionRate, '目標貢獻率');
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new MoneyError(`換算係數必須大於零，收到 ${conversionFactor}`);
  }

  const targetContribution = roundHalfAwayFromZero(salePrice.amount * targetContributionRate);
  const availableTwd = salePrice.amount - otherCosts.amount - targetContribution;

  if (availableTwd <= 0) {
    return {
      maxPurchaseJpy: money(0, 'JPY'),
      feasible: false,
      reason: '扣除其他成本與目標貢獻後無可用採購預算',
    };
  }

  const availableJpy = convert(twd(availableTwd), { ...fx, from: 'TWD', to: 'JPY' });
  const maxPurchaseJpy = money(Math.floor(availableJpy.amount / conversionFactor), 'JPY');

  if (maxPurchaseJpy.amount <= 0) {
    return { maxPurchaseJpy, feasible: false, reason: '換算後採購價不足 1 日圓' };
  }
  return { maxPurchaseJpy, feasible: true };
}

/**
 * 落地變動成本彙總。可扣抵稅額、公司固定費用與不可扣抵成本的處理交由財務設定，
 * 這裡只負責把已設定的項目加總，避免重複計入。
 */
export interface LandedCostComponents {
  readonly purchaseJpy: Money;
  readonly fx: FxRate;
  readonly localShippingJpy: Money;
  readonly internationalShippingTwd: Money;
  readonly customsTwd: Money;
  readonly packagingTwd: Money;
  readonly twDeliverySubsidyTwd: Money;
  readonly paymentFeeTwd: Money;
  readonly expectedMarketingTwd: Money;
}

export function landedVariableCost(components: LandedCostComponents): Money {
  const purchaseTwd = convert(components.purchaseJpy, components.fx);
  const localShippingTwd = convert(components.localShippingJpy, components.fx);
  const total =
    purchaseTwd.amount +
    localShippingTwd.amount +
    components.internationalShippingTwd.amount +
    components.customsTwd.amount +
    components.packagingTwd.amount +
    components.twDeliverySubsidyTwd.amount +
    components.paymentFeeTwd.amount +
    components.expectedMarketingTwd.amount;
  return twd(total);
}

/** 價格變動是否超過送審門檻（預設 15%）。 */
export function exceedsPriceChangeThreshold(
  previousTwd: number,
  nextTwd: number,
  threshold = 0.15,
): boolean {
  if (previousTwd <= 0) return nextTwd > 0;
  return Math.abs(nextTwd - previousTwd) / previousTwd > threshold;
}
