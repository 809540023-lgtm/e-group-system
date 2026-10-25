/**
 * 商品寫入（供應商後台與總部共用）。
 *
 * 上架狀態只有 admin 能改：供應商送出的 status 一律以 null 傳入，
 * 由 SQL 決定「新商品為 draft、既有商品維持原狀態」，
 * 避免供應商自行把商品改成 active 繞過總部審核。
 *
 * 供應商只能寫自己的商品：guardSupplierId 非 null 時，ON CONFLICT 的更新
 * 會加上 supplier_id 比對，避免以他人 SKU 覆寫別家商品。
 */

export interface ProductUpsert {
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly supplierId: string;
  readonly price: number;
  readonly cost: number;
  readonly weight: number;
  readonly calories: number;
  readonly protein: number;
  readonly fat: number;
  readonly saturatedFat: number | null;
  readonly carbs: number;
  readonly sugar: number | null;
  readonly sodium: number;
  readonly allergens: readonly string[];
  readonly storage: string;
  readonly shelfLife: number;
  readonly heating: string;
  readonly claims: readonly string[];
  /** null 代表不變更狀態（供應商）；admin 才可指定。 */
  readonly status: string | null;
  readonly reviewedBy: string;
  /**
   * 非 null 時只允許更新該供應商自己的商品（供應商後台）。
   * 避免供應商以他人 SKU 覆寫別家商品的內容；admin 傳 null 不受限。
   */
  readonly guardSupplierId: string | null;
}

export type QueryExecutor = (sql: string, params: readonly unknown[]) => Promise<readonly unknown[]>;

/** 回傳 false 代表 SKU 已存在但不屬於 guardSupplierId，未寫入任何資料。 */
export async function upsertProduct(exec: QueryExecutor, input: ProductUpsert): Promise<boolean> {
  const rows = await exec(
    `INSERT INTO products(sku, name, category, description, supplier_id, price_twd, cost_twd, weight_g,
       calories, protein_g, fat_g, saturated_fat_g, carbs_g, sugar_g, sodium_mg, allergens, storage,
       shelf_life_days, heating_instructions, claims, status, nutrition_reviewed_by, nutrition_reviewed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,COALESCE($21::text,'draft'),$22,now())
     ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category,
       description = EXCLUDED.description, price_twd = EXCLUDED.price_twd, cost_twd = EXCLUDED.cost_twd,
       weight_g = EXCLUDED.weight_g, calories = EXCLUDED.calories, protein_g = EXCLUDED.protein_g,
       fat_g = EXCLUDED.fat_g, saturated_fat_g = EXCLUDED.saturated_fat_g, carbs_g = EXCLUDED.carbs_g,
       sugar_g = EXCLUDED.sugar_g, sodium_mg = EXCLUDED.sodium_mg, allergens = EXCLUDED.allergens,
       storage = EXCLUDED.storage, shelf_life_days = EXCLUDED.shelf_life_days,
       heating_instructions = EXCLUDED.heating_instructions, claims = EXCLUDED.claims,
       status = COALESCE($21::text, products.status), nutrition_reviewed_by = EXCLUDED.nutrition_reviewed_by,
       nutrition_reviewed_at = now(), updated_at = now()
     WHERE $23::uuid IS NULL OR products.supplier_id = $23::uuid
     RETURNING sku`,
    [
      input.sku,
      input.name,
      input.category,
      input.description,
      input.supplierId,
      input.price,
      input.cost,
      input.weight,
      input.calories,
      input.protein,
      input.fat,
      input.saturatedFat,
      input.carbs,
      input.sugar,
      input.sodium,
      input.allergens,
      input.storage,
      input.shelfLife,
      input.heating,
      input.claims,
      input.status,
      input.reviewedBy,
      input.guardSupplierId,
    ],
  );
  return rows.length > 0;
}
