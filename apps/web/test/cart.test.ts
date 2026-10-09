import { describe, expect, it } from 'vitest';
import { CART_MAX_LINES, addLine, assertCartValid, mergeLines, parseCart, removeLine, serializeCart, setQuantity, toQuoteInputs } from '../src/lib/cart.ts';

describe('parseCart', () => {
  it('未設定或空字串回傳空陣列', () => {
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart('')).toEqual([]);
  });

  it('解析合法內容', () => {
    expect(parseCart('[{"sku":"sku-a","quantity":2},{"sku":"sku-b","quantity":1}]')).toEqual([
      { sku: 'sku-a', quantity: 2 },
      { sku: 'sku-b', quantity: 1 },
    ]);
  });

  it('忽略數量非正整數的項目', () => {
    const raw = JSON.stringify([
      { sku: 'sku-a', quantity: 0 },
      { sku: 'sku-b', quantity: -1 },
      { sku: 'sku-c', quantity: 'abc' },
      { sku: 'sku-d', quantity: 3 },
    ]);
    expect(parseCart(raw)).toEqual([{ sku: 'sku-d', quantity: 3 }]);
  });

  it('忽略缺少 SKU 的項目', () => {
    expect(parseCart(JSON.stringify([{ quantity: 1 }, { sku: '  ', quantity: 1 }, { sku: 'sku-a', quantity: 1 }]))).toEqual([
      { sku: 'sku-a', quantity: 1 },
    ]);
  });

  it('內容不是合法 JSON 時回傳空陣列而非丟出例外', () => {
    expect(parseCart('not-json')).toEqual([]);
    expect(parseCart('{"sku":"a"}')).toEqual([]);
  });
});

describe('mergeLines', () => {
  it('相同 SKU 合併數量', () => {
    expect(mergeLines([{ sku: 'a', quantity: 1 }, { sku: 'a', quantity: 2 }])).toEqual([{ sku: 'a', quantity: 3 }]);
  });

  it('合併後超過單品上限時截到上限', () => {
    const merged = mergeLines([{ sku: 'a', quantity: 600 }, { sku: 'a', quantity: 600 }]);
    expect(merged[0]?.quantity).toBe(999);
  });
});

describe('serializeCart', () => {
  it('序列化後可再解析回相同內容', () => {
    const lines = [{ sku: 'sku-a', quantity: 2 }, { sku: 'sku-b', quantity: 5 }];
    expect(parseCart(serializeCart(lines))).toEqual(lines);
  });
});

describe('addLine / removeLine / setQuantity', () => {
  it('加入新商品', () => {
    expect(addLine([], 'a', 2)).toEqual([{ sku: 'a', quantity: 2 }]);
  });

  it('加入既有商品時累加', () => {
    expect(addLine([{ sku: 'a', quantity: 1 }], 'a', 2)).toEqual([{ sku: 'a', quantity: 3 }]);
  });

  it('數量為 0 或負數時不加入', () => {
    expect(addLine([], 'a', 0)).toEqual([]);
    expect(addLine([], 'a', -3)).toEqual([]);
  });

  it('刪除商品', () => {
    expect(removeLine([{ sku: 'a', quantity: 1 }, { sku: 'b', quantity: 1 }], 'a')).toEqual([{ sku: 'b', quantity: 1 }]);
  });

  it('設定數量為 0 等同刪除', () => {
    expect(setQuantity([{ sku: 'a', quantity: 3 }], 'a', 0)).toEqual([]);
  });

  it('設定數量', () => {
    expect(setQuantity([{ sku: 'a', quantity: 3 }], 'a', 7)).toEqual([{ sku: 'a', quantity: 7 }]);
  });
});

describe('assertCartValid', () => {
  it('超過行數上限時拒絕', () => {
    const lines = Array.from({ length: CART_MAX_LINES + 1 }, (_, i) => ({ sku: `sku-${i}`, quantity: 1 }));
    expect(() => assertCartValid(lines)).toThrow(/上限/);
  });

  it('空購物車時拒絕', () => {
    expect(() => assertCartValid([])).toThrow(/購物車為空/);
  });

  it('數量超過 999 時拒絕', () => {
    expect(() => assertCartValid([{ sku: 'a', quantity: 1000 }])).toThrow(/999/);
  });

  it('合法內容通過', () => {
    expect(() => assertCartValid([{ sku: 'a', quantity: 1 }])).not.toThrow();
  });
});

describe('toQuoteInputs', () => {
  it('轉成報價輸入', () => {
    expect(toQuoteInputs([{ sku: 'a', quantity: 2 }])).toEqual([{ sku: 'a', quantity: 2 }]);
  });
});
