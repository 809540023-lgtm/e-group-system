import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { createShipmentAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listStations } from '../../../lib/queries.ts';
import { listSupplierBatches, listSupplierShipments } from '../../../lib/ops.ts';

export default async function SupplierShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['supplier', 'admin']);
  if (session.supplierId === null) redirect('/admin');
  const params = await searchParams;

  const [shipments, batches, stations] = await Promise.all([
    listSupplierShipments(session.supplierId),
    listSupplierBatches(session.supplierId),
    listStations(),
  ]);
  const shippable = batches.filter((batch) => batch.status === 'available' && batch.quantity_available - batch.quantity_reserved > 0);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader title="出貨管理" subtitle="出貨後由站點收貨驗溫；溫度不符即建立異常並隔離批次。" />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="出貨單">
        {shipments.length === 0 ? <p className="muted small">尚未建立出貨單。</p> : (
          <Table head={['批號', 'SKU', '站點', '數量', '狀態', '出貨時間', '收貨時間', '收貨溫度', '備註']}>
            {shipments.map((shipment) => (
              <tr key={shipment.id}>
                <td className="mono">{shipment.lot_no}</td>
                <td className="mono tiny">{shipment.sku}</td>
                <td>{shipment.station_name}</td>
                <td className="num">{shipment.quantity}</td>
                <td><Badge tone={shipment.status === 'received' ? 'ok' : shipment.status === 'rejected' ? 'danger' : 'warn'}>{shipment.status}</Badge></td>
                <td className="muted small">{formatDateTime(shipment.dispatched_at)}</td>
                <td className="muted small">{formatDateTime(shipment.received_at)}</td>
                <td className="num">{shipment.received_temp_c === null ? '—' : `${shipment.received_temp_c} °C`}</td>
                <td className="muted small">{shipment.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="建立出貨單">
        <form action={createShipmentAction} className="form">
          <input type="hidden" name="redirectTo" value="/supplier/shipments" />
          <div className="grid grid-3">
            <Field label="批次">
              <select name="batchId" required>
                {shippable.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.lot_no} · {batch.product_name}（可出 {batch.quantity_available - batch.quantity_reserved}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="目的站點">
              <select name="stationId" required>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>{station.code} · {station.name}</option>
                ))}
              </select>
            </Field>
            <Field label="數量"><input name="quantity" type="number" min="1" required /></Field>
          </div>
          <Field label="備註"><input name="note" placeholder="冷藏車 4°C 配送" /></Field>
          <button type="submit" className="btn btn-primary">建立出貨單</button>
        </form>
      </Card>
    </>
  );
}
