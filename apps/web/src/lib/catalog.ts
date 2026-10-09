/**
 * 商品查詢（規劃書 04、05、13 章；模組 05、06）。
 *
 * 公開 API 只讀已發布版本；成本欄位不得出現在公開輸出。
 * 沒有資料庫連線時使用明確標示的示範資料，不以假成功掩蓋。
 */

import type { SupplyMode } from '@jp/domain';

export interface PublicProduct {
  readonly sku: string;
  readonly productCode: string;
  readonly titleZh: string;
  readonly titleJa: string | null;
  readonly category: string;
  readonly spec: string | null;
  readonly unitsPerPack: number;
  readonly saleTwd: number;
  readonly supplyMode: SupplyMode;
  readonly origin: string;
  readonly weightG: number | null;
  readonly dimensions: string | null;
  readonly sourceUrl: string | null;
  readonly assetId: string | null;
  readonly sourceUpdatedAt: string | null;
  readonly productVersionId: string;
  readonly published: boolean;
  readonly complianceApproved: boolean;
  readonly arrivalWindow: string;
  readonly sourceTags: readonly string[];
}

export interface CatalogQuery {
  readonly category?: string;
  readonly zone?: string;
  readonly keyword?: string;
  readonly limit?: number;
}

export interface CatalogRepository {
  readonly kind: 'database' | 'fixture';
  list(query: CatalogQuery): Promise<readonly PublicProduct[]>;
  bySku(sku: string): Promise<PublicProduct | null>;
  categories(): Promise<readonly string[]>;
}

export const CATEGORIES = ['面膜', '保養品', '保健食品', '食品飲料', '生活用品'] as const;
export const ZONES = ['好市多', '日本 DM 本期選物', '臺灣現貨', '日本預購'] as const;

/** 公開輸出不得含成本；此函式是唯一的序列化出口。 */
export function toPublicJson(product: PublicProduct): Record<string, unknown> {
  return {
    sku: product.sku,
    productCode: product.productCode,
    titleZh: product.titleZh,
    titleJa: product.titleJa,
    category: product.category,
    spec: product.spec,
    unitsPerPack: product.unitsPerPack,
    saleTwd: product.saleTwd,
    supplyMode: product.supplyMode,
    origin: product.origin,
    weightG: product.weightG,
    dimensions: product.dimensions,
    sourceUrl: product.sourceUrl,
    assetId: product.assetId,
    sourceUpdatedAt: product.sourceUpdatedAt,
    productVersionId: product.productVersionId,
    published: product.published,
    complianceApproved: product.complianceApproved,
    arrivalWindow: product.arrivalWindow,
    sourceTags: product.sourceTags,
  };
}

export function arrivalWindowFor(supplyMode: SupplyMode): string {
  switch (supplyMode) {
    case 'in_stock':
      return '臺灣現貨，可立即出貨（1–3 個工作天）';
    case 'preorder':
      return '日本預購，需向日本下單後出貨（14–20 個工作天）';
    case 'inquiry':
      return '需先詢問供貨與價格';
  }
}

export function matchesQuery(product: PublicProduct, query: CatalogQuery): boolean {
  if (query.category !== undefined && product.category !== query.category) return false;
  if (query.zone !== undefined && !product.sourceTags.includes(query.zone)) return false;
  if (query.keyword !== undefined && query.keyword.trim() !== '') {
    const needle = query.keyword.trim().toLowerCase();
    const haystack = [product.titleZh, product.titleJa ?? '', product.sku, product.spec ?? '', product.category]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function sortForStorefront(products: readonly PublicProduct[]): readonly PublicProduct[] {
  const rank: Record<SupplyMode, number> = { in_stock: 0, preorder: 1, inquiry: 2 };
  return [...products].sort((a, b) => {
    const byMode = rank[a.supplyMode] - rank[b.supplyMode];
    if (byMode !== 0) return byMode;
    return a.titleZh.localeCompare(b.titleZh, 'zh-Hant');
  });
}

/** 示範資料：僅在沒有資料庫連線時使用，且明確標示 kind='fixture'。 */
export function fixtureProducts(): readonly PublicProduct[] {
  const base = {
    productCode: 'DEMO',
    titleJa: null,
    unitsPerPack: 1,
    origin: 'JP',
    weightG: 300,
    dimensions: '20x12x6',
    sourceUrl: null,
    assetId: null,
    sourceUpdatedAt: new Date().toISOString(),
    productVersionId: 'demo-v1',
    published: true,
    complianceApproved: true,
  } as const;
  return [
    { ...base, sku: 'DEMO-MASK-30', titleZh: '日本製保濕面膜 30 片', category: '面膜', spec: '30 片／盒', saleTwd: 348, supplyMode: 'in_stock', arrivalWindow: arrivalWindowFor('in_stock'), sourceTags: ['臺灣現貨'] },
    { ...base, sku: 'DEMO-LOTION-200', titleZh: '日本製化妝水 200ml', category: '保養品', spec: '200ml／瓶', saleTwd: 520, supplyMode: 'in_stock', arrivalWindow: arrivalWindowFor('in_stock'), sourceTags: ['臺灣現貨'] },
    { ...base, sku: 'DEMO-VITC-90', titleZh: '日本製維他命 C 90 錠', category: '保健食品', spec: '90 錠／瓶', saleTwd: 690, supplyMode: 'preorder', arrivalWindow: arrivalWindowFor('preorder'), sourceTags: ['日本預購', '日本 DM 本期選物'] },
    { ...base, sku: 'DEMO-COSTCO-NUT', titleZh: '好市多綜合堅果 1kg', category: '食品飲料', spec: '1kg／包', saleTwd: 899, supplyMode: 'preorder', arrivalWindow: arrivalWindowFor('preorder'), sourceTags: ['好市多', '日本預購'] },
    { ...base, sku: 'DEMO-TOWEL-3', titleZh: '日本製今治毛巾 3 入', category: '生活用品', spec: '3 入／組', saleTwd: 780, supplyMode: 'inquiry', arrivalWindow: arrivalWindowFor('inquiry'), sourceTags: ['日本 DM 本期選物'] },
  ];
}

export function createFixtureRepository(): CatalogRepository {
  const all = fixtureProducts();
  return {
    kind: 'fixture',
    async list(query) {
      const filtered = sortForStorefront(all.filter((p) => matchesQuery(p, query)));
      return query.limit === undefined ? filtered : filtered.slice(0, query.limit);
    },
    async bySku(sku) {
      return all.find((p) => p.sku === sku) ?? null;
    },
    async categories() {
      return [...CATEGORIES];
    },
  };
}
