import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { quarantineBatchAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { BATCH_STATUS_LABELS, formatDate, STORAGE_LABELS } from '../../../lib/format.ts';
import { listStationBatches } from '../../../lib/ops.ts';

export default async function StationInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const batches = await listStationBatches(session.stationId);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const total = batches.reduce((sum, batch) => sum + (batch.status === 'available' ? batch.quantity_available - batch.quantity_reserved : 0), 0);
  const expiring = batches.filter((batch) => batch.status === 'available' && new Date(batch.expires_on) <= new Date(Date.now() + 2 * 86_400_000));

  return (
    <>
      <PageHeader title="庫存批次" subtitle={`目前可用 ${total} 單位；配貨採先到期先出（FIFO）。`} />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}
      {expiring.length > 0 ? <Notice tone="warn">有 {expiring.length} 批 2 日內到期，建議優先配貨或促銷。</Notice> : null}

      <Card title="批次庫存">
        {batches.length === 0 ? <p className="muted small">目前沒有庫存批次。</p> : (
          <Table head={['批號', '商品', '保存', '到期日', '可用', '保留', '狀態', '操作']}>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td className="mono"><Link href={`/trace/${batch.id}`}>{batch.lot_no}</Link></td>
                <td>{batch.product_name}<div className="muted tiny">{batch.sku}</div></td>
                <td>{STORAGE_LABELS[batch.storage] ?? batch.storage}</td>
                <td>{formatDate(batch.expires_on)}</td>
                <td className="num">{batch.quantity_available}</td>
                <td className="num">{batch.quantity_reserved}</td>
                <td><Badge tone={batch.status === 'available' ? 'ok' : batch.status === 'recalled' ? 'danger' : 'warn'}>{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</Badge></td>
                <td>
                  {batch.status === 'available' ? (
                    <form action={quarantineBatchAction} className="row">
                      <input type="hidden" name="batchId" value={batch.id} />
                      <input type="hidden" name="redirectTo" value="/station/inventory" />
                      <input name="reason" required placeholder="隔離原因" style={{ width: 130 }} />
                      <button type="submit" className="btn btn-sm btn-danger">隔離</button>
                    </form>
                  ) : (
                    <Link href="/station/quarantine" className="btn btn-sm">處理</Link>
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
