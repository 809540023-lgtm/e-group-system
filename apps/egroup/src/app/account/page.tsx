import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Field, KeyValue, Notice, PageHeader, Stat, Table } from '../../components/ui.tsx';
import { updateProfileAction } from '../../lib/actions.ts';
import { getSession } from '../../lib/auth.ts';
import { query } from '../../lib/db.ts';
import { formatDateTime, formatTwd } from '../../lib/format.ts';
import { getCustomer, listOrdersForCustomer } from '../../lib/queries.ts';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session === null) redirect('/login');
  if (session.role !== 'customer' || session.customerId === null) redirect('/');

  const params = await searchParams;
  const [customer, orders, referrals] = await Promise.all([
    getCustomer(session.customerId),
    listOrdersForCustomer(session.customerId),
    query<{ id: string; referee_name: string; order_no: string; reward_twd: number; status: string; created_at: string }>(
      `SELECT r.id, c.name AS referee_name, o.order_no, r.reward_twd, r.status, r.created_at
         FROM referrals r
         JOIN customers c ON c.id = r.referee_customer_id
         JOIN orders o ON o.id = r.order_id
        WHERE r.referrer_customer_id = $1
        ORDER BY r.created_at DESC`,
      [session.customerId],
    ),
  ]);
  if (customer === null) redirect('/');

  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const delivered = orders.filter((order) => order.status === 'delivered').length;

  return (
    <>
      <PageHeader title="會員中心" subtitle="管理過敏原、推薦碼與點數。過敏原會在商品列表與結帳時自動檢查。" />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-4">
        <Stat label="累積點數" value={customer.points} hint="推薦獎勵入點" />
        <Stat label="完成訂單" value={delivered} hint={`共 ${orders.length} 筆`} />
        <Stat label="推薦碼" value={<span className="mono">{customer.referral_code}</span>} hint="分享給朋友" />
        <Stat label="推薦人" value={customer.referred_by_name ?? '—'} hint="僅能歸因一次" />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="會員資料">
          <form action={updateProfileAction} className="form">
            <Field label="姓名"><input name="name" defaultValue={customer.name} required /></Field>
            <Field label="手機"><input name="phone" defaultValue={customer.phone ?? ''} /></Field>
            <Field label="電子郵件"><input value={customer.email ?? ''} disabled /></Field>
            <Field label="過敏原" hint="以逗號分隔；留空表示未設定">
              <input name="allergens" defaultValue={customer.allergens.join(', ')} placeholder="花生, 牛奶" />
            </Field>
            <button type="submit" className="btn btn-primary">儲存</button>
          </form>
        </Card>

        <Card title="推薦獎勵" subtitle="被推薦人完成交付後，總部核准才入點；退款會扣回">
          {referrals.length === 0 ? (
            <p className="muted small">還沒有推薦紀錄。分享您的推薦碼 <span className="mono">{customer.referral_code}</span>。</p>
          ) : (
            <Table head={['被推薦人', '訂單', '獎勵', '狀態', '時間']}>
              {referrals.map((referral) => (
                <tr key={referral.id}>
                  <td>{referral.referee_name}</td>
                  <td className="mono tiny">{referral.order_no}</td>
                  <td className="num">{formatTwd(referral.reward_twd)}</td>
                  <td><Badge tone={referral.status === 'approved' ? 'ok' : referral.status === 'reversed' ? 'danger' : 'warn'}>{referral.status}</Badge></td>
                  <td className="muted small">{formatDateTime(referral.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
          <div className="divider" />
          <KeyValue items={[
            { label: '推薦碼', value: <span className="mono">{customer.referral_code}</span> },
            { label: '推薦人', value: customer.referred_by_name ?? '—' },
            { label: '點數', value: customer.points },
          ]} />
          <p className="muted tiny" style={{ marginTop: 10 }}>
            推薦為單層、不得自薦；被推薦人僅能歸因一次。退款時已核准獎勵會自動扣回。
          </p>
        </Card>
      </div>

      <Card title="最近訂單" className="card" actions={<Link href="/orders" className="btn btn-sm">全部訂單</Link>}>
        {orders.length === 0 ? <p className="muted small">還沒有訂單。</p> : (
          <Table head={['訂單', '站點', '金額', '狀態', '時間']}>
            {orders.slice(0, 5).map((order) => (
              <tr key={order.id}>
                <td><Link href={`/orders/${order.order_no}`}>{order.order_no}</Link></td>
                <td>{order.station_name}</td>
                <td className="num">{formatTwd(order.total_twd)}</td>
                <td>{order.status}</td>
                <td className="muted small">{formatDateTime(order.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
