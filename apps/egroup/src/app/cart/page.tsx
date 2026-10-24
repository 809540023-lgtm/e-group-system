import Link from 'next/link';
import { Card, Empty, Notice, PageHeader, Table } from '../../components/ui.tsx';
import { clearCartAction, removeFromCartAction, updateCartAction } from '../../lib/actions.ts';
import { getSession } from '../../lib/auth.ts';
import { cartLines } from '../../lib/cart.ts';
import { formatTwd, STORAGE_LABELS } from '../../lib/format.ts';

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const { lines, subtotal, count } = await cartLines();
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="購物車"
        subtitle="結帳時會再次檢查過敏原、站點狀態與批次庫存。"
        actions={<Link href="/products" className="btn">繼續選購</Link>}
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      {lines.length === 0 ? (
        <Empty>購物車是空的。<Link href="/products"> 去挑幾份餐食</Link></Empty>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <Card title={`商品 ${count} 件`}>
            <Table head={['商品', '單價', '數量', '小計', '']}>
              {lines.map((line) => (
                <tr key={line.product.sku}>
                  <td>
                    <Link href={`/products/${line.product.sku}`}>{line.product.name}</Link>
                    <div className="muted tiny">{line.product.sku} · {STORAGE_LABELS[line.product.storage]}</div>
                  </td>
                  <td className="num">{formatTwd(line.product.price_twd)}</td>
                  <td>
                    <form action={updateCartAction} className="inline">
                      <input type="hidden" name="sku" value={line.product.sku} />
                      <input name="quantity" type="number" min={0} max={99} defaultValue={line.quantity} style={{ width: 64 }} />
                      <button type="submit" className="btn btn-sm">更新</button>
                    </form>
                  </td>
                  <td className="num">{formatTwd(line.lineTotal)}</td>
                  <td>
                    <form action={removeFromCartAction}>
                      <input type="hidden" name="sku" value={line.product.sku} />
                      <button type="submit" className="btn btn-sm btn-danger">移除</button>
                    </form>
                  </td>
                </tr>
              ))}
            </Table>
            <div className="actions" style={{ marginTop: 12 }}>
              <form action={clearCartAction}><button type="submit" className="btn btn-ghost btn-sm">清空購物車</button></form>
            </div>
          </Card>

          <Card title="結帳摘要">
            <div className="stack">
              <div className="spread"><span className="muted">商品小計</span><span>{formatTwd(subtotal)}</span></div>
              <div className="spread"><span className="muted">站點服務費</span><span>{formatTwd(15)}</span></div>
              <div className="spread"><span className="muted">外送費</span><span>{formatTwd(0)}</span></div>
              <div className="divider" />
              <div className="spread"><strong>預估總額</strong><span className="price">{formatTwd(subtotal + 15)}</span></div>
            </div>
            <div style={{ marginTop: 16 }}>
              {session?.role === 'customer' ? (
                <Link href="/checkout" className="btn btn-primary" style={{ width: '100%' }}>前往結帳</Link>
              ) : (
                <Notice tone="warn">
                  結帳需要會員帳號。<Link href="/login"> 登入</Link> 或 <Link href="/login?mode=register">註冊</Link>。
                </Notice>
              )}
            </div>
            <p className="muted tiny" style={{ marginTop: 12 }}>
              取貨碼為 6 位數字，只儲存 HMAC 雜湊；結帳後僅顯示一次，遺失請聯絡站點。
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
