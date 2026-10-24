import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { saveProductAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatTwd, PRODUCT_STATUS_LABELS, STORAGE_LABELS } from '../../../lib/format.ts';
import { listProducts } from '../../../lib/queries.ts';

export default async function SupplierProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['supplier', 'admin']);
  if (session.supplierId === null) redirect('/admin');
  const params = await searchParams;

  const products = (await listProducts({ includeInactive: true })).filter(
    (product) => product.supplier_id === session.supplierId,
  );
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="商品與標示"
        subtitle="營養標示須符合法規；禁止醫療效能與不實宣稱。標示不合格的商品無法儲存。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="我的商品">
        {products.length === 0 ? <p className="muted small">尚未建立商品。</p> : (
          <Table head={['SKU', '名稱', '分類', '售價', '成本', '保存', '過敏原', '狀態', '庫存']}>
            {products.map((product) => (
              <tr key={product.sku}>
                <td className="mono">{product.sku}</td>
                <td><Link href={`/products/${product.sku}`}>{product.name}</Link></td>
                <td>{product.category}</td>
                <td className="num">{formatTwd(product.price_twd)}</td>
                <td className="num">{formatTwd(product.cost_twd)}</td>
                <td>{STORAGE_LABELS[product.storage] ?? product.storage}</td>
                <td className="muted small">{product.allergens.length === 0 ? '—' : product.allergens.join('、')}</td>
                <td><Badge tone={product.status === 'active' ? 'ok' : product.status === 'recalled' ? 'danger' : 'muted'}>{PRODUCT_STATUS_LABELS[product.status] ?? product.status}</Badge></td>
                <td className="num">{product.available}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="新增 / 更新商品" subtitle="以 SKU 為鍵；儲存時會重新執行營養標示檢查">
        <form action={saveProductAction} className="form">
          <input type="hidden" name="redirectTo" value="/supplier/products" />
          <div className="grid grid-3">
            <Field label="SKU"><input name="sku" required placeholder="EG-CHK-001" /></Field>
            <Field label="名稱"><input name="name" required /></Field>
            <Field label="分類"><input name="category" required placeholder="舒肥主餐" /></Field>
          </div>
          <Field label="描述"><textarea name="description" rows={2} /></Field>
          <div className="grid grid-4">
            <Field label="售價 (TWD)"><input name="price" type="number" min="0" required /></Field>
            <Field label="成本 (TWD)"><input name="cost" type="number" min="0" required /></Field>
            <Field label="淨重 (g)"><input name="weight" type="number" min="1" required /></Field>
            <Field label="保存期限 (日)"><input name="shelfLife" type="number" min="1" required /></Field>
          </div>
          <div className="grid grid-4">
            <Field label="熱量 (kcal)"><input name="calories" type="number" min="0" required /></Field>
            <Field label="蛋白質 (g)"><input name="protein" type="number" step="0.1" min="0" required /></Field>
            <Field label="脂肪 (g)"><input name="fat" type="number" step="0.1" min="0" required /></Field>
            <Field label="飽和脂肪 (g)"><input name="satFat" type="number" step="0.1" min="0" /></Field>
          </div>
          <div className="grid grid-4">
            <Field label="碳水 (g)"><input name="carbs" type="number" step="0.1" min="0" required /></Field>
            <Field label="糖 (g)"><input name="sugar" type="number" step="0.1" min="0" /></Field>
            <Field label="鈉 (mg)"><input name="sodium" type="number" min="0" required /></Field>
            <Field label="保存方式">
              <select name="storage" defaultValue="chilled">
                <option value="chilled">冷藏</option>
                <option value="frozen">冷凍</option>
                <option value="ambient">常溫</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-2">
            <Field label="過敏原" hint="以逗號分隔，例如：牛奶, 大豆"><input name="allergens" /></Field>
            <Field label="營養宣稱" hint="例如：高蛋白, 低脂；不實宣稱會被阻擋"><input name="claims" /></Field>
          </div>
          <Field label="加熱方式"><textarea name="heating" rows={2} placeholder="微波 700W 90 秒，中心溫度需達 75°C" /></Field>
          <Field label="狀態">
            <select name="status" defaultValue="draft">
              <option value="draft">草稿</option>
              <option value="active">上架</option>
              <option value="suspended">停售</option>
            </select>
          </Field>
          <button type="submit" className="btn btn-primary">儲存商品</button>
        </form>
      </Card>
    </>
  );
}
