/**
 * 版本化 migration 執行器（規劃書 14、18 章；模組 02、18）。
 *
 * 特性：
 * - 逐版套用，記錄 version 與 checksum；已套用的版本若 checksum 改變即拒絕。
 * - 每個 migration 在自己的交易中執行（SQL 檔內另有 BEGIN/COMMIT 時由檔案控制）。
 * - 提供 dry-run 與無破壞回復（只回報，不自動逆轉金融紀錄）。
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MigrationFile {
  readonly version: string;
  readonly path: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface AppliedMigration {
  readonly version: string;
  readonly checksum: string;
  readonly appliedAt: string;
}

export interface MigrationPlan {
  readonly pending: readonly MigrationFile[];
  readonly alreadyApplied: readonly MigrationFile[];
  readonly checksumMismatches: readonly { readonly version: string; readonly expected: string; readonly actual: string }[];
}

export interface Queryable {
  query(sql: string, params?: readonly unknown[]): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<readonly MigrationFile[]> {
  const entries = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  for (const name of entries) {
    const path = join(dir, name);
    const sql = await readFile(path, 'utf8');
    files.push({ version: name.replace(/\.sql$/, ''), path, sql, checksum: checksumOf(sql) });
  }
  return files;
}

export function planMigrations(
  files: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): MigrationPlan {
  const appliedByVersion = new Map(applied.map((a) => [a.version, a]));
  const pending: MigrationFile[] = [];
  const alreadyApplied: MigrationFile[] = [];
  const checksumMismatches: { version: string; expected: string; actual: string }[] = [];

  for (const file of files) {
    const record = appliedByVersion.get(file.version);
    if (record === undefined) {
      pending.push(file);
      continue;
    }
    alreadyApplied.push(file);
    if (record.checksum !== file.checksum) {
      checksumMismatches.push({ version: file.version, expected: record.checksum, actual: file.checksum });
    }
  }

  return { pending, alreadyApplied, checksumMismatches };
}

export async function ensureMigrationsTable(db: Queryable): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum   text NOT NULL
    )
  `);
}

export async function readAppliedMigrations(db: Queryable): Promise<readonly AppliedMigration[]> {
  const result = await db.query('SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version');
  return result.rows.map((row) => ({
    version: String(row.version),
    checksum: String(row.checksum),
    appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : String(row.applied_at),
  }));
}

export interface MigrateOptions {
  readonly dir?: string;
  readonly dryRun?: boolean;
  readonly log?: (message: string) => void;
}

export interface MigrateResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
  readonly pendingCount: number;
  readonly dryRun: boolean;
}

export async function migrate(db: Queryable, options: MigrateOptions = {}): Promise<MigrateResult> {
  const log = options.log ?? (() => {});
  const dryRun = options.dryRun ?? false;

  await ensureMigrationsTable(db);
  const files = await loadMigrations(options.dir);
  const applied = await readAppliedMigrations(db);
  const plan = planMigrations(files, applied);

  if (plan.checksumMismatches.length > 0) {
    const detail = plan.checksumMismatches.map((m) => `${m.version}（已套用 ${m.expected.slice(0, 12)}，檔案 ${m.actual.slice(0, 12)}）`).join('、');
    throw new Error(`MIGRATION_CHECKSUM_MISMATCH: 已套用的 migration 內容被修改：${detail}。請新增版本，不要改舊版。`);
  }

  if (dryRun) {
    for (const file of plan.pending) log(`[dry-run] 將套用 ${file.version}`);
    return { applied: [], skipped: plan.alreadyApplied.map((f) => f.version), pendingCount: plan.pending.length, dryRun: true };
  }

  const appliedNow: string[] = [];
  for (const file of plan.pending) {
    log(`套用 ${file.version}`);
    await db.query(file.sql);
    await db.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file.version, file.checksum]);
    appliedNow.push(file.version);
  }

  return { applied: appliedNow, skipped: plan.alreadyApplied.map((f) => f.version), pendingCount: 0, dryRun: false };
}

/**
 * 無破壞回復：只回報目前版本與可回復的目標，不自動逆轉金融紀錄。
 * 真正的資料回復由備份還原流程處理（規劃書 19 章）。
 */
export function describeRollback(
  applied: readonly AppliedMigration[],
  targetVersion: string,
): { readonly current: string | null; readonly target: string; readonly steps: readonly string[]; readonly destructive: boolean } {
  const current = applied.length > 0 ? (applied[applied.length - 1]?.version ?? null) : null;
  const steps = applied.filter((a) => a.version > targetVersion).map((a) => a.version);
  return {
    current,
    target: targetVersion,
    steps,
    destructive: steps.length > 0,
  };
}
