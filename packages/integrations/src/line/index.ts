/**
 * LINE 官方帳號 adapter（規劃書 10、15、16、17 章；模組 11）。
 *
 * 規則：
 * - 驗章先用原始 Buffer，通過後才 JSON parse。
 * - 事件重送以 webhookEventId 去重。
 * - 員工通知只含訂單碼、待辦角色與連結，不含完整客戶地址、電話、報關身分。
 * - 群組成員或聊天文字不等於後臺權限。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { type AdapterCapability, type AdapterResult, err, notConfigured, ok, readEnv } from '../contract.ts';

export const LINE_ENV_NAMES = [
  'LINE_CHANNEL_ID',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_STAFF_GROUP_ID',
] as const;

export interface LineWebhookEvent {
  readonly webhookEventId: string;
  readonly type: string;
  readonly timestamp: number;
  readonly source: { readonly type: string; readonly userId?: string; readonly groupId?: string };
  readonly message?: { readonly type: string; readonly text?: string };
  readonly replyToken?: string;
}

export interface LineWebhookPayload {
  readonly destination: string;
  readonly events: readonly LineWebhookEvent[];
}

export interface LineMessage {
  readonly type: 'text' | 'flex';
  readonly text?: string;
  readonly altText?: string;
  readonly contents?: unknown;
}

export interface LineAdapter {
  capability(): AdapterCapability;
  /** 驗章：必須傳入原始位元組。 */
  verifySignature(rawBody: Buffer, signature: string): AdapterResult<true>;
  /** 驗章通過後才 parse。 */
  parseWebhook(rawBody: Buffer): AdapterResult<LineWebhookPayload>;
  /** 去重：回傳首次出現的事件。 */
  dedupeEvents(events: readonly LineWebhookEvent[], seen: ReadonlySet<string>): readonly LineWebhookEvent[];
  pushMessage(to: string, messages: readonly LineMessage[]): Promise<AdapterResult<{ readonly sent: boolean }>>;
  replyMessage(replyToken: string, messages: readonly LineMessage[]): Promise<AdapterResult<{ readonly sent: boolean }>>;
}

export interface LineAdapterOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly fixtures?: {
    readonly push?: Readonly<Record<string, { readonly sent: boolean }>>;
  };
}

/** replyToken 有效期約 30 秒；超過即不可回覆，需改用 push。 */
export const REPLY_TOKEN_TTL_MS = 30_000;

export function isReplyTokenExpired(eventTimestampMs: number, now: Date): boolean {
  return now.getTime() - eventTimestampMs > REPLY_TOKEN_TTL_MS;
}

export function computeLineSignature(rawBody: Buffer, channelSecret: string): string {
  return createHmac('sha256', channelSecret).update(rawBody).digest('base64');
}

export function verifyLineSignature(rawBody: Buffer, signature: string, channelSecret: string): boolean {
  const expected = computeLineSignature(rawBody, channelSecret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createLineAdapter(options: LineAdapterOptions = {}): LineAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fixtures = options.fixtures;
  const { values, missing } = readEnv(LINE_ENV_NAMES, env);
  const mockMode = fixtures !== undefined;

  const capability = (): AdapterCapability => ({
    name: 'line',
    status: mockMode ? 'integration_pending' : missing.length === 0 ? 'ready' : 'integration_pending',
    mode: mockMode ? 'mock' : 'live',
    missingEnv: mockMode ? [] : missing,
    notes: mockMode
      ? '使用 fixtures 執行；未接上 LINE 官方帳號，外部驗收為 integration_pending。'
      : missing.length === 0
        ? '已設定 LINE 官方帳號憑證。'
        : '缺少 LINE 憑證，僅能使用 fixtures。',
  });

  return {
    capability,

    verifySignature(rawBody, signature) {
      if (mockMode) return ok(true, 'mock');
      if (missing.length > 0) return notConfigured(missing);
      const secret = values.LINE_CHANNEL_SECRET as string;
      if (!verifyLineSignature(rawBody, signature, secret)) {
        return err('unauthorized', 'LINE 簽章驗證失敗，拒絕處理。', { retryable: false });
      }
      return ok(true);
    },

    parseWebhook(rawBody) {
      try {
        const parsed = JSON.parse(rawBody.toString('utf8')) as LineWebhookPayload;
        if (!Array.isArray(parsed.events)) {
          return err('invalid_response', 'LINE webhook 缺少 events 陣列。', { retryable: false });
        }
        return ok(parsed);
      } catch (cause) {
        return err('invalid_response', `LINE webhook JSON 解析失敗：${String(cause)}`, { retryable: false });
      }
    },

    dedupeEvents(events, seen) {
      const fresh: LineWebhookEvent[] = [];
      const local = new Set(seen);
      for (const event of events) {
        if (local.has(event.webhookEventId)) continue;
        local.add(event.webhookEventId);
        fresh.push(event);
      }
      return fresh;
    },

    async pushMessage(to, messages) {
      if (mockMode) {
        return ok(fixtures.push?.[to] ?? { sent: true }, 'mock');
      }
      if (missing.length > 0) return notConfigured(missing);
      try {
        const response = await fetchImpl('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${values.LINE_CHANNEL_ACCESS_TOKEN as string}`,
          },
          body: JSON.stringify({ to, messages }),
        });
        if (!response.ok) {
          return err('provider_error', `LINE push 回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        return ok({ sent: true });
      } catch (cause) {
        return err('network_error', `LINE push 失敗：${String(cause)}`, { retryable: true });
      }
    },

    async replyMessage(replyToken, messages) {
      if (mockMode) return ok({ sent: true }, 'mock');
      if (missing.length > 0) return notConfigured(missing);
      try {
        const response = await fetchImpl('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${values.LINE_CHANNEL_ACCESS_TOKEN as string}`,
          },
          body: JSON.stringify({ replyToken, messages }),
        });
        if (!response.ok) {
          return err('provider_error', `LINE reply 回應 ${response.status}`, {
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        return ok({ sent: true });
      } catch (cause) {
        return err('network_error', `LINE reply 失敗：${String(cause)}`, { retryable: true });
      }
    },
  };
}

/**
 * 員工通知內容：只含訂單碼、待辦角色與連結。
 * 完整客戶地址、電話、報關身分與金鑰留在限制存取區。
 */
export interface StaffNotificationInput {
  readonly orderCode: string;
  readonly role: string;
  readonly taskSummary: string;
  readonly adminPath: string;
  readonly publicBaseUrl: string;
}

const PII_PATTERNS: readonly RegExp[] = [
  /\b09\d{8}\b/,
  /\b0[2-8]\d{7,8}\b/,
  /\b[A-Z][12]\d{8}\b/,
  /(?:地址|住址)[:：]/,
  /(?:身分證|身份證)[:：]?\s*[A-Z]?\d{8,}/,
];

export function assertNoPiiInStaffMessage(text: string): void {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error('員工通知不得包含客戶電話、地址或報關身分資料。');
    }
  }
}

export function buildStaffNotification(input: StaffNotificationInput): LineMessage {
  const text = [
    `【待辦】${input.role}`,
    `訂單：${input.orderCode}`,
    input.taskSummary,
    `後臺：${input.publicBaseUrl.replace(/\/$/, '')}${input.adminPath}`,
  ].join('\n');
  assertNoPiiInStaffMessage(text);
  return { type: 'text', text };
}

/** 顧客服務通知：只含訂單碼與狀態，不含內部成本或員工資訊。 */
export function buildCustomerOrderNotification(input: {
  readonly orderCode: string;
  readonly statusText: string;
  readonly orderPath: string;
  readonly publicBaseUrl: string;
}): LineMessage {
  const text = [
    `訂單 ${input.orderCode}`,
    input.statusText,
    `查看：${input.publicBaseUrl.replace(/\/$/, '')}${input.orderPath}`,
  ].join('\n');
  return { type: 'text', text };
}
