import { fail, json, readJson, str } from '../../../lib/api.ts';
import { getSession } from '../../../lib/auth.ts';
import { dbErrorMessage, one } from '../../../lib/db.ts';
import { pickupSecret } from '../../../lib/secrets.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);
  if (session.role !== 'station' && session.role !== 'admin') return fail('FORBIDDEN', 403);

  const body = await readJson(request);
  const orderNo = str(body, 'orderNo');
  const code = str(body, 'code');
  const clientEventId = str(body, 'clientEventId');
  if (orderNo === '' || code === '') return fail('ORDER_NO_AND_CODE_REQUIRED');

  const order = await one<{ id: string; station_id: string }>('SELECT id, station_id FROM orders WHERE order_no = $1', [orderNo]);
  if (order === null) return fail('ORDER_NOT_FOUND', 404);
  if (session.role === 'station' && order.station_id !== session.stationId) return fail('ORDER_NOT_FOUND', 404);

  try {
    const result = await one<{ result: { status: string; order_no: string } }>(
      'SELECT eg_deliver_order($1,$2,$3,$4,NULLIF($5,\'\')) AS result',
      [order.id, code, pickupSecret(), session.email, clientEventId],
    );
    return json({ status: result?.result.status ?? 'delivered', order_no: orderNo });
  } catch (error) {
    return fail(dbErrorMessage(error), 409);
  }
}
