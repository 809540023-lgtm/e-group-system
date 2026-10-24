import Link from 'next/link';
import { Badge, Card, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { updateProductStatusAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatTwd, PRODUCT_STATUS_LABELS, STORAGE_LABELS } from '../../../lib/format.ts';
import { listProducts } from '../../../lib/queries.ts';

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const products = await listProducts({ includeInactive: true });
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="商品定價"
        subtitle="售價須覆蓋食材成本、站點服務費與冷鏈物流；毛利率低於 45% 需重新議價。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="商品與毛利">
        <Table head={['SKU', '商品', '供應商', '售價', '成本', '毛利', '毛利率', '保存', '狀態', '調整']}>
          {products.map((product) => {
            const margin = product.price_twd - product.cost_twd;
            const rate = product.price_twd === 0 ? 0 : Math.round((margin / product.price_twd) * 100);
            return (
              <tr key={product.sku}>
                <td className="mono"><Link href={`/products/${product.sku}`}>{product.sku}</Link></td>
                <td>{product.name}</td>
                <td className="muted small">{product.supplier_name}</td>
                <td className="num">{formatTwd(product.price_twd)}</td>
                <td className="num">{formatTwd(product.cost_twd)}</td>
                <td className="num">{formatTwd(margin)}</td>
                <td className="num"><Badge tone={rate >= 45 ? 'ok' : rate >= 30 ? 'warn' : 'danger'}>{rate}%</Badge></td>
                <td>{STORAGE_LABELS[product.storage] ?? product.storage}</td>
                <td><Badge tone={product.status === 'active' ? 'ok' : product.status === 'recalled' ? 'danger' : 'muted'}>{PRODUCT_STATUS_LABELS[product.status] ?? product.status}</Badge></td>
                <td>
                  <form action={updateProductStatusAction} className="row">
                    <input type="hidden" name="sku" value={product.sku} />
                    <input type="hidden" name="redirectTo" value="/admin/pricing" />
                    <select name="status" defaultValue={product.status}>
                      <option value="draft">草稿</option>
                      <option value="active">上架</option>
                      <option value="suspended">停售</option>
                    </select>
                    <button type="submit" className="btn btn-sm">更新</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
