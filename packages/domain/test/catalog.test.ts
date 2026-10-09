import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type SourceRow,
  assertPublishable,
  diffCatalog,
  isSourceStale,
  normalizeJan,
  normalizeSourceRows,
  snapshotHash,
  sourceRowHash,
} from '../src/catalog.ts';

const baseRow: SourceRow = {
  product_code: 'P001',
  sku: 'SKU-001',
  jan: '4901234567894',
  title_zh: '保濕面膜 30 片',
  title_ja: '保湿マスク 30枚',
  category: '面膜',
  source_tags: ['好市多'],
  spec: '30 片/盒',
  units_per_pack: 30,
  cost_jpy: 1200,
  sale_twd: 599,
  weight_g: 450,
  origin: 'JP',
  supply_mode: '現貨',
  source_url: 'https://example.com/p/1',
  asset_id: 'drive-asset-1',
};

describe('catalog 正規化', () => {
  it('JAN 保留前導零且只接受 8 或 13 位', () => {
    expect(normalizeJan('01234567')).toBe('01234567');
    expect(normalizeJan(1234567)).toBeNull();
    expect(normalizeJan('4901234567894')).toBe('4901234567894');
    expect(normalizeJan('abc')).toBeNull();
    expect(normalizeJan(undefined)).toBeNull();
  });

  it('中文供貨模式與產地對映', () => {
    const result = normalizeSourceRows([baseRow]);
    expect(result.blocked).toBe(false);
    expect(result.products[0]?.supplyMode).toBe('in_stock');
    expect(result.products[0]?.origin).toBe('JP');
  });

  it('未知供貨模式預設為詢價', () => {
    const result = normalizeSourceRows([{ ...baseRow, supply_mode: '亂填' }]);
    expect(result.products[0]?.supplyMode).toBe('inquiry');
  });

  it('空表阻擋整批', () => {
    const result = normalizeSourceRows([]);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('空表');
  });

  it('讀一半（列數不符）阻擋整批', () => {
    const result = normalizeSourceRows([baseRow], { expectedRowCount: 5 });
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('讀取不完整');
  });

  it('必填欄位缺漏阻擋整批', () => {
    const result = normalizeSourceRows([{ ...baseRow, title_zh: '' }]);
    expect(result.blocked).toBe(true);
    expect(result.issues.some((i) => i.field === 'title_zh')).toBe(true);
  });

  it('重複 SKU 產生問題紀錄', () => {
    const result = normalizeSourceRows([baseRow, { ...baseRow, title_zh: '重複列' }]);
    expect(result.issues.some((i) => i.message.includes('SKU 重複'))).toBe(true);
  });

  it('非整數價格產生問題紀錄', () => {
    const result = normalizeSourceRows([{ ...baseRow, sale_twd: 599.5 }]);
    expect(result.issues.some((i) => i.field === 'sale_twd')).toBe(true);
  });

  it('負數價格產生問題紀錄', () => {
    const result = normalizeSourceRows([{ ...baseRow, cost_jpy: -1 }]);
    expect(result.issues.some((i) => i.field === 'cost_jpy')).toBe(true);
  });

  it('包裝數量必須大於零', () => {
    const result = normalizeSourceRows([{ ...baseRow, units_per_pack: 0 }]);
    expect(result.issues.some((i) => i.field === 'units_per_pack')).toBe(true);
  });
});

describe('catalog 雜湊與冪等', () => {
  it('逐列雜湊排除抓取時間，同批重跑相同', () => {
    const a = sourceRowHash({ ...baseRow, source_updated_at: '2026-10-08T00:00:00Z' });
    const b = sourceRowHash({ ...baseRow, source_updated_at: '2026-10-09T12:00:00Z' });
    expect(a).toBe(b);
  });

  it('業務欄位變動會改變雜湊', () => {
    expect(sourceRowHash(baseRow)).not.toBe(sourceRowHash({ ...baseRow, sale_twd: 600 }));
  });

  it('標籤順序不影響雜湊', () => {
    const a = sourceRowHash({ ...baseRow, source_tags: ['好市多', '面膜'] });
    const b = sourceRowHash({ ...baseRow, source_tags: ['面膜', '好市多'] });
    expect(a).toBe(b);
  });

  it('整批 snapshot 雜湊不受列序重排影響', () => {
    const second: SourceRow = { ...baseRow, sku: 'SKU-002', product_code: 'P002' };
    expect(snapshotHash([baseRow, second])).toBe(snapshotHash([second, baseRow]));
  });
});

describe('catalog 差異', () => {
  it('缺列只通知，不等於下架', () => {
    const previous = new Map([
      ['SKU-001', 'hash-a'],
      ['SKU-002', 'hash-b'],
    ]);
    const next = normalizeSourceRows([baseRow]).products;
    const diff = diffCatalog(previous, next);
    expect(diff.missing).toEqual(['SKU-002']);
    expect(diff.archiveRequested).toEqual([]);
  });

  it('明確 archive 才提出下架', () => {
    const previous = new Map([['SKU-001', 'hash-a']]);
    const next = normalizeSourceRows([baseRow]).products;
    const diff = diffCatalog(previous, next, ['SKU-001']);
    expect(diff.archiveRequested).toEqual(['SKU-001']);
  });

  it('新增、變更、未變更分類正確', () => {
    const next = normalizeSourceRows([baseRow]).products;
    const same = diffCatalog(new Map([['SKU-001', next[0]!.sourceHash]]), next);
    expect(same.unchanged).toEqual(['SKU-001']);

    const changed = diffCatalog(new Map([['SKU-001', 'old-hash']]), next);
    expect(changed.changed).toEqual(['SKU-001']);

    const added = diffCatalog(new Map(), next);
    expect(added.added).toEqual(['SKU-001']);
  });
});

describe('catalog 來源新鮮度與發布條件', () => {
  it('超過 48 小時視為過期', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect(isSourceStale('2026-10-09T00:00:00Z', now)).toBe(false);
    expect(isSourceStale('2026-10-06T00:00:00Z', now)).toBe(true);
    expect(isSourceStale(null, now)).toBe(true);
    expect(isSourceStale('不是日期', now)).toBe(true);
  });

  it('未核准不得發布', () => {
    const product = normalizeSourceRows([baseRow]).products[0]!;
    expect(() => assertPublishable(product, false)).toThrow(AppError);
    expect(() => assertPublishable(product, true)).not.toThrow();
  });

  it('詢價商品不得直接發布', () => {
    const product = normalizeSourceRows([{ ...baseRow, supply_mode: '詢價' }]).products[0]!;
    expect(() => assertPublishable(product, true)).toThrow(AppError);
  });

  it('缺少已核准售價不得發布', () => {
    const { sale_twd: _omitted, ...withoutSale } = baseRow;
    const product = normalizeSourceRows([withoutSale]).products[0]!;
    expect(() => assertPublishable(product, true)).toThrow(AppError);
  });
});
