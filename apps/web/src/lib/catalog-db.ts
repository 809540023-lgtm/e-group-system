/**
 * 資料庫版商品查詢（規劃書 04、05、13 章；模組 05、06）。
 *
 * 只讀已發布版本；成本欄位不出現在公開查詢。
 * 公開 API 使用 jp_web 角色，不得使用管理帳號。
 */

import { Client } from 'pg';
import { arrivalWindowFor, type CatalogQuery, type CatalogRepository, type PublicProduct } from './catalog.ts';
import type { SupplyMode } from '@jp/domain';

interface Row {
  readonly sku: string;
  readonly product_code: string;
  readonly title_zh: string;
  readonly title_ja: string | null;
  readonly category: string;
  readonly spec: string | null;
  readonly units_per_pack: number;
  readonly sale_twd: number;
  readonly supply_mode: string;
  readonly origin: string;
  readonly weight_g: number | null;
  readonly dimensions: string | null;
  readonly source_url: string | null;
  readonly asset_id: string | null;
  readonly source_updated_at: string | null;
  readonly version_id: string;
  readonly compliance_approved: boolean;
  readonly source_tags: readonly string[];
}

const SELECT_COLUMNS = `
  s.sku, p.product_code, p.title_zh, p.title_ja, p.category, p.origin, p.source_tags,
  s.spec, s.units_per_pack, s.sale_twd, s.supply_mode, s.weight_g, s.dimensions,
  s.source_url, s.asset_id, s.updated_at AS source_updated_at,
  p.published_version_id AS version_id,
  COALESCE(c.approved, false) AS compliance_approved
`;

const FROM_JOIN = `
  FROM skus s
  JOIN products p ON p.product_id = s.product_id
  LEFT JOIN product_compliance c ON c.sku_id = s.sku_id
`;

function toPublic(row: Row): PublicProduct {
  const supplyMode = (['in_stock', 'preorder', 'inquiry'] as const).includes(row.supply_mode as SupplyMode)
    ? (row.supply_mode as SupplyMode)
    : 'inquiry';
  return {
    sku: row.sku,
    productCode: row.product_code,
    titleZh: row.title_zh,
    titleJa: row.title_ja,
    category: row.category,
    spec: row.spec,
    unitsPerPack: row.units_per_pack,
    saleTwd: row.sale_twd,
    supplyMode,
    origin: row.origin,
    weightG: row.weight_g,
    dimensions: row.dimensions,
    sourceUrl: row.source_url,
    assetId: row.asset_id,
    sourceUpdatedAt: row.source_updated_at,
    productVersionId: row.version_id,
    published: true,
    complianceApproved: row.compliance_approved,
    arrivalWindow: arrivalWindowFor(supplyMode),
    sourceTags: row.source_tags,
  };
}

export function createDatabaseRepository(databaseUrl: string): CatalogRepository {
  async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  return {
    kind: 'database',
    async list(query: CatalogQuery) {
      return withClient(async (client) => {
        const conditions = ['p.published_version_id IS NOT NULL', 's.sale_twd IS NOT NULL', 'COALESCE(c.approved, false) = true'];
        const params: unknown[] = [];
        if (query.category !== undefined) {
          params.push(query.category);
          conditions.push(`p.category = $${String(params.length)}`);
        }
        if (query.zone !== undefined) {
          params.push(query.zone);
          conditions.push(`$${String(params.length)} = ANY(p.source_tags)`);
        }
        if (query.keyword !== undefined && query.keyword.trim() !== '') {
          params.push(`%${query.keyword.trim()}%`);
          conditions.push(`(p.title_zh ILIKE $${String(params.length)} OR s.sku ILIKE $${String(params.length)} OR COALESCE(s.spec,'') ILIKE $${String(params.length)})`);
        }
        const limit = query.limit ?? 60;
        params.push(limit);
        const sql = `SELECT ${SELECT_COLUMNS} ${FROM_JOIN} WHERE ${conditions.join(' AND ')}
          ORDER BY CASE s.supply_mode WHEN 'in_stock' THEN 0 WHEN 'preorder' THEN 1 ELSE 2 END, p.title_zh
          LIMIT $${String(params.length)}`;
        const result = await client.query<Row>(sql, params);
        return result.rows.map(toPublic);
      });
    },
    async bySku(sku) {
      return withClient(async (client) => {
        const result = await client.query<Row>(
          `SELECT ${SELECT_COLUMNS} ${FROM_JOIN} WHERE s.sku = $1 AND p.published_version_id IS NOT NULL`,
          [sku],
        );
        const row = result.rows[0];
        return row === undefined ? null : toPublic(row);
      });
    },
    async categories() {
      return withClient(async (client) => {
        const result = await client.query<{ category: string }>(
          `SELECT DISTINCT p.category ${FROM_JOIN} WHERE p.published_version_id IS NOT NULL ORDER BY p.category`,
        );
        return result.rows.map((r) => r.category);
      });
    },
  };
}

/** 有 DATABASE_URL 時用資料庫，否則用明確標示的示範資料。 */
export async function resolveRepository(): Promise<CatalogRepository> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    const { createFixtureRepository } = await import('./catalog.ts');
    return createFixtureRepository();
  }
  return createDatabaseRepository(url);
}
