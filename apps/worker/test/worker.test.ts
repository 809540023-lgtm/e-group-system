import { describe, expect, it } from 'vitest';
import { readWorkerEnv, validateWorkerEnv } from '../src/env.ts';
import {
  dispatchJob,
  done,
  fail,
  fromAdapter,
  pending,
  retryDelayMs,
  shouldRetry,
  unknownTopicResult,
  withTimeout,
  type OutboxHandler,
  type OutboxJob,
} from '../src/outbox.ts';
import { defaultHandlers } from '../src/handlers/index.ts';
import { createWorker } from '../src/worker.ts';
import { ok, err } from '@jp/integrations';

const baseJob: OutboxJob = {
  job_id: '11111111-1111-1111-1111-111111111111',
  topic: 'payment.confirmed',
  payload: { orderCode: 'JP20260101ABC' },
  attempts: 1,
  max_attempts: 5,
};

const context = { workerId: 'test-worker', now: new Date('2026-01-01T00:00:00Z'), log: () => {} };

describe('readWorkerEnv', () => {
  it('缺少 DATABASE_URL 時為 null，不以記憶體佇列假裝成功', () => {
    expect(readWorkerEnv({}).databaseUrl).toBeNull();
    expect(readWorkerEnv({ DATABASE_URL: '   ' }).databaseUrl).toBeNull();
  });

  it('讀取 DATABASE_URL 並套用預設值', () => {
    const env = readWorkerEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' });
    expect(env.databaseUrl).toBe('postgres://u:p@localhost:5432/db');
    expect(env.batchSize).toBe(20);
    expect(env.leaseSeconds).toBe(120);
    expect(env.pollIntervalMs).toBe(5000);
    expect(env.once).toBe(false);
  });

  it('非正整數的設定值回退為預設，不讓 0 造成無限迴圈', () => {
    const env = readWorkerEnv({ WORKER_BATCH_SIZE: '0', WORKER_POLL_MS: '-5', WORKER_LEASE_SECONDS: 'abc' });
    expect(env.batchSize).toBe(20);
    expect(env.pollIntervalMs).toBe(5000);
    expect(env.leaseSeconds).toBe(120);
  });

  it('WORKER_ONCE=true 時只跑一輪', () => {
    expect(readWorkerEnv({ WORKER_ONCE: 'true' }).once).toBe(true);
  });

  it('未指定 WORKER_ID 時以 pid 產生可辨識的識別碼', () => {
    expect(readWorkerEnv({}).workerId).toContain('worker-');
  });
});

describe('validateWorkerEnv', () => {
  it('缺少 DATABASE_URL 時拒絕啟動', () => {
    const problems = validateWorkerEnv(readWorkerEnv({}));
    expect(problems.map((p) => p.name)).toContain('DATABASE_URL');
  });

  it('租約過短會造成重複處理，必須擋下', () => {
    const problems = validateWorkerEnv(readWorkerEnv({ DATABASE_URL: 'postgres://x', WORKER_LEASE_SECONDS: '10' }));
    expect(problems.map((p) => p.name)).toContain('WORKER_LEASE_SECONDS');
  });

  it('設定完整時沒有問題', () => {
    expect(validateWorkerEnv(readWorkerEnv({ DATABASE_URL: 'postgres://x' }))).toEqual([]);
  });
});

describe('dispatchJob', () => {
  it('未實作的 topic 明確回報，不以假成功掩蓋', async () => {
    const result = await dispatchJob({ ...baseJob, topic: 'not.implemented' }, defaultHandlers(), context);
    expect(result.handled).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.message).toContain('integration_pending');
  });

  it('unknownTopicResult 不重試', () => {
    expect(unknownTopicResult('x').retryable).toBe(false);
  });

  it('處理器成功時回報 ok', async () => {
    const handlers = new Map<string, OutboxHandler>([['payment.confirmed', async () => done('完成')]]);
    const result = await dispatchJob(baseJob, handlers, context);
    expect(result).toMatchObject({ handled: true, ok: true, message: '完成' });
  });

  it('處理器拋出例外時視為可重試失敗，不讓 worker 崩潰', async () => {
    const handlers = new Map<string, OutboxHandler>([
      [
        'payment.confirmed',
        async () => {
          throw new Error('boom');
        },
      ],
    ]);
    const result = await dispatchJob(baseJob, handlers, context);
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.message).toBe('boom');
  });

  it('不可重試的失敗保留 retryable=false', async () => {
    const handlers = new Map<string, OutboxHandler>([['payment.confirmed', async () => fail('格式錯誤')]]);
    const result = await dispatchJob(baseJob, handlers, context);
    expect(result.retryable).toBe(false);
  });
});

describe('shouldRetry', () => {
  it('成功不重試', () => {
    expect(shouldRetry(baseJob, { topic: 't', handled: true, ok: true, message: '', retryable: false })).toBe(false);
  });

  it('不可重試的失敗不重試', () => {
    expect(shouldRetry(baseJob, { topic: 't', handled: true, ok: false, message: '', retryable: false })).toBe(false);
  });

  it('未達上限時重試', () => {
    expect(shouldRetry(baseJob, { topic: 't', handled: true, ok: false, message: '', retryable: true })).toBe(true);
  });

  it('達到上限後不再重試，避免無限重試', () => {
    const exhausted = { ...baseJob, attempts: 5, max_attempts: 5 };
    expect(shouldRetry(exhausted, { topic: 't', handled: true, ok: false, message: '', retryable: true })).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('退避時間隨嘗試次數增加', () => {
    const first = retryDelayMs({ ...baseJob, attempts: 1 });
    const later = retryDelayMs({ ...baseJob, attempts: 4 });
    expect(later).toBeGreaterThan(first);
  });

  it('退避有上限，不會無限成長', () => {
    expect(retryDelayMs({ ...baseJob, attempts: 30 })).toBeLessThanOrEqual(30 * 60 * 1000);
  });
});

describe('withTimeout', () => {
  it('在時限內完成時回傳結果', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'test')).resolves.toBe('ok');
  });

  it('逾時時明確失敗，不讓處理器無限執行', async () => {
    const never = new Promise<string>(() => {});
    await expect(withTimeout(never, 20, 'slow')).rejects.toThrow(/HANDLER_TIMEOUT/);
  });
});

describe('handler outcome helpers', () => {
  it('pending 標示 integration_pending 且不重試', () => {
    const outcome = pending('缺少憑證');
    expect(outcome.ok).toBe(false);
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toContain('integration_pending');
  });

  it('fromAdapter 成功時使用呼叫端說明', () => {
    expect(fromAdapter(ok({ a: 1 }), '已送出')).toEqual({ ok: true, message: '已送出', retryable: false });
  });

  it('fromAdapter 失敗時保留 adapter 的可重試性', () => {
    expect(fromAdapter(err('rate_limited', '限流', { retryable: true }), 'x')).toEqual({
      ok: false,
      message: '限流',
      retryable: true,
    });
  });
});

describe('defaultHandlers', () => {
  it('涵蓋規劃書列出的所有 topic', () => {
    const topics = [...defaultHandlers().keys()];
    expect(topics).toEqual(
      expect.arrayContaining([
        'catalog.sync',
        'payment.confirmed',
        'payment.refund',
        'line.notify.staff',
        'line.notify.customer',
        'shipment.tracking',
        'ads.metrics.pull',
        'ads.draft.create',
        'ai.task.dispatch',
        'staff.summary',
        'reconcile.daily',
      ]),
    );
  });

  it('缺少外部憑證時回報 integration_pending，不假成功', async () => {
    const handlers = defaultHandlers();
    const line = handlers.get('line.notify.staff');
    expect(line).toBeDefined();
    const result = await line!({ ...baseJob, topic: 'line.notify.staff', payload: { staffGroupId: 'C123' } }, context);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('integration_pending');
  });

  it('缺少必要欄位時回報驗證失敗且不重試', async () => {
    const handlers = defaultHandlers();
    const result = await handlers.get('payment.confirmed')!({ ...baseJob, payload: {} }, context);
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.message).toContain('orderCode');
  });

  it('付款確認工作不重複扣庫存，只負責後續通知', async () => {
    const handlers = defaultHandlers();
    const result = await handlers.get('payment.confirmed')!(baseJob, context);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('交易中');
  });

  it('AI 任務在 desktop_manual 模式下只產生任務包，不呼叫外部 API', async () => {
    const handlers = defaultHandlers();
    const result = await handlers.get('ai.task.dispatch')!(
      { ...baseJob, topic: 'ai.task.dispatch', payload: { taskKey: 'catalog.describe', instructions: '寫文案' } },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.message).toContain('未呼叫外部 AI API');
  });

  it('不支援的廣告平台明確失敗', async () => {
    const handlers = defaultHandlers();
    const result = await handlers.get('ads.metrics.pull')!(
      { ...baseJob, topic: 'ads.metrics.pull', payload: { platform: 'tiktok', since: '2026-01-01', until: '2026-01-02' } },
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain('tiktok');
  });
});

describe('createWorker', () => {
  it('缺少 DATABASE_URL 時拒絕啟動，不以假成功掩蓋', async () => {
    const worker = createWorker({ env: readWorkerEnv({}), log: () => {} });
    await expect(worker.run()).rejects.toThrow(/WORKER_ENV_INVALID/);
  });

  it('runOnce 在沒有資料庫連線時明確失敗', async () => {
    const worker = createWorker({ env: readWorkerEnv({}), log: () => {} });
    await expect(worker.runOnce()).rejects.toThrow(/WORKER_NO_DATABASE/);
  });
});
