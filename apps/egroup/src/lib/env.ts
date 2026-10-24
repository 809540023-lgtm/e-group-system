/**
 * 環境變數集中解析。
 * 同一 monorepo 內另有日本代購系統使用 DATABASE_URL / SESSION_SECRET，
 * 因此本系統優先讀取 EGROUP_ 前綴，找不到才回退到通用名稱。
 */
export function databaseUrl(): string {
  return process.env.EGROUP_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgres://localhost:5432/egroup_dev';
}

export function sessionSecret(): string {
  return process.env.EGROUP_SESSION_SECRET ?? process.env.SESSION_SECRET ?? 'dev-only-egroup-session-secret-change-me';
}

export function pickupSecret(): string {
  return process.env.EGROUP_PICKUP_SECRET ?? process.env.PICKUP_SECRET ?? 'dev-only-egroup-pickup-secret-change-me';
}
