import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type CatalogSnapshot,
  type InventorySnapshot,
  type QuoteLineInput,
  type ShippingOption,
  allocateShippingFee,
  assertQuoteUsable,
  assertRefundWithinAvailable,
  availableRefundAmount,
  buildQuote,
  decideReservationRelease,
  lockOrder,
  reservationExpiry,
  reservationRequestsFromQuote,
  validateLineInputs,
} from '../src/checkout.ts';
import { twd } from '../src/money.ts';

const now = new Date('2026-10-09T04:00:00Z');
const fresh = '2026-10-09T00:00:00Z';

function catalogOf(entries: readonly CatalogSnapshot[]): Map<string, CatalogSnapshot> {
  return new Map(entries.map((e) => [e.sku, e]));
}

function inventoryOf(entries: readonly InventorySnapshot[]): Map<string, InventorySnapshot> {
  return new Map(entries.map((e) => [e.sku, e]));
}

const inStock: CatalogSnapshot = {
  sku: 'SKU-A',
  productVersionId: 'v1',
  saleTwd: 599,
  supplyMode: 'in_stock',
  published: true,
  complianceApproved: true,
  sourceUpdatedAt: fresh,
  weightG: 450,
};

const preorder: CatalogSnapshot = {
  sku: 'SKU-B',
  productVersionId: 'v1',
  saleTwd: 1299,
  supplyMode: 'preorder',
  published: true,
  complianceApproved: true,
  sourceUpdatedAt: fresh,
  weightG: 800,
};

const shipping: ShippingOption = {
  code: 'jp_consolidation_3kg',
  label: '日臺集貨 3 公斤',
  feeTwd: 380,
  promisedWindow: '14-20 個工作天',
  allowsSplit: true,
};

function build(lines: readonly QuoteLineInput[], overrides: Partial<Parameters<typeof buildQuote>[0]> = {}) {
  return buildQuote({
    quoteId: 'Q-1',
    lines,
    catalog: catalogOf([inStock, preorder]),
    inventory: inventoryOf([
      { sku: 'SKU-A', onHand: 10, reserved: 2, preorderQuota: 0 },
      { sku: 'SKU-B', onHand: 0, reserved: 0, preorderQuota: 50 },
    ]),
    shippingOption: shipping,
    termsVersion: 'terms-2026-10',
    now,
    ...overrides,
  });
}

describe('checkout 輸入驗證', () => {
  it('拒絕空購物車', () => {
    expect(() => validateLineInputs([])).toThrow(AppError);
  });

  it('拒絕負數與零數量', () => {
    expect(() => validateLineInputs([{ sku: 'A', quantity: -1 }])).toThrow(AppError);
    expect(() => validateLineInputs([{ sku: 'A', quantity: 0 }])).toThrow(AppError);
    expect(() => validateLineInputs([{ sku: 'A', quantity: 1.5 }])).toThrow(AppError);
  });

  it('拒絕重複 SKU', () => {
    expect(() =>
      validateLineInputs([
        { sku: 'A', quantity: 1 },
        { sku: 'A', quantity: 2 },
      ]),
    ).toThrow(AppError);
  });

  it('拒絕空 SKU 與超量', () => {
    expect(() => validateLineInputs([{ sku: '  ', quantity: 1 }])).toThrow(AppError);
    expect(() => validateLineInputs([{ sku: 'A', quantity: 1000 }])).toThrow(AppError);
  });
});

describe('checkout 報價', () => {
  it('伺服器重新定價，忽略前端價格', () => {
    const quote = build([{ sku: 'SKU-A', quantity: 2 }]);
    expect(quote.lines[0]?.unitPriceTwd).toBe(599);
    expect(quote.subtotalTwd).toBe(1198);
    expect(quote.totalTwd).toBe(1198 + 380);
  });

  it('報價含 hash、條款版本與效期', () => {
    const quote = build([{ sku: 'SKU-A', quantity: 1 }]);
    expect(quote.quoteHash).toMatch(/^[0-9a-f]{16}$/);
    expect(quote.termsVersion).toBe('terms-2026-10');
    expect(new Date(quote.expiresAt).getTime() - new Date(quote.issuedAt).getTime()).toBe(15 * 60_000);
  });

  it('同輸入產生相同 quote hash（冪等）', () => {
    const a = build([{ sku: 'SKU-A', quantity: 1 }]);
    const b = build([{ sku: 'SKU-A', quantity: 1 }]);
    expect(a.quoteHash).toBe(b.quoteHash);
  });

  it('現貨超庫存被拒', () => {
    expect(() => build([{ sku: 'SKU-A', quantity: 9 }])).toThrow(AppError);
  });

  it('預購扣配額而非現貨', () => {
    const quote = build([{ sku: 'SKU-B', quantity: 5 }]);
    expect(quote.lines[0]?.supplyMode).toBe('preorder');
    expect(quote.subtotalTwd).toBe(1299 * 5);
  });

  it('預購超配額被拒', () => {
    expect(() => build([{ sku: 'SKU-B', quantity: 51 }])).toThrow(AppError);
  });

  it('已下架商品被拒', () => {
    expect(() =>
      build([{ sku: 'SKU-A', quantity: 1 }], {
        catalog: catalogOf([{ ...inStock, published: false }]),
      }),
    ).toThrow(AppError);
  });

  it('合規未核准被拒', () => {
    expect(() =>
      build([{ sku: 'SKU-A', quantity: 1 }], {
        catalog: catalogOf([{ ...inStock, complianceApproved: false }]),
      }),
    ).toThrow(AppError);
  });

  it('來源過期暫停即時供貨結帳', () => {
    expect(() =>
      build([{ sku: 'SKU-A', quantity: 1 }], {
        catalog: catalogOf([{ ...inStock, sourceUpdatedAt: '2026-10-01T00:00:00Z' }]),
      }),
    ).toThrow(AppError);
  });

  it('詢價商品不進報價明細，改列詢價清單', () => {
    const quote = build([{ sku: 'SKU-A', quantity: 1 }], {
      catalog: catalogOf([inStock, { ...preorder, sku: 'SKU-C', supplyMode: 'inquiry' }]),
      lines: [
        { sku: 'SKU-A', quantity: 1 },
        { sku: 'SKU-C', quantity: 1 },
      ],
    });
    expect(quote.inquirySkus).toEqual(['SKU-C']);
    expect(quote.lines.map((l) => l.sku)).toEqual(['SKU-A']);
  });

  it('全部詢價時拒絕直接收款', () => {
    expect(() =>
      build([{ sku: 'SKU-C', quantity: 1 }], {
        catalog: catalogOf([{ ...preorder, sku: 'SKU-C', supplyMode: 'inquiry' }]),
      }),
    ).toThrow(AppError);
  });

  it('找不到商品被拒', () => {
    expect(() => build([{ sku: 'NOPE', quantity: 1 }])).toThrow(AppError);
  });

  it('過期報價不可使用', () => {
    const quote = build([{ sku: 'SKU-A', quantity: 1 }]);
    expect(() => assertQuoteUsable(quote, new Date(new Date(quote.expiresAt).getTime() + 1))).toThrow(AppError);
    expect(() => assertQuoteUsable(quote, now)).not.toThrow();
  });
});

describe('checkout 鎖定順序與保留', () => {
  it('SKU 鎖定順序固定且去重', () => {
    expect(lockOrder(['B', 'A', 'C', 'A'])).toEqual(['A', 'B', 'C']);
  });

  it('組合訂單反向輸入得到相同鎖定順序', () => {
    const forward = lockOrder(['SKU-A', 'SKU-B']);
    const backward = lockOrder(['SKU-B', 'SKU-A']);
    expect(forward).toEqual(backward);
  });

  it('保留請求依固定順序產生', () => {
    const quote = build([
      { sku: 'SKU-B', quantity: 1 },
      { sku: 'SKU-A', quantity: 1 },
    ]);
    expect(reservationRequestsFromQuote(quote).map((r) => r.sku)).toEqual(['SKU-A', 'SKU-B']);
  });

  it('付款方式對應不同保留期限，ATM 不用 15 分鐘', () => {
    expect(reservationExpiry('credit_card', now).getTime() - now.getTime()).toBe(15 * 60_000);
    expect(reservationExpiry('atm', now).getTime() - now.getTime()).toBe(3 * 24 * 60 * 60_000);
    expect(reservationExpiry('cvs', now).getTime() - now.getTime()).toBe(7 * 24 * 60 * 60_000);
    expect(() => reservationExpiry('crypto', now)).toThrow(AppError);
  });

  it('逾期釋放前先檢查金流', () => {
    expect(decideReservationRelease({ paymentStatus: 'unpaid', paymentQueryPending: false })).toEqual({
      action: 'release',
    });
    expect(decideReservationRelease({ paymentStatus: 'paid', paymentQueryPending: false }).action).toBe('hold');
    expect(decideReservationRelease({ paymentStatus: 'processing', paymentQueryPending: false }).action).toBe('hold');
    expect(decideReservationRelease({ paymentStatus: 'unpaid', paymentQueryPending: true }).action).toBe('hold');
  });
});

describe('checkout 退款與運費分攤', () => {
  it('可退餘額不得為負', () => {
    expect(availableRefundAmount(1000, 300).amount).toBe(700);
    expect(() => availableRefundAmount(1000, 1200)).toThrow(AppError);
  });

  it('退款不得超過可退餘額', () => {
    expect(() => assertRefundWithinAvailable(701, twd(700))).toThrow(AppError);
    expect(() => assertRefundWithinAvailable(700, twd(700))).not.toThrow();
    expect(() => assertRefundWithinAvailable(0, twd(700))).toThrow(AppError);
    expect(() => assertRefundWithinAvailable(-1, twd(700))).toThrow(AppError);
  });

  it('運費分攤加總等於運費總額', () => {
    const parts = allocateShippingFee(380, [
      { sku: 'A', quantity: 1, unitPriceTwd: 599, lineTotalTwd: 599, productVersionId: 'v1', supplyMode: 'in_stock' },
      { sku: 'B', quantity: 1, unitPriceTwd: 1299, lineTotalTwd: 1299, productVersionId: 'v1', supplyMode: 'preorder' },
    ]);
    expect(parts.reduce((acc, p) => acc + p.amount, 0)).toBe(380);
  });
});
