import { redirect } from 'next/navigation';
import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { requireRole } from '../../../lib/auth.ts';
import { formatDate, formatTwd } from '../../../lib/format.ts';
import { listStationSettlements } from '../../../lib/ops.ts';

export default async function StationSettlementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const settlements = await listStationSettlements(session.stationId);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const net = settlements.reduce((sum, item) => sum + item.net_twd, 0);
  const delivered = settlements.reduce((sum, item) => sum + item.delivered_count, 0);

  return (
    <>
      <PageHeader
        title="服務結算"
        subtitle="依完成取貨筆數計算服務費，加上品質獎金並扣除缺失扣款；同一訂單不得重複結算。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-3">
        <Stat label="累計淨額" value={formatTwd(net)} hint="服務費 + 獎金 - 扣款" />
        <Stat label="結算筆數" value={settlements.length} hint="每期一筆" />
        <Stat label="完成取貨" value={delivered} hint="已納入結算" />
      </div>

      <Card title="結算明細" className="card">
        {settlements.length === 0 ? <p className="muted small">尚無結算紀錄。</p> : (
          <Table head={['期間', '完成筆數', '服務費', '品質獎金', '扣款', '淨額', '狀態']}>
            {settlements.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.period_start)} – {formatDate(item.period_end)}</td>
                <td className="num">{item.delivered_count}</td>
                <td className="num">{formatTwd(item.service_fee_twd)}</td>
                <td className="num">{formatTwd(item.quality_bonus_twd)}</td>
                <td className="num">{formatTwd(item.deductions_twd)}</td>
                <td className="num">{formatTwd(item.net_twd)}</td>
                <td><Badge tone={item.status === 'paid' ? 'ok' : item.status === 'approved' ? 'info' : 'muted'}>{item.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
