/**
 * 所有外部服務 adapter 的共用契約。
 *
 * 規則（規劃書 14、18 章）：
 * - 沒有憑證或資格時，仍要完成介面、mock、錯誤路徑與測試，
 *   並把外部驗收標成 `integration_pending`，保留 disabled。
 * - 不得以假成功掩蓋缺口：`ok: true` 只能來自真實回應或明確標示的 mock。
 */

export type IntegrationStatus = 'ready' | 'integration_pending' | 'disabled';

export type AdapterMode = 'live' | 'mock';

export interface AdapterCapability {
  readonly name: string;
  readonly status: IntegrationStatus;
  readonly mode: AdapterMode;
  /** 缺少的環境變數名稱（不含值），供後臺顯示設定缺口。 */
  readonly missingEnv: readonly string[];
  readonly notes: string;
}

export interface AdapterOk<T> {
  readonly ok: true;
  readonly mode: AdapterMode;
  readonly value: T;
}

export interface AdapterErr {
  readonly ok: false;
  readonly mode: AdapterMode;
  readonly code: IntegrationErrorCode;
  readonly message: string;
  /** 是否可安全重試（網路、限流、5xx）。 */
  readonly retryable: boolean;
}

export type AdapterResult<T> = AdapterOk<T> | AdapterErr;

export type IntegrationErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'invalid_response'
  | 'network_error'
  | 'provider_error'
  | 'unsupported'
  | 'region_unavailable';

export function ok<T>(value: T, mode: AdapterMode = 'live'): AdapterOk<T> {
  return { ok: true, mode, value };
}

export function err(
  code: IntegrationErrorCode,
  message: string,
  options: { readonly retryable?: boolean; readonly mode?: AdapterMode } = {},
): AdapterErr {
  return {
    ok: false,
    mode: options.mode ?? 'live',
    code,
    message,
    retryable: options.retryable ?? false,
  };
}

/** 缺少憑證時使用；呼叫端必須把狀態記為 integration_pending，不得當成成功。 */
export function notConfigured(missingEnv: readonly string[]): AdapterErr {
  return err(
    'not_configured',
    `尚未設定外部服務憑證：${missingEnv.join(', ')}。請在私密 env 或 secret store 設定後再啟用。`,
    { retryable: false, mode: 'mock' },
  );
}

export function isRetryable(result: AdapterResult<unknown>): boolean {
  return !result.ok && result.retryable;
}

/** 依 HTTP 狀態碼對映可重試性；429 與 5xx 可重試，其餘不可。 */
export function classifyHttpStatus(status: number): {
  readonly code: IntegrationErrorCode;
  readonly retryable: boolean;
} {
  if (status === 401) return { code: 'unauthorized', retryable: false };
  if (status === 403) return { code: 'forbidden', retryable: false };
  if (status === 404) return { code: 'not_found', retryable: false };
  if (status === 429) return { code: 'rate_limited', retryable: true };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  if (status >= 400) return { code: 'invalid_response', retryable: false };
  return { code: 'provider_error', retryable: false };
}

/** 指數退避（含抖動），供 worker 重試使用；上限 30 分鐘。 */
export function backoffDelayMs(
  attempt: number,
  options: { readonly baseMs?: number; readonly maxMs?: number; readonly jitter?: number } = {},
): number {
  const baseMs = options.baseMs ?? 1000;
  const maxMs = options.maxMs ?? 30 * 60 * 1000;
  const jitter = options.jitter ?? 0.2;
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const raw = baseMs * 2 ** (safeAttempt - 1);
  const factor = 1 + (Math.random() * 2 - 1) * jitter;
  // 先加抖動再取上限，maxMs 才是真正的天花板。
  return Math.max(0, Math.round(Math.min(raw * factor, maxMs)));
}

/** 讀取環境變數並回報缺少的鍵；不記錄值。 */
export function readEnv(
  names: readonly string[],
  env: Record<string, string | undefined> = process.env,
): { readonly values: Record<string, string>; readonly missing: readonly string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const raw = env[name];
    if (raw === undefined || raw.trim() === '') {
      missing.push(name);
    } else {
      values[name] = raw;
    }
  }
  return { values, missing };
}

/** 遮蔽敏感字串，只保留前後各 4 碼，供日誌與後臺顯示。 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}
