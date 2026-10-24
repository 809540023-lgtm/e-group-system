import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { createBatchAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { BATCH_STATUS_LABELS, formatDate } from '../../../lib/format.ts';
import { listProducts, listStations } from '../../../lib/queries.ts';
import { listSupplierBatches } from '../../../lib/ops.ts';

export default async function SupplierBatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['supplier', 'admin']);
  if (session.supplierId === null) redirect('/admin');
  const params = await searchParams;

  const [batches, products, stations] = await Promise.all([
    listSupplierBatches(session.supplierId),
    listProducts({ includeInactive: true }),
    listStations(),
  ]);
  const mine = products.filter((product) => product.supplier_id === session.supplierId);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader title="批次管理" subtitle="每個批次對應唯一批號與效期；庫存以 FIFO（先到期先出）配貨。" />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="批次清單">
        {batches.length === 0 ? <p className="muted small">尚未建立批次。</p> : (
          <Table head={['批號', '商品', '生產日', '到期日', '收貨', '可用', '保留', '站點', '文件', '狀態']}>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td className="mono"><Link href={`/trace/${batch.id}`}>{batch.lot_no}</Link></td>
                <td>{batch.product_name}</td>
                <td>{formatDate(batch.produced_on)}</td>
                <td>{formatDate(batch.expires_on)}</td>
                <td className="num">{batch.quantity_received}</td>
                <td className="num">{batch.quantity_available}</td>
                <td className="num">{batch.quantity_reserved}</td>
                <td className="muted small">{batch.station_name ?? '—'}</td>
                <td className="num">{batch.documents}</td>
                <td><Badge tone={batch.status === 'available' ? 'ok' : batch.status === 'recalled' ? 'danger' : 'warn'}>{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="建立批次" subtitle="收貨溫度需符合保存條件；冷凍 ≤ -18°C、冷藏 0–7°C">
        <form action={createBatchAction} className="form">
          <input type="hidden" name="redirectTo" value="/supplier/batches" />
          <div className="grid grid-3">
            <Field label="商品">
              <select name="sku" required>
                {mine.map((product) => (
                  <option key={product.sku} value={product.sku}>{product.sku} · {product.name}</option>
                ))}
              </select>
            </Field>
            <Field label="批號"><input name="lotNo" required placeholder="LOT-2026-001" /></Field>
            <Field label="數量"><input name="quantity" type="number" min="1" required /></Field>
          </div>
          <div className="grid grid-3">
            <Field label="生產日"><input name="producedOn" type="date" required /></Field>
            <Field label="到期日"><input name="expiresOn" type="date" required /></Field>
            <Field label="收貨溫度 (°C)"><input name="temp" type="number" step="0.1" required /></Field>
          </div>
          <Field label="指定站點" hint="留空表示尚未配送">
            <select name="stationId" defaultValue="">
              <option value="">未指定</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>{station.code} · {station.name}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn btn-primary">建立批次</button>
        </form>
      </Card>
    </>
  );
}
