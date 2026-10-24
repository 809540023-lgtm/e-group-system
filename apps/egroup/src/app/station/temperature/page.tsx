import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { logTemperatureAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime, TEMPERATURE_STATUS_LABELS } from '../../../lib/format.ts';
import { listStationBatches, listStationTemperatures } from '../../../lib/ops.ts';

export default async function StationTemperaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const [events, batches] = await Promise.all([
    listStationTemperatures(session.stationId),
    listStationBatches(session.stationId),
  ]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const breaches = events.filter((event) => event.status === 'breach');

  return (
    <>
      <PageHeader
        title="冷鏈溫度"
        subtitle="每 4 小時記錄一次；超溫需記錄處理方式。連續超溫應隔離批次並通報總部。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}
      {breaches.length > 0 ? <Notice tone="danger">近 7 日有 {breaches.length} 筆超溫紀錄，請確認批次是否需隔離。</Notice> : null}

      <Card title="新增溫度紀錄">
        <form action={logTemperatureAction} className="form">
          <input type="hidden" name="redirectTo" value="/station/temperature" />
          <div className="grid grid-4">
            <Field label="溫度 (°C)"><input name="temp" type="number" step="0.1" required /></Field>
            <Field label="持續時間 (分)"><input name="duration" type="number" min="0" defaultValue={0} /></Field>
            <Field label="判定">
              <select name="status" defaultValue="ok">
                <option value="ok">正常</option>
                <option value="warning">警戒</option>
                <option value="breach">超溫</option>
              </select>
            </Field>
            <Field label="批次" hint="留空表示設備環境溫度">
              <select name="batchId" defaultValue="">
                <option value="">環境</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.lot_no} · {batch.product_name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="處理方式" hint="例如：調整除霜頻率、轉移批次、報廢">
            <input name="action" required placeholder="檢查門條並轉移批次" />
          </Field>
          <button type="submit" className="btn btn-primary">建立紀錄</button>
        </form>
      </Card>

      <Card title="溫度紀錄">
        {events.length === 0 ? <p className="muted small">尚無溫度紀錄。</p> : (
          <Table head={['溫度', '持續', '判定', '批次', '處理', '人員', '時間']}>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="num">{event.temp_c} °C</td>
                <td className="num">{event.duration_minutes} 分</td>
                <td><Badge tone={event.status === 'ok' ? 'ok' : event.status === 'warning' ? 'warn' : 'danger'}>{TEMPERATURE_STATUS_LABELS[event.status] ?? event.status}</Badge></td>
                <td className="mono tiny">{event.lot_no ?? '環境'}</td>
                <td className="muted small">{event.action}</td>
                <td className="muted tiny">{event.actor}</td>
                <td className="muted small">{formatDateTime(event.recorded_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
