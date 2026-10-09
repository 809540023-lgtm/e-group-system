import { describe, expect, it } from 'vitest';
import {
  REPLY_TOKEN_TTL_MS,
  assertNoPiiInStaffMessage,
  buildCustomerOrderNotification,
  buildStaffNotification,
  computeLineSignature,
  createLineAdapter,
  isReplyTokenExpired,
  verifyLineSignature,
} from '../src/line/index.ts';

const SECRET = 'test-channel-secret';

describe('LINE 簽章', () => {
  it('computeLineSignature 為 base64 HMAC-SHA256', () => {
    const sig = computeLineSignature(Buffer.from('{"a":1}'), SECRET);
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('正確簽章通過、錯誤簽章失敗', () => {
    const body = Buffer.from('{"events":[]}');
    const sig = computeLineSignature(body, SECRET);
    expect(verifyLineSignature(body, sig, SECRET)).toBe(true);
    expect(verifyLineSignature(body, 'wrong', SECRET)).toBe(false);
    expect(verifyLineSignature(Buffer.from('{"events":[1]}'), sig, SECRET)).toBe(false);
  });

  it('長度不同的簽章不丟出例外', () => {
    expect(verifyLineSignature(Buffer.from('x'), 'a', SECRET)).toBe(false);
  });
});

describe('LINE adapter', () => {
  it('無憑證時為 integration_pending', () => {
    const adapter = createLineAdapter({ env: {} });
    const cap = adapter.capability();
    expect(cap.status).toBe('integration_pending');
    expect(cap.missingEnv).toContain('LINE_CHANNEL_SECRET');
  });

  it('無憑證時驗章回報 not_configured', () => {
    const adapter = createLineAdapter({ env: {} });
    const result = adapter.verifySignature(Buffer.from('x'), 'sig');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });

  it('已設定憑證時錯誤簽章回報 unauthorized', () => {
    const adapter = createLineAdapter({
      env: { LINE_CHANNEL_ID: '1', LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: 't', LINE_STAFF_GROUP_ID: 'g' },
    });
    const result = adapter.verifySignature(Buffer.from('x'), 'bad');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('unauthorized');
  });

  it('已設定憑證時正確簽章通過', () => {
    const adapter = createLineAdapter({
      env: { LINE_CHANNEL_ID: '1', LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: 't', LINE_STAFF_GROUP_ID: 'g' },
    });
    const body = Buffer.from('{"events":[]}');
    const result = adapter.verifySignature(body, computeLineSignature(body, SECRET));
    expect(result.ok).toBe(true);
  });

  it('parseWebhook 解析事件並拒絕非 JSON', () => {
    const adapter = createLineAdapter({ env: {} });
    const good = adapter.parseWebhook(Buffer.from('{"destination":"d","events":[]}'));
    expect(good.ok).toBe(true);
    const bad = adapter.parseWebhook(Buffer.from('not json'));
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error('unreachable');
    expect(bad.code).toBe('invalid_response');
  });

  it('parseWebhook 拒絕缺少 events 的 payload', () => {
    const adapter = createLineAdapter({ env: {} });
    const result = adapter.parseWebhook(Buffer.from('{"destination":"d"}'));
    expect(result.ok).toBe(false);
  });

  it('dedupeEvents 只回傳首次出現的事件', () => {
    const adapter = createLineAdapter({ env: {} });
    const events = [
      { webhookEventId: 'e1', type: 'message', timestamp: 1, source: { type: 'user' } },
      { webhookEventId: 'e2', type: 'message', timestamp: 2, source: { type: 'user' } },
      { webhookEventId: 'e1', type: 'message', timestamp: 1, source: { type: 'user' } },
    ];
    const fresh = adapter.dedupeEvents(events, new Set(['e2']));
    expect(fresh.map((e) => e.webhookEventId)).toEqual(['e1']);
  });

  it('pushMessage 未設定時回報 not_configured', async () => {
    const adapter = createLineAdapter({ env: {} });
    const result = await adapter.pushMessage('u', [{ type: 'text', text: 'hi' }]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('not_configured');
  });

  it('fixtures 模式 push 成功', async () => {
    const adapter = createLineAdapter({ env: {}, fixtures: { push: { u1: { sent: true } } } });
    const result = await adapter.pushMessage('u1', [{ type: 'text', text: 'hi' }]);
    expect(result.ok).toBe(true);
  });
});

describe('replyToken 期限', () => {
  it('超過 30 秒視為過期', () => {
    const now = new Date(1_000_000);
    expect(isReplyTokenExpired(now.getTime() - REPLY_TOKEN_TTL_MS - 1, now)).toBe(true);
    expect(isReplyTokenExpired(now.getTime() - 1000, now)).toBe(false);
  });
});

describe('員工通知不含個資', () => {
  it('正常通知可建立', () => {
    const message = buildStaffNotification({
      orderCode: 'JP20260101-0001',
      role: '商品採購',
      taskSummary: '待採購 2 件',
      adminPath: '/admin/tasks/1',
      publicBaseUrl: 'https://example.com/',
    });
    expect(message.text).toContain('JP20260101-0001');
    expect(message.text).toContain('https://example.com/admin/tasks/1');
  });

  it('含手機號碼的通知被拒絕', () => {
    expect(() => assertNoPiiInStaffMessage('聯絡 0912345678')).toThrow(/不得包含/);
  });

  it('含地址的通知被拒絕', () => {
    expect(() => assertNoPiiInStaffMessage('地址：臺北市信義區')).toThrow(/不得包含/);
  });

  it('含身分證號的通知被拒絕', () => {
    expect(() => assertNoPiiInStaffMessage('身分證：A123456789')).toThrow(/不得包含/);
  });

  it('顧客通知只含訂單碼與狀態', () => {
    const message = buildCustomerOrderNotification({
      orderCode: 'JP20260101-0001',
      statusText: '已付款，準備出貨',
      orderPath: '/orders/JP20260101-0001',
      publicBaseUrl: 'https://example.com',
    });
    expect(message.text).toContain('已付款');
    expect(message.text).not.toContain('成本');
  });
});
