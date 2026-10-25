import { fail } from '../../../../lib/api.ts';
import { getSession } from '../../../../lib/auth.ts';
import { toCsv } from '../../../../lib/csv.ts';
import { listAuditEventsForExport } from '../../../../lib/kpi.ts';

export const dynamic = 'force-dynamic';

/** 稽核匯出：計畫書第十五章要求總部端可匯出稽核紀錄。 */
export async function GET() {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);
  if (session.role !== 'admin') return fail('FORBIDDEN', 403);

  const rows = await listAuditEventsForExport();
  const header = ['id', 'created_at', 'actor_type', 'actor_id', 'action', 'entity_type', 'entity_id', 'reason'];
  const csv = toCsv(
    header,
    rows.map((row) => [row.id, row.created_at, row.actor_type, row.actor_id, row.action, row.entity_type, row.entity_id, row.reason]),
  );
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="egroup-audit-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
