import { fail, json } from '../../../lib/api.ts';
import { getSession } from '../../../lib/auth.ts';
import { listReplenishment } from '../../../lib/ops.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);
  if (session.role !== 'admin' && session.role !== 'supplier') return fail('FORBIDDEN', 403);

  const rows = await listReplenishment();
  return json({
    count: rows.length,
    items: rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      storage: row.storage,
      shelf_life_days: row.shelf_life_days,
      available: Number(row.available),
      sold_7d: Number(row.sold_7d),
      sold_28d: Number(row.sold_28d),
      suggested: Number(row.suggested),
    })),
  });
}
