import Link from 'next/link';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { closeRecallAction, createRecallAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { BATCH_STATUS_LABELS, formatDate, formatDateTime } from '../../../lib/format.ts';
import { listRecalls } from '../../../lib/queries.ts';
import { listQualityBatches, listRecallNotifications } from '../../../lib/ops.ts';

export default async function AdminQualityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const [batches, recalls, notifications] = await Promise.all([
    listQualityBatches(),
    listRecalls(),
    listRecallNotifications(),
  ]);
  const stats = new Map(notifications.map((row) => [row.recall_id, row]));
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const open = recalls.filter((recall) => recall.status === 'open');
  const risky = batches.filter((batch) => batch.breaches !== '0' || batch.status === 'quarantined');

  return (
    <>
      <PageHeader
        title="品質與召回"
        subtitle="召回啟動後全通路立即封鎖；顧客通知全部送出後才能結案。AI 不得解除召回。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}
      {open.length > 0 ? <Notice tone="danger">目前有 {open.length} 件召回進行中。</Notice> : null}

      <Card title="進行中召回">
        {open.length === 0 ? <p className="muted small">目前沒有進行中的召回。</p> : (
          <Table head={['商品', '批號', '原因', '通知進度', '開始時間', '結案']}>
            {open.map((recall) => {
              const stat = stats.get(recall.id);
              return (
                <tr key={recall.id}>
                  <td>{recall.product_name}<div className="muted tiny">{recall.sku}</div></td>
                  <td className="mono">{recall.lot_no ?? '全品項'}</td>
                  <td className="muted small">{recall.reason}</td>
                  <td className="num">{stat === undefined ? '0 / 0' : `${stat.sent} / ${stat.total}`}</td>
                  <td className="muted small">{formatDateTime(recall.started_at)}</td>
                  <td>
                    <form action={closeRecallAction}>
                      <input type="hidden" name="recallId" value={recall.id} />
                      <input type="hidden" name="redirectTo" value="/admin/quality" />
                      <button type="submit" className="btn btn-sm">結案</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title="啟動召回">
        <form action={createRecallAction} className="form">
          <input type="hidden" name="redirectTo" value="/admin/quality" />
          <div className="grid grid-2">
            <Field label="批次">
              <select name="batchId" required>
                {batches.filter((batch) => batch.status !== 'recalled').map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.lot_no} · {batch.product_name}（{batch.supplier_name}）</option>
                ))}
              </select>
            </Field>
            <Field label="召回原因"><input name="reason" required placeholder="檢驗不合格 / 溫度異常" /></Field>
          </div>
          <button type="submit" className="btn btn-danger">啟動召回</button>
        </form>
      </Card>

      <Card title="高風險批次">
        {risky.length === 0 ? <p className="muted small">目前沒有高風險批次。</p> : (
          <Table head={['批號', '商品', '供應商', '站點', '到期日', '超溫', '狀態']}>
            {risky.map((batch) => (
              <tr key={batch.id}>
                <td className="mono"><Link href={`/trace/${batch.id}`}>{batch.lot_no}</Link></td>
                <td>{batch.product_name}</td>
                <td className="muted small">{batch.supplier_name}</td>
                <td className="muted small">{batch.station_name ?? '—'}</td>
                <td>{formatDate(batch.expires_on)}</td>
                <td className="num">{batch.breaches}</td>
                <td><Badge tone={batch.status === 'recalled' ? 'danger' : 'warn'}>{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
