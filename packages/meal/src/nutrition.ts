/**
 * 營養標示與宣稱檢核（計畫書第四章、第十二章）。
 *
 * 原則：
 * 1. 不以單一主菜達標推論全餐或全店達標。
 * 2. 疾病治療、減重保證等宣稱一律阻擋。
 * 3. 檢核結果只是內部提示，正式上架仍須合格專業人員覆核。
 */

export type StorageType = 'frozen' | 'chilled' | 'ambient';

export interface NutritionFacts {
  /** 每份重量（公克）。 */
  readonly servingG: number;
  readonly calories: number;
  readonly proteinG: number;
  readonly fatG: number;
  readonly saturatedFatG?: number;
  readonly carbsG: number;
  readonly sugarG?: number;
  readonly sodiumMg: number;
}

export interface ProductLabel {
  readonly sku: string;
  readonly name: string;
  readonly nutrition: NutritionFacts;
  readonly allergens: readonly string[];
  readonly storage: StorageType;
  readonly shelfLifeDays: number;
  readonly heatingInstructions: string;
  readonly claims: readonly string[];
}

export interface LabelIssue {
  readonly code: string;
  readonly severity: 'blocker' | 'warning';
  readonly message: string;
}

export interface LabelCheck {
  readonly ok: boolean;
  readonly issues: readonly LabelIssue[];
  readonly per100g: {
    readonly calories: number;
    readonly proteinG: number;
    readonly fatG: number;
    readonly carbsG: number;
    readonly sodiumMg: number;
    readonly sugarG: number;
  };
}

/** 臺灣食品過敏原標示常見項目；未列出的自訂項目仍可宣告。 */
export const TAIWAN_MAJOR_ALLERGENS = [
  '甲殼類',
  '芒果',
  '花生',
  '牛奶',
  '羊奶',
  '蛋',
  '堅果',
  '芝麻',
  '含麩質穀物',
  '大豆',
  '魚類',
  '亞硫酸鹽',
] as const;

const FORBIDDEN_CLAIM_PATTERNS: readonly { readonly pattern: RegExp; readonly message: string }[] = [
  { pattern: /治療|治癒|療效|醫治/, message: '一般食品不得宣稱治療疾病。' },
  { pattern: /預防(疾病|癌症|糖尿病|高血壓)|抗癌|防癌/, message: '一般食品不得宣稱預防疾病。' },
  { pattern: /保證(減重|瘦身|不復胖)|必瘦|快速減重/, message: '不得保證減重效果。' },
  { pattern: /取代(藥物|醫囑)|停藥/, message: '不得宣稱可取代藥物或醫囑。' },
  { pattern: /改善(肝功能|腎功能|血糖|血脂)/, message: '涉及生理功能改變的宣稱須另行確認。' },
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function per100g(value: number, servingG: number): number {
  return round1((value / servingG) * 100);
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * 檢核營養資料與宣稱。
 * 高蛋白：每份蛋白質 ≥ 12g 且蛋白質熱量占比 ≥ 20%。
 * 低脂：每 100g 脂肪 ≤ 3g。低鈉：每 100g 鈉 ≤ 120mg。
 */
export function checkLabel(label: ProductLabel): LabelCheck {
  const issues: LabelIssue[] = [];
  const n = label.nutrition;

  if (!isNonNegative(n.servingG) || n.servingG <= 0) {
    issues.push({ code: 'SERVING_INVALID', severity: 'blocker', message: '每份重量必須大於零。' });
  }
  for (const [key, value] of Object.entries({
    calories: n.calories,
    proteinG: n.proteinG,
    fatG: n.fatG,
    carbsG: n.carbsG,
    sodiumMg: n.sodiumMg,
  })) {
    if (!isNonNegative(value)) {
      issues.push({ code: 'NUTRITION_NEGATIVE', severity: 'blocker', message: `${key} 必須是非負數。` });
    }
  }
  if (n.saturatedFatG !== undefined && n.saturatedFatG > n.fatG) {
    issues.push({ code: 'SAT_FAT_EXCEEDS_FAT', severity: 'blocker', message: '飽和脂肪不可高於總脂肪。' });
  }
  if (n.sugarG !== undefined && n.sugarG > n.carbsG) {
    issues.push({ code: 'SUGAR_EXCEEDS_CARBS', severity: 'blocker', message: '糖不可高於碳水化合物。' });
  }

  const servingG = n.servingG > 0 ? n.servingG : 100;
  const computedCalories = n.proteinG * 4 + n.carbsG * 4 + n.fatG * 9;
  if (n.calories > 0 && Math.abs(computedCalories - n.calories) / n.calories > 0.2) {
    issues.push({
      code: 'CALORIE_MACRO_MISMATCH',
      severity: 'warning',
      message: `三大營養素推算熱量 ${Math.round(computedCalories)} kcal 與標示 ${n.calories} kcal 差距超過 20%。`,
    });
  }

  if (label.shelfLifeDays <= 0) {
    issues.push({ code: 'SHELF_LIFE_INVALID', severity: 'blocker', message: '保存期限必須大於零。' });
  }
  if (label.heatingInstructions.trim() === '') {
    issues.push({ code: 'HEATING_MISSING', severity: 'blocker', message: '缺少加熱說明。' });
  }
  if (label.allergens.some((a) => a.trim() === '')) {
    issues.push({ code: 'ALLERGEN_EMPTY', severity: 'blocker', message: '過敏原項目不可為空字串。' });
  }

  const proteinCalories = n.proteinG * 4;
  const proteinRatio = n.calories > 0 ? proteinCalories / n.calories : 0;
  const fatPer100g = per100g(n.fatG, servingG);
  const sodiumPer100g = per100g(n.sodiumMg, servingG);
  const sugarPer100g = per100g(n.sugarG ?? 0, servingG);

  for (const claim of label.claims) {
    const text = claim.trim();
    if (text === '') continue;

    for (const rule of FORBIDDEN_CLAIM_PATTERNS) {
      if (rule.pattern.test(text)) {
        issues.push({ code: 'FORBIDDEN_CLAIM', severity: 'blocker', message: `「${text}」：${rule.message}` });
      }
    }

    if (/高蛋白/.test(text)) {
      if (n.proteinG < 12 || proteinRatio < 0.2) {
        issues.push({
          code: 'HIGH_PROTEIN_NOT_MET',
          severity: 'blocker',
          message: `「${text}」未達每份蛋白質 12g 且蛋白質熱量占比 20%（目前 ${n.proteinG}g、${Math.round(proteinRatio * 100)}%）。`,
        });
      }
    }
    if (/低脂/.test(text) && fatPer100g > 3) {
      issues.push({ code: 'LOW_FAT_NOT_MET', severity: 'blocker', message: `「${text}」未達每 100g 脂肪 ≤ 3g（目前 ${fatPer100g}g）。` });
    }
    if (/低鈉/.test(text) && sodiumPer100g > 120) {
      issues.push({ code: 'LOW_SODIUM_NOT_MET', severity: 'blocker', message: `「${text}」未達每 100g 鈉 ≤ 120mg（目前 ${sodiumPer100g}mg）。` });
    }
    if (/無糖|零糖/.test(text) && sugarPer100g > 0.5) {
      issues.push({ code: 'NO_SUGAR_NOT_MET', severity: 'blocker', message: `「${text}」未達每 100g 糖 ≤ 0.5g（目前 ${sugarPer100g}g）。` });
    }
  }

  return {
    ok: issues.every((issue) => issue.severity !== 'blocker'),
    issues,
    per100g: {
      calories: per100g(n.calories, servingG),
      proteinG: per100g(n.proteinG, servingG),
      fatG: fatPer100g,
      carbsG: per100g(n.carbsG, servingG),
      sodiumMg: sodiumPer100g,
      sugarG: sugarPer100g,
    },
  };
}

/** 顧客過敏原比對：只要商品含顧客指定過敏原即回傳命中項目。 */
export function matchAllergens(productAllergens: readonly string[], customerAllergens: readonly string[]): readonly string[] {
  const normalized = new Set(customerAllergens.map((a) => a.trim()).filter(Boolean));
  return productAllergens.filter((a) => normalized.has(a.trim()));
}
