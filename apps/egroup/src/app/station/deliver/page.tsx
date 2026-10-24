import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { deliverOrderAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime, formatTwd, ORDER_STATUS_LABELS } from '../../../lib/format.ts';
import { listStationOrders } from '../../../lib/ops.ts';

export default async function StationDeliverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const orders = await listStationOrders(session.stationId, ['paid', 'preparing', 'ready']);
  const ready = orders.filter((order) => order.status === 'ready');
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="取貨核銷"
        subtitle="取貨碼為一次性；核銷後立即失效。離線事件以 clientEventId 去重，重送不會重複扣庫存。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="核銷取貨碼">
        <form action={deliverOrderAction} className="form">
          <input type="hidden" name="redirectTo" value="/station/deliver" />
          <div className="grid grid-3">
            <Field label="訂單編號"><input name="orderNo" required placeholder="EG-20260101-0001" /></Field>
            <Field label="6 位取貨碼"><input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" /></Field>
            <Field label="離線事件 ID" hint="離線補送時填入，避免重複核銷">
              <input name="clientEventId" placeholder="offline-..." />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary">確認核銷</button>
        </form>
      </Card>

      <Card title="可取貨訂單">
        {ready.length === 0 ? <p className="muted small">目前沒有已備妥的訂單。</p> : (
          <Table head={['訂單', '顧客', '內容', '金額', '取貨期限']}>
            {ready.map((order) => (
              <tr key={order.id}>
                <td className="mono">{order.order_no}</td>
                <td>{order.customer_name}<div className="muted tiny">{order.customer_phone ?? '—'}</div></td>
                <td className="muted small">{order.items ?? '—'}</td>
                <td className="num">{formatTwd(order.total_twd)}</td>
                <td className="muted small">{formatDateTime(order.pickup_code_expires_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="備貨中訂單">
        {orders.filter((order) => order.status !== 'ready').length === 0 ? <p className="muted small">沒有備貨中的訂單。</p> : (
          <Table head={['訂單', '顧客', '內容', '狀態', '金額']}>
            {orders.filter((order) => order.status !== 'ready').map((order) => (
              <tr key={order.id}>
                <td className="mono">{order.order_no}</td>
                <td>{order.customer_name}</td>
                <td className="muted small">{order.items ?? '—'}</td>
                <td><Badge tone="warn">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge></td>
                <td className="num">{formatTwd(order.total_twd)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
