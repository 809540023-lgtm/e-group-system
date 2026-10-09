/**
 * ChatGPT Ads（OpenAI Advertiser API）adapter（規劃書 12、13、15 章；模組 14）。
 *
 * 規則：
 * - 使用 OPENAI_ADS_API_KEY，不使用一般模型 key。
 * - 先只讀 ad_account 取得帳號、幣別、時區、review 與 serving 條件。
 * - 用 geo_lookup 查目標臺灣是否在當前可用市場；不可選就保留 disabled，
 *   不改成任意其他國家。
 * - 預算以官方 micros 單位與帳號幣別轉換。
 * - 資源先 paused；create 重試按官方 Idempotency-Key 儲存。
 */

import { amountToMicros, microsToAmount } from '@jp/domain';
import { type AdapterCapability, type AdapterResult, err, notConfigured, ok, readEnv } from '../contract.ts';

export const OPENAI_ADS_ENV_NAMES = ['OPENAI_ADS_API_KEY', 'OPENAI_ADS_API_BASE'] as const;

export const OPENAI_ADS_DEFAULT_BASE = 'https://api.openai.com/v1/ads';

export interface OpenAiAdAccount {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly timezone: string;
  readonly reviewStatus: string;
  readonly servingStatus: string;
}

export interface GeoLookupResult {
  readonly countryCode: string;
  readonly available: boolean;
  readonly reason: string;
}

export interface OpenAiAdDraft {
  readonly internalCampaignId: string;
  readonly name: string;
  readonly objective: string;
  readonly dailyBudgetMicros: number;
  readonly currency: string;
  readonly status: 'paused';
}

export interface OpenAiAdsAdapter {
  capability(): AdapterCapability;
  getAdAccount(): Promise<AdapterResult<OpenAiAdAccount>>;
  geoLookup(countryCode: string): Promise<AdapterResult<GeoLookupResult>>;
  createPausedDraft(draft: OpenAiAdDraft, idempotencyKey: string): Promise<AdapterResult<{ readonly externalId: string; readonly status: 'paused' }>>;
  fetchInsights(input: { readonly since: string; readonly until: string }): Promise<AdapterResult<readonly { readonly date: string; readonly spendMicros: number; readonly impressions: number; readonly clicks: number }[]>>;
}

export interface OpenAiAdsAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly fixtures?: {
    readonly account?: OpenAiAdAccount;
    readonly geo?: Readonly<Record<string, GeoLookupResult>>;
    readonly drafts?: Readonly<Record<string, { readonly externalId: string; readonly status: 'paused' }>>;
  };
}

/** 臺灣是否為當前可用市場；不可用時保留 disabled，不改成其他國家。 */
export function evaluateRegionAvailability(result: GeoLookupResult): {
  readonly enabled: boolean;
  readonly status: 'ready' | 'disabled';
  readonly reason: string;
} {
  if (result.available) {
    return { enabled: true, status: 'ready', reason: `${result.countryCode} 為可用市場。` };
  }
  return {
    enabled: false,
    status: 'disabled',
    reason: `${result.countryCode} 目前不可投放：${result.reason}。保留 disabled，不改成其他國家。`,
  };
}

/** 預算轉換：官方 micros 單位與帳號幣別。 */
export function budgetToMicros(amount: number, currency: string, accountCurrency: string): number {
  if (currency.toUpperCase() !== accountCurrency.toUpperCase()) {
    throw new Error(`幣別不符：預算為 ${currency}，帳號為 ${accountCurrency}。`);
  }
  return amountToMicros(amount);
}

export function microsToBudget(micros: number): number {
  return microsToAmount(micros);
}

export function createOpenAiAdsAdapter(options: OpenAiAdsAdapterOptions = {}): OpenAiAdsAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fixtures = options.fixtures;
  const { values, missing } = readEnv(OPENAI_ADS_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;
  const apiBase = values.OPENAI_ADS_API_BASE ?? OPENAI_ADS_DEFAULT_BASE;

  const capability = (): AdapterCapability => ({
    name: 'openai_ads',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；未取得 ChatGPT Ads 資格，外部驗收為 integration_pending。'
      : missing.length === 0
        ? `已設定 Advertiser API，base = ${apiBase}。`
        : '缺少 OPENAI_ADS_API_KEY，僅能使用 fixtures。',
  });

  async function get<T>(path: string): Promise<AdapterResult<T>> {
    try {
      const response = await fetchImpl(`${apiBase}${path}`, {
        headers: { Authorization: `Bearer ${values.OPENAI_ADS_API_KEY ?? ''}` },
      });
      if (!response.ok) {
        return err('provider_error', `OpenAI Ads 回應 ${response.status}`, {
          retryable: response.status === 429 || response.status >= 500,
        });
      }
      return ok((await response.json()) as T);
    } catch (cause) {
      return err('network_error', `OpenAI Ads 連線失敗：${String(cause)}`, { retryable: true });
    }
  }

  return {
    capability,

    async getAdAccount() {
      if (mockMode) {
        if (fixtures.account === undefined) return err('not_found', 'fixtures 無 ad_account', { mode: 'mock' });
        return ok(fixtures.account, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return get<OpenAiAdAccount>('/ad_account');
    },

    async geoLookup(countryCode) {
      if (mockMode) {
        const fixture = fixtures.geo?.[countryCode];
        if (fixture === undefined) return err('not_found', `fixtures 無 geo ${countryCode}`, { mode: 'mock' });
        return ok(fixture, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return get<GeoLookupResult>(`/geo_lookup?country_code=${encodeURIComponent(countryCode)}`);
    },

    async createPausedDraft(draft, idempotencyKey) {
      if (draft.status !== 'paused') {
        return err('unsupported', '資源必須先以 paused 建立。', { retryable: false });
      }
      if (mockMode) {
        const fixture = fixtures.drafts?.[idempotencyKey];
        if (fixture === undefined) {
          return err('not_found', `fixtures 無此草稿 ${idempotencyKey}`, { mode: 'mock' });
        }
        return ok(fixture, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      return err('unsupported', 'OpenAI Advertiser API 需依當日官方文件實作；目前保留 disabled。', {
        retryable: false,
      });
    },

    async fetchInsights(input) {
      if (mockMode) return ok([], 'mock');
      if (missing.length > 0) return notConfigured(missing);
      return get<readonly { readonly date: string; readonly spendMicros: number; readonly impressions: number; readonly clicks: number }[]>(
        `/insights?since=${encodeURIComponent(input.since)}&until=${encodeURIComponent(input.until)}`,
      );
    },
  };
}

/** 自然搜尋設定、商品資料與廣告分開；不得宣稱上線保證投放或自然推薦。 */
export const OPENAI_ADS_DISCLAIMER =
  'ChatGPT Ads 不保證上線投放或自然搜尋推薦；自然搜尋設定與商品資料為獨立範圍。';
