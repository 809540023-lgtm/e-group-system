/**
 * 報價與結帳（規劃書 06、07 章；模組 07）。
 *
 * 伺服器重新讀取核准售價、版本、可售量與配送規則，產生 15 分鐘有效的報價快照。
 * 前端傳來的價格、運費與角色一律不採用。
 */

import { buildQuote, type CatalogSnapshot, type InventorySnapshot, type Quote, type ShippingOption } from '@jp/domain';
import type { CatalogRepository, PublicProduct } from './catalog.ts';

export const DEFAULT_SHIPPING_OPTIONS: readonly ShippingOption[] = [
  { code: 'tw_home', label: '臺灣本島常溫宅配', feeTwd: 60, promisedWindow: '1–3 個工作天', allowsSplit: false },
  { code: 'tw_cvs', label: '超商取貨', feeTwd: 60, promisedWindow: '2–4 個工作天', allowsSplit: false },
  { code: 'jp_consolidation', label: '日臺集貨（預購）', feeTwd: 120, promisedWindow: '14–20 個工作天', allowsSplit: true },
];

export const TERMS_VERSION = 'terms-2026-01';

export function shippingOptionByCode(code: string): ShippingOption | null {
  return DEFAULT_SHIPPING_OPTIONS.find((o) => o.code === code) ?? null;
}

export function toCatalogSnapshot(product: PublicProduct): CatalogSnapshot {
  return {
    sku: product.sku,
    productVersionId: product.productVersionId,
    saleTwd: product.saleTwd,
    supplyMode: product.supplyMode,
    published: product.published,
    complianceApproved: product.complianceApproved,
    sourceUpdatedAt: product.sourceUpdatedAt,
    weightG: product.weightG,
  };
}

export interface InventoryReader {
  (skus: readonly string[]): Promise<ReadonlyMap<string, InventorySnapshot>>;
}

/** 示範用庫存：僅在沒有資料庫連線時使用。 */
export function fixtureInventory(products: readonly PublicProduct[]): ReadonlyMap<string, InventorySnapshot> {
  const map = new Map<string, InventorySnapshot>();
  for (const product of products) {
    map.set(product.sku, {
      sku: product.sku,
      onHand: product.supplyMode === 'in_stock' ? 20 : 0,
      reserved: 0,
      preorderQuota: product.supplyMode === 'preorder' ? 20 : 0,
    });
  }
  return map;
}

export interface BuildQuoteRequest {
  readonly quoteId: string;
  readonly lines: readonly { readonly sku: string; readonly quantity: number }[];
  readonly shippingOptionCode: string;
  readonly repo: CatalogRepository;
  readonly inventory: InventoryReader;
  readonly now?: Date;
}

export async function buildServerQuote(request: BuildQuoteRequest): Promise<Quote> {
  const option = shippingOptionByCode(request.shippingOptionCode);
  if (option === null) {
    throw new Error(`UNKNOWN_SHIPPING_OPTION: 不支援的配送方式 ${request.shippingOptionCode}`);
  }
  const products = await Promise.all(request.lines.map((l) => request.repo.bySku(l.sku)));
  const catalog = new Map<string, CatalogSnapshot>();
  for (const product of products) {
    if (product !== null) catalog.set(product.sku, toCatalogSnapshot(product));
  }
  const inventory = await request.inventory(request.lines.map((l) => l.sku));
  return buildQuote({
    quoteId: request.quoteId,
    lines: request.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
    catalog,
    inventory,
    shippingOption: option,
    termsVersion: TERMS_VERSION,
    now: request.now ?? new Date(),
  });
}
