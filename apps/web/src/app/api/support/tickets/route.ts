import { NextResponse } from 'next/server';
import { AppError, firstResponseDue, routeTicket, type TicketCategory } from '@jp/domain';

export const dynamic = 'force-dynamic';

const CATEGORY_MAP: Readonly<Record<string, TicketCategory>> = {
  付款: 'payment',
  出貨: 'shipping',
  退換貨: 'return',
  商品諮詢: 'product',
  訂單狀態: 'order_status',
  payment: 'payment',
  shipping: 'shipping',
  return: 'return',
  product: 'product',
  order_status: 'order_status',
  other: 'other',
};

/** 領域品類 → 資料庫 CHECK 允許值。 */
const DB_CATEGORY: Readonly<Record<TicketCategory, string>> = {
  order_status: 'order',
  product: 'product',
  payment: 'payment',
  shipping: 'shipping',
  return: 'return',
  other: 'other',
};

/**
 * 客服案件建立（規劃書 17 章；模組 17）。
 *
 * 建立案件編號、依品類設定首次回覆時限，並依狀態決定是否可交由 AI 草擬。
 * 缺貨、改品、遲付及退款一律轉所屬角色，不由 AI 自行決定。
 */
export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const contact = String(form.get('contact') ?? '').trim();
  const rawCategory = String(form.get('category') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();
  const orderCode = String(form.get('orderCode') ?? '').trim();

  if (contact === '' || message === '') {
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: '請填寫聯絡方式與問題描述。' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: '問題描述請控制在 2000 字以內。' }, { status: 400 });
  }

  const category = CATEGORY_MAP[rawCategory] ?? 'other';
  const now = new Date();
  const due = firstResponseDue(category, now);
  const routing = routeTicket({ category, orderStatus: null, paymentStatus: null, stockAvailable: null });

  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    return NextResponse.json(
      { error: 'INTEGRATION_PENDING', message: '尚未設定 DATABASE_URL，無法建立客服案件。' },
      { status: 503 },
    );
  }

  try {
    const ticketCode = await createTicket(url, { category, message, orderCode, dueAt: due, routing });
    return NextResponse.json({ status: 'created', ticketCode, firstResponseDueAt: due.toISOString(), routing });
  } catch (cause) {
    if (cause instanceof AppError) {
      return NextResponse.json({ error: cause.error_code, message: cause.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'INTERNAL', message: '建立案件失敗，請稍後再試。' }, { status: 500 });
  }
}

interface CreateInput {
  readonly category: TicketCategory;
  readonly message: string;
  readonly orderCode: string;
  readonly dueAt: Date;
  readonly routing: ReturnType<typeof routeTicket>;
}

async function createTicket(url: string, input: CreateInput): Promise<string> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const assignedRole = input.routing.action === 'route_to_role' ? input.routing.role : 'support';
    const result = await client.query<{ ticket_code: string }>(
      `INSERT INTO support_tickets (ticket_code, order_id, category, status, assigned_role, first_response_due_at)
       VALUES ($1, (SELECT order_id FROM orders WHERE order_code = $2), $3, 'open', $4, $5)
       RETURNING ticket_code`,
      [
        generateTicketCode(),
        input.orderCode === '' ? null : input.orderCode,
        DB_CATEGORY[input.category],
        assignedRole,
        input.dueAt.toISOString(),
      ],
    );
    const ticketCode = result.rows[0]?.ticket_code ?? '';
    await client.query(
      `INSERT INTO ticket_messages (ticket_id, author_kind, body, cited_facts)
       SELECT ticket_id, 'customer', $2, '[]'::jsonb FROM support_tickets WHERE ticket_code = $1`,
      [ticketCode, input.message],
    );
    await client.query('COMMIT');
    return ticketCode;
  } catch (cause) {
    await client.query('ROLLBACK');
    throw cause;
  } finally {
    await client.end();
  }
}

function generateTicketCode(): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `CS-${stamp}-${random}`;
}
