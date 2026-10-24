import { Badge, Card, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listAuditEvents } from '../../../lib/queries.ts';
import { listOfflineEvents } from '../../../lib/ops.ts';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const [events, offline] = await Promise.all([listAuditEvents(200), listOfflineEvents()]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="稽核軌跡"
        subtitle="所有關鍵操作皆寫入不可變稽核事件；離線事件以 clientEventId 去重後重放。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="離線事件重放">
        {offline.length === 0 ? <p className="muted small">尚無離線事件。</p> : (
          <Table head={['事件 ID', '類型', '站點', '接收時間', '處理時間', '結果']}>
            {offline.map((event) => (
              <tr key={event.id}>
                <td className="mono tiny">{event.client_event_id}</td>
                <td>{event.type}</td>
                <td className="muted small">{event.station_name}</td>
                <td className="muted small">{formatDateTime(event.received_at)}</td>
                <td className="muted small">{formatDateTime(event.processed_at)}</td>
                <td><Badge tone={event.result === 'duplicate' ? 'warn' : 'ok'}>{event.result ?? '待處理'}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="稽核事件" className="card">
        <p className="muted small">
          匯出為 CSV（含 BOM，Excel 可直接開啟）：<a className="btn btn-sm" href="/api/audit/export">下載稽核匯出</a>
        </p>
        <Table head={['動作', '實體類型', '實體', '操作者', '原因', '時間']}>
          {events.map((event) => (
            <tr key={event.id}>
              <td className="mono tiny">{event.action}</td>
              <td className="muted small">{event.entity_type}</td>
              <td className="mono tiny">{event.entity_id}</td>
              <td className="muted tiny">{event.actor_type} · {event.actor_id}</td>
              <td className="muted small">{event.reason ?? '—'}</td>
              <td className="muted small">{formatDateTime(event.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
