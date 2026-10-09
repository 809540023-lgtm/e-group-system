import { describe, expect, it } from 'vitest';
import {
  createGoogleSourceAdapter,
  driveAssetProxyPath,
  isPublicDriveShareUrl,
  mapHeaders,
  sheetValuesToSourceRows,
  type GoogleSheetsValues,
} from '../src/google/index.ts';

const HEADERS = ['商品編號', 'SKU', 'JAN', '中文品名', '分類', '已核准售價', '日圓成本', '標籤', '供貨模式'];

function sheet(rows: readonly (readonly string[])[]): GoogleSheetsValues {
  return { range: 'ApprovedCatalog!A1:I', majorDimension: 'ROWS', values: [HEADERS, ...rows] };
}

describe('mapHeaders', () => {
  it('對映已知中文標題', () => {
    const { mapping, unknownHeaders, missingRequired } = mapHeaders(HEADERS);
    expect(mapping[0]).toBe('product_code');
    expect(mapping[1]).toBe('sku');
    expect(mapping[5]).toBe('sale_twd');
    expect(unknownHeaders).toEqual([]);
    expect(missingRequired).toEqual([]);
  });

  it('回報未知標題與缺少必要欄位', () => {
    const { unknownHeaders, missingRequired } = mapHeaders(['商品編號', '亂欄位']);
    expect(unknownHeaders).toEqual(['亂欄位']);
    expect(missingRequired).toContain('sku');
    expect(missingRequired).toContain('title_zh');
    expect(missingRequired).toContain('category');
  });

  it('重複標題只取第一次出現', () => {
    const { mapping } = mapHeaders(['商品編號', '商品代碼']);
    expect(mapping[0]).toBe('product_code');
    expect(mapping[1]).toBeUndefined();
  });
});

describe('sheetValuesToSourceRows', () => {
  it('轉換列並拆解標籤', () => {
    const result = sheetValuesToSourceRows(sheet([['P1', 'S1', '4901234567894', '測試品', '食品', '348', '1200', '好市多、日本', '現貨']]));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.source_tags).toEqual(['好市多', '日本']);
    expect(result.rows[0]?.sale_twd).toBe('348');
  });

  it('跳過整列空白並計數', () => {
    const result = sheetValuesToSourceRows(sheet([['', '', '', '', '', '', '', '', ''], ['P1', 'S1', '', '品', '食品', '100', '', '', '']]));
    expect(result.rows).toHaveLength(1);
    expect(result.skippedEmptyRows).toBe(1);
  });

  it('空表回報缺少全部必要欄位', () => {
    const result = sheetValuesToSourceRows({ range: 'x', majorDimension: 'ROWS', values: [] });
    expect(result.rows).toEqual([]);
    expect(result.missingRequired).toContain('product_code');
  });

  it('缺少欄位的列不填入 undefined 值', () => {
    const result = sheetValuesToSourceRows(sheet([['P1', 'S1', '', '品', '食品', '', '', '', '']]));
    expect(result.rows[0]).not.toHaveProperty('sale_twd');
    expect(result.rows[0]).not.toHaveProperty('jan');
  });
});

describe('createGoogleSourceAdapter', () => {
  it('無憑證時 capability 為 integration_pending 並列出缺少的 env', () => {
    const adapter = createGoogleSourceAdapter({ env: {} });
    const cap = adapter.capability();
    expect(cap.status).toBe('integration_pending');
    expect(cap.missingEnv).toContain('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  });

  it('無憑證時讀取回報 not_configured，不以假成功掩蓋', async () => {
    const adapter = createGoogleSourceAdapter({ env: {} });
    const result = await adapter.readApprovedCatalog({ spreadsheetId: 'S', range: 'A1:I' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });

  it('fixtures 模式可完整讀取並標記 mock', async () => {
    const adapter = createGoogleSourceAdapter({
      env: {},
      fixtures: { sheets: { 'S!A1:I': sheet([['P1', 'S1', '', '品', '食品', '100', '', '', '']]) } },
    });
    const result = await adapter.readApprovedCatalog({ spreadsheetId: 'S', range: 'A1:I' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.mode).toBe('mock');
    expect(result.value.values).toHaveLength(2);
  });

  it('fixtures 缺少範圍時回報 not_found', async () => {
    const adapter = createGoogleSourceAdapter({ env: {}, fixtures: { sheets: {} } });
    const result = await adapter.readApprovedCatalog({ spreadsheetId: 'S', range: 'A1:I' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_found');
  });

  it('Drive 檔案 metadata 含 version 供來源鎖使用', async () => {
    const adapter = createGoogleSourceAdapter({
      env: {},
      fixtures: {
        files: {
          F1: { id: 'F1', name: 'a.xlsx', mimeType: 'x', version: '42', modifiedTime: '2026-01-01T00:00:00Z', sizeBytes: 10 },
        },
      },
    });
    const result = await adapter.getDriveFile('F1');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.version).toBe('42');
  });

  it('已設定憑證時 capability 為 ready', () => {
    const adapter = createGoogleSourceAdapter({
      env: {
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'a@b.iam.gserviceaccount.com',
        GOOGLE_PRIVATE_KEY: 'key',
        GOOGLE_APPROVED_CATALOG_SHEET_ID: 'S',
      },
    });
    expect(adapter.capability().status).toBe('ready');
  });
});

describe('Drive 圖片存取', () => {
  it('分享頁 URL 不得當公開圖', () => {
    expect(isPublicDriveShareUrl('https://drive.google.com/file/d/abc/view')).toBe(true);
    expect(isPublicDriveShareUrl('https://docs.google.com/spreadsheets/d/abc')).toBe(true);
    expect(isPublicDriveShareUrl('/api/assets/abc')).toBe(false);
  });

  it('asset ID 轉為後端代理路徑', () => {
    expect(driveAssetProxyPath('abc/def')).toBe('/api/assets/abc%2Fdef');
  });
});
