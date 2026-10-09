import { AppError } from './errors.ts';

/**
 * 行銷素材與廣告草稿。
 *
 * 核心不變式：
 * 1. 素材與特定商品版次連線；售價、效期、庫存、到貨條件變動時標記需更新。
 * 2. 食品與保健內容不可自創醫療宣稱。
 * 3. 投放資源先以 paused 建立，啟動依預先核准政策執行。
 * 4. 預算以帳號幣別儲存，不把 USD micros 當作臺幣元。
 */

export type Platform = 'facebook' | 'instagram' | 'chatgpt_ads' | 'line' | 'search';

export type CreativeStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'needs_update' | 'retired';

export interface Creative {
  readonly creativeId: string;
  readonly productVersionId: string;
  readonly sku: string;
  readonly platform: Platform;
  readonly headline: string;
  readonly body: string;
  readonly imageAssetId: string | null;
  /** 圖片使用權證明。 */
  readonly imageRights: 'owned' | 'licensed' | 'supplier_granted' | 'unknown';
  readonly status: CreativeStatus;
  readonly reviewedBy: string | null;
  readonly validUntil: string | null;
  readonly createdAt: string;
}

/** 不可自創醫療宣稱的關鍵詞。命中即需人工複核。 */
const PROHIBITED_CLAIM_PATTERNS: readonly RegExp[] = [
  /療效/,
  /治療/,
  /治癒/,
  /抗癌/,
  /防癌/,
  /降血壓/,
  /降血糖/,
  /減肥功效/,
  /瘦身功效/,
  /醫藥級/,
  /藥用/,
  /保證有效/,
  /百分之百有效/,
  /根治/,
  /消炎/,
  /殺菌/,
];

export interface ClaimCheckResult {
  readonly ok: boolean;
  readonly hits: readonly string[];
}

export function checkProhibitedClaims(text: string): ClaimCheckResult {
  const hits = PROHIBITED_CLAIM_PATTERNS.filter((p) => p.test(text)).map((p) => p.source);
  return { ok: hits.length === 0, hits };
}

export function assertNoProhibitedClaims(text: string): void {
  const result = checkProhibitedClaims(text);
  if (!result.ok) {
    throw new AppError('COMPLIANCE_BLOCKED', `文案含不可自創的醫療宣稱：${result.hits.join('、')}`);
  }
}

export interface ProductVersionFacts {
  readonly productVersionId: string;
  readonly saleTwd: number;
  readonly published: boolean;
  readonly stockAvailable: number;
  readonly promisedWindow: string;
  readonly promotionValidUntil: string | null;
}

export type CreativeIssue =
  | { readonly kind: 'version_changed'; readonly creativeId: string }
  | { readonly kind: 'product_unpublished'; readonly creativeId: string }
  | { readonly kind: 'out_of_stock'; readonly creativeId: string }
  | { readonly kind: 'promotion_expired'; readonly creativeId: string }
  | { readonly kind: 'missing_image'; readonly creativeId: string }
  | { readonly kind: 'unknown_image_rights'; readonly creativeId: string }
  | { readonly kind: 'prohibited_claim'; readonly creativeId: string; readonly hits: readonly string[] };

/**
 * 檢查素材是否仍可投放。任何一項成立即標記需更新。
 */
export function auditCreative(
  creative: Creative,
  facts: ProductVersionFacts | null,
  now: Date,
): CreativeIssue[] {
  const issues: CreativeIssue[] = [];

  if (!facts) {
    issues.push({ kind: 'version_changed', creativeId: creative.creativeId });
    return issues;
  }
  if (facts.productVersionId !== creative.productVersionId) {
    issues.push({ kind: 'version_changed', creativeId: creative.creativeId });
  }
  if (!facts.published) {
    issues.push({ kind: 'product_unpublished', creativeId: creative.creativeId });
  }
  if (facts.stockAvailable <= 0) {
    issues.push({ kind: 'out_of_stock', creativeId: creative.creativeId });
  }
  if (facts.promotionValidUntil && new Date(facts.promotionValidUntil).getTime() < now.getTime()) {
    issues.push({ kind: 'promotion_expired', creativeId: creative.creativeId });
  }
  if (!creative.imageAssetId) {
    issues.push({ kind: 'missing_image', creativeId: creative.creativeId });
  }
  if (creative.imageRights === 'unknown') {
    issues.push({ kind: 'unknown_image_rights', creativeId: creative.creativeId });
  }
  const claim = checkProhibitedClaims(`${creative.headline} ${creative.body}`);
  if (!claim.ok) {
    issues.push({ kind: 'prohibited_claim', creativeId: creative.creativeId, hits: claim.hits });
  }

  return issues;
}

/** 通用 UTM 產生器。 */
export interface UtmInput {
  readonly baseUrl: string;
  readonly source: Platform;
  readonly medium: string;
  readonly campaign: string;
  readonly content?: string;
  readonly term?: string;
}

export function buildUtmUrl(input: UtmInput): string {
  const url = new URL(input.baseUrl);
  url.searchParams.set('utm_source', input.source);
  url.searchParams.set('utm_medium', input.medium);
  url.searchParams.set('utm_campaign', input.campaign);
  if (input.content) url.searchParams.set('utm_content', input.content);
  if (input.term) url.searchParams.set('utm_term', input.term);
  return url.toString();
}

/** 預算政策：以帳號幣別儲存，micros 需明確轉換。 */
export interface BudgetPolicy {
  readonly platform: Platform;
  readonly accountCurrency: 'TWD' | 'USD' | 'JPY';
  readonly dailyLimit: number;
  readonly monthlyLimit: number;
  /** 單次變動幅度上限，例如 0.2 代表 20%。 */
  readonly maxSingleChangeRate: number;
  readonly minObservationDays: number;
  readonly approverRole: string;
}

export interface BudgetChangeRequest {
  readonly platform: Platform;
  readonly currentDaily: number;
  readonly requestedDaily: number;
  readonly accountCurrency: 'TWD' | 'USD' | 'JPY';
}

export type BudgetDecision =
  | { readonly action: 'allow' }
  | { readonly action: 'require_approval'; readonly reason: string }
  | { readonly action: 'reject'; readonly reason: string };

export function evaluateBudgetChange(policy: BudgetPolicy, request: BudgetChangeRequest): BudgetDecision {
  if (request.platform !== policy.platform) {
    return { action: 'reject', reason: '預算政策與平臺不符' };
  }
  if (request.accountCurrency !== policy.accountCurrency) {
    return { action: 'reject', reason: `幣別不符：政策為 ${policy.accountCurrency}，請求為 ${request.accountCurrency}` };
  }
  if (request.requestedDaily > policy.dailyLimit) {
    return { action: 'require_approval', reason: `超過每日上限 ${policy.dailyLimit} ${policy.accountCurrency}` };
  }
  if (request.currentDaily > 0) {
    const changeRate = Math.abs(request.requestedDaily - request.currentDaily) / request.currentDaily;
    if (changeRate > policy.maxSingleChangeRate) {
      return {
        action: 'require_approval',
        reason: `單次變動 ${(changeRate * 100).toFixed(1)}% 超過上限 ${(policy.maxSingleChangeRate * 100).toFixed(0)}%`,
      };
    }
  }
  return { action: 'allow' };
}

/** 官方 micros 單位轉換：1 單位 = 1,000,000 micros。 */
export function microsToAmount(micros: number): number {
  if (!Number.isInteger(micros) || micros < 0) {
    throw new AppError('VALIDATION_FAILED', `micros 必須為非負整數，收到 ${micros}`);
  }
  return Math.round(micros / 1_000_000);
}

export function amountToMicros(amount: number): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new AppError('VALIDATION_FAILED', `金額必須為非負整數，收到 ${amount}`);
  }
  return amount * 1_000_000;
}

/** 投放資源一律先以 paused 建立。 */
export interface AdResourceDraft {
  readonly internalId: string;
  readonly platform: Platform;
  readonly externalId: string | null;
  readonly status: 'paused' | 'active' | 'archived';
  readonly budgetAmount: number;
  readonly budgetCurrency: string;
  readonly idempotencyKey: string;
}

export function assertDraftIsPaused(draft: AdResourceDraft): void {
  if (draft.status !== 'paused') {
    throw new AppError('FORBIDDEN', '投放資源必須先以 paused 建立，啟動需依核准政策');
  }
}

/** 同一操作不得生成多資源。 */
export function assertIdempotentCreate(
  existing: readonly AdResourceDraft[],
  idempotencyKey: string,
): void {
  if (existing.some((d) => d.idempotencyKey === idempotencyKey)) {
    throw new AppError('CONFLICT', `冪等鍵 ${idempotencyKey} 已建立過資源，不重複建立`);
  }
}
