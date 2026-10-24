import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { quarantineBatchAction, releaseQuarantineAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { BATCH_STATUS_LABELS, formatDate } from '../../../lib/format.ts';
import { listRecalls } from '../../../lib/queries.ts';
import { listStationBatches } from '../../../lib/ops.ts';

export default async function StationQuarantinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const [batches, recalls] = await Promise.all([
    listStationBatches(session.stationId),
    listRecalls(),
  ]);
  const quarantined = batches.filter((batch) => batch.status === 'quarantined');
  const available = batches.filter((batch) => batch.status === 'available');
  const openRecalls = recalls.filter((recall) => recall.status === 'open');
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="隔離與召回"
        subtitle="隔離批次立即停止銷售與交付。召回由總部啟動，站點不得自行解除。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}
      {openRecalls.length > 0 ? (
        <Notice tone="danger">
          目前有 {openRecalls.length} 件召回進行中，相關商品不得交付。
          <Link href="/recalls" className="link"> 查看召回公告</Link>
        </Notice>
      ) : null}

      <Card title="隔離中批次">
        {quarantined.length === 0 ? <p className="muted small">目前沒有隔離批次。</p> : (
          <Table head={['批號', '商品', '到期日', '可用', '狀態', '操作']}>
            {quarantined.map((batch) => (
              <tr key={batch.id}>
                <td className="mono"><Link href={`/trace/${batch.id}`}>{batch.lot_no}</Link></td>
                <td>{batch.product_name}</td>
                <td>{formatDate(batch.expires_on)}</td>
                <td className="num">{batch.quantity_available}</td>
                <td><Badge tone="warn">{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</Badge></td>
                <td>
                  <form action={releaseQuarantineAction}>
                    <input type="hidden" name="batchId" value={batch.id} />
                    <input type="hidden" name="redirectTo" value="/station/quarantine" />
                    <button type="submit" className="btn btn-sm">解除隔離</button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="隔離批次">
        <form action={quarantineBatchAction} className="form">
          <input type="hidden" name="redirectTo" value="/station/quarantine" />
          <div className="grid grid-2">
            <Field label="批次">
              <select name="batchId" required>
                {available.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.lot_no} · {batch.product_name}</option>
                ))}
              </select>
            </Field>
            <Field label="隔離原因"><input name="reason" required placeholder="溫度異常 / 包裝破損" /></Field>
          </div>
          <button type="submit" className="btn btn-danger" disabled={available.length === 0}>執行隔離</button>
        </form>
      </Card>
    </>
  );
}
