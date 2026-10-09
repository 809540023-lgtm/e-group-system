import { NextResponse } from 'next/server';
import { AppError } from '@jp/domain';

export const dynamic = 'force-dynamic';

interface LookupBody {
  readonly orderCode?: unknown;
  readonly phone?: unknown;
}

/**
 * 訂單查詢（規劃書 05、07 章；模組 07）。
 *
 * 只憑訂單編號不足以查詢；必須同時提供下單時留存的手機末三碼，
 * 且回應只包含狀態與金額，不回傳完整地址、電話或報關證件。
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const orderCode = typeof body.orderCode === 'string' ? body.orderCode.trim().toUpperCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';

  if (!/^[A-Z0-9-]{6,32}$/.test(orderCode)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: '訂單編號格式不正確。' }, { status: 400 });
  }
  if (phone.length < 3) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: '請提供下單手機末三碼。' }, { status: 400 });
  }

  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    return NextResponse.json(
      { error: 'INTEGRATION_PENDING', message: '尚未設定 DATABASE_URL，無法查詢訂單。' },
      { status: 503 },
    );
  }

  try {
    const summary = await lookupOrder(url, orderCode, phone);
    if (summary === null) {
      // 不區分「查無訂單」與「驗證失敗」，避免被用來探測訂單編號。
      return NextResponse.json({ error: 'NOT_FOUND', message: '查無符合的訂單，請確認編號與手機末三碼。' }, { status: 404 });
    }
    return NextResponse.json({ order: summary });
  } catch (cause) {
    if (cause instanceof AppError) {
      return NextResponse.json({ error: cause.error_code, message: cause.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'INTERNAL', message: '查詢失敗，請稍後再試。' }, { status: 500 });
  }
}

interface OrderSummary {
  readonly orderCode: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly shipmentStatus: string;
  readonly totalTwd: number;
  readonly paidTwd: number;
  readonly refundedTwd: number;
  readonly createdAt: string;
  readonly lines: readonly { readonly sku: string; readonly quantity: number; readonly supplyMode: string }[];
}

async function lookupOrder(url: string, orderCode: string, phone: string): Promise<OrderSummary | null> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<{
      order_code: string;
      status: string;
      payment_status: string;
      shipment_status: string;
      total_twd: number;
      paid_twd: number;
      refunded_twd: number;
      created_at: Date;
      phone: string | null;
    }>(
      `SELECT o.order_code, o.status, o.payment_status, o.shipment_status,
              o.total_twd, o.paid_twd, o.refunded_twd, o.created_at, cp.phone
         FROM orders o
         LEFT JOIN customer_private cp ON cp.customer_id = o.customer_id
        WHERE o.order_code = $1`,
      [orderCode],
    );
    const row = result.rows[0];
    if (row === undefined) return null;

    const stored = (row.phone ?? '').replace(/\D/g, '');
    if (stored.length < 3 || !stored.endsWith(phone.slice(-3))) return null;

    const lines = await client.query<{ sku: string; quantity: number; supply_mode: string }>(
      'SELECT sku, quantity, supply_mode FROM order_lines WHERE order_id = (SELECT order_id FROM orders WHERE order_code = $1) ORDER BY sku',
      [orderCode],
    );

    return {
      orderCode: row.order_code,
      status: row.status,
      paymentStatus: row.payment_status,
      shipmentStatus: row.shipment_status,
      totalTwd: row.total_twd,
      paidTwd: row.paid_twd,
      refundedTwd: row.refunded_twd,
      createdAt: row.created_at.toISOString(),
      lines: lines.rows.map((l) => ({ sku: l.sku, quantity: l.quantity, supplyMode: l.supply_mode })),
    };
  } finally {
    await client.end();
  }
}
