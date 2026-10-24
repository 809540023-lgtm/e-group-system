import Link from 'next/link';
import { Badge, Card, Empty, Field, Notice, PageHeader } from '../../components/ui.tsx';
import { addToCartAction } from '../../lib/actions.ts';
import { getSession } from '../../lib/auth.ts';
import { formatTwd, STORAGE_LABELS } from '../../lib/format.ts';
import { getCustomer, listProducts } from '../../lib/queries.ts';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const customer = session?.customerId !== null && session?.customerId !== undefined
    ? await getCustomer(session.customerId)
    : null;

  const search = typeof params.q === 'string' ? params.q : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const storage = typeof params.storage === 'string' ? params.storage : '';
  const excludeMine = params.excludeMine === '1';

  const products = await listProducts({
    search,
    category,
    storage,
    excludeAllergens: excludeMine ? (customer?.allergens ?? []) : [],
  });

  const categories = [...new Set((await listProducts()).map((product) => product.category))];
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="選購餐食"
        subtitle="每項商品都標示營養、過敏原、保存方式與加熱方式；庫存以批次到期日先進先出。"
        actions={<Link href="/cart" className="btn">前往購物車</Link>}
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="篩選" className="card">
        <form method="get" className="form">
          <div className="form-row">
            <Field label="關鍵字"><input name="q" defaultValue={search} placeholder="品名、SKU 或描述" /></Field>
            <Field label="分類">
              <select name="category" defaultValue={category}>
                <option value="">全部分類</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="保存方式">
              <select name="storage" defaultValue={storage}>
                <option value="">全部</option>
                <option value="chilled">冷藏</option>
                <option value="frozen">冷凍</option>
                <option value="ambient">常溫</option>
              </select>
            </Field>
            <Field label="過敏原">
              <label className="check">
                <input type="checkbox" name="excludeMine" value="1" defaultChecked={excludeMine} />
                排除我的過敏原{customer !== null && customer.allergens.length > 0 ? `（${customer.allergens.join('、')}）` : '（尚未設定）'}
              </label>
            </Field>
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary">套用篩選</button>
            <Link href="/products" className="btn btn-ghost">清除</Link>
          </div>
        </form>
      </Card>

      <div style={{ marginTop: 16 }}>
        {products.length === 0 ? (
          <Empty>沒有符合條件的商品。試著清除篩選或調整關鍵字。</Empty>
        ) : (
          <div className="grid grid-3">
            {products.map((product) => {
              const available = Number(product.available);
              return (
                <Card key={product.sku}>
                  <div className="product-card">
                    <div className="product-thumb">{product.category}</div>
                    <div className="spread">
                      <div>
                        <Link href={`/products/${product.sku}`}><strong>{product.name}</strong></Link>
                        <div className="muted tiny">{product.sku} · {product.supplier_name}</div>
                      </div>
                      <Badge tone={available > 0 ? 'ok' : 'danger'}>{available > 0 ? `可售 ${available}` : '售完'}</Badge>
                    </div>
                    <p className="muted small">{product.description}</p>
                    <div className="pill-row">
                      <Badge tone="info">{STORAGE_LABELS[product.storage]}</Badge>
                      <Badge tone="muted">{product.calories} kcal</Badge>
                      <Badge tone="muted">蛋白質 {product.protein_g}g</Badge>
                      {product.claims.map((claim) => <Badge key={claim} tone="ok">{claim}</Badge>)}
                    </div>
                    {product.allergens.length > 0 ? (
                      <div className="muted tiny">過敏原：{product.allergens.join('、')}</div>
                    ) : (
                      <div className="muted tiny">未標示主要過敏原</div>
                    )}
                    <div className="spread">
                      <span className="price">{formatTwd(product.price_twd)}</span>
                      <form action={addToCartAction} className="inline">
                        <input type="hidden" name="sku" value={product.sku} />
                        <input type="hidden" name="redirectTo" value="/products" />
                        <input name="quantity" type="number" min={1} max={99} defaultValue={1} style={{ width: 64 }} />
                        <button type="submit" className="btn btn-primary btn-sm" disabled={available <= 0}>加入</button>
                      </form>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
