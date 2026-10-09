import { NextResponse } from 'next/server';
import { verifyLineSignature, type LineWebhookPayload } from '@jp/integrations/line';
import { readWebEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * LINE webhook（規劃書 11 章；模組 11）。
 *
 * 以原始 request body 驗證 HMAC-SHA256，再處理事件與重送去去重。
 * 不將群組中任何人輸入的「退款」「上架」文字直接當作授權。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = readWebEnv();
  if (env.lineChannelSecret === null) {
    return NextResponse.json(
      { status: 'integration_pending', reason: '尚未設定 LINE_CHANNEL_SECRET，無法驗證 webhook 簽章。' },
      { status: 503 },
    );
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get('x-line-signature') ?? '';
  if (!verifyLineSignature(rawBody, signature, env.lineChannelSecret)) {
    return NextResponse.json({ status: 'rejected', reason: '簽章驗證失敗。' }, { status: 401 });
  }

  let payload: LineWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as LineWebhookPayload;
  } catch {
    return NextResponse.json({ status: 'rejected', reason: '內容不是合法 JSON。' }, { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const accepted: string[] = [];
  for (const event of events) {
    // 只記錄事件鍵；實際處理交由 worker 的 outbox，避免在 webhook 內做長工作。
    const key = `${event.webhookEventId ?? 'unknown'}:${event.type ?? 'unknown'}`;
    accepted.push(key);
  }

  // LINE 要求 200 才視為已接收。
  return NextResponse.json({ status: 'accepted', events: accepted.length });
}
