import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, Field, KeyValue, Notice, PageHeader, StatusBadge, Table } from '../../../components/ui.tsx';
import { payOrderAction, refundOrderAction } from '../../../lib/actions.ts';
import { getSession } from '../../../lib/auth.ts';
import { one, query } from '../../../lib/db.ts';
import { formatDateTime, formatTwd, ORDER_STATUS_LABELS } from '../../../lib/format.ts';
import { getOrderByNo, getOrderItems } from '../../../lib/queries.ts';

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session === null) redirect('/login');

  const { orderNo } = await params;
  const search = await searchParams;
  const order = await getOrderByNo(orderNo);
  if (order === null) notFound();

  const allowed =
    (session.role === 'customer' && session.customerId === order.customer_id) ||
    (session.role === 'station' && session.stationId === order.station_id) ||
    session.role === 'admin';
  if (!allowed) notFound();

  const [items, payments, refunds, delivery, audit] = await Promise.all([
    getOrderItems(order.id),
    query<{ id: string; provider: string; provider_txn_id: string | null; amount_twd: number; status: string; created_at: string }>(
      'SELECT id, provider, provider_txn_id, amount_twd, status, created_at FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
      [order.id],
    ),
    query<{ id: string; amount_twd: number; reason: string; status: string; created_at: string }>(
      'SELECT id, amount_twd, reason, status, created_at FROM refunds WHERE order_id = $1 ORDER BY created_at DESC',
      [order.id],
    ),
    one<{ delivered_at: string; delivered_by: string; method: string }>(
      'SELECT delivered_at, delivered_by, method FROM deliveries WHERE order_id = $1',
      [order.id],
    ),
    query<{ id: string; action: string; actor_type: string; actor_id: string; created_at: string }>(
      'SELECT id::text, action, actor_type, actor_id, created_at FROM audit_events WHERE entity_type = \'order\' AND entity_id = $1 ORDER BY id DESC',
      [order.id],
    ),
  ]);

  const code = typeof search.code === 'string' ? search.code : undefined;
  const error = typeof search.error === 'string' ? search.error : undefined;
  const ok = typeof search.ok === 'string' ? search.ok : undefined;
  const paid = payments.filter((payment) => payment.status === 'succeeded').reduce((sum, payment) => sum + payment.amount_twd, 0);
  const refunded = refunds.filter((refund) => refund.status === 'completed').reduce((sum, refund) => sum + refund.amount_twd, 0);
  const refundable = Math.max(0, paid - refunded);

  return (
    <>
      <PageHeader
        title={`訂單 ${order.order_no}`}
        subtitle={`${order.station_name}（${order.station_code}）· ${formatDateTime(order.created_at)}`}
        actions={<Link href={session.role === 'customer' ? '/orders' : '/station'} className="btn">回列表</Link>}
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      {code !== undefined ? (
        <Card title="取貨碼（只顯示這一次）" subtitle="請截圖或記下；系統只儲存 HMAC 雜湊，無法再次查詢明文。">
          <div className="code-box">{code}</div>
          <p className="muted small" style={{ marginTop: 10 }}>
            取貨碼有效至 {formatDateTime(order.pickup_code_expires_at)}。到站點出示訂單編號與此碼完成核銷。
          </p>
        </Card>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="訂單狀態">
          <div className="row" style={{ marginBottom: 12 }}>
            <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
            <StatusBadge status={order.payment_status} label={order.payment_status === 'paid' ? '已付款' : order.payment_status === 'unpaid' ? '未付款' : order.payment_status} />
            {order.pickup_code_used_at !== null ? <Badge tone="muted">取貨碼已使用</Badge> : <Badge tone="warn">取貨碼未使用</Badge>}
          </div>
          <KeyValue items={[
            { label: '商品小計', value: formatTwd(order.subtotal_twd) },
            { label: '站點服務費', value: formatTwd(order.station_fee_twd) },
            { label: '外送費', value: formatTwd(order.delivery_fee_twd) },
            { label: '總額', value: <strong className="price">{formatTwd(order.total_twd)}</strong> },
            { label: '已付款', value: formatTwd(paid) },
            { label: '已退款', value: formatTwd(refunded) },
            { label: '可退餘額', value: formatTwd(refundable) },
            { label: '推薦碼', value: order.referral_code ?? '—' },
          ]} />

          {session.role === 'customer' && order.payment_status === 'unpaid' && order.status === 'pending_payment' ? (
            <form action={payOrderAction} style={{ marginTop: 14 }}>
              <input type="hidden" name="orderNo" value={order.order_no} />
              <button type="submit" className="btn btn-primary">示範付款</button>
            </form>
          ) : null}

          {session.role === 'customer' && refundable > 0 ? (
            <form action={refundOrderAction} className="form" style={{ marginTop: 14 }}>
              <input type="hidden" name="orderNo" value={order.order_no} />
              <div className="form-row">
                <Field label="退款金額" hint={`可退上限 ${formatTwd(refundable)}`}>
                  <input name="amount" type="number" min={1} max={refundable} defaultValue={refundable} />
                </Field>
                <Field label="退款原因"><input name="reason" required placeholder="例如：未取貨" /></Field>
              </div>
              <button type="submit" className="btn btn-danger">申請退款</button>
            </form>
          ) : null}
        </Card>

        <Card title="交付與站點">
          <KeyValue items={[
            { label: '取貨站點', value: order.station_name },
            { label: '站點代碼', value: order.station_code },
            { label: '取貨碼到期', value: formatDateTime(order.pickup_code_expires_at) },
            { label: '取貨碼使用時間', value: formatDateTime(order.pickup_code_used_at) },
            { label: '交付時間', value: delivery === null ? '—' : formatDateTime(delivery.delivered_at) },
            { label: '交付人員', value: delivery?.delivered_by ?? '—' },
            { label: '交付方式', value: delivery?.method ?? '—' },
          ]} />
          <div className="divider" />
          <h3>狀態時間軸</h3>
          <div className="timeline" style={{ marginTop: 10 }}>
            {audit.length === 0 ? <p className="muted small">尚無稽核事件。</p> : audit.map((event) => (
              <div className="timeline-item" key={event.id}>
                <span className="dot" />
                <div>
                  <div>{event.action}</div>
                  <div className="muted tiny">{event.actor_type} · {event.actor_id} · {formatDateTime(event.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="商品明細" className="card">
        <Table head={['商品', '批號', '數量', '單價', '小計', '追溯']}>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}<div className="muted tiny">{item.sku}</div></td>
              <td className="mono">{item.lot_no}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatTwd(item.unit_price_twd)}</td>
              <td className="num">{formatTwd(item.line_total_twd)}</td>
              <td><Link href={`/trace/${item.batch_id}`} className="btn btn-sm">查看</Link></td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="付款紀錄">
          {payments.length === 0 ? <p className="muted small">尚無付款紀錄。</p> : (
            <Table head={['金流', '交易編號', '金額', '狀態', '時間']}>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.provider}</td>
                  <td className="mono tiny">{payment.provider_txn_id ?? '—'}</td>
                  <td className="num">{formatTwd(payment.amount_twd)}</td>
                  <td><StatusBadge status={payment.status} /></td>
                  <td className="muted small">{formatDateTime(payment.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="退款紀錄">
          {refunds.length === 0 ? <p className="muted small">尚無退款紀錄。</p> : (
            <Table head={['金額', '原因', '狀態', '時間']}>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td className="num">{formatTwd(refund.amount_twd)}</td>
                  <td>{refund.reason}</td>
                  <td><StatusBadge status={refund.status} /></td>
                  <td className="muted small">{formatDateTime(refund.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
