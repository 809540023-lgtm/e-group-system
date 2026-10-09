import { AppError } from './errors.ts';

/**
 * 商品來源正規化與查重規則。
 *
 * 來源欄位有中文、合併儲存格或不同價格格式，必須先建立明確 mapping，
 * 不能由 AI 每天猜欄位含義。
 */

export type SupplyMode = 'in_stock' | 'preorder' | 'inquiry';
export type Origin = 'JP' | 'OTHER' | 'UNKNOWN';

export interface SourceRow {
  readonly product_code: string;
  readonly sku: string;
  readonly jan?: string;
  readonly title_zh: string;
  readonly title_ja?: string;
  readonly category: string;
  readonly source_tags?: readonly string[];
  readonly spec?: string;
  readonly units_per_pack?: number;
  readonly cost_jpy?: number;
  readonly sale_twd?: number;
  readonly weight_g?: number;
  readonly dimensions?: string;
  readonly origin?: string;
  readonly supply_mode?: string;
  readonly source_url?: string;
  readonly asset_id?: string;
  readonly source_updated_at?: string;
}

export interface NormalizedProduct {
  readonly productCode: string;
  readonly sku: string;
  readonly jan: string | null;
  readonly titleZh: string;
  readonly titleJa: string | null;
  readonly category: string;
  readonly sourceTags: readonly string[];
  readonly spec: string | null;
  readonly unitsPerPack: number;
  readonly costJpy: number | null;
  readonly saleTwd: number | null;
  readonly weightG: number | null;
  readonly dimensions: string | null;
  readonly origin: Origin;
  readonly supplyMode: SupplyMode;
  readonly sourceUrl: string | null;
  readonly assetId: string | null;
  readonly sourceUpdatedAt: string | null;
  /** 逐列雜湊，只含業務欄位，排除抓取時間與欄位順序。 */
  readonly sourceHash: string;
}

export interface RowIssue {
  readonly rowIndex: number;
  readonly sku: string | null;
  readonly field: string;
  readonly message: string;
}


function normalizeSupplyMode(raw: string | undefined): SupplyMode {
  if (!raw) return 'inquiry';
  const value = raw.trim().toLowerCase();
  if (value === 'in_stock' || value === '現貨' || value === '现货') return 'in_stock';
  if (value === 'preorder' || value === '預購' || value === '预购') return 'preorder';
  if (value === 'inquiry' || value === '詢價' || value === '询价') return 'inquiry';
  return 'inquiry';
}

function normalizeOrigin(raw: string | undefined): Origin {
  if (!raw) return 'UNKNOWN';
  const value = raw.trim().toUpperCase();
  if (value === 'JP' || value === 'JAPAN' || value === '日本') return 'JP';
  if (value === 'UNKNOWN' || value === '未知' || value === '') return 'UNKNOWN';
  return 'OTHER';
}

/** JAN 必須保留前導零，因此一律以字串處理。 */
export function normalizeJan(raw: string | number | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return null;
  if (text.length !== 8 && text.length !== 13) return null;
  return text;
}

function toIntegerOrNull(raw: number | undefined, label: string, issues: RowIssue[], rowIndex: number, sku: string | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
    issues.push({ rowIndex, sku, field: label, message: `${label} 必須是整數，收到 ${raw}` });
    return null;
  }
  return raw;
}

/**
 * 逐列雜湊：只包含業務欄位，欄位順序固定，排除本次抓取時間。
 * 同一批重跑必須得到相同雜湊，才能保持冪等。
 */
export function sourceRowHash(row: SourceRow): string {
  const businessFields = [
    row.product_code ?? '',
    row.sku ?? '',
    normalizeJan(row.jan) ?? '',
    row.title_zh ?? '',
    row.title_ja ?? '',
    row.category ?? '',
    [...(row.source_tags ?? [])].sort().join('|'),
    row.spec ?? '',
    String(row.units_per_pack ?? ''),
    String(row.cost_jpy ?? ''),
    String(row.sale_twd ?? ''),
    String(row.weight_g ?? ''),
    row.dimensions ?? '',
    normalizeOrigin(row.origin),
    normalizeSupplyMode(row.supply_mode),
    row.source_url ?? '',
    row.asset_id ?? '',
  ];
  return fnv1a64(businessFields.join('\u0001'));
}

/** 整批 snapshot 雜湊：由已排序的逐列雜湊組成，列序重排不影響結果。 */
export function snapshotHash(rows: readonly SourceRow[]): string {
  const hashes = rows.map(sourceRowHash).sort();
  return fnv1a64(hashes.join('\u0002'));
}

function fnv1a64(input: string): string {
  // 以兩個 32 位 FNV-1a 併接，避免依賴 Node crypto，讓 domain 可在任何 runtime 執行。
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export interface NormalizeResult {
  readonly products: readonly NormalizedProduct[];
  readonly issues: readonly RowIssue[];
  /** 整批阻擋：空表、截斷或錯列時不得發布。 */
  readonly blocked: boolean;
  readonly blockReason?: string;
}

export interface NormalizeOptions {
  /** 來源宣告的總列數；與實際讀到列數不符代表讀一半。 */
  readonly expectedRowCount?: number;
  /** 必填欄位，缺少即阻擋整批。 */
  readonly requiredColumns?: readonly (keyof SourceRow)[];
}

const DEFAULT_REQUIRED: readonly (keyof SourceRow)[] = ['product_code', 'sku', 'title_zh', 'category'];

/**
 * 正規化整批來源。任何阻擋條件成立時 blocked = true，
 * 呼叫端必須保留上一次發布版本，不得把半張表當成新的完整商品目錄。
 */
export function normalizeSourceRows(rows: readonly SourceRow[], options: NormalizeOptions = {}): NormalizeResult {
  const issues: RowIssue[] = [];
  const required = options.requiredColumns ?? DEFAULT_REQUIRED;

  if (rows.length === 0) {
    return { products: [], issues, blocked: true, blockReason: '來源為空表，保留上一次發布版本' };
  }

  if (options.expectedRowCount !== undefined && options.expectedRowCount !== rows.length) {
    return {
      products: [],
      issues,
      blocked: true,
      blockReason: `來源讀取不完整：預期 ${options.expectedRowCount} 列，實際 ${rows.length} 列`,
    };
  }

  const products: NormalizedProduct[] = [];
  const seenSku = new Map<string, number>();

  rows.forEach((row, rowIndex) => {
    const sku = typeof row.sku === 'string' && row.sku.trim() !== '' ? row.sku.trim() : null;

    for (const column of required) {
      const value = row[column];
      if (value === undefined || value === null || String(value).trim() === '') {
        issues.push({ rowIndex, sku, field: String(column), message: `必填欄位 ${String(column)} 為空` });
      }
    }

    if (sku) {
      const previous = seenSku.get(sku);
      if (previous !== undefined) {
        issues.push({ rowIndex, sku, field: 'sku', message: `SKU 重複，首次出現於第 ${previous + 1} 列` });
      } else {
        seenSku.set(sku, rowIndex);
      }
    }

    const unitsPerPack = toIntegerOrNull(row.units_per_pack, 'units_per_pack', issues, rowIndex, sku) ?? 1;
    if (unitsPerPack <= 0) {
      issues.push({ rowIndex, sku, field: 'units_per_pack', message: '包裝數量必須大於零' });
    }

    const costJpy = toIntegerOrNull(row.cost_jpy, 'cost_jpy', issues, rowIndex, sku);
    const saleTwd = toIntegerOrNull(row.sale_twd, 'sale_twd', issues, rowIndex, sku);
    const weightG = toIntegerOrNull(row.weight_g, 'weight_g', issues, rowIndex, sku);

    if (costJpy !== null && costJpy < 0) {
      issues.push({ rowIndex, sku, field: 'cost_jpy', message: '日圓購價不可為負數' });
    }
    if (saleTwd !== null && saleTwd < 0) {
      issues.push({ rowIndex, sku, field: 'sale_twd', message: '已核准臺幣售價不可為負數' });
    }

    const supplyMode = normalizeSupplyMode(row.supply_mode);
    if (supplyMode === 'inquiry' && weightG === null) {
      // 未知重量或配送條件者先詢價，這是預期行為而非錯誤。
    }

    products.push({
      productCode: String(row.product_code ?? '').trim(),
      sku: sku ?? '',
      jan: normalizeJan(row.jan),
      titleZh: String(row.title_zh ?? '').trim(),
      titleJa: row.title_ja ? String(row.title_ja).trim() : null,
      category: String(row.category ?? '').trim(),
      sourceTags: [...(row.source_tags ?? [])].map((t) => t.trim()).filter((t) => t !== ''),
      spec: row.spec ? String(row.spec).trim() : null,
      unitsPerPack,
      costJpy,
      saleTwd,
      weightG,
      dimensions: row.dimensions ? String(row.dimensions).trim() : null,
      origin: normalizeOrigin(row.origin),
      supplyMode,
      sourceUrl: row.source_url ? String(row.source_url).trim() : null,
      assetId: row.asset_id ? String(row.asset_id).trim() : null,
      sourceUpdatedAt: row.source_updated_at ? String(row.source_updated_at).trim() : null,
      sourceHash: sourceRowHash(row),
    });
  });

  const hasBlockingIssue = issues.some((issue) => required.includes(issue.field as keyof SourceRow));
  if (hasBlockingIssue) {
    return { products, issues, blocked: true, blockReason: '必填欄位缺漏，阻擋整批發布' };
  }

  return { products, issues, blocked: false };
}

export interface SyncDiff {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  /** 未出現在本批的 SKU：只通知，不等於下架。 */
  readonly missing: readonly string[];
  /** 明確標記 archive 才提出下架。 */
  readonly archiveRequested: readonly string[];
}

export function diffCatalog(
  previous: ReadonlyMap<string, string>,
  next: readonly NormalizedProduct[],
  archiveSkus: readonly string[] = [],
): SyncDiff {
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const nextSkus = new Set<string>();

  for (const product of next) {
    nextSkus.add(product.sku);
    const previousHash = previous.get(product.sku);
    if (previousHash === undefined) {
      added.push(product.sku);
    } else if (previousHash !== product.sourceHash) {
      changed.push(product.sku);
    } else {
      unchanged.push(product.sku);
    }
  }

  const missing = [...previous.keys()].filter((sku) => !nextSkus.has(sku));
  const archiveRequested = archiveSkus.filter((sku) => nextSkus.has(sku));

  return { added, changed, unchanged, missing, archiveRequested };
}

/** 來源超過建議 48 小時未確認時，暫停需即時供貨的結帳。 */
export const SOURCE_STALE_HOURS = 48;

export function isSourceStale(sourceUpdatedAt: string | null, now: Date, staleHours = SOURCE_STALE_HOURS): boolean {
  if (!sourceUpdatedAt) return true;
  const updated = new Date(sourceUpdatedAt);
  if (Number.isNaN(updated.getTime())) return true;
  const ageHours = (now.getTime() - updated.getTime()) / 3_600_000;
  return ageHours > staleHours;
}

export function assertPublishable(product: NormalizedProduct, complianceApproved: boolean): void {
  if (product.saleTwd === null) {
    throw new AppError('VALIDATION_FAILED', '商品缺少已核准臺幣售價，不得發布');
  }
  if (!complianceApproved) {
    throw new AppError('COMPLIANCE_BLOCKED', '商品尚未完成品類合法銷售審核，不得發布');
  }
  if (product.supplyMode === 'inquiry') {
    throw new AppError('VALIDATION_FAILED', '詢價商品不得直接發布為可下單商品');
  }
}
