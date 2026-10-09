import { describe, expect, it } from 'vitest';
import { MoneyError } from '../src/money.ts';
import {
  exceedsPriceChangeThreshold,
  landedVariableCost,
  maxPurchasePrice,
  minimumSalePrice,
} from '../src/pricing.ts';
import { jpy, twd } from '../src/money.ts';

describe('pricing', () => {
  it('規劃書範例：固定成本 250、比例費率 3%、貢獻率 25% → 最低售價 348', () => {
    const result = minimumSalePrice({
      fixedVariableCost: twd(250),
      proportionalRate: 0.03,
      targetContributionRate: 0.25,
    });
    expect(result.minimumSale.amount).toBe(348);
    expect(result.proportionalFee.amount).toBe(10);
    expect(result.contribution.amount).toBe(88);
  });

  it('區分比例費率與貢獻率，不當成成本加價 25%', () => {
    const asMarkup = minimumSalePrice({
      fixedVariableCost: twd(250),
      proportionalRate: 0,
      targetContributionRate: 0,
    });
    expect(asMarkup.minimumSale.amount).toBe(250);

    const withContribution = minimumSalePrice({
      fixedVariableCost: twd(250),
      proportionalRate: 0,
      targetContributionRate: 0.25,
    });
    expect(withContribution.minimumSale.amount).toBe(334);
  });

  it('費率與貢獻率合計達 100% 時拒絕計算', () => {
    expect(() =>
      minimumSalePrice({ fixedVariableCost: twd(250), proportionalRate: 0.5, targetContributionRate: 0.5 }),
    ).toThrow(MoneyError);
  });

  it('拒絕無效費率', () => {
    expect(() =>
      minimumSalePrice({ fixedVariableCost: twd(250), proportionalRate: -0.1, targetContributionRate: 0.25 }),
    ).toThrow(MoneyError);
    expect(() =>
      minimumSalePrice({ fixedVariableCost: twd(250), proportionalRate: 1, targetContributionRate: 0 }),
    ).toThrow(MoneyError);
  });

  it('最高採購價：成本高於可售價時不產生建議', () => {
    const result = maxPurchasePrice({
      salePrice: twd(300),
      otherCosts: twd(400),
      targetContributionRate: 0.25,
      fx: { rate: 0.21, from: 'TWD', to: 'JPY', effectiveDate: '2026-10-08' },
    });
    expect(result.feasible).toBe(false);
    expect(result.maxPurchaseJpy.amount).toBe(0);
    expect(result.reason).toBeDefined();
  });

  it('最高採購價：正常情況回傳整數日圓', () => {
    const result = maxPurchasePrice({
      salePrice: twd(1000),
      otherCosts: twd(200),
      targetContributionRate: 0.25,
      fx: { rate: 0.21, from: 'TWD', to: 'JPY', effectiveDate: '2026-10-08' },
    });
    expect(result.feasible).toBe(true);
    expect(Number.isInteger(result.maxPurchaseJpy.amount)).toBe(true);
    expect(result.maxPurchaseJpy.amount).toBeGreaterThan(0);
  });

  it('落地成本彙總含日圓換算', () => {
    const total = landedVariableCost({
      purchaseJpy: jpy(1000),
      fx: { rate: 0.21, from: 'JPY', to: 'TWD', effectiveDate: '2026-10-08' },
      localShippingJpy: jpy(500),
      internationalShippingTwd: twd(120),
      customsTwd: twd(30),
      packagingTwd: twd(20),
      twDeliverySubsidyTwd: twd(60),
      paymentFeeTwd: twd(10),
      expectedMarketingTwd: twd(50),
    });
    expect(total.amount).toBe(210 + 105 + 120 + 30 + 20 + 60 + 10 + 50);
  });

  it('變價門檻預設 15%', () => {
    expect(exceedsPriceChangeThreshold(1000, 1140)).toBe(false);
    expect(exceedsPriceChangeThreshold(1000, 1160)).toBe(true);
    expect(exceedsPriceChangeThreshold(1000, 840)).toBe(true);
    expect(exceedsPriceChangeThreshold(0, 1)).toBe(true);
  });
});
