import { describe, expect, it } from 'vitest';
import { CATEGORIES, ZONES, arrivalWindowFor, createFixtureRepository, fixtureProducts, matchesQuery, sortForStorefront, toPublicJson } from '../src/lib/catalog.ts';

describe('toPublicJson', () => {
  it('公開輸出不得包含任何成本欄位', () => {
    const json = toPublicJson(fixtureProducts()[0]!);
    const keys = Object.keys(json).join(',');
    expect(keys).not.toMatch(/cost/i);
    expect(keys).not.toMatch(/purchase/i);
    expect(keys).not.toMatch(/margin/i);
    expect(keys).not.toMatch(/supplier/i);
  });

  it('公開輸出包含售價與供貨方式', () => {
    const json = toPublicJson(fixtureProducts()[0]!);
    expect(typeof json.saleTwd).toBe('number');
    expect(typeof json.supplyMode).toBe('string');
  });
});

describe('arrivalWindowFor', () => {
  it('現貨標示可立即出貨', () => {
    expect(arrivalWindowFor('in_stock')).toMatch(/立即/);
  });

  it('預購標示需向日本下單', () => {
    expect(arrivalWindowFor('preorder')).toMatch(/日本/);
  });

  it('需詢問標示需先確認供貨', () => {
    expect(arrivalWindowFor('inquiry')).toMatch(/詢問|確認/);
  });
});

describe('matchesQuery', () => {
  const product = fixtureProducts()[0]!;

  it('無條件時全部符合', () => {
    expect(matchesQuery(product, {})).toBe(true);
  });

  it('分類不符時排除', () => {
    expect(matchesQuery(product, { category: '不存在的分類' })).toBe(false);
  });

  it('關鍵字可比對中文品名', () => {
    expect(matchesQuery(product, { keyword: product.titleZh.slice(0, 2) })).toBe(true);
  });

  it('關鍵字比對 SKU 時不分大小寫', () => {
    expect(matchesQuery(product, { keyword: product.sku.toUpperCase() })).toBe(true);
  });
});

describe('sortForStorefront', () => {
  it('現貨排在預購之前', () => {
    const sorted = sortForStorefront(fixtureProducts());
    const firstPreorder = sorted.findIndex((p) => p.supplyMode === 'preorder');
    const lastInStock = sorted.map((p) => p.supplyMode).lastIndexOf('in_stock');
    if (firstPreorder !== -1 && lastInStock !== -1) {
      expect(lastInStock).toBeLessThan(firstPreorder);
    }
  });

  it('不改變輸入陣列', () => {
    const input = fixtureProducts();
    const before = input.map((p) => p.sku);
    sortForStorefront(input);
    expect(input.map((p) => p.sku)).toEqual(before);
  });
});

describe('createFixtureRepository', () => {
  it('示範資料明確標示為 fixture', () => {
    expect(createFixtureRepository().kind).toBe('fixture');
  });

  it('可依 SKU 取得商品', async () => {
    const repo = createFixtureRepository();
    const first = fixtureProducts()[0]!;
    expect((await repo.bySku(first.sku))?.sku).toBe(first.sku);
  });

  it('查不到的 SKU 回傳 null', async () => {
    expect(await createFixtureRepository().bySku('no-such-sku')).toBeNull();
  });

  it('列出分類', async () => {
    expect(await createFixtureRepository().categories()).toEqual([...CATEGORIES]);
  });

  it('依分類篩選', async () => {
    const repo = createFixtureRepository();
    const category = fixtureProducts()[0]!.category;
    const list = await repo.list({ category });
    expect(list.every((p) => p.category === category)).toBe(true);
  });

  it('依專區篩選', async () => {
    const repo = createFixtureRepository();
    const list = await repo.list({ zone: ZONES[0] });
    expect(list.length).toBeGreaterThan(0);
  });

  it('限制筆數', async () => {
    expect((await createFixtureRepository().list({ limit: 2 })).length).toBeLessThanOrEqual(2);
  });
});
