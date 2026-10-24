import Link from 'next/link';
import { Badge, Card, Empty, Notice, PageHeader, Table } from '../../components/ui.tsx';
import { query } from '../../lib/db.ts';
import { formatDateTime } from '../../lib/format.ts';
import { listRecalls } from '../../lib/queries.ts';

export default async function RecallsPage() {
  const recalls = await listRecalls();
  const notifications = await query<{ recall_id: string; total: string; sent: string }>(
    `SELECT recall_id, count(*)::text AS total, count(*) FILTER (WHERE status = 'sent')::text AS sent
       FROM recall_notifications GROUP BY recall_id`,
  );
  const byRecall = new Map(notifications.map((row) => [row.recall_id, row]));
  const open = recalls.filter((recall) => recall.status === 'open');

  return (
    <>
      <PageHeader
        title="召回公告"
        subtitle="召回中商品與批次不得透過任何管道銷售或交付；顧客通知完成後才能結案。"
      />

      {open.length > 0 ? (
        <Notice tone="danger">目前有 {open.length} 件召回進行中。相關商品已停止銷售與交付。</Notice>
      ) : (
        <Notice tone="ok">目前沒有進行中的召回。</Notice>
      )}

      <Card title="召回紀錄" className="card">
        {recalls.length === 0 ? (
          <Empty>目前沒有召回紀錄。</Empty>
        ) : (
          <Table head={['商品', '批號', '原因', '狀態', '通知', '開始', '結案']}>
            {recalls.map((recall) => {
              const stats = byRecall.get(recall.id);
              return (
                <tr key={recall.id}>
                  <td>
                    <Link href={`/products/${recall.sku}`}>{recall.product_name}</Link>
                    <div className="muted tiny">{recall.sku}</div>
                  </td>
                  <td className="mono">{recall.lot_no ?? '全品項'}</td>
                  <td>{recall.reason}</td>
                  <td><Badge tone={recall.status === 'open' ? 'danger' : 'muted'}>{recall.status === 'open' ? '進行中' : '已結案'}</Badge></td>
                  <td className="num">{stats === undefined ? '0 / 0' : `${stats.sent} / ${stats.total}`}</td>
                  <td className="muted small">{formatDateTime(recall.started_at)}</td>
                  <td className="muted small">{formatDateTime(recall.closed_at)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
