import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Empty, Field, Notice, PageHeader, Table } from '../../components/ui.tsx';
import { placeOrderAction } from '../../lib/actions.ts';
import { getSession } from '../../lib/auth.ts';
import { cartLines } from '../../lib/cart.ts';
import { formatTwd, STATION_TYPE_LABELS } from '../../lib/format.ts';
import { getCustomer, listStations } from '../../lib/queries.ts';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session === null) redirect('/login');
  if (session.role !== 'customer' || session.customerId === null) redirect('/');

  const params = await searchParams;
  const { lines, subtotal } = await cartLines();
  const [stations, customer] = await Promise.all([listStations(), getCustomer(session.customerId)]);
  const activeStations = stations.filter((station) => station.status === 'active');
  const conflicts = lines.flatMap((line) =>
    line.product.allergens.filter((allergen) => (customer?.allergens ?? []).includes(allergen)),
  );
  const error = typeof params.error === 'string' ? params.error : undefined;

  if (lines.length === 0) {
    return (
      <>
        <PageHeader title="結帳" />
        <Empty>購物車是空的。<Link href="/products"> 去選購</Link></Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader title="結帳" subtitle="確認站點與過敏原後送出。訂單、庫存保留、付款與稽核會在同一個交易完成。" />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {conflicts.length > 0 ? (
        <Notice tone="danger">購物車含您的過敏原：{[...new Set(conflicts)].join('、')}。請先回購物車移除。</Notice>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="訂單明細">
          <Table head={['商品', '數量', '小計']}>
            {lines.map((line) => (
              <tr key={line.product.sku}>
                <td>{line.product.name}<div className="muted tiny">{line.product.sku}</div></td>
                <td className="num">{line.quantity}</td>
                <td className="num">{formatTwd(line.lineTotal)}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="stack">
            <div className="spread"><span className="muted">商品小計</span><span>{formatTwd(subtotal)}</span></div>
            <div className="spread"><span className="muted">站點服務費</span><span>{formatTwd(15)}</span></div>
            <div className="spread"><strong>總額</strong><span className="price">{formatTwd(subtotal + 15)}</span></div>
          </div>
        </Card>

        <Card title="取貨與推薦">
          <form action={placeOrderAction} className="form">
            <Field label="取貨站點" hint="僅顯示營運中站點">
              <select name="stationId" required defaultValue={activeStations[0]?.id ?? ''}>
                {activeStations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}（{STATION_TYPE_LABELS[station.type]}，{station.mrt_station}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="推薦碼" hint="可留空；被推薦人僅能歸因一次，且不得自薦">
              <input name="referralCode" placeholder="例如 EGMIMI" />
            </Field>
            <div className="notice">
              <div className="spread"><span className="muted small">會員</span><span>{customer?.name}</span></div>
              <div className="spread"><span className="muted small">過敏原</span><span>{customer?.allergens.length ? customer.allergens.join('、') : '未設定'}</span></div>
              <div className="spread"><span className="muted small">取貨碼</span><span>送出後顯示一次</span></div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={conflicts.length > 0}>送出訂單</button>
            <Link href="/cart" className="btn btn-ghost">回購物車</Link>
          </form>
        </Card>
      </div>
    </>
  );
}
