/**
 * 資料庫存取層（規劃書 14、16 章；模組 02）。
 *
 * 只提供查詢與交易輔助；交易一致性由 migration 中的 SQL 函式保證。
 * 公開 API 使用 jp_web，worker 使用 jp_worker，報表使用 jp_reporter。
 */

export * from './migrate.ts';
export * from './smoke.ts';

export type DbRole = 'web' | 'worker' | 'reporter';

export interface DbConfig {
  readonly webUrl: string;
  readonly workerUrl: string;
  readonly reporterUrl: string;
}

export const DB_ENV_NAMES = ['DATABASE_URL', 'DATABASE_URL_WORKER', 'DATABASE_URL_REPORTER'] as const;

export function readDbConfig(env: Record<string, string | undefined> = process.env): {
  readonly config: DbConfig | null;
  readonly missing: readonly string[];
} {
  const missing: string[] = [];
  const webUrl = env.DATABASE_URL;
  const workerUrl = env.DATABASE_URL_WORKER;
  const reporterUrl = env.DATABASE_URL_REPORTER;
  if (webUrl === undefined || webUrl.trim() === '') missing.push('DATABASE_URL');
  if (workerUrl === undefined || workerUrl.trim() === '') missing.push('DATABASE_URL_WORKER');
  if (reporterUrl === undefined || reporterUrl.trim() === '') missing.push('DATABASE_URL_REPORTER');
  if (missing.length > 0) return { config: null, missing };
  return { config: { webUrl: webUrl as string, workerUrl: workerUrl as string, reporterUrl: reporterUrl as string }, missing: [] };
}

/** 公開 API 不得使用管理帳號；連線字串角色必須符合預期。 */
export function assertRoleMatches(url: string, expectedRole: DbRole): void {
  const role = url.match(/^postgres(?:ql)?:\/\/([^:@/]+)/)?.[1];
  const expected = `jp_${expectedRole}`;
  if (role === undefined) {
    throw new Error('DB_ROLE_UNPARSEABLE: 無法從連線字串解析角色。');
  }
  if (role !== expected) {
    throw new Error(`DB_ROLE_MISMATCH: 連線角色為 ${role}，應為 ${expected}。公開 API 不得使用管理帳號。`);
  }
}

export interface OutboxJobRow {
  readonly job_id: string;
  readonly topic: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  readonly max_attempts: number;
}

export interface OutboxClaim {
  readonly workerId: string;
  readonly limit: number;
  readonly leaseSeconds: number;
}

export function outboxClaimSql(): string {
  return 'SELECT * FROM jp_claim_outbox_jobs($1, $2, $3)';
}

export function outboxClaimParams(claim: OutboxClaim): readonly unknown[] {
  return [claim.workerId, claim.limit, claim.leaseSeconds];
}

export function outboxFinishSql(): string {
  return 'SELECT * FROM jp_finish_outbox_job($1, $2, $3)';
}

/** 每日台北 06:00 商品同步的排程鍵；手動觸發共用同一 job。 */
export const CATALOG_SYNC_SCHEDULE = '0 6 * * *';
export const CATALOG_SYNC_TIMEZONE = 'Asia/Taipei';
export const OUTBOX_INTERVAL_MINUTES = 5;
export const STAFF_SUMMARY_SCHEDULE = '0 9 * * *';
