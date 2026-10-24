import { json } from '../../../lib/api.ts';
import { listRecalls } from '../../../lib/queries.ts';
import { listRecallNotifications } from '../../../lib/ops.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [recalls, notifications] = await Promise.all([listRecalls(), listRecallNotifications()]);
  const stats = new Map(notifications.map((row) => [row.recall_id, row]));

  return json({
    open: recalls.filter((recall) => recall.status === 'open').length,
    recalls: recalls.map((recall) => ({
      id: recall.id,
      sku: recall.sku,
      product_name: recall.product_name,
      lot_no: recall.lot_no,
      reason: recall.reason,
      status: recall.status,
      started_at: recall.started_at,
      closed_at: recall.closed_at,
      notifications: stats.get(recall.id) ?? { total: '0', sent: '0', failed: '0' },
    })),
  });
}
