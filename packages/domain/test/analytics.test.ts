import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type ConversionEvent,
  assertExportHasPurpose,
  attributeRefundToOriginalMonth,
  buildAttributionReport,
  classifyReconciliation,
  computeFunnelRates,
  computeRoasAndCac,
  dedupeEvents,
  netContribution,
  toPlatformPurchaseEvent,
} from '../src/analytics.ts';

describe('analytics 淨貢獻', () => {
  it('淨貢獻 = 已收款 − 退款 − 落地成本 − 金流費 − 運費補貼 − 廣告支出', () => {
    const result = netContribution({
      paidTwd: 10000,
      refundedTwd: 1000,
      paymentFeeTwd: 300,
      landedCostTwd: 5000,
      shippingSubsidyTwd: 200,
      adSpendTwd: 1000,
    });
    expect(result.netRevenue.amount).toBe(9000);
    expect(result.contribution.amount).toBe(9000 - 5000 - 300 - 200 - 1000);
    expect(result.contributionRate).toBeCloseTo(2500 / 9000, 10);
  });

  it('無收入時貢獻率為 0 而非 NaN', () => {
    const result = netContribution({
      paidTwd: 0,
      refundedTwd: 0,
      paymentFeeTwd: 0,
      landedCostTwd: 0,
      shippingSubsidyTwd: 0,
      adSpendTwd: 0,
    });
    expect(result.contributionRate).toBe(0);
  });
});

describe('analytics 歸因', () => {
  it('多平臺歸因收入不可直接加總為實際營收', () => {
    const report = buildAttributionReport(
      [
        { platform: 'facebook', attributedRevenueTwd: 5000, attributedOrders: 5, spendTwd: 1000, attributionWindowDays: 7, timeBasis: 'click' },
        { platform: 'chatgpt_ads', attributedRevenueTwd: 3000, attributedOrders: 3, spendTwd: 500, attributionWindowDays: 30, timeBasis: 'view' },
      ],
      6000,
    );
    expect(report.summedAttributedRevenueTwd).toBe(8000);
    expect(report.actualRevenueTwd).toBe(6000);
    expect(report.warning).toContain('不可直接加總');
  });

  it('零分母回傳 null，不回 Infinity 或 NaN', () => {
    const noSpend = computeRoasAndCac({ revenueTwd: 1000, spendTwd: 0, newCustomers: 5 });
    expect(noSpend.roas).toBeNull();
    expect(noSpend.cac).toBe(0);

    const noCustomers = computeRoasAndCac({ revenueTwd: 1000, spendTwd: 500, newCustomers: 0 });
    expect(noCustomers.roas).toBe(2);
    expect(noCustomers.cac).toBeNull();
  });

  it('漏斗比率零分母回傳 null', () => {
    const rates = computeFunnelRates({
      visitors: 1000,
      productViews: 0,
      addToCarts: 0,
      beginCheckouts: 0,
      paymentConfirmed: 0,
    });
    expect(rates.addToCartRate).toBeNull();
    expect(rates.checkoutRate).toBeNull();
    expect(rates.paymentSuccessRate).toBeNull();
  });

  it('漏斗比率正常計算', () => {
    const rates = computeFunnelRates({
      visitors: 1000,
      productViews: 500,
      addToCarts: 100,
      beginCheckouts: 50,
      paymentConfirmed: 40,
    });
    expect(rates.addToCartRate).toBeCloseTo(0.2, 10);
    expect(rates.checkoutRate).toBeCloseTo(0.5, 10);
    expect(rates.paymentSuccessRate).toBeCloseTo(0.8, 10);
  });
});

describe('analytics 轉換事件', () => {
  const event = (overrides: Partial<ConversionEvent> = {}): ConversionEvent => ({
    eventName: 'payment_confirmed',
    eventId: 'E-1',
    occurredAt: '2026-10-09T00:00:00Z',
    orderId: 'O-1',
    valueTwd: 1198,
    consentGranted: true,
    ...overrides,
  });

  it('只有已驗證付款且同意量測才送出 Purchase', () => {
    expect(toPlatformPurchaseEvent(event(), 'facebook')).toEqual({ send: true });
  });

  it('感謝頁瀏覽不算 Purchase', () => {
    const result = toPlatformPurchaseEvent(event({ eventName: 'begin_checkout' }), 'facebook');
    expect(result.send).toBe(false);
  });

  it('未同意量測不送出，但不影響訂單履行', () => {
    const result = toPlatformPurchaseEvent(event({ consentGranted: false }), 'facebook');
    expect(result.send).toBe(false);
    expect(result.reason).toContain('未同意量測');
  });

  it('缺少金額不送出', () => {
    expect(toPlatformPurchaseEvent(event({ valueTwd: null }), 'facebook').send).toBe(false);
    expect(toPlatformPurchaseEvent(event({ valueTwd: 0 }), 'facebook').send).toBe(false);
  });

  it('事件去重：同一 event_id 不重複送出', () => {
    const delivered = new Set(['E-1']);
    const result = dedupeEvents(delivered, [event(), event({ eventId: 'E-2' })]);
    expect(result.map((e) => e.eventId)).toEqual(['E-2']);
  });

  it('同批內重複 event_id 也只送一次', () => {
    const result = dedupeEvents(new Set(), [event(), event()]);
    expect(result).toHaveLength(1);
  });
});

describe('analytics 退款歸屬', () => {
  it('跨月退款歸屬到原交易月份', () => {
    const result = attributeRefundToOriginalMonth({
      amountTwd: 500,
      originalPaidAt: '2026-09-30T10:00:00Z',
      refundedAt: '2026-10-02T10:00:00Z',
    });
    expect(result.month).toBe('2026-09');
    expect(result.crossMonth).toBe(true);
  });

  it('同月退款不標記跨月', () => {
    const result = attributeRefundToOriginalMonth({
      amountTwd: 500,
      originalPaidAt: '2026-10-01T10:00:00Z',
      refundedAt: '2026-10-02T10:00:00Z',
    });
    expect(result.crossMonth).toBe(false);
  });
});

describe('analytics 對帳分類', () => {
  const base = {
    orderPaidTwd: 1000,
    providerReportedTwd: 1000,
    refundRequestedTwd: 0,
    refundCompletedTwd: 0,
    expectedFeeTwd: 30,
    actualFeeTwd: 30,
    settlementDays: 3,
    referenceId: 'O-1',
  };

  it('一致時無差異', () => {
    expect(classifyReconciliation(base)).toEqual([]);
  });

  it('已收未回報', () => {
    const diffs = classifyReconciliation({ ...base, providerReportedTwd: 800 });
    expect(diffs).toContainEqual({
      kind: 'paid_not_reported',
      referenceId: 'O-1',
      amountTwd: 200,
      note: '已收未回報，需向平臺查單',
    });
  });

  it('重複付款', () => {
    const diffs = classifyReconciliation({ ...base, providerReportedTwd: 2000 });
    expect(diffs.some((d) => d.kind === 'duplicate_payment')).toBe(true);
  });

  it('退款未完成', () => {
    const diffs = classifyReconciliation({ ...base, refundRequestedTwd: 500, refundCompletedTwd: 200 });
    expect(diffs).toContainEqual({
      kind: 'refund_incomplete',
      referenceId: 'O-1',
      amountTwd: 300,
      note: '退款未完成',
    });
  });

  it('手續費差異與撥款延遲', () => {
    const diffs = classifyReconciliation({ ...base, actualFeeTwd: 35, settlementDays: 10 });
    expect(diffs.some((d) => d.kind === 'fee_difference')).toBe(true);
    expect(diffs.some((d) => d.kind === 'settlement_delay')).toBe(true);
  });
});

describe('analytics 匯出', () => {
  it('匯出必須填寫用途與範圍', () => {
    expect(() => assertExportHasPurpose({ purpose: '', scope: 'orders' })).toThrow(AppError);
    expect(() => assertExportHasPurpose({ purpose: '月結', scope: '  ' })).toThrow(AppError);
    expect(() => assertExportHasPurpose({ purpose: '月結', scope: 'orders' })).not.toThrow();
  });
});
