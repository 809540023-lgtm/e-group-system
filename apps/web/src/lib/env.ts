/**
 * 環境設定（規劃書 14、18 章；模組 01、03）。
 *
 * 秘密只從私密 env 讀取，不使用 NEXT_PUBLIC_ 前綴。
 * 正式模式缺少必要設定時直接拒絕啟動，不以替代機制掩蓋。
 */

export type AppMode = 'development' | 'staging' | 'production';

export interface WebEnv {
  readonly mode: AppMode;
  readonly publicBaseUrl: string;
  readonly sessionSecret: string | null;
  readonly quoteSigningSecret: string | null;
  readonly databaseUrl: string | null;
  readonly devAuthEnabled: boolean;
  readonly ecpayHashKey: string | null;
  readonly ecpayHashIv: string | null;
  readonly ecpayMerchantId: string | null;
  readonly lineChannelSecret: string | null;
  readonly lineChannelAccessToken: string | null;
}

export const WEB_ENV_NAMES = [
  'APP_MODE',
  'PUBLIC_BASE_URL',
  'SESSION_SECRET',
  'QUOTE_SIGNING_SECRET',
  'DATABASE_URL',
  'DEV_AUTH_ENABLED',
  'ECPAY_HASH_KEY',
  'ECPAY_HASH_IV',
  'ECPAY_MERCHANT_ID',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
] as const;

function readMode(raw: string | undefined): AppMode {
  if (raw === 'production' || raw === 'staging' || raw === 'development') return raw;
  return 'development';
}

function nonEmpty(value: string | undefined): string | null {
  return value === undefined || value.trim() === '' ? null : value;
}

export function readWebEnv(env: Record<string, string | undefined> = process.env): WebEnv {
  const mode = readMode(env.APP_MODE);
  return {
    mode,
    publicBaseUrl: nonEmpty(env.PUBLIC_BASE_URL) ?? 'http://localhost:3000',
    sessionSecret: nonEmpty(env.SESSION_SECRET),
    quoteSigningSecret: nonEmpty(env.QUOTE_SIGNING_SECRET),
    databaseUrl: nonEmpty(env.DATABASE_URL),
    // dev-only auth 只在非正式模式可用。
    devAuthEnabled: mode !== 'production' && env.DEV_AUTH_ENABLED === 'true',
    ecpayHashKey: nonEmpty(env.ECPAY_HASH_KEY),
    ecpayHashIv: nonEmpty(env.ECPAY_HASH_IV),
    ecpayMerchantId: nonEmpty(env.ECPAY_MERCHANT_ID),
    lineChannelSecret: nonEmpty(env.LINE_CHANNEL_SECRET),
    lineChannelAccessToken: nonEmpty(env.LINE_CHANNEL_ACCESS_TOKEN),
  };
}

export interface EnvProblem {
  readonly name: string;
  readonly reason: string;
}

/** 正式模式必須具備的設定；缺少即拒絕啟動。 */
export function validateProductionEnv(env: WebEnv): readonly EnvProblem[] {
  if (env.mode !== 'production') return [];
  const problems: EnvProblem[] = [];
  if (env.sessionSecret === null) problems.push({ name: 'SESSION_SECRET', reason: '正式模式必須設定 session 簽章密鑰。' });
  if (env.quoteSigningSecret === null) problems.push({ name: 'QUOTE_SIGNING_SECRET', reason: '正式模式必須設定報價簽章密鑰。' });
  if (env.databaseUrl === null) problems.push({ name: 'DATABASE_URL', reason: '正式模式必須連線 PostgreSQL。' });
  if (env.publicBaseUrl.startsWith('http://')) problems.push({ name: 'PUBLIC_BASE_URL', reason: '正式模式必須使用 https。' });
  if (env.devAuthEnabled) problems.push({ name: 'DEV_AUTH_ENABLED', reason: '正式模式不得啟用 dev-only auth。' });
  return problems;
}

/** 正式模式若啟用 dev-only auth 即拒絕啟動。 */
export function assertDevAuthAllowed(env: WebEnv): void {
  if (env.mode === 'production' && env.devAuthEnabled) {
    throw new Error('DEV_AUTH_FORBIDDEN_IN_PRODUCTION: 正式模式不得啟用 dev-only auth。');
  }
}

export function isProduction(env: WebEnv = readWebEnv()): boolean {
  return env.mode === 'production';
}
