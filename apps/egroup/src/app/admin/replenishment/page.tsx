import { Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { requireRole } from '../../../lib/auth.ts';
import { STORAGE_LABELS } from '../../../lib/format.ts';
import { listReplenishment } from '../../../lib/ops.ts';

export default async function AdminReplenishmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const rows = await listReplenishment();
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const need = rows.filter((row) => Number(row.suggested) > 0);
  const totalSuggested = need.reduce((sum, row) => sum + Number(row.suggested), 0);

  return (
    <>
      <PageHeader
        title="補貨預測"
        subtitle="以近 7 日銷量推估 3 日安全庫存，扣除現有可用量後得出建議補貨量。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-3">
        <Stat label="需補貨品項" value={need.length} hint={`共 ${rows.length} 項上架商品`} />
        <Stat label="建議補貨總量" value={totalSuggested} hint="3 日安全庫存" />
        <Stat label="零庫存品項" value={rows.filter((row) => Number(row.available) === 0).length} hint="立即處理" />
      </div>

      <Card title="建議補貨" className="card">
        <Table head={['SKU', '商品', '保存', '效期', '可用', '7 日銷量', '28 日銷量', '建議補貨']}>
          {rows.map((row) => (
            <tr key={row.sku}>
              <td className="mono">{row.sku}</td>
              <td>{row.name}</td>
              <td>{STORAGE_LABELS[row.storage] ?? row.storage}</td>
              <td className="num">{row.shelf_life_days} 日</td>
              <td className="num">{row.available}</td>
              <td className="num">{row.sold_7d}</td>
              <td className="num">{row.sold_28d}</td>
              <td className="num">{Number(row.suggested) > 0 ? row.suggested : '—'}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
