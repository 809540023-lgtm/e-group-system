import { redirect } from 'next/navigation';
import { Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { recordHeatingAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listStationHeating, listStationOrders } from '../../../lib/ops.ts';

export default async function StationHeatingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const [records, orders] = await Promise.all([
    listStationHeating(session.stationId),
    listStationOrders(session.stationId, ['paid', 'preparing', 'ready']),
  ]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="加熱紀錄"
        subtitle="加熱須達中心溫度 75°C 以上並記錄設備與時間；未達標不得交付。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="新增加熱紀錄">
        <form action={recordHeatingAction} className="form">
          <input type="hidden" name="redirectTo" value="/station/heating" />
          <div className="grid grid-4">
            <Field label="訂單">
              <select name="orderNo" required>
                {orders.map((order) => (
                  <option key={order.id} value={order.order_no}>{order.order_no} · {order.customer_name}</option>
                ))}
              </select>
            </Field>
            <Field label="SKU"><input name="sku" required placeholder="EG-CHK-001" /></Field>
            <Field label="加熱秒數"><input name="duration" type="number" min="1" required /></Field>
            <Field label="中心溫度 (°C)"><input name="coreTemp" type="number" step="0.1" required /></Field>
          </div>
          <button type="submit" className="btn btn-primary" disabled={orders.length === 0}>建立紀錄</button>
        </form>
      </Card>

      <Card title="加熱歷史">
        {records.length === 0 ? <p className="muted small">尚無加熱紀錄。</p> : (
          <Table head={['訂單', 'SKU', '秒數', '中心溫度', '操作人', '時間']}>
            {records.map((record) => (
              <tr key={record.id}>
                <td className="mono">{record.order_no ?? '—'}</td>
                <td className="mono tiny">{record.sku}</td>
                <td className="num">{record.duration_seconds}</td>
                <td className="num">{record.core_temp_c === null ? '—' : `${record.core_temp_c} °C`}</td>
                <td className="muted small">{record.operator}</td>
                <td className="muted small">{formatDateTime(record.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
