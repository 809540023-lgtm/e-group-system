import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type Shipment,
  type ShippingRateCard,
  appendTrackingEvent,
  assertAllocationConserved,
  assertCustomsReady,
  chargeableWeightG,
  latestTrackingStatus,
  quoteShipping,
  requiresInquiry,
  volumetricWeightG,
} from '../src/shipping.ts';

const rateCard: ShippingRateCard = {
  version: 'jp-consolidation-2026-10',
  channel: 'jp_consolidation',
  volumetricDivisor: 6000,
  tiers: [
    { upToG: 1000, feeTwd: 250 },
    { upToG: 3000, feeTwd: 380 },
    { upToG: 5000, feeTwd: 520 },
    { upToG: null, feeTwd: 700 },
  ],
  minimumChargeTwd: 250,
  fuelSurchargeRate: 0.05,
  remoteAreaSurchargeTwd: 120,
  taxBurden: 'customer',
  effectiveFrom: '2026-10-01',
  effectiveTo: '2026-12-31',
  restrictedCategories: ['冷鏈', '肉品', '植物', '噴霧', '酒類', '電池'],
  maxWeightG: 20000,
  maxLongestSideCm: 120,
};

const now = new Date('2026-10-09T04:00:00Z');

describe('shipping 計價重量', () => {
  it('材積重 = 長×寬×高 ÷ 材積係數（cm³/kg），向上取整', () => {
    expect(volumetricWeightG({ lengthCm: 30, widthCm: 20, heightCm: 10 }, 6000)).toBe(1000);
    expect(volumetricWeightG({ lengthCm: 40, widthCm: 30, heightCm: 30 }, 6000)).toBe(6000);
  });

  it('計價重量取實重與材積重較大者', () => {
    const dims = { lengthCm: 40, widthCm: 30, heightCm: 30 };
    expect(chargeableWeightG(7000, dims, 6000)).toBe(7000);
    expect(chargeableWeightG(100, dims, 6000)).toBe(6000);
  });

  it('無尺寸時只用實重', () => {
    expect(chargeableWeightG(450, null, 6000)).toBe(450);
  });

  it('拒絕負實重與無效材積係數', () => {
    expect(() => chargeableWeightG(-1, null, 6000)).toThrow(AppError);
    expect(() => volumetricWeightG({ lengthCm: 1, widthCm: 1, heightCm: 1 }, 0)).toThrow(AppError);
  });
});

describe('shipping 報價', () => {
  it('3 公斤 20 天 NT$380 是特定方案，不是通用價', () => {
    const quote = quoteShipping({
      channel: 'jp_consolidation',
      actualWeightG: 3000,
      dimensions: null,
      destination: { city: '臺北市', isRemote: false },
      category: '面膜',
      rateCard,
      now,
    });
    expect(quote.baseFeeTwd).toBe(380);
    expect(quote.fuelSurchargeTwd).toBe(19);
    expect(quote.totalFeeTwd).toBe(399);
    expect(quote.rateCardVersion).toBe('jp-consolidation-2026-10');
  });

  it('低於最低收費時以最低收費計', () => {
    const quote = quoteShipping({
      channel: 'jp_consolidation',
      actualWeightG: 100,
      dimensions: null,
      destination: { city: '臺北市', isRemote: false },
      category: '面膜',
      rateCard: { ...rateCard, tiers: [{ upToG: null, feeTwd: 100 }] },
      now,
    });
    expect(quote.baseFeeTwd).toBe(250);
  });

  it('偏遠地區加收偏遠費', () => {
    const quote = quoteShipping({
      channel: 'jp_consolidation',
      actualWeightG: 3000,
      dimensions: null,
      destination: { city: '連江縣', isRemote: true },
      category: '面膜',
      rateCard,
      now,
    });
    expect(quote.remoteSurchargeTwd).toBe(120);
    expect(quote.totalFeeTwd).toBe(380 + 19 + 120);
  });

  it('限制品類標記例外但不直接拒收', () => {
    const quote = quoteShipping({
      channel: 'jp_consolidation',
      actualWeightG: 1000,
      dimensions: null,
      destination: { city: '臺北市', isRemote: false },
      category: '酒類',
      rateCard,
      now,
    });
    expect(quote.exceptions.some((e) => e.includes('限制品'))).toBe(true);
  });

  it('超重與超長邊標記例外', () => {
    const quote = quoteShipping({
      channel: 'jp_consolidation',
      actualWeightG: 25000,
      dimensions: { lengthCm: 200, widthCm: 10, heightCm: 10 },
      destination: { city: '臺北市', isRemote: false },
      category: '面膜',
      rateCard,
      now,
    });
    expect(quote.exceptions.some((e) => e.includes('超過上限'))).toBe(true);
    expect(quote.exceptions.some((e) => e.includes('最長邊'))).toBe(true);
  });

  it('費率版本與通路不符被拒', () => {
    expect(() =>
      quoteShipping({
        channel: 'jp_direct',
        actualWeightG: 1000,
        dimensions: null,
        destination: { city: '臺北市', isRemote: false },
        category: '面膜',
        rateCard,
        now,
      }),
    ).toThrow(AppError);
  });

  it('費率版本過期被拒', () => {
    expect(() =>
      quoteShipping({
        channel: 'jp_consolidation',
        actualWeightG: 1000,
        dimensions: null,
        destination: { city: '臺北市', isRemote: false },
        category: '面膜',
        rateCard,
        now: new Date('2027-01-01T00:00:00Z'),
      }),
    ).toThrow(AppError);
  });

  it('稅費負擔隨費率版本', () => {
    const quote = quoteShipping({
      channel: 'jp_consolidation',
      actualWeightG: 1000,
      dimensions: null,
      destination: { city: '臺北市', isRemote: false },
      category: '面膜',
      rateCard: { ...rateCard, taxBurden: 'seller' },
      now,
    });
    expect(quote.taxBurden).toBe('seller');
  });
});

describe('shipping 詢價判定', () => {
  it('未知重量或尺寸需詢價', () => {
    expect(requiresInquiry({ actualWeightG: null, dimensions: null, category: '面膜', rateCard })).toBe(true);
    expect(requiresInquiry({ actualWeightG: 0, dimensions: null, category: '面膜', rateCard })).toBe(true);
    expect(
      requiresInquiry({ actualWeightG: 500, dimensions: null, category: '面膜', rateCard }),
    ).toBe(true);
  });

  it('限制品類需詢價', () => {
    expect(
      requiresInquiry({
        actualWeightG: 500,
        dimensions: { lengthCm: 10, widthCm: 10, heightCm: 10 },
        category: '電池',
        rateCard,
      }),
    ).toBe(true);
  });

  it('條件完整且非限制品不需詢價', () => {
    expect(
      requiresInquiry({
        actualWeightG: 500,
        dimensions: { lengthCm: 10, widthCm: 10, heightCm: 10 },
        category: '面膜',
        rateCard,
      }),
    ).toBe(false);
  });
});

describe('shipping 分批出貨與追蹤', () => {
  const ordered = new Map([
    ['L1', 3],
    ['L2', 1],
  ]);

  it('分批出貨數量守恆', () => {
    const shipments: Shipment[] = [
      { shipmentId: 'S1', trackingNo: 'T1', items: [{ orderLineId: 'L1', sku: 'A', quantity: 2 }], status: 'shipped' },
      { shipmentId: 'S2', trackingNo: 'T2', items: [{ orderLineId: 'L1', sku: 'A', quantity: 1 }], status: 'packed' },
    ];
    expect(() => assertAllocationConserved(ordered, shipments)).not.toThrow();
  });

  it('超量出貨被拒', () => {
    const shipments: Shipment[] = [
      { shipmentId: 'S1', trackingNo: 'T1', items: [{ orderLineId: 'L1', sku: 'A', quantity: 4 }], status: 'shipped' },
    ];
    expect(() => assertAllocationConserved(ordered, shipments)).toThrow(AppError);
  });

  it('不屬於此訂單的明細被拒', () => {
    const shipments: Shipment[] = [
      { shipmentId: 'S1', trackingNo: 'T1', items: [{ orderLineId: 'L9', sku: 'X', quantity: 1 }], status: 'shipped' },
    ];
    expect(() => assertAllocationConserved(ordered, shipments)).toThrow(AppError);
  });

  it('追蹤事件 append-only，重複不覆蓋', () => {
    const first = appendTrackingEvent([], {
      shipmentId: 'S1',
      status: 'shipped',
      occurredAt: '2026-10-09T00:00:00Z',
      source: 'carrier',
    });
    const second = appendTrackingEvent(first, {
      shipmentId: 'S1',
      status: 'customs',
      occurredAt: '2026-10-11T00:00:00Z',
      source: 'carrier',
    });
    expect(second).toHaveLength(2);

    const duplicate = appendTrackingEvent(second, {
      shipmentId: 'S1',
      status: 'customs',
      occurredAt: '2026-10-11T00:00:00Z',
      source: 'carrier',
    });
    expect(duplicate).toHaveLength(2);
  });

  it('最新狀態依發生時間而非插入順序', () => {
    const events = [
      { shipmentId: 'S1', status: 'delivered', occurredAt: '2026-10-15T00:00:00Z', source: 'c' },
      { shipmentId: 'S1', status: 'shipped', occurredAt: '2026-10-09T00:00:00Z', source: 'c' },
    ];
    expect(latestTrackingStatus(events)).toBe('delivered');
    expect(latestTrackingStatus([])).toBeNull();
  });
});

describe('shipping 報關', () => {
  it('個人直寄需報關資料與 EZ WAY 委任', () => {
    expect(() =>
      assertCustomsReady({ channel: 'jp_direct', customsIdProvided: false, ezWayDelegationConfirmed: false }),
    ).toThrow(AppError);
    expect(() =>
      assertCustomsReady({ channel: 'jp_direct', customsIdProvided: true, ezWayDelegationConfirmed: false }),
    ).toThrow(AppError);
    expect(() =>
      assertCustomsReady({ channel: 'jp_direct', customsIdProvided: true, ezWayDelegationConfirmed: true }),
    ).not.toThrow();
  });

  it('集貨通路不需個別報關委任', () => {
    expect(() =>
      assertCustomsReady({ channel: 'jp_consolidation', customsIdProvided: false, ezWayDelegationConfirmed: false }),
    ).not.toThrow();
  });
});
