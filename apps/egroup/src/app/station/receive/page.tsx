import { redirect } from 'next/navigation';
import { Badge, Card, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { receiveShipmentAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listStationShipments } from '../../../lib/ops.ts';

export default async function StationReceivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const shipments = await listStationShipments(session.stationId);
  const pending = shipments.filter((shipment) => shipment.status === 'in_transit');
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="收貨驗收"
        subtitle="收貨時量測中心溫度並登錄；冷凍 ≤ -18°C、冷藏 0–7°C。不符者建立異常並隔離。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="待收貨出貨單">
        {pending.length === 0 ? <p className="muted small">目前沒有待收貨的出貨單。</p> : (
          <Table head={['批號', '商品', '供應商', '數量', '出貨時間', '收貨溫度', '操作']}>
            {pending.map((shipment) => (
              <tr key={shipment.id}>
                <td className="mono">{shipment.lot_no}</td>
                <td>{shipment.product_name}</td>
                <td className="muted small">{shipment.supplier_name}</td>
                <td className="num">{shipment.quantity}</td>
                <td className="muted small">{formatDateTime(shipment.dispatched_at)}</td>
                <td colSpan={2}>
                  <form action={receiveShipmentAction} className="row">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <input type="hidden" name="redirectTo" value="/station/receive" />
                    <input name="temp" type="number" step="0.1" required placeholder="°C" style={{ width: 90 }} />
                    <button type="submit" className="btn btn-sm btn-primary">確認收貨</button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="收貨紀錄">
        {shipments.filter((shipment) => shipment.status !== 'in_transit').length === 0 ? (
          <p className="muted small">尚無收貨紀錄。</p>
        ) : (
          <Table head={['批號', '商品', '供應商', '數量', '狀態', '收貨時間', '收貨溫度']}>
            {shipments.filter((shipment) => shipment.status !== 'in_transit').map((shipment) => (
              <tr key={shipment.id}>
                <td className="mono">{shipment.lot_no}</td>
                <td>{shipment.product_name}</td>
                <td className="muted small">{shipment.supplier_name}</td>
                <td className="num">{shipment.quantity}</td>
                <td><Badge tone={shipment.status === 'received' ? 'ok' : 'danger'}>{shipment.status}</Badge></td>
                <td className="muted small">{formatDateTime(shipment.received_at)}</td>
                <td className="num">{shipment.received_temp_c === null ? '—' : `${shipment.received_temp_c} °C`}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
