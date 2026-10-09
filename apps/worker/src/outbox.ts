/**
 * Outbox 工作處理（規劃書 16 章；模組 08、11、13、14、15、16、17）。
 *
 * 以租約 + SKIP LOCKED 取得工作，重試到上限後送失敗佇列，不無限重試。
 * 每個 topic 的處理器必須是冪等的：同一工作重複執行不得產生第二次外部副作用。
 */

import { backoffDelayMs, type AdapterResult } from '@jp/integrations';

export type OutboxTopic =
  | 'catalog.sync'
  | 'payment.confirmed'
  | 'payment.refund'
  | 'line.notify.staff'
  | 'line.notify.customer'
  | 'shipment.tracking'
  | 'ads.metrics.pull'
  | 'ads.draft.create'
  | 'ai.task.dispatch'
  | 'staff.summary'
  | 'reconcile.daily';

export interface OutboxJob {
  readonly job_id: string;
  readonly topic: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  readonly max_attempts: number;
}

export interface HandlerContext {
  readonly workerId: string;
  readonly now: Date;
  readonly log: (message: string) => void;
}

/**
 * 處理器結果。刻意不使用 AdapterResult：處理器需要一句可讀的結果說明，
 * 而 AdapterOk 沒有 message 欄位。
 */
export interface HandlerOutcome {
  readonly ok: boolean;
  readonly message: string;
  readonly retryable: boolean;
}

export type OutboxHandler = (job: OutboxJob, context: HandlerContext) => Promise<HandlerOutcome>;

/** 成功結果。 */
export function done(message: string): HandlerOutcome {
  return { ok: true, message, retryable: false };
}

/** 失敗結果；retryable 決定是否進入重試。 */
export function fail(message: string, retryable = false): HandlerOutcome {
  return { ok: false, message, retryable };
}

/** 缺少外部憑證：狀態維持 integration_pending，不重試、不假成功。 */
export function pending(message: string): HandlerOutcome {
  return { ok: false, message: `integration_pending：${message}`, retryable: false };
}

/** 把 adapter 結果轉成處理器結果；成功時使用呼叫端提供的說明。 */
export function fromAdapter<T>(result: AdapterResult<T>, successMessage: string): HandlerOutcome {
  if (result.ok) return done(successMessage);
  return { ok: false, message: result.message, retryable: result.retryable };
}

export interface DispatchResult {
  readonly topic: string;
  readonly handled: boolean;
  readonly ok: boolean;
  readonly message: string;
  readonly retryable: boolean;
}

/** 未實作的 topic 明確回報，不以假成功掩蓋。 */
export function unknownTopicResult(topic: string): DispatchResult {
  return {
    topic,
    handled: false,
    ok: false,
    message: `尚未實作 topic ${topic} 的處理器；狀態維持 integration_pending。`,
    retryable: false,
  };
}

export async function dispatchJob(
  job: OutboxJob,
  handlers: ReadonlyMap<string, OutboxHandler>,
  context: HandlerContext,
): Promise<DispatchResult> {
  const handler = handlers.get(job.topic);
  if (handler === undefined) return unknownTopicResult(job.topic);

  try {
    const result = await handler(job, context);
    return { topic: job.topic, handled: true, ok: result.ok, message: result.message, retryable: result.retryable };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '處理器發生未知錯誤';
    return { topic: job.topic, handled: true, ok: false, message, retryable: true };
  }
}

/**
 * 決定工作是否應繼續重試。
 * 已達上限或錯誤不可重試時，直接送失敗佇列。
 */
export function shouldRetry(job: OutboxJob, result: DispatchResult): boolean {
  if (result.ok) return false;
  if (!result.retryable) return false;
  return job.attempts < job.max_attempts;
}

/**
 * 下一次重試的等待毫秒數。
 * 實際的 available_at 由 `jp_finish_outbox_job` 在同一交易內寫入；
 * 這裡只用於記錄與顯示，不作為重試依據。
 */
export function retryDelayMs(job: OutboxJob): number {
  return backoffDelayMs(job.attempts, { jitter: 0.2 });
}

/** 逾時保護：處理器不得無限執行，超過即視為失敗並等待租約回收。 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`HANDLER_TIMEOUT: ${label} 超過 ${timeoutMs} 毫秒`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
