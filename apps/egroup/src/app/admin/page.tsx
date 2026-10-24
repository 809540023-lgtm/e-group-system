import Link from 'next/link';
import { Badge, Card, Empty, Notice, PageHeader, Stat, Table } from '../../components/ui.tsx';
import { requireRole } from '../../lib/auth.ts';
import { formatDateTime, formatTwd, ORDER_STATUS_LABELS } from '../../lib/format.ts';
import { getAdminSummary, listAuditEvents, listRecalls } from '../../lib/queries.ts';
import { listQualityBatches, listReferrals } from '../../lib/ops.ts';
import { query } from '../../lib/db.ts';

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const [summary, recalls, referrals, batches, audit, recentOrders] = await Promise.all([
    getAdminSummary(),
    listRecalls(),
    listReferrals(),
    listQualityBatches(),
    listAuditEvents(8),
    query<{ order_no: string; customer_name: string; station_name: string; total_twd: number; status: string; created_at: string }>(
      `SELECT o.order_no, c.name AS customer_name, st.name AS station_name, o.total_twd, o.status, o.created_at
         FROM orders o JOIN customers c ON c.id = o.customer_id JOIN stations st ON st.id = o.station_id
        ORDER BY o.created_at DESC LIMIT 8`,
    ),
  ]);

  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const openRecalls = recalls.filter((recall) => recall.status === 'open');
  const pendingReferrals = referrals.filter((referral) => referral.status === 'pending');
  const lowStock = batches.filter((batch) => batch.status === 'available' && batch.breaches !== '0');

  return (
    <>
      <PageHeader
        title="營運儀表板"
        subtitle="總部視角：營收、訂單、品質、推薦與稽核。所有變更皆寫入稽核軌跡。"
        actions={<Link href="/admin/quality" className="btn btn-primary">品質與召回</Link>}
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-4">
        <Stat label="累計營收" value={formatTwd(summary.revenue)} hint="已付款訂單" />
        <Stat label="訂單總數" value={summary.orders} hint={`${summary.customers} 位會員`} />
        <Stat label="上架商品" value={summary.active_products} hint="有效標示" />
        <Stat label="待核准推薦" value={summary.pending_referrals} hint="完成交付後核准" />
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <Stat label="進行中召回" value={summary.open_recalls} hint="全通路封鎖" />
        <Stat label="低庫存批次" value={summary.low_stock} hint="少於 10 單位" />
        <Stat label="7 日超溫" value={summary.breaches} hint="需檢討" />
        <Stat label="稽核事件" value={audit.length} hint="最近紀錄" />
      </div>

      {openRecalls.length > 0 ? (
        <Notice tone="danger">有 {openRecalls.length} 件召回進行中，相關商品已停止銷售與交付。</Notice>
      ) : null}
      {pendingReferrals.length > 0 ? (
        <Notice tone="warn">有 {pendingReferrals.length} 筆推薦獎勵待核准。<Link href="/admin/referrals" className="link">前往處理</Link></Notice>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="最近訂單" actions={<Link href="/admin/reconciliation" className="btn btn-sm">對帳</Link>}>
          {recentOrders.length === 0 ? <Empty>尚無訂單。</Empty> : (
            <Table head={['訂單', '顧客', '站點', '金額', '狀態']}>
              {recentOrders.map((order) => (
                <tr key={order.order_no}>
                  <td className="mono"><Link href={`/orders/${order.order_no}`}>{order.order_no}</Link></td>
                  <td>{order.customer_name}</td>
                  <td className="muted small">{order.station_name}</td>
                  <td className="num">{formatTwd(order.total_twd)}</td>
                  <td><Badge tone={order.status === 'delivered' ? 'ok' : 'warn'}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="稽核軌跡" actions={<Link href="/admin/audit" className="btn btn-sm">全部</Link>}>
          {audit.length === 0 ? <Empty>尚無稽核事件。</Empty> : (
            <Table head={['動作', '實體', '操作者', '時間']}>
              {audit.map((event) => (
                <tr key={event.id}>
                  <td className="mono tiny">{event.action}</td>
                  <td className="muted small">{event.entity_type}</td>
                  <td className="muted tiny">{event.actor_id}</td>
                  <td className="muted small">{formatDateTime(event.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {lowStock.length > 0 ? (
        <Card title="溫控異常批次" className="card">
          <Table head={['批號', '商品', '供應商', '站點', '超溫次數']}>
            {lowStock.slice(0, 8).map((batch) => (
              <tr key={batch.id}>
                <td className="mono"><Link href={`/trace/${batch.id}`}>{batch.lot_no}</Link></td>
                <td>{batch.product_name}</td>
                <td className="muted small">{batch.supplier_name}</td>
                <td className="muted small">{batch.station_name ?? '—'}</td>
                <td className="num">{batch.breaches}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
    </>
  );
}
