import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Empty, Notice, PageHeader, Stat, Table } from '../../components/ui.tsx';
import { requireRole } from '../../lib/auth.ts';
import { formatDate, formatTwd } from '../../lib/format.ts';
import { getSupplier } from '../../lib/queries.ts';
import { getSupplierOverview, listSupplierBatches, listSupplierExceptions } from '../../lib/ops.ts';

export default async function SupplierHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['supplier', 'admin']);
  if (session.supplierId === null) redirect('/admin');
  const params = await searchParams;

  const [supplier, overview, batches, exceptions] = await Promise.all([
    getSupplier(session.supplierId),
    getSupplierOverview(session.supplierId),
    listSupplierBatches(session.supplierId),
    listSupplierExceptions(session.supplierId),
  ]);
  if (supplier === null) redirect('/');

  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const expiring = batches.filter((batch) => batch.status === 'available' && new Date(batch.expires_on) <= new Date(Date.now() + 3 * 86_400_000));

  return (
    <>
      <PageHeader title={supplier.name} subtitle="供應商工作台：商品標示、批次、檢驗文件、出貨與異常回覆。" />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-4">
        <Stat label="上架商品" value={overview.active_products} hint={`共 ${overview.products} 項`} />
        <Stat label="可用批次" value={overview.batches} hint={`${overview.expiring} 批 3 日內到期`} />
        <Stat label="運送中" value={overview.in_transit} hint="等待站點收貨" />
        <Stat label="待回覆異常" value={overview.open_exceptions} hint="需 24 小時內回覆" />
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <Stat label="累計出貨金額" value={formatTwd(overview.revenue)} hint="已付款訂單" />
        <Stat label="檢驗文件" value={overview.documents} hint="逐批登錄" />
        <Stat label="HACCP" value={<Badge tone={supplier.haccp_status === 'verified' ? 'ok' : 'warn'}>{supplier.haccp_status}</Badge>} hint="須維持有效" />
        <Stat label="產品責任險" value={formatDate(supplier.insurance_expires_on)} hint="到期前續保" />
      </div>

      {expiring.length > 0 ? (
        <Notice tone="warn">有 {expiring.length} 個批次將在 3 日內到期，請與站點協調促銷或回收。</Notice>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="即將到期批次" actions={<Link href="/supplier/batches" className="btn btn-sm">批次管理</Link>}>
          {expiring.length === 0 ? <Empty>沒有即將到期的批次。</Empty> : (
            <Table head={['批號', '商品', '到期日', '可用']}>
              {expiring.map((batch) => (
                <tr key={batch.id}>
                  <td className="mono">{batch.lot_no}</td>
                  <td>{batch.product_name}</td>
                  <td>{formatDate(batch.expires_on)}</td>
                  <td className="num">{batch.quantity_available - batch.quantity_reserved}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="待處理異常" actions={<Link href="/supplier/exceptions" className="btn btn-sm">異常處理</Link>}>
          {exceptions.filter((item) => item.status === 'open').length === 0 ? <Empty>沒有待回覆的異常。</Empty> : (
            <Table head={['類型', '批號', '說明', '時間']}>
              {exceptions.filter((item) => item.status === 'open').map((item) => (
                <tr key={item.id}>
                  <td>{item.type}</td>
                  <td className="mono tiny">{item.lot_no ?? '—'}</td>
                  <td className="muted small">{item.description}</td>
                  <td className="muted small">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
