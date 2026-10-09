import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type AdResourceDraft,
  type BudgetPolicy,
  type Creative,
  amountToMicros,
  assertDraftIsPaused,
  assertIdempotentCreate,
  assertNoProhibitedClaims,
  auditCreative,
  buildUtmUrl,
  checkProhibitedClaims,
  evaluateBudgetChange,
  microsToAmount,
} from '../src/marketing.ts';

const now = new Date('2026-10-09T00:00:00Z');

const creative: Creative = {
  creativeId: 'C-1',
  productVersionId: 'v1',
  sku: 'SKU-A',
  platform: 'facebook',
  headline: '日本原裝保濕面膜',
  body: '30 片裝，日本直送',
  imageAssetId: 'asset-1',
  imageRights: 'owned',
  status: 'approved',
  reviewedBy: 'owner-1',
  validUntil: null,
  createdAt: '2026-10-01T00:00:00Z',
};

const facts = {
  productVersionId: 'v1',
  saleTwd: 599,
  published: true,
  stockAvailable: 10,
  promisedWindow: '14-20 個工作天',
  promotionValidUntil: null,
};

describe('marketing 醫療宣稱檢查', () => {
  it('一般商品文案通過', () => {
    expect(checkProhibitedClaims('日本原裝保濕面膜 30 片').ok).toBe(true);
  });

  it('命中療效、治療、抗癌等詞需複核', () => {
    expect(checkProhibitedClaims('可治療皮膚炎').ok).toBe(false);
    expect(checkProhibitedClaims('抗癌聖品').ok).toBe(false);
    expect(checkProhibitedClaims('保證有效').ok).toBe(false);
    expect(checkProhibitedClaims('百分之百有效').ok).toBe(false);
  });

  it('assertNoProhibitedClaims 拋出 COMPLIANCE_BLOCKED', () => {
    try {
      assertNoProhibitedClaims('本產品可治癒糖尿病');
      throw new Error('應該要拋錯');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).error_code).toBe('COMPLIANCE_BLOCKED');
    }
  });
});

describe('marketing 素材稽核', () => {
  it('狀態一致時無問題', () => {
    expect(auditCreative(creative, facts, now)).toEqual([]);
  });

  it('商品版次變更標記需更新', () => {
    const issues = auditCreative(creative, { ...facts, productVersionId: 'v2' }, now);
    expect(issues).toContainEqual({ kind: 'version_changed', creativeId: 'C-1' });
  });

  it('找不到版次視為已變更', () => {
    expect(auditCreative(creative, null, now)).toContainEqual({ kind: 'version_changed', creativeId: 'C-1' });
  });

  it('下架、缺貨、活動過期分別標記', () => {
    expect(auditCreative(creative, { ...facts, published: false }, now)).toContainEqual({
      kind: 'product_unpublished',
      creativeId: 'C-1',
    });
    expect(auditCreative(creative, { ...facts, stockAvailable: 0 }, now)).toContainEqual({
      kind: 'out_of_stock',
      creativeId: 'C-1',
    });
    expect(
      auditCreative(creative, { ...facts, promotionValidUntil: '2026-09-01T00:00:00Z' }, now),
    ).toContainEqual({ kind: 'promotion_expired', creativeId: 'C-1' });
  });

  it('缺圖與圖片權利不明標記', () => {
    expect(auditCreative({ ...creative, imageAssetId: null }, facts, now)).toContainEqual({
      kind: 'missing_image',
      creativeId: 'C-1',
    });
    expect(auditCreative({ ...creative, imageRights: 'unknown' }, facts, now)).toContainEqual({
      kind: 'unknown_image_rights',
      creativeId: 'C-1',
    });
  });

  it('文案含醫療宣稱標記', () => {
    const issues = auditCreative({ ...creative, body: '可治療關節炎' }, facts, now);
    expect(issues.some((i) => i.kind === 'prohibited_claim')).toBe(true);
  });
});

describe('marketing UTM', () => {
  it('產生含來源、媒介與活動的網址', () => {
    const url = buildUtmUrl({
      baseUrl: 'https://shop.example.com/p/sku-a',
      source: 'facebook',
      medium: 'cpc',
      campaign: '2026q4_mask',
      content: 'ad1',
    });
    expect(url).toContain('utm_source=facebook');
    expect(url).toContain('utm_medium=cpc');
    expect(url).toContain('utm_campaign=2026q4_mask');
    expect(url).toContain('utm_content=ad1');
  });

  it('保留原有查詢參數', () => {
    const url = buildUtmUrl({
      baseUrl: 'https://shop.example.com/p?ref=line',
      source: 'line',
      medium: 'social',
      campaign: 'c1',
    });
    expect(url).toContain('ref=line');
  });
});

describe('marketing 預算政策', () => {
  const policy: BudgetPolicy = {
    platform: 'facebook',
    accountCurrency: 'TWD',
    dailyLimit: 3000,
    monthlyLimit: 60000,
    maxSingleChangeRate: 0.2,
    minObservationDays: 3,
    approverRole: 'owner',
  };

  it('小幅調整直接允許', () => {
    expect(
      evaluateBudgetChange(policy, { platform: 'facebook', currentDaily: 1000, requestedDaily: 1100, accountCurrency: 'TWD' }),
    ).toEqual({ action: 'allow' });
  });

  it('超過單次變動幅度需核准', () => {
    const decision = evaluateBudgetChange(policy, {
      platform: 'facebook',
      currentDaily: 1000,
      requestedDaily: 1500,
      accountCurrency: 'TWD',
    });
    expect(decision.action).toBe('require_approval');
  });

  it('超過每日上限需核准', () => {
    const decision = evaluateBudgetChange(policy, {
      platform: 'facebook',
      currentDaily: 1000,
      requestedDaily: 5000,
      accountCurrency: 'TWD',
    });
    expect(decision.action).toBe('require_approval');
  });

  it('幣別不符直接拒絕，不把 USD micros 當臺幣元', () => {
    const decision = evaluateBudgetChange(policy, {
      platform: 'facebook',
      currentDaily: 1000,
      requestedDaily: 1100,
      accountCurrency: 'USD',
    });
    expect(decision.action).toBe('reject');
  });

  it('平臺不符直接拒絕', () => {
    const decision = evaluateBudgetChange(policy, {
      platform: 'instagram',
      currentDaily: 1000,
      requestedDaily: 1100,
      accountCurrency: 'TWD',
    });
    expect(decision.action).toBe('reject');
  });
});

describe('marketing micros 轉換', () => {
  it('1 單位 = 1,000,000 micros', () => {
    expect(amountToMicros(5)).toBe(5_000_000);
    expect(microsToAmount(5_000_000)).toBe(5);
  });

  it('拒絕負數與非整數', () => {
    expect(() => amountToMicros(-1)).toThrow(AppError);
    expect(() => microsToAmount(1.5)).toThrow(AppError);
  });
});

describe('marketing 投放資源', () => {
  const draft: AdResourceDraft = {
    internalId: 'AD-1',
    platform: 'facebook',
    externalId: null,
    status: 'paused',
    budgetAmount: 1000,
    budgetCurrency: 'TWD',
    idempotencyKey: 'key-1',
  };

  it('必須先以 paused 建立', () => {
    expect(() => assertDraftIsPaused(draft)).not.toThrow();
    expect(() => assertDraftIsPaused({ ...draft, status: 'active' })).toThrow(AppError);
  });

  it('同一冪等鍵不重複建立資源', () => {
    expect(() => assertIdempotentCreate([draft], 'key-1')).toThrow(AppError);
    expect(() => assertIdempotentCreate([draft], 'key-2')).not.toThrow();
  });
});
