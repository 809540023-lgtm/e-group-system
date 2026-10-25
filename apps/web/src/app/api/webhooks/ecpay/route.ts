import { NextResponse } from 'next/server';
import { AppError, verifyEcpayNotification, type VerifiedNotification } from '@jp/domain';
import { withClient } from '@/lib/db';
import { readWebEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * ECPay 付款通知（規劃書 08 章；模組 08）。
 *
 * 以原始 request body 驗證 CheckMacValue，再處理事件與重送去去重。
 * 期望值必須來自資料庫的 payment_attempts，不能只信通知內容。
 * 未設定金流憑證時明確回報 integration_pending，不以假成功掩蓋。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = readWebEnv();
  const rawBody = Buffer.from(await request.arrayBuffer());

  if (env.ecpayHashKey === null || env.ecpayHashIv === null || env.ecpayMerchantId === null) {
    return NextResponse.json(
      { status: 'integration_pending', reason: '尚未設定 ECPAY_MERCHANT_ID／ECPAY_HASH_KEY／ECPAY_HASH_IV，無法驗證付款通知。' },
      { status: 503 },
    );
  }

  const params = new URLSearchParams(rawBody.toString('utf8'));
  const merchantTradeNo = params.get('MerchantTradeNo') ?? '';
  const expected = await lookupExpectations(merchantTradeNo);
  if (expected === null) {
    return NextResponse.json({ status: 'rejected', reason: '找不到對應的付款嘗試。' }, { status: 400 });
  }

  let verified: VerifiedNotification;
  try {
    verified = verifyEcpayNotification({
      rawBody,
      hashKey: env.ecpayHashKey,
      hashIv: env.ecpayHashIv,
      expectedMerchantId: env.ecpayMerchantId,
      expectedMerchantTradeNo: expected.merchantTradeNo,
      expectedAmountTwd: expected.amountTwd,
      allowSimulated: env.mode !== 'production',
    });
  } catch (cause) {
    const reason = cause instanceof AppError ? cause.message : '付款通知驗證失敗。';
    return NextResponse.json({ status: 'rejected', reason }, { status: 400 });
  }

  if (verified.simulated && env.mode === 'production') {
    return NextResponse.json({ status: 'rejected', reason: '正式環境不接受模擬付款通知。' }, { status: 400 });
  }

  if (verified.amountTwd !== expected.amountTwd) {
    return NextResponse.json({ status: 'needs_review', reason: '通知金額與訂單金額不符。' }, { status: 409 });
  }

  // 事件與 outbox 必須在同一交易中寫入；由 jp_apply_payment_event 完成。
  const applied = await applyPaymentEvent({
    eventKey: verified.eventKey,
    orderId: expected.orderId,
    attemptId: expected.attemptId,
    providerTradeNo: verified.providerTradeNo,
    amountTwd: verified.amountTwd,
    paid: verified.success,
  });

  if (!applied.ok) {
    return NextResponse.json({ status: 'needs_review', reason: applied.reason }, { status: 409 });
  }

  // ECPay 要求回應 1|OK 才視為已接收。
  return new NextResponse('1|OK', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

interface Expectations {
  readonly orderId: string;
  readonly attemptId: string;
  readonly merchantTradeNo: string;
  readonly amountTwd: number;
}

async function lookupExpectations(merchantTradeNo: string): Promise<Expectations | null> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') return null;
  return withClient(url, async (client) => {
    const result = await client.query<{ order_id: string; attempt_id: string; merchant_trade_no: string; amount_twd: number }>(
      'SELECT order_id, attempt_id, merchant_trade_no, amount_twd FROM payment_attempts WHERE merchant_trade_no = $1',
      [merchantTradeNo],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : { orderId: row.order_id, attemptId: row.attempt_id, merchantTradeNo: row.merchant_trade_no, amountTwd: row.amount_twd };
  });
}

interface ApplyInput {
  readonly eventKey: string;
  readonly orderId: string;
  readonly attemptId: string;
  readonly providerTradeNo: string;
  readonly amountTwd: number;
  readonly paid: boolean;
}

async function applyPaymentEvent(input: ApplyInput): Promise<{ readonly ok: boolean; readonly reason: string }> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') return { ok: false, reason: '未設定 DATABASE_URL，無法套用付款事件。' };
  return withClient(url, async (client) => {
    const result = await client.query<{ applied: boolean; duplicate: boolean; needs_review: boolean }>(
      'SELECT * FROM jp_apply_payment_event($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [
        input.eventKey,
        input.orderId,
        input.attemptId,
        'ecpay',
        input.providerTradeNo,
        input.amountTwd,
        input.paid,
        false,
        new Date().toISOString(),
        JSON.stringify({ source: 'ecpay_webhook' }),
        'payment.confirmed',
      ],
    );
    const row = result.rows[0];
    if (row?.needs_review === true) return { ok: false, reason: '付款事件需人工核對。' };
    return { ok: true, reason: row?.duplicate === true ? '重送事件已去重。' : '付款事件已套用。' };
  });
}
