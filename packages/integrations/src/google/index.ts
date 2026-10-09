/**
 * Google 來源 adapter（規劃書 02、03、04 章；模組 04）。
 *
 * 責任分工：Google Drive 是商品來源（DM、圖片、Excel、ApprovedCatalog），
 * 不是訂單或庫存來源。本 adapter 只讀已核准來源，使用最小權限服務帳號。
 *
 * 沒有真實憑證時：回傳 `not_configured`，狀態 `integration_pending`，
 * 並提供 fixtures 讓上層流程與測試可完整執行。
 */

import type { SourceRow } from '@jp/domain';
import {
  type AdapterCapability,
  type AdapterResult,
  err,
  notConfigured,
  ok,
  readEnv,
} from '../contract.ts';

export const GOOGLE_ENV_NAMES = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_APPROVED_CATALOG_SHEET_ID',
] as const;

export interface GoogleSheetsRange {
  readonly spreadsheetId: string;
  readonly range: string;
}

export interface GoogleSheetsValues {
  readonly range: string;
  readonly majorDimension: 'ROWS';
  readonly values: readonly (readonly string[])[];
}

export interface GoogleDriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly version: string;
  readonly modifiedTime: string;
  readonly sizeBytes: number | null;
}

export interface GoogleSourceAdapter {
  capability(): AdapterCapability;
  /** 讀取 ApprovedCatalog 工作表；第一列為中文欄位標題。 */
  readApprovedCatalog(range: GoogleSheetsRange): Promise<AdapterResult<GoogleSheetsValues>>;
  /** 取得 Drive 檔案 metadata（含 version，供來源鎖使用）。 */
  getDriveFile(fileId: string): Promise<AdapterResult<GoogleDriveFile>>;
  /** 下載 XLSX 位元組；呼叫端負責解析，不在此處轉成商品。 */
  downloadXlsx(fileId: string): Promise<AdapterResult<Uint8Array>>;
}

/** 中文欄位標題 → SourceRow 欄位。既有來源表已使用這些標題。 */
export const APPROVED_CATALOG_HEADERS: Readonly<Record<string, keyof SourceRow>> = {
  商品編號: 'product_code',
  商品代碼: 'product_code',
  SKU: 'sku',
  規格編號: 'sku',
  JAN: 'jan',
  條碼: 'jan',
  中文品名: 'title_zh',
  品名: 'title_zh',
  日文品名: 'title_ja',
  分類: 'category',
  標籤: 'source_tags',
  規格: 'spec',
  入數: 'units_per_pack',
  每包數量: 'units_per_pack',
  日圓成本: 'cost_jpy',
  成本日圓: 'cost_jpy',
  已核准售價: 'sale_twd',
  售價: 'sale_twd',
  重量: 'weight_g',
  尺寸: 'dimensions',
  產地: 'origin',
  供貨模式: 'supply_mode',
  來源網址: 'source_url',
  圖片ID: 'asset_id',
  來源更新時間: 'source_updated_at',
};

export interface HeaderMappingResult {
  readonly mapping: Readonly<Record<number, keyof SourceRow>>;
  readonly unknownHeaders: readonly string[];
  readonly missingRequired: readonly string[];
}

const REQUIRED_FIELDS: readonly (keyof SourceRow)[] = ['product_code', 'sku', 'title_zh', 'category'];

/**
 * 建立欄位對映。錯欄位必須阻擋整批，因此未知標題與缺少必要欄位都要回報。
 */
export function mapHeaders(headers: readonly string[]): HeaderMappingResult {
  const mapping: Record<number, keyof SourceRow> = {};
  const unknownHeaders: string[] = [];
  const seen = new Set<keyof SourceRow>();
  headers.forEach((raw, index) => {
    const key = raw.trim();
    const field = APPROVED_CATALOG_HEADERS[key];
    if (field === undefined) {
      if (key !== '') unknownHeaders.push(key);
      return;
    }
    if (seen.has(field)) return;
    seen.add(field);
    mapping[index] = field;
  });
  const missingRequired = REQUIRED_FIELDS.filter((f) => !seen.has(f));
  return { mapping, unknownHeaders, missingRequired };
}

export interface SheetToRowsResult {
  readonly rows: readonly SourceRow[];
  readonly unknownHeaders: readonly string[];
  readonly missingRequired: readonly string[];
  readonly skippedEmptyRows: number;
}

/**
 * 把工作表值轉成 SourceRow。空表、缺少必要欄位、整列空白都要明確處理，
 * 由 `normalizeSourceRows` 決定是否阻擋整批。
 */
export function sheetValuesToSourceRows(values: GoogleSheetsValues): SheetToRowsResult {
  const headerRow = values.values[0];
  if (headerRow === undefined) {
    return {
      rows: [],
      unknownHeaders: [],
      missingRequired: [...REQUIRED_FIELDS],
      skippedEmptyRows: 0,
    };
  }
  const { mapping, unknownHeaders, missingRequired } = mapHeaders(headerRow);
  const rows: SourceRow[] = [];
  let skippedEmptyRows = 0;

  for (const raw of values.values.slice(1)) {
    if (raw.every((cell) => cell.trim() === '')) {
      skippedEmptyRows += 1;
      continue;
    }
    const draft: Record<string, unknown> = {};
    for (const [indexText, field] of Object.entries(mapping)) {
      const cell = raw[Number(indexText)];
      if (cell === undefined) continue;
      const trimmed = cell.trim();
      if (trimmed === '') continue;
      draft[field] =
        field === 'source_tags'
          ? trimmed
              .split(/[、,;|]/)
              .map((t) => t.trim())
              .filter((t) => t !== '')
          : trimmed;
    }
    rows.push(draft as unknown as SourceRow);
  }

  return { rows, unknownHeaders, missingRequired, skippedEmptyRows };
}

export interface GoogleAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  /** 測試或離線示範用 fixtures；設定後即為 mock 模式。 */
  readonly fixtures?: {
    readonly sheets?: Readonly<Record<string, GoogleSheetsValues>>;
    readonly files?: Readonly<Record<string, GoogleDriveFile>>;
    readonly xlsx?: Readonly<Record<string, Uint8Array>>;
  };
}

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';

export function createGoogleSourceAdapter(options: GoogleAdapterOptions = {}): GoogleSourceAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fixtures = options.fixtures;
  const { missing } = readEnv(GOOGLE_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;

  const capability = (): AdapterCapability => ({
    name: 'google_source',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；真實 Google 憑證未設定，外部驗收為 integration_pending。'
      : missing.length === 0
        ? '已設定服務帳號；仍須以當日官方文件核對 Sheets/Drive 版本。'
        : '缺少服務帳號憑證，僅能使用 fixtures。',
  });

  async function accessToken(): Promise<AdapterResult<string>> {
    if (mockMode) return ok('mock-token', 'mock');
    if (missing.length > 0) return notConfigured(missing);
    // 真實 OAuth2 JWT 交換需在部署環境以官方套件完成；此處明確回報未實作，
    // 不以假 token 掩蓋缺口。
    return err(
      'unsupported',
      '服務帳號 JWT 交換需在部署環境以官方 google-auth 套件完成；本 adapter 不自行實作簽章。',
      { retryable: false },
    );
  }

  return {
    capability,

    async readApprovedCatalog(range) {
      if (mockMode) {
        const fixture =
          fixtures.sheets?.[`${range.spreadsheetId}!${range.range}`] ?? fixtures.sheets?.[range.range];
        if (fixture === undefined) {
          return err('not_found', `fixtures 沒有 ${range.spreadsheetId}!${range.range}`, { mode: 'mock' });
        }
        return ok(fixture, 'mock');
      }
      const token = await accessToken();
      if (!token.ok) return token;
      const url = `${SHEETS_BASE}/${encodeURIComponent(range.spreadsheetId)}/values/${encodeURIComponent(range.range)}?majorDimension=ROWS`;
      try {
        const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token.value}` } });
        if (!response.ok) {
          return err('provider_error', `Sheets 回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        const body = (await response.json()) as GoogleSheetsValues;
        return ok(body);
      } catch (cause) {
        return err('network_error', `Sheets 連線失敗：${String(cause)}`, { retryable: true });
      }
    },

    async getDriveFile(fileId) {
      if (mockMode) {
        const fixture = fixtures.files?.[fileId];
        if (fixture === undefined) return err('not_found', `fixtures 沒有檔案 ${fileId}`, { mode: 'mock' });
        return ok(fixture, 'mock');
      }
      const token = await accessToken();
      if (!token.ok) return token;
      const url = `${DRIVE_BASE}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,version,modifiedTime,size&supportsAllDrives=true`;
      try {
        const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token.value}` } });
        if (!response.ok) {
          return err('provider_error', `Drive 回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        const body = (await response.json()) as {
          id: string;
          name: string;
          mimeType: string;
          version: string;
          modifiedTime: string;
          size?: string;
        };
        return ok({
          id: body.id,
          name: body.name,
          mimeType: body.mimeType,
          version: body.version,
          modifiedTime: body.modifiedTime,
          sizeBytes: body.size === undefined ? null : Number(body.size),
        });
      } catch (cause) {
        return err('network_error', `Drive 連線失敗：${String(cause)}`, { retryable: true });
      }
    },

    async downloadXlsx(fileId) {
      if (mockMode) {
        const fixture = fixtures.xlsx?.[fileId];
        if (fixture === undefined) return err('not_found', `fixtures 沒有 XLSX ${fileId}`, { mode: 'mock' });
        return ok(fixture, 'mock');
      }
      const token = await accessToken();
      if (!token.ok) return token;
      const url = `${DRIVE_BASE}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
      try {
        const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token.value}` } });
        if (!response.ok) {
          return err('provider_error', `Drive 下載回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        return ok(new Uint8Array(await response.arrayBuffer()));
      } catch (cause) {
        return err('network_error', `Drive 下載失敗：${String(cause)}`, { retryable: true });
      }
    },
  };
}

/**
 * 圖片存取：Drive 分享頁 URL 不能直接當公開圖。
 * 只接受 asset ID，並轉成後端代理路徑，由後端驗證權限後回傳。
 */
export function driveAssetProxyPath(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}`;
}

export function isPublicDriveShareUrl(url: string): boolean {
  return /^https?:\/\/(drive|docs)\.google\.com\//i.test(url.trim());
}
