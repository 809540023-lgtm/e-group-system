/**
 * 環境變數集中解析。
 * 同一 monorepo 內另有日本代購系統使用 DATABASE_URL / SESSION_SECRET，
 * 因此本系統優先讀取 EGROUP_ 前綴，找不到才回退到通用名稱。
 *
 * 正式環境（NODE_ENV=production 或 EGROUP_ENV=production）缺少密鑰時直接拋錯，
 * 不回退到開發預設值：以已知預設值簽章等於任何人都能偽造 session 與取貨碼。
 */

const DEV_DATABASE_URL = 'postgres://localhost:5432/egroup_dev';
const DEV_SESSION_SECRET = 'dev-only-egroup-session-secret-change-me';
const DEV_PICKUP_SECRET = 'dev-only-egroup-pickup-secret-change-me';

type Env = Record<string, string | undefined>;

export function isProduction(env: Env = process.env): boolean {
  return env.NODE_ENV === 'production' || env.EGROUP_ENV === 'production';
}

function pick(env: Env, names: readonly string[]): string | null {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value.trim() !== '') return value;
  }
  return null;
}

function secret(env: Env, primary: string, fallback: string, devDefault: string): string {
  const value = pick(env, [primary, fallback]);
  if (value === null) {
    if (isProduction(env)) throw new Error(`EGROUP_ENV_MISSING: 正式環境必須設定 ${primary}。`);
    return devDefault;
  }
  if (isProduction(env) && value === devDefault) {
    throw new Error(`EGROUP_ENV_INSECURE: ${primary} 不可使用開發預設值。`);
  }
  return value;
}

export function databaseUrl(env: Env = process.env): string {
  const value = pick(env, ['EGROUP_DATABASE_URL', 'DATABASE_URL']);
  if (value !== null) return value;
  if (isProduction(env)) throw new Error('EGROUP_ENV_MISSING: 正式環境必須設定 EGROUP_DATABASE_URL。');
  return DEV_DATABASE_URL;
}

export function sessionSecret(env: Env = process.env): string {
  return secret(env, 'EGROUP_SESSION_SECRET', 'SESSION_SECRET', DEV_SESSION_SECRET);
}

export function pickupSecret(env: Env = process.env): string {
  return secret(env, 'EGROUP_PICKUP_SECRET', 'PICKUP_SECRET', DEV_PICKUP_SECRET);
}

export interface EgroupEnvProblem {
  readonly name: string;
  readonly reason: string;
}

/** 正式環境必須具備的設定；缺少或仍為開發預設值即視為問題。 */
export function validateEgroupEnv(env: Env = process.env): readonly EgroupEnvProblem[] {
  if (!isProduction(env)) return [];
  const problems: EgroupEnvProblem[] = [];

  if (pick(env, ['EGROUP_DATABASE_URL', 'DATABASE_URL']) === null) {
    problems.push({ name: 'EGROUP_DATABASE_URL', reason: '正式環境必須連線 PostgreSQL。' });
  }

  const session = pick(env, ['EGROUP_SESSION_SECRET', 'SESSION_SECRET']);
  if (session === null) {
    problems.push({ name: 'EGROUP_SESSION_SECRET', reason: '正式環境必須設定 session 簽章密鑰。' });
  } else if (session === DEV_SESSION_SECRET) {
    problems.push({ name: 'EGROUP_SESSION_SECRET', reason: '不可使用開發預設值。' });
  }

  const pickup = pick(env, ['EGROUP_PICKUP_SECRET', 'PICKUP_SECRET']);
  if (pickup === null) {
    problems.push({ name: 'EGROUP_PICKUP_SECRET', reason: '正式環境必須設定取貨碼雜湊密鑰。' });
  } else if (pickup === DEV_PICKUP_SECRET) {
    problems.push({ name: 'EGROUP_PICKUP_SECRET', reason: '不可使用開發預設值。' });
  }

  return problems;
}

/** 啟動時呼叫；設定不完整就拒絕啟動，不以替代機制掩蓋。 */
export function assertEgroupEnv(env: Env = process.env): void {
  const problems = validateEgroupEnv(env);
  if (problems.length === 0) return;
  throw new Error(`EGROUP_ENV_INVALID: ${problems.map((p) => `${p.name}（${p.reason}）`).join('；')}`);
}
