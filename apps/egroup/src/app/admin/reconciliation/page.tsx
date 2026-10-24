import { Badge, Card, Field, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { settleStationAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDate, formatTwd } from '../../../lib/format.ts';
import { listStations } from '../../../lib/queries.ts';
import { listSettlements } from '../../../lib/ops.ts';

export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const [settlements, stations] = await Promise.all([listSettlements(), listStations()]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const net = settlements.reduce((sum, item) => sum + item.net_twd, 0);
  const delivered = settlements.reduce((sum, item) => sum + item.delivered_count, 0);

  return (
    <>
      <PageHeader
        title="對帳結算"
        subtitle="每期每站點一筆結算；同一訂單不得重複納入結算，確保付款、交付與會計一致。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-3">
        <Stat label="結算淨額" value={formatTwd(net)} hint="服務費 + 獎金 - 扣款" />
        <Stat label="納入訂單" value={delivered} hint="完成取貨" />
        <Stat label="結算筆數" value={settlements.length} hint="站點 × 期間" />
      </div>

      <Card title="結算紀錄" className="card">
        {settlements.length === 0 ? <p className="muted small">尚無結算紀錄。</p> : (
          <Table head={['站點', '期間', '完成筆數', '服務費', '獎金', '扣款', '淨額', '狀態']}>
            {settlements.map((item) => (
              <tr key={item.id}>
                <td>{item.station_code} · {item.station_name}</td>
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

      <Card title="建立結算">
        <form action={settleStationAction} className="form">
          <input type="hidden" name="redirectTo" value="/admin/reconciliation" />
          <div className="grid grid-3">
            <Field label="站點">
              <select name="stationId" required>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>{station.code} · {station.name}</option>
                ))}
              </select>
            </Field>
            <Field label="期間起"><input name="start" type="date" required /></Field>
            <Field label="期間迄"><input name="end" type="date" required /></Field>
          </div>
          <div className="grid grid-4">
            <Field label="每筆服務費"><input name="fee" type="number" min="0" defaultValue={30} required /></Field>
            <Field label="品質獎金"><input name="bonus" type="number" min="0" defaultValue={0} /></Field>
            <Field label="扣款"><input name="deduction" type="number" min="0" defaultValue={0} /></Field>
            <Field label="扣款原因"><input name="deductionReason" placeholder="溫控缺失" /></Field>
          </div>
          <button type="submit" className="btn btn-primary">建立結算</button>
        </form>
      </Card>
    </>
  );
}
