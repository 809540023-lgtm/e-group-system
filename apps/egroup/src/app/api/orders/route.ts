import { randomUUID } from 'node:crypto';
import { generatePickupCode, hashPickupCode, matchAllergens } from '@eg/meal';
import { fail, int, json, readJson, str } from '../../../lib/api.ts';
import { getSession } from '../../../lib/auth.ts';
import { dbErrorMessage, one, query } from '../../../lib/db.ts';
import { listOrdersForCustomer } from '../../../lib/queries.ts';
import { pickupSecret } from '../../../lib/secrets.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);

  if (session.role === 'customer' && session.customerId !== null) {
    const orders = await listOrdersForCustomer(session.customerId);
    return json({ count: orders.length, orders });
  }
  if (session.role === 'admin') {
    const orders = await query(
      `SELECT o.order_no, c.name AS customer_name, st.name AS station_name, o.status, o.total_twd, o.created_at
         FROM orders o JOIN customers c ON c.id = o.customer_id JOIN stations st ON st.id = o.station_id
        ORDER BY o.created_at DESC LIMIT 100`,
    );
    return json({ count: orders.length, orders });
  }
  return fail('FORBIDDEN', 403);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);
  if (session.role !== 'customer' || session.customerId === null) return fail('FORBIDDEN', 403);

  const body = await readJson(request);
  const stationId = str(body, 'stationId');
  const referralCode = str(body, 'referralCode');
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (stationId === '') return fail('STATION_REQUIRED');
  if (rawItems.length === 0) return fail('ITEMS_REQUIRED');

  const items = rawItems
    .map((item) => {
      const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
      return { sku: str(record, 'sku'), quantity: int(record, 'quantity', 0) };
    })
    .filter((item) => item.sku !== '' && item.quantity > 0);
  if (items.length === 0) return fail('ITEMS_REQUIRED');

  const customer = await one<{ allergens: string[] }>('SELECT allergens FROM customers WHERE id = $1', [session.customerId]);
  const products = await query<{ sku: string; allergens: string[] }>(
    'SELECT sku, allergens FROM products WHERE sku = ANY($1::text[])',
    [items.map((item) => item.sku)],
  );
  const conflicts = products.flatMap((product) => matchAllergens(product.allergens, customer?.allergens ?? []));
  if (conflicts.length > 0) {
    return fail(`ALLERGEN_CONFLICT:${[...new Set(conflicts)].join(',')}`, 409);
  }

  const code = generatePickupCode();
  const pickupHash = hashPickupCode(code, pickupSecret());
  const expires = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const idempotencyKey = str(body, 'idempotencyKey') || `order:${session.customerId}:${randomUUID()}`;

  try {
    const result = await one<{ result: { order_id: string; order_no: string; total_twd: number } }>(
      `SELECT eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULLIF($6,''),$7,$8) AS result`,
      [
        session.customerId,
        stationId,
        JSON.stringify(items),
        pickupHash,
        expires,
        referralCode,
        idempotencyKey,
        session.email,
      ],
    );
    if (result === null) return fail('ORDER_CREATE_FAILED', 500);
    return json(
      {
        order_no: result.result.order_no,
        total_twd: result.result.total_twd,
        pickup_code: code,
        pickup_code_expires_at: expires,
      },
      201,
    );
  } catch (error) {
    return fail(dbErrorMessage(error), 409);
  }
}
