/**
 * Worker 設定（規劃書 16、18 章；模組 08、11、13、14、15、16、17）。
 *
 * 秘密只從私密 env 讀取。缺少 DATABASE_URL 時 worker 不啟動，
 * 不以記憶體佇列假裝處理成功。
 */

export interface WorkerEnv {
  readonly databaseUrl: string | null;
  readonly workerId: string;
  readonly batchSize: number;
  readonly leaseSeconds: number;
  readonly pollIntervalMs: number;
  readonly maxConsecutiveFailures: number;
  readonly once: boolean;
}

export const WORKER_ENV_NAMES = ['DATABASE_URL', 'WORKER_ID', 'WORKER_BATCH_SIZE', 'WORKER_LEASE_SECONDS', 'WORKER_POLL_MS'] as const;

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function readWorkerEnv(env: Record<string, string | undefined> = process.env): WorkerEnv {
  const databaseUrl = env.DATABASE_URL === undefined || env.DATABASE_URL.trim() === '' ? null : env.DATABASE_URL;
  const workerId = env.WORKER_ID === undefined || env.WORKER_ID.trim() === '' ? `worker-${process.pid}` : env.WORKER_ID;
  return {
    databaseUrl,
    workerId,
    batchSize: positiveInt(env.WORKER_BATCH_SIZE, 20),
    leaseSeconds: positiveInt(env.WORKER_LEASE_SECONDS, 120),
    pollIntervalMs: positiveInt(env.WORKER_POLL_MS, 5_000),
    maxConsecutiveFailures: positiveInt(env.WORKER_MAX_FAILURES, 10),
    once: env.WORKER_ONCE === 'true',
  };
}

export interface WorkerProblem {
  readonly name: string;
  readonly reason: string;
}

/** 啟動前檢查；缺少必要設定時拒絕啟動。 */
export function validateWorkerEnv(env: WorkerEnv): readonly WorkerProblem[] {
  const problems: WorkerProblem[] = [];
  if (env.databaseUrl === null) {
    problems.push({ name: 'DATABASE_URL', reason: 'worker 必須連線 PostgreSQL 才能取得 outbox 工作。' });
  }
  if (env.leaseSeconds < 30) {
    problems.push({ name: 'WORKER_LEASE_SECONDS', reason: '租約過短會造成同一工作被重複處理，至少 30 秒。' });
  }
  return problems;
}
