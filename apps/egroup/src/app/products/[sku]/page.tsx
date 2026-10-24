import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { addToCartAction } from '../../../lib/actions.ts';
import { getSession } from '../../../lib/auth.ts';
import { query } from '../../../lib/db.ts';
import { formatDate, formatTwd, STORAGE_LABELS } from '../../../lib/format.ts';
import { getCustomer, getProduct } from '../../../lib/queries.ts';

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sku } = await params;
  const search = await searchParams;
  const product = await getProduct(sku);
  if (product === null) notFound();

  const session = await getSession();
  const customer = session?.customerId !== null && session?.customerId !== undefined
    ? await getCustomer(session.customerId)
    : null;
  const conflicts = customer === null
    ? []
    : product.allergens.filter((allergen) => customer.allergens.includes(allergen));

  const batches = await query<{
    id: string;
    lot_no: string;
    produced_on: string;
    expires_on: string;
    quantity_available: number;
    quantity_reserved: number;
    status: string;
    station_name: string | null;
  }>(
    `SELECT b.id, b.lot_no, b.produced_on, b.expires_on, b.quantity_available, b.quantity_reserved,
            b.status, st.name AS station_name
       FROM batches b
       LEFT JOIN stations st ON st.id = b.station_id
      WHERE b.sku = $1
      ORDER BY b.expires_on`,
    [sku],
  );

  const available = Number(product.available);
  const error = typeof search.error === 'string' ? search.error : undefined;
  const ok = typeof search.ok === 'string' ? search.ok : undefined;

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${product.sku} · ${product.category} · ${product.supplier_name}`}
        actions={<Link href="/products" className="btn">回商品列表</Link>}
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}
      {conflicts.length > 0 ? (
        <Notice tone="danger">此商品含您的過敏原：{conflicts.join('、')}。結帳時會再次阻擋。</Notice>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card>
          <div className="product-thumb" style={{ height: 180, fontSize: '2.2rem' }}>{product.category}</div>
          <p style={{ marginTop: 14 }}>{product.description}</p>
          <div className="pill-row" style={{ marginTop: 10 }}>
            <Badge tone="info">{STORAGE_LABELS[product.storage]}</Badge>
            <Badge tone="muted">保存 {product.shelf_life_days} 天</Badge>
            <Badge tone="muted">{product.weight_g} g</Badge>
            {product.claims.map((claim) => <Badge key={claim} tone="ok">{claim}</Badge>)}
          </div>
          <div className="divider" />
          <div className="spread">
            <div>
              <div className="price" style={{ fontSize: '1.6rem' }}>{formatTwd(product.price_twd)}</div>
              <div className="muted tiny">可售 {available} 份</div>
            </div>
            <form action={addToCartAction} className="inline">
              <input type="hidden" name="sku" value={product.sku} />
              <input type="hidden" name="redirectTo" value={`/products/${product.sku}`} />
              <Field label="數量">
                <input name="quantity" type="number" min={1} max={99} defaultValue={1} style={{ width: 80 }} />
              </Field>
              <button type="submit" className="btn btn-primary" disabled={available <= 0}>加入購物車</button>
            </form>
          </div>
        </Card>

        <Card title="營養標示" subtitle={`每份 ${product.weight_g} 公克`}>
          <div className="nutrition-grid">
            <div className="nutrition-cell"><b>{product.calories}</b><span>熱量 kcal</span></div>
            <div className="nutrition-cell"><b>{product.protein_g}g</b><span>蛋白質</span></div>
            <div className="nutrition-cell"><b>{product.fat_g}g</b><span>脂肪</span></div>
            <div className="nutrition-cell"><b>{product.saturated_fat_g ?? '—'}g</b><span>飽和脂肪</span></div>
            <div className="nutrition-cell"><b>{product.carbs_g}g</b><span>碳水化合物</span></div>
            <div className="nutrition-cell"><b>{product.sugar_g ?? '—'}g</b><span>糖</span></div>
            <div className="nutrition-cell"><b>{product.sodium_mg}mg</b><span>鈉</span></div>
            <div className="nutrition-cell"><b>{product.allergens.length}</b><span>過敏原項</span></div>
          </div>
          <div className="divider" />
          <div className="stack">
            <div className="spread"><span className="muted small">過敏原</span><span>{product.allergens.length > 0 ? product.allergens.join('、') : '無標示'}</span></div>
            <div className="spread"><span className="muted small">加熱方式</span><span style={{ textAlign: 'right', maxWidth: '60%' }}>{product.heating_instructions}</span></div>
            <div className="spread"><span className="muted small">供應商</span><span>{product.supplier_name}</span></div>
          </div>
        </Card>
      </div>

      <Card title="批次與追溯" subtitle="點擊批號查看檢驗文件、庫存異動與冷鏈溫度" className="card">
        {batches.length === 0 ? (
          <p className="muted small">目前沒有批次資料。</p>
        ) : (
          <Table head={['批號', '生產日', '到期日', '站點', '可售', '保留', '狀態', '追溯']}>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td className="mono">{batch.lot_no}</td>
                <td>{formatDate(batch.produced_on)}</td>
                <td>{formatDate(batch.expires_on)}</td>
                <td>{batch.station_name ?? '—'}</td>
                <td className="num">{batch.quantity_available}</td>
                <td className="num">{batch.quantity_reserved}</td>
                <td><Badge tone={batch.status === 'available' ? 'ok' : batch.status === 'recalled' ? 'danger' : 'warn'}>{batch.status}</Badge></td>
                <td><Link href={`/trace/${batch.id}`} className="btn btn-sm">查看</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
