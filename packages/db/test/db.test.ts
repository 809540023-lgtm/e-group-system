import { describe, expect, it } from 'vitest';
import {
  assertRoleMatches,
  checksumOf,
  describeRollback,
  loadMigrations,
  outboxClaimParams,
  planMigrations,
  readDbConfig,
  type AppliedMigration,
  type MigrationFile,
} from '../src/index.ts';

function file(version: string, sql: string): MigrationFile {
  return { version, path: `/x/${version}.sql`, sql, checksum: checksumOf(sql) };
}

describe('migration 規劃', () => {
  it('未套用的版本列為 pending', () => {
    const plan = planMigrations([file('001_core', 'a'), file('002_jobs', 'b')], []);
    expect(plan.pending.map((f) => f.version)).toEqual(['001_core', '002_jobs']);
    expect(plan.alreadyApplied).toEqual([]);
  });

  it('已套用且 checksum 相同時列為 alreadyApplied', () => {
    const f = file('001_core', 'a');
    const applied: AppliedMigration[] = [{ version: '001_core', checksum: f.checksum, appliedAt: '2026-01-01' }];
    const plan = planMigrations([f], applied);
    expect(plan.pending).toEqual([]);
    expect(plan.alreadyApplied.map((x) => x.version)).toEqual(['001_core']);
    expect(plan.checksumMismatches).toEqual([]);
  });

  it('已套用版本內容被修改時回報 checksum 不符', () => {
    const applied: AppliedMigration[] = [{ version: '001_core', checksum: 'deadbeef', appliedAt: '2026-01-01' }];
    const plan = planMigrations([file('001_core', 'a')], applied);
    expect(plan.checksumMismatches).toHaveLength(1);
    expect(plan.checksumMismatches[0]?.version).toBe('001_core');
  });

  it('checksumOf 對相同內容穩定、不同內容不同', () => {
    expect(checksumOf('abc')).toBe(checksumOf('abc'));
    expect(checksumOf('abc')).not.toBe(checksumOf('abd'));
    expect(checksumOf('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('loadMigrations 依檔名排序載入實際 migration', async () => {
    const files = await loadMigrations();
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files[0]?.version).toBe('001_core');
    expect(files[1]?.version).toBe('002_jobs');
    expect(files[2]?.version).toBe('003_roles');
    for (const f of files) {
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(f.sql.length).toBeGreaterThan(100);
    }
  });

  it('001_core 包含核心表與整數金額約束', async () => {
    const files = await loadMigrations();
    const core = files.find((f) => f.version === '001_core')?.sql ?? '';
    for (const table of [
      'products', 'skus', 'inventory', 'inventory_reservations', 'orders', 'order_lines',
      'quotes', 'payment_attempts', 'payment_events', 'payment_transactions', 'refund_requests',
      'outbox_jobs', 'audit_events', 'schema_migrations',
    ]) {
      expect(core).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(core).toContain('CHECK (reserved <= on_hand)');
    expect(core).toContain('CHECK (refunded_twd <= paid_twd)');
    expect(core).toContain('preorder_quota');
  });

  it('002_jobs 包含交易函式', async () => {
    const files = await loadMigrations();
    const jobs = files.find((f) => f.version === '002_jobs')?.sql ?? '';
    for (const fn of [
      'jp_create_order', 'jp_apply_payment_event', 'jp_request_refund', 'jp_complete_refund',
      'jp_release_expired_reservations', 'jp_claim_outbox_jobs', 'jp_finish_outbox_job',
    ]) {
      expect(jobs).toContain(`FUNCTION ${fn}`);
    }
    expect(jobs).toContain('FOR UPDATE SKIP LOCKED');
    expect(jobs).toContain('ORDER BY elem->>\'sku\'');
  });

  it('003_roles 建立三個最小權限角色且報表不得讀個資', async () => {
    const files = await loadMigrations();
    const roles = files.find((f) => f.version === '003_roles')?.sql ?? '';
    expect(roles).toContain('CREATE ROLE jp_web');
    expect(roles).toContain('CREATE ROLE jp_worker');
    expect(roles).toContain('CREATE ROLE jp_reporter');
    expect(roles).toContain('REVOKE ALL ON customer_private, addresses FROM jp_reporter');
    expect(roles).toContain('NOSUPERUSER');
  });
});

describe('無破壞回復', () => {
  it('回報目前版本與需回復的步驟', () => {
    const applied: AppliedMigration[] = [
      { version: '001_core', checksum: 'a', appliedAt: '' },
      { version: '002_jobs', checksum: 'b', appliedAt: '' },
      { version: '003_roles', checksum: 'c', appliedAt: '' },
    ];
    const result = describeRollback(applied, '001_core');
    expect(result.current).toBe('003_roles');
    expect(result.steps).toEqual(['002_jobs', '003_roles']);
    expect(result.destructive).toBe(true);
  });

  it('已在目標版本時無步驟', () => {
    const applied: AppliedMigration[] = [{ version: '001_core', checksum: 'a', appliedAt: '' }];
    const result = describeRollback(applied, '001_core');
    expect(result.steps).toEqual([]);
    expect(result.destructive).toBe(false);
  });

  it('沒有已套用版本時 current 為 null', () => {
    expect(describeRollback([], '001_core').current).toBeNull();
  });
});

describe('資料庫設定', () => {
  it('缺少連線字串時回報缺少的鍵', () => {
    const { config, missing } = readDbConfig({});
    expect(config).toBeNull();
    expect(missing).toEqual(['DATABASE_URL', 'DATABASE_URL_WORKER', 'DATABASE_URL_REPORTER']);
  });

  it('三個連線字串齊全時回傳設定', () => {
    const { config, missing } = readDbConfig({
      DATABASE_URL: 'postgres://jp_web:pw@localhost:5432/jp',
      DATABASE_URL_WORKER: 'postgres://jp_worker:pw@localhost:5432/jp',
      DATABASE_URL_REPORTER: 'postgres://jp_reporter:pw@localhost:5432/jp',
    });
    expect(missing).toEqual([]);
    expect(config?.webUrl).toContain('jp_web');
  });

  it('角色不符時拒絕，避免公開 API 使用管理帳號', () => {
    expect(() => assertRoleMatches('postgres://postgres:pw@localhost:5432/jp', 'web')).toThrow(/DB_ROLE_MISMATCH/);
    expect(() => assertRoleMatches('postgres://jp_web:pw@localhost:5432/jp', 'web')).not.toThrow();
    expect(() => assertRoleMatches('postgres://jp_worker:pw@localhost:5432/jp', 'worker')).not.toThrow();
    expect(() => assertRoleMatches('postgres://jp_reporter:pw@localhost:5432/jp', 'reporter')).not.toThrow();
  });

  it('無法解析角色時拒絕', () => {
    expect(() => assertRoleMatches('not-a-url', 'web')).toThrow(/DB_ROLE_UNPARSEABLE/);
  });

  it('outbox 認領參數順序正確', () => {
    expect(outboxClaimParams({ workerId: 'w1', limit: 20, leaseSeconds: 120 })).toEqual(['w1', 20, 120]);
  });
});
