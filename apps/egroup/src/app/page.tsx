import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Empty, Notice, PageHeader, Stat, StatusBadge, Table } from '../components/ui.tsx';
import { getSession } from '../lib/auth.ts';
import { cartLines } from '../lib/cart.ts';
import { formatDate, formatTwd, ORDER_STATUS_LABELS, STATION_TYPE_LABELS, STORAGE_LABELS } from '../lib/format.ts';
import { getCustomer, listOrdersForCustomer, listProducts, listRecalls, listStations } from '../lib/queries.ts';

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === 'supplier') redirect('/supplier');
  if (session?.role === 'station') redirect('/station');
  if (session?.role === 'admin') redirect('/admin');

  const [products, stations, recalls] = await Promise.all([listProducts(), listStations(), listRecalls()]);
  const openRecalls = recalls.filter((recall) => recall.status === 'open');
  const featured = products.slice(0, 6);

  if (session?.role === 'customer' && session.customerId !== null) {
    const [customer, orders, cart] = await Promise.all([
      getCustomer(session.customerId),
      listOrdersForCustomer(session.customerId),
      cartLines(),
    ]);
    const active = orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status));

    return (
      <>
        <PageHeader
          title={`${session.displayName}，今天想吃什麼？`}
          subtitle="依您的過敏原自動提示；所有餐食皆可追溯批次、檢驗文件與冷鏈溫度。"
          actions={<Link href="/products" className="btn btn-primary">開始選購</Link>}
        />

        {openRecalls.length > 0 ? (
          <Notice tone="danger">
            目前有 {openRecalls.length} 件召回進行中，相關商品已停止銷售與交付。
            <Link href="/recalls"> 查看公告</Link>
          </Notice>
        ) : null}

        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <Stat label="進行中訂單" value={active.length} hint="待付款、備餐或可取貨" />
          <Stat label="累積點數" value={customer?.points ?? 0} hint="推薦獎勵入點" />
          <Stat label="購物車件數" value={cart.count} hint={formatTwd(cart.subtotal)} />
          <Stat label="可選商品" value={products.length} hint="跨 3 家供應商" />
        </div>

        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <Card title="最近訂單" actions={<Link href="/orders" className="btn btn-sm">全部訂單</Link>}>
            {orders.length === 0 ? (
              <Empty>還沒有訂單。選購餐食後，取貨碼只會顯示一次。</Empty>
            ) : (
              <Table head={['訂單', '站點', '金額', '狀態', '建立']}>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/orders/${order.order_no}`}>{order.order_no}</Link></td>
                    <td>{order.station_name}</td>
                    <td className="num">{formatTwd(order.total_twd)}</td>
                    <td><StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} /></td>
                    <td className="muted small">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="為您推薦" subtitle="已排除您的過敏原">
            <div className="stack">
              {featured.slice(0, 4).map((product) => (
                <div className="spread" key={product.sku}>
                  <div>
                    <Link href={`/products/${product.sku}`}>{product.name}</Link>
                    <div className="muted tiny">
                      {product.category} · {STORAGE_LABELS[product.storage]} · {product.calories} kcal
                    </div>
                  </div>
                  <div className="row">
                    <span className="price">{formatTwd(product.price_twd)}</span>
                    <Link href={`/products/${product.sku}`} className="btn btn-sm">查看</Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="雙北捷運健康餐食節點網路"
        subtitle="把健康餐食放進捷運生活圈：集中採購、冷鏈配送、站點取貨、全程可追溯。"
        actions={<Link href="/products" className="btn btn-primary">瀏覽餐食</Link>}
      />

      {openRecalls.length > 0 ? (
        <Notice tone="danger">
          目前有 {openRecalls.length} 件召回進行中。<Link href="/recalls"> 查看公告</Link>
        </Notice>
      ) : null}

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <Stat label="上架 SKU" value={products.length} hint="主菜、配菜、主食、醬料與組合" />
        <Stat label="營運站點" value={stations.filter((station) => station.status === 'active').length} hint="A/B/C/D 四型節點" />
        <Stat label="可取貨庫存" value={products.reduce((sum, product) => sum + Number(product.available), 0)} hint="跨站點可售數量" />
        <Stat label="召回中" value={openRecalls.length} hint="全通路停止銷售與交付" />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="精選餐食" actions={<Link href="/products" className="btn btn-sm">全部商品</Link>}>
          <div className="grid grid-2">
            {featured.map((product) => (
              <div className="product-card" key={product.sku}>
                <div className="product-thumb">{product.category}</div>
                <div>
                  <Link href={`/products/${product.sku}`}>{product.name}</Link>
                  <div className="muted tiny">
                    {STORAGE_LABELS[product.storage]} · {product.calories} kcal · 蛋白質 {product.protein_g}g
                  </div>
                </div>
                <div className="spread">
                  <span className="price">{formatTwd(product.price_twd)}</span>
                  <Badge tone={Number(product.available) > 0 ? 'ok' : 'danger'}>
                    {Number(product.available) > 0 ? `可售 ${product.available}` : '售完'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="取貨站點" actions={<Link href="/stations" className="btn btn-sm">站點資訊</Link>}>
          <div className="stack">
            {stations.map((station) => (
              <div className="spread" key={station.id}>
                <div>
                  <strong>{station.name}</strong>
                  <div className="muted tiny">
                    {STATION_TYPE_LABELS[station.type]} · {station.mrt_line} {station.mrt_station} · 步行 {station.walk_minutes} 分
                  </div>
                </div>
                <StatusBadge status={station.status} label={station.status === 'active' ? '營運中' : station.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="為什麼是節點網路" subtitle="計畫書的核心設計" className="card" >
        <div className="grid grid-3">
          <div>
            <h3>食品安全優先</h3>
            <p className="muted small">批次、檢驗文件、冷鏈溫度與召回通知同一條資料鏈；召回中商品不得銷售或交付。</p>
          </div>
          <div>
            <h3>站點輕資產</h3>
            <p className="muted small">A/B/C/D 四型節點依人流、冷鏈、補貨與競爭條件評分，通過食安與場地門檻才進入決策。</p>
          </div>
          <div>
            <h3>資料可稽核</h3>
            <p className="muted small">訂單、付款、退款、交付、推薦與結算皆留稽核軌跡；離線事件以 client_event_id 安全補送。</p>
          </div>
        </div>
      </Card>
    </>
  );
}
