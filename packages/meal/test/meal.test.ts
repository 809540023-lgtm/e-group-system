import { describe, expect, it } from 'vitest';
import {
  allocate,
  checkLabel,
  computeOrderTotals,
  computeSettlement,
  evaluateReferral,
  evaluateTemperature,
  forecastDemand,
  hqBreakEven,
  isSaleBlocked,
  matchAllergens,
  nearExpirySuggestions,
  scoreStation,
  stationBreakEven,
  unitEconomics,
  canDeliver,
  generatePickupCode,
  hashPickupCode,
  verifyPickupCode,
  pickupExpiry,
  buildRecallPlan,
  canCloseRecall,
  assertAiActionAllowed,
  detectAnomalies,
  assertNoOversell,
  assertRefundable,
  canTransition,
  twd,
} from '../src/index.ts';

describe('money', () => {
  it('allocates without losing a dollar', () => {
    const parts = allocate(twd(100), [1, 1, 1]);
    expect(parts.map((p) => p.amount).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('rejects non-integer amounts', () => {
    expect(() => twd(1.5)).toThrow();
  });
});

describe('nutrition', () => {
  const base = {
    sku: 'SKU-1',
    name: '舒肥雞胸',
    nutrition: { servingG: 200, calories: 300, proteinG: 40, fatG: 8, carbsG: 20, sodiumMg: 300 },
    allergens: ['大豆'],
    storage: 'chilled' as const,
    shelfLifeDays: 5,
    heatingInstructions: '微波 2 分鐘',
    claims: ['高蛋白'],
  };

  it('accepts a valid high-protein label', () => {
    const result = checkLabel(base);
    expect(result.ok).toBe(true);
  });

  it('blocks a high-protein claim that does not meet thresholds', () => {
    const result = checkLabel({ ...base, nutrition: { ...base.nutrition, proteinG: 5 } });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'HIGH_PROTEIN_NOT_MET')).toBe(true);
  });

  it('blocks disease treatment claims', () => {
    const result = checkLabel({ ...base, claims: ['可治療糖尿病'] });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'FORBIDDEN_CLAIM')).toBe(true);
  });

  it('matches customer allergens', () => {
    expect(matchAllergens(['大豆', '蛋'], ['蛋', '花生'])).toEqual(['蛋']);
  });
});

describe('station scoring', () => {
  it('disqualifies unsafe venues regardless of score', () => {
    const result = scoreStation({
      id: 'S1',
      name: '測試站',
      type: 'A',
      demandScore: 30,
      costScore: 20,
      coldChainScore: 20,
      replenishmentScore: 15,
      competitionScore: 15,
      foodSafetyPass: false,
      venuePass: true,
    });
    expect(result.total).toBe(100);
    expect(result.eligible).toBe(false);
    expect(result.grade).toBe('D');
  });
});

describe('economics', () => {
  it('matches the plan example contribution of 45', () => {
    const result = unitEconomics({
      revenueTwd: 200,
      productCostTwd: 100,
      coldChainTwd: 12,
      packagingTwd: 5,
      stationServiceTwd: 20,
      paymentTwd: 4,
      wasteReserveTwd: 6,
      referralTwd: 8,
    });
    expect(result.contributionTwd).toBe(45);
  });

  it('computes station break-even at 1500 orders per month', () => {
    expect(stationBreakEven(30_000, 20).ordersPerMonth).toBe(1500);
    expect(stationBreakEven(30_000, 20).ordersPerDay).toBe(50);
  });

  it('computes HQ break-even at 6667 orders per month', () => {
    expect(hqBreakEven(300_000, 45).ordersPerMonth).toBe(6667);
  });
});

describe('pickup code', () => {
  it('generates six digits and verifies with HMAC', () => {
    const code = generatePickupCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = hashPickupCode(code, 'secret');
    expect(verifyPickupCode(code, hash, 'secret')).toBe(true);
    expect(verifyPickupCode('000000', hash, 'secret')).toBe(false);
  });

  it('rejects reused, expired, recalled and cancelled codes', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    const base = {
      codeHash: 'x',
      usedAt: null,
      expiresAt: pickupExpiry(now),
      orderStatus: 'ready',
      recalled: false,
    };
    expect(canDeliver(base, now).ok).toBe(true);
    expect(canDeliver({ ...base, usedAt: now.toISOString() }, now).ok).toBe(false);
    expect(canDeliver({ ...base, recalled: true }, now).ok).toBe(false);
    expect(canDeliver({ ...base, orderStatus: 'cancelled' }, now).ok).toBe(false);
    expect(canDeliver({ ...base, expiresAt: '2026-10-23T00:00:00Z' }, now).ok).toBe(false);
  });
});

describe('referral', () => {
  const base = {
    referrerCustomerId: 'c1',
    refereeCustomerId: 'c2',
    orderId: 'o1',
    orderPaid: true,
    orderDelivered: true,
    orderRefunded: false,
    orderAmountTwd: 200,
    rewardTwd: 20,
    perOrderCapTwd: 50,
    monthlyBudgetRemainingTwd: 1000,
    priorClaimsForOrder: 0,
    priorClaimsByReferee: 0,
    sameDevice: false,
    samePhone: false,
    sameAddress: false,
  };

  it('approves a valid single-level referral', () => {
    expect(evaluateReferral(base).approved).toBe(true);
  });

  it('blocks self-referral and duplicate claims', () => {
    expect(evaluateReferral({ ...base, refereeCustomerId: 'c1' }).approved).toBe(false);
    expect(evaluateReferral({ ...base, priorClaimsForOrder: 1 }).approved).toBe(false);
    expect(evaluateReferral({ ...base, orderRefunded: true }).approved).toBe(false);
  });
});

describe('recall', () => {
  it('blocks all sales channels for an open recall', () => {
    const result = isSaleBlocked({
      sku: 'SKU-1',
      batchId: 'B1',
      recalls: [{ id: 'r1', sku: 'SKU-1', batchId: 'B1', status: 'open', reason: '溫度異常', startedAt: '2026-10-24' }],
      productStatus: 'active',
      batchStatus: 'available',
    });
    expect(result.blocked).toBe(true);
  });

  it('builds a plan and requires all orders handled before closing', () => {
    const plan = buildRecallPlan({
      recall: { id: 'r1', sku: 'SKU-1', batchId: 'B1', status: 'open', reason: '檢驗不合格', startedAt: '2026-10-24' },
      orders: [
        { orderId: 'o1', customerId: 'c1', stationId: 's1', status: 'delivered', quantity: 1 },
        { orderId: 'o2', customerId: 'c2', stationId: 's1', status: 'cancelled', quantity: 1 },
      ],
      stations: [{ stationId: 's1', name: '站點', onHand: 3 }],
    });
    expect(plan.affectedOrders).toHaveLength(1);
    expect(canCloseRecall(plan, []).ok).toBe(false);
    expect(canCloseRecall(plan, ['o1']).ok).toBe(true);
  });
});

describe('temperature', () => {
  it('flags frozen breach above -15C', () => {
    expect(evaluateTemperature({ storage: 'frozen', tempC: -10, durationMinutes: 5 }).status).toBe('breach');
  });

  it('warns on short chilled excursion', () => {
    expect(evaluateTemperature({ storage: 'chilled', tempC: 9, durationMinutes: 10 }).status).toBe('warning');
    expect(evaluateTemperature({ storage: 'chilled', tempC: 9, durationMinutes: 40 }).status).toBe('breach');
  });
});

describe('forecast', () => {
  it('forecasts a horizon from history', () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      quantity: 10 + (i % 7),
    }));
    const result = forecastDemand(history, 3);
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.quantity >= 0)).toBe(true);
  });

  it('suggests scrap for expired batches', () => {
    const result = nearExpirySuggestions(
      [{ batchId: 'b1', sku: 's1', stationId: 'st1', quantity: 2, expiresOn: '2026-10-23', unitPriceTwd: 200 }],
      new Date('2026-10-24T00:00:00Z'),
    );
    expect(result[0]?.action).toBe('donate_or_scrap');
  });
});

describe('orders', () => {
  it('computes totals server-side', () => {
    const totals = computeOrderTotals([{ sku: 'a', quantity: 2, unitPriceTwd: 200 }], 12, 20);
    expect(totals.totalTwd).toBe(432);
  });

  it('prevents oversell and over-refund', () => {
    expect(() => assertNoOversell('a', 2, 1, 0)).toThrow();
    expect(() => assertRefundable(200, 100, 150)).toThrow();
  });

  it('enforces the order state machine', () => {
    expect(canTransition('paid', 'preparing')).toBe(true);
    expect(canTransition('delivered', 'ready')).toBe(false);
  });
});

describe('settlement', () => {
  it('deduplicates delivered orders and applies deductions', () => {
    const result = computeSettlement({
      stationId: 's1',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      deliveredOrderIds: ['o1', 'o1', 'o2'],
      serviceFeePerOrderTwd: 20,
      qualityBonusTwd: 100,
      deductions: [{ reason: '溫控缺失', amountTwd: 50 }],
    });
    expect(result.deliveredCount).toBe(2);
    expect(result.netTwd).toBe(90);
  });
});

describe('ai guardrails', () => {
  it('blocks forbidden actions', () => {
    expect(() => assertAiActionAllowed('lift_recall')).toThrow();
    expect(() => assertAiActionAllowed('forecast_demand')).not.toThrow();
  });

  it('detects anomalies', () => {
    const alerts = detectAnomalies([{ name: '報廢率', value: 6, threshold: 3, direction: 'above', unit: '%' }]);
    expect(alerts[0]?.severity).toBe('critical');
  });
});
