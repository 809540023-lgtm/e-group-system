import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Empty, Notice, PageHeader, Stat, StatusBadge, Table } from '../../components/ui.tsx';
import { getSession } from '../../lib/auth.ts';
import { formatDateTime, formatTwd, ORDER_STATUS_LABELS } from '../../lib/format.ts';
import { listOrdersForCustomer } from '../../lib/queries.ts';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session === null) redirect('/login');
  if (session.role !== 'customer' || session.customerId === null) redirect('/');

  const params = await searchParams;
  const orders = await listOrdersForCustomer(session.customerId);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const active = orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status));
  const spent = orders
    .filter((order) => order.payment_status === 'paid' || order.payment_status === 'partially_refunded')
    .reduce((sum, order) => sum + order.total_twd, 0);

  return (
    <>
      <PageHeader title="我的訂單" subtitle="取貨碼只顯示一次；已使用或過期的取貨碼不可重複核銷。" actions={<Link href="/products" className="btn">再買一次</Link>} />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-3">
        <Stat label="訂單總數" value={orders.length} />
        <Stat label="進行中" value={active.length} hint="待付款、備餐或可取貨" />
        <Stat label="累積消費" value={formatTwd(spent)} hint="已付款訂單" />
      </div>

      <Card title="訂單紀錄" className="card">
        {orders.length === 0 ? (
          <Empty>還沒有訂單。<Link href="/products"> 去選購</Link></Empty>
        ) : (
          <Table head={['訂單編號', '站點', '金額', '付款', '狀態', '建立時間', '']}>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="mono">{order.order_no}</td>
                <td>{order.station_name}<div className="muted tiny">{order.station_code}</div></td>
                <td className="num">{formatTwd(order.total_twd)}</td>
                <td><StatusBadge status={order.payment_status} label={order.payment_status === 'paid' ? '已付款' : order.payment_status === 'unpaid' ? '未付款' : order.payment_status} /></td>
                <td><StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} /></td>
                <td className="muted small">{formatDateTime(order.created_at)}</td>
                <td><Link href={`/orders/${order.order_no}`} className="btn btn-sm">明細</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
