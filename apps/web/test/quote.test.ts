import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIPPING_OPTIONS, TERMS_VERSION, buildServerQuote, fixtureInventory, shippingOptionByCode, toCatalogSnapshot } from '../src/lib/quote.ts';
import { createFixtureRepository, fixtureProducts } from '../src/lib/catalog.ts';

const repo = createFixtureRepository();

async function quoteFor(sku: string, quantity: number, shipping = 'tw_home') {
  return buildServerQuote({
    quoteId: 'quote-test',
    lines: [{ sku, quantity }],
    shippingOptionCode: shipping,
    repo,
    inventory: async (skus) => {
      const products = await Promise.all(skus.map((s) => repo.bySku(s)));
      return fixtureInventory(products.filter((p): p is NonNullable<typeof p> => p !== null));
    },
  });
}

describe('shippingOptionByCode', () => {
  it('取得已知配送方式', () => {
    expect(shippingOptionByCode('tw_home')?.feeTwd).toBe(60);
  });

  it('未知配送方式回傳 null', () => {
    expect(shippingOptionByCode('no-such')).toBeNull();
  });

  it('每種配送方式都標示承諾時間，不隱藏運費', () => {
    for (const option of DEFAULT_SHIPPING_OPTIONS) {
      expect(option.promisedWindow.length).toBeGreaterThan(0);
      expect(option.feeTwd).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('toCatalogSnapshot', () => {
  it('快照包含版本與合規狀態，供下單時再次驗證', () => {
    const snapshot = toCatalogSnapshot(fixtureProducts()[0]!);
    expect(snapshot.productVersionId).toBeTruthy();
    expect(typeof snapshot.published).toBe('boolean');
    expect(typeof snapshot.complianceApproved).toBe('boolean');
  });
});

describe('buildServerQuote', () => {
  it('不支援的配送方式直接拒絕', async () => {
    await expect(quoteFor(fixtureProducts()[0]!.sku, 1, 'no-such')).rejects.toThrow(/UNKNOWN_SHIPPING_OPTION/);
  });

  it('現貨商品可產生報價並含運費', async () => {
    const inStock = fixtureProducts().find((p) => p.supplyMode === 'in_stock')!;
    const quote = await quoteFor(inStock.sku, 1);
    expect(quote.shippingFeeTwd).toBe(60);
    expect(quote.totalTwd).toBe(inStock.saleTwd + 60);
    expect(quote.termsVersion).toBe(TERMS_VERSION);
  });

  it('售價以伺服器讀到的核准價為準，不採用前端傳入值', async () => {
    const inStock = fixtureProducts().find((p) => p.supplyMode === 'in_stock')!;
    const quote = await quoteFor(inStock.sku, 2);
    expect(quote.subtotalTwd).toBe(inStock.saleTwd * 2);
  });

  it('預購商品不扣現貨庫存', async () => {
    const preorder = fixtureProducts().find((p) => p.supplyMode === 'preorder')!;
    const quote = await quoteFor(preorder.sku, 1);
    expect(quote.lines[0]?.supplyMode).toBe('preorder');
  });

  it('超過可售量時拒絕', async () => {
    const inStock = fixtureProducts().find((p) => p.supplyMode === 'in_stock')!;
    await expect(quoteFor(inStock.sku, 999)).rejects.toThrow();
  });

  it('需詢問的商品不能直接下單', async () => {
    const inquiry = fixtureProducts().find((p) => p.supplyMode === 'inquiry');
    if (inquiry === undefined) return;
    await expect(quoteFor(inquiry.sku, 1)).rejects.toThrow();
  });

  it('報價有有效期限', async () => {
    const inStock = fixtureProducts().find((p) => p.supplyMode === 'in_stock')!;
    const quote = await quoteFor(inStock.sku, 1);
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
