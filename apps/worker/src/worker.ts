/**
 * Worker 主迴圈（規劃書 16 章；模組 08、11、13、14、15、16、17）。
 *
 * 以租約 + SKIP LOCKED 取得 outbox 工作；重試到上限後送失敗佇列。
 * 收到 SIGINT／SIGTERM 時停止領取新工作，等目前批次完成後才結束。
 */

import { Client } from 'pg';
import { outboxClaimParams, outboxClaimSql, outboxFinishSql, type OutboxJobRow } from '@jp/db';
import { readWorkerEnv, validateWorkerEnv, type WorkerEnv } from './env.ts';
import { defaultHandlers } from './handlers/index.ts';
import { dispatchJob, retryDelayMs, shouldRetry, withTimeout, type OutboxHandler, type OutboxJob } from './outbox.ts';

export const HANDLER_TIMEOUT_MS = 60_000;

export interface WorkerRunSummary {
  readonly claimed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly dead: number;
  readonly unknownTopics: readonly string[];
}

export interface WorkerOptions {
  readonly env?: WorkerEnv;
  readonly handlers?: ReadonlyMap<string, OutboxHandler>;
  readonly log?: (message: string) => void;
  readonly signal?: AbortSignal;
}

export function createWorker(options: WorkerOptions = {}): {
  readonly runOnce: () => Promise<WorkerRunSummary>;
  readonly run: () => Promise<void>;
} {
  const env = options.env ?? readWorkerEnv();
  const handlers = options.handlers ?? defaultHandlers();
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const signal = options.signal;

  let client: Client | null = null;

  async function connect(): Promise<Client> {
    if (client !== null) return client;
    if (env.databaseUrl === null) throw new Error('WORKER_NO_DATABASE: 未設定 DATABASE_URL，worker 不啟動。');
    const created = new Client({ connectionString: env.databaseUrl });
    await created.connect();
    client = created;
    return created;
  }

  async function runOnce(): Promise<WorkerRunSummary> {
    const db = await connect();
    const claimParams = [...outboxClaimParams({ workerId: env.workerId, limit: env.batchSize, leaseSeconds: env.leaseSeconds })];
    const claimed = await db.query<OutboxJobRow>(outboxClaimSql(), claimParams);

    let succeeded = 0;
    let failed = 0;
    let dead = 0;
    const unknownTopics: string[] = [];

    for (const row of claimed.rows) {
      const job: OutboxJob = {
        job_id: row.job_id,
        topic: row.topic,
        payload: row.payload,
        attempts: row.attempts,
        max_attempts: row.max_attempts,
      };
      const result = await dispatchJob(job, handlers, { workerId: env.workerId, now: new Date(), log });
      if (!result.handled) unknownTopics.push(job.topic);

      const finish = await db.query<{ status: string; attempts: number }>(outboxFinishSql(), [
        job.job_id,
        result.ok,
        result.ok ? null : result.message,
      ]);
      const status = finish.rows[0]?.status ?? 'failed';

      if (result.ok) succeeded += 1;
      else if (status === 'dead') dead += 1;
      else failed += 1;

      const retryNote = shouldRetry(job, result) ? `（約 ${Math.round(retryDelayMs(job) / 1000)} 秒後重試）` : '';
      log(`[${env.workerId}] ${job.topic} ${job.job_id} → ${status}${retryNote}：${result.message}`);
    }

    return { claimed: claimed.rows.length, succeeded, failed, dead, unknownTopics };
  }

  async function run(): Promise<void> {
    const problems = validateWorkerEnv(env);
    if (problems.length > 0) {
      for (const problem of problems) log(`設定問題 ${problem.name}：${problem.reason}`);
      throw new Error('WORKER_ENV_INVALID: worker 設定不完整，拒絕啟動。');
    }

    let consecutiveFailures = 0;
    while (signal?.aborted !== true) {
      try {
        const summary = await runOnce();
        consecutiveFailures = 0;
        if (summary.claimed === 0) {
          await sleep(env.pollIntervalMs, signal);
        }
      } catch (cause) {
        consecutiveFailures += 1;
        log(`批次失敗（連續 ${consecutiveFailures} 次）：${cause instanceof Error ? cause.message : '未知錯誤'}`);
        if (consecutiveFailures >= env.maxConsecutiveFailures) {
          throw new Error('WORKER_TOO_MANY_FAILURES: 連續失敗次數過多，停止以避免無限重試。', { cause });
        }
        await sleep(env.pollIntervalMs, signal);
      }
      if (env.once) break;
    }
  }

  return { runOnce, run };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export { withTimeout, HANDLER_TIMEOUT_MS as handlerTimeoutMs };
