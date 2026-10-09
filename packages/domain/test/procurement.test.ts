import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type PreorderDemand,
  type ReceiptLine,
  aggregatePreorderDemand,
  assertNoDuplicateReceipt,
  assertSeparateLedgers,
  evaluateReceipt,
  procurementCostTwd,
  purchaseOrderTotalJpy,
} from '../src/procurement.ts';
import { jpy } from '../src/money.ts';

const now = new Date('2026-10-09T00:00:00Z');

describe('procurement 預購需求彙總', () => {
  const demands: PreorderDemand[] = [
    { orderId: 'O1', orderLineId: 'L1', sku: 'SKU-A', quantity: 2, paidAt: '2026-10-08T00:00:00Z' },
    { orderId: 'O2', orderLineId: 'L2', sku: 'SKU-A', quantity: 3, paidAt: '2026-10-08T01:00:00Z' },
    { orderId: 'O3', orderLineId: 'L3', sku: 'SKU-B', quantity: 1, paidAt: '2026-10-08T02:00:00Z' },
  ];
  const suppliers = new Map([
    ['SKU-A', 'SUP-1'],
    ['SKU-B', 'SUP-1'],
  ]);

  it('按供應商與 SKU 彙總並保留原訂單分配', () => {
    const batches = aggregatePreorderDemand(demands, suppliers);
    expect(batches).toHaveLength(2);
    const a = batches.find((b) => b.sku === 'SKU-A')!;
    expect(a.totalQuantity).toBe(5);
    expect(a.allocations.map((x) => x.orderLineId)).toEqual(['L1', 'L2']);
    expect(a.allocations.reduce((acc, x) => acc + x.quantity, 0)).toBe(5);
  });

  it('未指定供應商被拒', () => {
    expect(() => aggregatePreorderDemand(demands, new Map([['SKU-A', 'SUP-1']]))).toThrow(AppError);
  });

  it('非正整數需求被拒', () => {
    expect(() =>
      aggregatePreorderDemand([{ ...demands[0]!, quantity: 0 }], suppliers),
    ).toThrow(AppError);
  });

  it('彙總結果排序穩定', () => {
    const a = aggregatePreorderDemand(demands, suppliers).map((b) => `${b.supplierId}:${b.sku}`);
    const b = aggregatePreorderDemand([...demands].reverse(), suppliers).map((x) => `${x.supplierId}:${x.sku}`);
    expect(a).toEqual(b);
  });
});

describe('procurement 採購單', () => {
  it('採購總額以日圓整數計算', () => {
    const total = purchaseOrderTotalJpy({
      purchaseOrderId: 'PO-1',
      supplierId: 'SUP-1',
      lines: [
        { sku: 'SKU-A', quantity: 10, unitPriceJpy: 1200 },
        { sku: 'SKU-B', quantity: 5, unitPriceJpy: 800 },
      ],
      approvedBy: 'owner-1',
      createdAt: '2026-10-09T00:00:00Z',
    });
    expect(total.amount).toBe(12000 + 4000);
    expect(total.currency).toBe('JPY');
  });

  it('拒絕非整數或負數採購數量與單價', () => {
    const base = {
      purchaseOrderId: 'PO-1',
      supplierId: 'SUP-1',
      approvedBy: 'owner-1',
      createdAt: '2026-10-09T00:00:00Z',
    };
    expect(() =>
      purchaseOrderTotalJpy({ ...base, lines: [{ sku: 'A', quantity: 0, unitPriceJpy: 100 }] }),
    ).toThrow(AppError);
    expect(() =>
      purchaseOrderTotalJpy({ ...base, lines: [{ sku: 'A', quantity: 1, unitPriceJpy: -1 }] }),
    ).toThrow(AppError);
    expect(() =>
      purchaseOrderTotalJpy({ ...base, lines: [{ sku: 'A', quantity: 1.5, unitPriceJpy: 100 }] }),
    ).toThrow(AppError);
  });
});

describe('procurement 實收檢查', () => {
  const line = (overrides: Partial<ReceiptLine> = {}): ReceiptLine => ({
    sku: 'SKU-A',
    orderedQuantity: 10,
    receivedQuantity: 10,
    lotNumber: 'LOT-1',
    expiryDate: '2027-12-31',
    damagedQuantity: 0,
    specMatches: true,
    ...overrides,
  });

  it('完全相符時無差異且可入庫', () => {
    const result = evaluateReceipt([line()], { now });
    expect(result.discrepancies).toEqual([]);
    expect(result.receivable).toEqual([
      { sku: 'SKU-A', quantity: 10, lotNumber: 'LOT-1', expiryDate: '2027-12-31' },
    ]);
    expect(result.requiresCustomerConsent).toBe(false);
  });

  it('短少、超收、破損分別記錄', () => {
    const result = evaluateReceipt(
      [
        line({ sku: 'A', receivedQuantity: 8 }),
        line({ sku: 'B', receivedQuantity: 12 }),
        line({ sku: 'C', damagedQuantity: 2 }),
      ],
      { now },
    );
    expect(result.discrepancies).toContainEqual({ kind: 'shortage', sku: 'A', missing: 2 });
    expect(result.discrepancies).toContainEqual({ kind: 'overage', sku: 'B', extra: 2 });
    expect(result.discrepancies).toContainEqual({ kind: 'damaged', sku: 'C', damaged: 2 });
  });

  it('破損數量不計入可入庫', () => {
    const result = evaluateReceipt([line({ receivedQuantity: 10, damagedQuantity: 3 })], { now });
    expect(result.receivable[0]?.quantity).toBe(7);
  });

  it('規格不符需客戶同意且不入庫', () => {
    const result = evaluateReceipt([line({ specMatches: false })], { now });
    expect(result.requiresCustomerConsent).toBe(true);
    expect(result.receivable).toEqual([]);
    expect(result.discrepancies).toContainEqual({ kind: 'spec_mismatch', sku: 'SKU-A' });
  });

  it('缺批號記錄差異', () => {
    const result = evaluateReceipt([line({ lotNumber: null })], { now });
    expect(result.discrepancies).toContainEqual({ kind: 'missing_lot', sku: 'SKU-A' });
  });

  it('效期過近記錄差異（預設 90 天）', () => {
    const result = evaluateReceipt([line({ expiryDate: '2026-11-01' })], { now });
    const expiring = result.discrepancies.find((d) => d.kind === 'expiring_soon');
    expect(expiring).toBeDefined();
    expect(result.discrepancies).toContainEqual({ kind: 'expiring_soon', sku: 'SKU-A', days: 23 });
  });

  it('效期充足不記錄差異', () => {
    const result = evaluateReceipt([line({ expiryDate: '2028-01-01' })], { now });
    expect(result.discrepancies.some((d) => d.kind === 'expiring_soon')).toBe(false);
  });

  it('可入庫數量為零時不產生入庫紀錄', () => {
    const result = evaluateReceipt([line({ receivedQuantity: 2, damagedQuantity: 2 })], { now });
    expect(result.receivable).toEqual([]);
  });
});

describe('procurement 重複入庫與分開記帳', () => {
  it('同一採購單同一批號不得重複入庫', () => {
    const existing = [{ purchaseOrderId: 'PO-1', lotNumber: 'LOT-1' }];
    expect(() => assertNoDuplicateReceipt(existing, { purchaseOrderId: 'PO-1', lotNumber: 'LOT-1' })).toThrow(AppError);
    expect(() =>
      assertNoDuplicateReceipt(existing, { purchaseOrderId: 'PO-1', lotNumber: 'LOT-2' }),
    ).not.toThrow();
    expect(() =>
      assertNoDuplicateReceipt(existing, { purchaseOrderId: 'PO-2', lotNumber: 'LOT-1' }),
    ).not.toThrow();
  });

  it('供應商付款重複記帳被拒', () => {
    expect(() =>
      assertSeparateLedgers([
        { kind: 'supplier_payment', referenceId: 'SP-1', amount: jpy(1000), occurredAt: '2026-10-09T00:00:00Z' },
        { kind: 'supplier_payment', referenceId: 'SP-1', amount: jpy(1000), occurredAt: '2026-10-09T01:00:00Z' },
      ]),
    ).toThrow(AppError);
  });

  it('客戶付款與供應商付款可並存', () => {
    expect(() =>
      assertSeparateLedgers([
        { kind: 'supplier_payment', referenceId: 'SP-1', amount: jpy(1000), occurredAt: '2026-10-09T00:00:00Z' },
        { kind: 'customer_payment', referenceId: 'SP-1', amount: jpy(1000), occurredAt: '2026-10-09T00:00:00Z' },
      ]),
    ).not.toThrow();
  });

  it('採購成本換算為臺幣整數', () => {
    const cost = procurementCostTwd(jpy(10000), jpy(500), 0.21);
    expect(cost.amount).toBe(Math.round(10500 * 0.21));
    expect(Number.isInteger(cost.amount)).toBe(true);
  });
});
