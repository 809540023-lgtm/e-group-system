import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { createPurchaseOrderAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDate, formatTwd } from '../../../lib/format.ts';
import { listProducts } from '../../../lib/queries.ts';
import { listPurchaseOrders, listSuppliers } from '../../../lib/ops.ts';

export default async function AdminProcurementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const [orders, suppliers, products] = await Promise.all([
    listPurchaseOrders(),
    listSuppliers(),
    listProducts({ includeInactive: true }),
  ]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const open = orders.filter((order) => order.status === 'ordered');
  const committed = open.reduce((sum, order) => sum + order.quantity * order.unit_cost_twd, 0);

  return (
    <>
      <PageHeader title="採購管理" subtitle={`未到貨採購金額 ${formatTwd(committed)}；採購單須對應合格供應商與上架商品。`} />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="採購單">
        {orders.length === 0 ? <p className="muted small">尚無採購單。</p> : (
          <Table head={['供應商', 'SKU', '商品', '數量', '單價', '小計', '狀態', '預計到貨']}>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.supplier_name}</td>
                <td className="mono tiny">{order.sku}</td>
                <td>{order.product_name}</td>
                <td className="num">{order.quantity}</td>
                <td className="num">{formatTwd(order.unit_cost_twd)}</td>
                <td className="num">{formatTwd(order.quantity * order.unit_cost_twd)}</td>
                <td><Badge tone={order.status === 'received' ? 'ok' : order.status === 'cancelled' ? 'danger' : 'warn'}>{order.status}</Badge></td>
                <td className="muted small">{formatDate(order.expected_on)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="建立採購單">
        <form action={createPurchaseOrderAction} className="form">
          <input type="hidden" name="redirectTo" value="/admin/procurement" />
          <div className="grid grid-2">
            <Field label="供應商">
              <select name="supplierId" required>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}（{supplier.haccp_status}）</option>
                ))}
              </select>
            </Field>
            <Field label="商品">
              <select name="sku" required>
                {products.map((product) => (
                  <option key={product.sku} value={product.sku}>{product.sku} · {product.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-3">
            <Field label="數量"><input name="quantity" type="number" min="1" required /></Field>
            <Field label="單價 (TWD)"><input name="unitCost" type="number" min="0" required /></Field>
            <Field label="預計到貨"><input name="expectedOn" type="date" /></Field>
          </div>
          <button type="submit" className="btn btn-primary">建立採購單</button>
        </form>
      </Card>
    </>
  );
}
