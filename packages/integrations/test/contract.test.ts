import { describe, expect, it } from 'vitest';
import {
  backoffDelayMs,
  classifyHttpStatus,
  err,
  isRetryable,
  maskSecret,
  notConfigured,
  ok,
  readEnv,
} from '../src/contract.ts';

describe('adapter contract', () => {
  it('ok 標記成功並保留模式', () => {
    const result = ok({ value: 1 }, 'mock');
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('mock');
  });

  it('err 預設不可重試', () => {
    const result = err('forbidden', 'no');
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('notConfigured 回報缺少的環境變數且為 mock 模式', () => {
    const result = notConfigured(['A', 'B']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
    expect(result.mode).toBe('mock');
    expect(result.message).toContain('A, B');
  });

  it('isRetryable 只對可重試錯誤為真', () => {
    expect(isRetryable(err('network_error', 'x', { retryable: true }))).toBe(true);
    expect(isRetryable(err('forbidden', 'x'))).toBe(false);
    expect(isRetryable(ok(1))).toBe(false);
  });

  it('classifyHttpStatus 對映 429 與 5xx 為可重試', () => {
    expect(classifyHttpStatus(401)).toEqual({ code: 'unauthorized', retryable: false });
    expect(classifyHttpStatus(403)).toEqual({ code: 'forbidden', retryable: false });
    expect(classifyHttpStatus(404)).toEqual({ code: 'not_found', retryable: false });
    expect(classifyHttpStatus(429)).toEqual({ code: 'rate_limited', retryable: true });
    expect(classifyHttpStatus(500)).toEqual({ code: 'provider_error', retryable: true });
    expect(classifyHttpStatus(503)).toEqual({ code: 'provider_error', retryable: true });
    expect(classifyHttpStatus(400)).toEqual({ code: 'invalid_response', retryable: false });
  });

  it('backoffDelayMs 指數成長且不超過上限', () => {
    const first = backoffDelayMs(1, { baseMs: 1000, jitter: 0 });
    const second = backoffDelayMs(2, { baseMs: 1000, jitter: 0 });
    const third = backoffDelayMs(3, { baseMs: 1000, jitter: 0 });
    expect(first).toBe(1000);
    expect(second).toBe(2000);
    expect(third).toBe(4000);
    expect(backoffDelayMs(50, { baseMs: 1000, maxMs: 60_000, jitter: 0 })).toBe(60_000);
  });

  it('backoffDelayMs 對無效 attempt 仍回傳非負值', () => {
    expect(backoffDelayMs(0, { jitter: 0 })).toBeGreaterThanOrEqual(0);
    expect(backoffDelayMs(-5, { jitter: 0 })).toBeGreaterThanOrEqual(0);
  });

  it('readEnv 回報缺少的鍵且不洩漏值', () => {
    const { values, missing } = readEnv(['A', 'B', 'C'], { A: 'x', B: '   ' });
    expect(values).toEqual({ A: 'x' });
    expect(missing).toEqual(['B', 'C']);
  });

  it('maskSecret 遮蔽短字串與長字串', () => {
    expect(maskSecret('short')).toBe('****');
    expect(maskSecret('abcdefghijkl')).toBe('abcd****ijkl');
  });
});
