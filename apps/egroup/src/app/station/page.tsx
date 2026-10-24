import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Empty, Notice, PageHeader, Stat, Table } from '../../components/ui.tsx';
import { markReadyAction } from '../../lib/actions.ts';
import { requireRole } from '../../lib/auth.ts';
import { formatDateTime, formatTwd, ORDER_STATUS_LABELS } from '../../lib/format.ts';
import { getStation } from '../../lib/queries.ts';
import { getStationOps, listStationOrders, listStationShipments } from '../../lib/ops.ts';

export default async function StationHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const [station, ops, orders, shipments] = await Promise.all([
    getStation(session.stationId),
    getStationOps(session.stationId),
    listStationOrders(session.stationId, ['paid', 'preparing', 'ready']),
    listStationShipments(session.stationId),
  ]);
  if (station === null) redirect('/');

  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const pending = shipments.filter((shipment) => shipment.status === 'in_transit');

  return (
    <>
      <PageHeader
        title={`${station.code} ${station.name}`}
        subtitle={`${station.type} 型站點 · ${station.address}`}
        actions={<Link href="/station/deliver" className="btn btn-primary">取貨核銷</Link>}
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-4">
        <Stat label="待取貨" value={ops.ready} hint="已可核銷" />
        <Stat label="備貨中" value={ops.preparing} hint="已付款待備貨" />
        <Stat label="今日完成" value={ops.delivered_today} hint="取貨核銷筆數" />
        <Stat label="庫存單位" value={ops.inventory} hint={`${ops.expiring} 批 2 日內到期`} />
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <Stat label="待收貨" value={ops.pending_shipments} hint="運送中出貨單" />
        <Stat label="隔離批次" value={ops.quarantined} hint="停止銷售" />
        <Stat label="7 日溫控異常" value={ops.breaches} hint="需檢討改善" />
        <Stat label="累計服務費" value={formatTwd(ops.settlement_net)} hint="結算淨額" />
      </div>

      {pending.length > 0 ? (
        <Notice tone="warn">有 {pending.length} 張出貨單待收貨，請先驗溫再入庫。</Notice>
      ) : null}

      <Card title="待處理訂單" actions={<Link href="/station/deliver" className="btn btn-sm">前往核銷</Link>}>
        {orders.length === 0 ? <Empty>目前沒有待處理訂單。</Empty> : (
          <Table head={['訂單', '顧客', '內容', '金額', '狀態', '取貨期限', '操作']}>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="mono"><Link href={`/orders/${order.order_no}`}>{order.order_no}</Link></td>
                <td>{order.customer_name}<div className="muted tiny">{order.customer_phone ?? '—'}</div></td>
                <td className="muted small">{order.items ?? '—'}</td>
                <td className="num">{formatTwd(order.total_twd)}</td>
                <td><Badge tone={order.status === 'ready' ? 'ok' : 'warn'}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge></td>
                <td className="muted small">{formatDateTime(order.pickup_code_expires_at)}</td>
                <td>
                  {order.status === 'ready' ? (
                    <span className="muted tiny">等待顧客取貨</span>
                  ) : (
                    <form action={markReadyAction}>
                      <input type="hidden" name="orderNo" value={order.order_no} />
                      <input type="hidden" name="redirectTo" value="/station" />
                      <button type="submit" className="btn btn-sm">標記可取貨</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
