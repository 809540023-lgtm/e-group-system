import { describe, expect, it } from 'vitest';
import {
  META_DEFAULT_GRAPH_VERSION,
  assertCurrencyMatches,
  createMetaAdapter,
  filterConsentedEvents,
  separateAttributionFromActual,
  type MetaConversionEvent,
} from '../src/meta/index.ts';
import {
  OPENAI_ADS_DISCLAIMER,
  budgetToMicros,
  createOpenAiAdsAdapter,
  evaluateRegionAvailability,
  microsToBudget,
} from '../src/openai-ads/index.ts';

const META_ENV = {
  META_APP_ID: '1',
  META_APP_SECRET: 's',
  META_ACCESS_TOKEN: 't',
  META_AD_ACCOUNT_ID: 'act_1',
  META_PIXEL_ID: 'p',
  META_GRAPH_VERSION: 'v21.0',
};

describe('Meta adapter', () => {
  it('無憑證時為 integration_pending', () => {
    const adapter = createMetaAdapter({ env: {} });
    expect(adapter.capability().status).toBe('integration_pending');
  });

  it('已設定時 describe 回報能力與版本', () => {
    const adapter = createMetaAdapter({ env: META_ENV });
    const cap = adapter.describe();
    expect(cap.graphVersion).toBe('v21.0');
    expect(cap.adAccountId).toBe('act_1');
    expect(cap.canCreateDraft).toBe(true);
  });

  it('未設定版本時使用預設 Graph 版本', () => {
    const adapter = createMetaAdapter({ env: { ...META_ENV, META_GRAPH_VERSION: undefined } });
    expect(adapter.describe().graphVersion).toBe(META_DEFAULT_GRAPH_VERSION);
  });

  it('草稿必須為 PAUSED', async () => {
    const adapter = createMetaAdapter({ env: META_ENV });
    const result = await adapter.createPausedDraft(
      {
        internalCampaignId: 'c1',
        name: 'n',
        objective: 'OUTCOME_SALES',
        dailyBudgetMicros: 1_000_000,
        currency: 'TWD',
        placements: ['facebook'],
        creativeIds: [],
        status: 'ACTIVE' as unknown as 'PAUSED',
      },
      'k',
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('unsupported');
  });

  it('未設定憑證時建立草稿回報 not_configured', async () => {
    const adapter = createMetaAdapter({ env: {} });
    const result = await adapter.createPausedDraft(
      {
        internalCampaignId: 'c1',
        name: 'n',
        objective: 'OUTCOME_SALES',
        dailyBudgetMicros: 1,
        currency: 'TWD',
        placements: ['facebook'],
        creativeIds: [],
        status: 'PAUSED',
      },
      'k',
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });

  it('fixtures 模式建立草稿依 idempotencyKey 回傳同一資源', async () => {
    const adapter = createMetaAdapter({
      env: {},
      fixtures: { drafts: { 'k1': { externalId: 'ext-1', status: 'PAUSED' } } },
    });
    const draft = {
      internalCampaignId: 'c1',
      name: 'n',
      objective: 'OUTCOME_SALES',
      dailyBudgetMicros: 1,
      currency: 'TWD',
      placements: ['facebook' as const],
      creativeIds: [],
      status: 'PAUSED' as const,
    };
    const first = await adapter.createPausedDraft(draft, 'k1');
    const second = await adapter.createPausedDraft(draft, 'k1');
    expect(first).toEqual(second);
  });

  it('未取得同意的轉換事件被跳過', () => {
    const events: MetaConversionEvent[] = [
      { eventName: 'Purchase', eventId: 'e1', eventTime: 1, value: 100, currency: 'TWD', orderCode: 'O1', consentGranted: true },
      { eventName: 'Purchase', eventId: 'e2', eventTime: 2, value: 200, currency: 'TWD', orderCode: 'O2', consentGranted: false },
    ];
    const { accepted, skipped } = filterConsentedEvents(events);
    expect(accepted.map((e) => e.eventId)).toEqual(['e1']);
    expect(skipped.map((e) => e.eventId)).toEqual(['e2']);
  });

  it('sendConversions 只計入已同意事件', async () => {
    const adapter = createMetaAdapter({ env: {}, fixtures: {} });
    const result = await adapter.sendConversions([
      { eventName: 'Purchase', eventId: 'e1', eventTime: 1, value: 1, currency: 'TWD', orderCode: 'O1', consentGranted: true },
      { eventName: 'Purchase', eventId: 'e2', eventTime: 2, value: 1, currency: 'TWD', orderCode: 'O2', consentGranted: false },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value).toEqual({ accepted: 1, skipped: 1 });
  });

  it('幣別不符時拒絕', () => {
    expect(() => assertCurrencyMatches('TWD', 'USD')).toThrow(/幣別不符/);
    expect(() => assertCurrencyMatches('twd', 'TWD')).not.toThrow();
  });

  it('fixtures 模式 insights 依日期區間過濾', async () => {
    const adapter = createMetaAdapter({
      env: {},
      fixtures: {
        insights: [
          { date: '2026-01-01', campaignId: 'c', spendMicros: 1, currency: 'TWD', impressions: 1, clicks: 1, platformAttributedPurchases: 1, platformAttributedRevenueMicros: 1 },
          { date: '2026-02-01', campaignId: 'c', spendMicros: 1, currency: 'TWD', impressions: 1, clicks: 1, platformAttributedPurchases: 1, platformAttributedRevenueMicros: 1 },
        ],
      },
    });
    const result = await adapter.fetchInsights({ since: '2026-01-01', until: '2026-01-31' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value).toHaveLength(1);
  });

  it('平臺歸因與實際營收分開顯示', () => {
    const separated = separateAttributionFromActual({ platformAttributedRevenueTwd: 10_000, actualNetRevenueTwd: 6_000 });
    expect(separated.platformAttributedRevenueTwd).toBe(10_000);
    expect(separated.actualNetRevenueTwd).toBe(6_000);
    expect(separated.note).toContain('不可加總');
  });
});

describe('ChatGPT Ads adapter', () => {
  it('無憑證時為 integration_pending', () => {
    const adapter = createOpenAiAdsAdapter({ env: {} });
    const cap = adapter.capability();
    expect(cap.status).toBe('integration_pending');
    expect(cap.missingEnv).toContain('OPENAI_ADS_API_KEY');
  });

  it('未設定時 getAdAccount 回報 not_configured', async () => {
    const adapter = createOpenAiAdsAdapter({ env: {} });
    const result = await adapter.getAdAccount();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });

  it('fixtures 模式取得帳號', async () => {
    const adapter = createOpenAiAdsAdapter({
      env: {},
      fixtures: {
        account: { id: 'a1', name: 'n', currency: 'USD', timezone: 'Asia/Taipei', reviewStatus: 'approved', servingStatus: 'active' },
      },
    });
    const result = await adapter.getAdAccount();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.currency).toBe('USD');
  });

  it('臺灣不可用時保留 disabled，不改成其他國家', () => {
    const decision = evaluateRegionAvailability({ countryCode: 'TW', available: false, reason: '尚未開放' });
    expect(decision.enabled).toBe(false);
    expect(decision.status).toBe('disabled');
    expect(decision.reason).toContain('不改成其他國家');
  });

  it('臺灣可用時啟用', () => {
    const decision = evaluateRegionAvailability({ countryCode: 'TW', available: true, reason: '' });
    expect(decision.enabled).toBe(true);
    expect(decision.status).toBe('ready');
  });

  it('預算以 micros 轉換且幣別必須相符', () => {
    expect(budgetToMicros(100, 'USD', 'USD')).toBe(100_000_000);
    expect(() => budgetToMicros(100, 'TWD', 'USD')).toThrow(/幣別不符/);
    expect(microsToBudget(100_000_000)).toBe(100);
  });

  it('草稿必須為 paused', async () => {
    const adapter = createOpenAiAdsAdapter({ env: {} });
    const result = await adapter.createPausedDraft(
      {
        internalCampaignId: 'c',
        name: 'n',
        objective: 'o',
        dailyBudgetMicros: 1,
        currency: 'USD',
        status: 'active' as unknown as 'paused',
      },
      'k',
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('unsupported');
  });

  it('fixtures 模式建立 paused 草稿', async () => {
    const adapter = createOpenAiAdsAdapter({
      env: {},
      fixtures: { drafts: { k1: { externalId: 'x1', status: 'paused' } } },
    });
    const result = await adapter.createPausedDraft(
      { internalCampaignId: 'c', name: 'n', objective: 'o', dailyBudgetMicros: 1, currency: 'USD', status: 'paused' },
      'k1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.status).toBe('paused');
  });

  it('免責聲明不得宣稱保證投放', () => {
    expect(OPENAI_ADS_DISCLAIMER).toContain('不保證');
  });
});
