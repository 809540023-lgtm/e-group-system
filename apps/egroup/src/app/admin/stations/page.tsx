import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { createStationAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { STATION_TYPE_LABELS } from '../../../lib/format.ts';
import { listStations } from '../../../lib/queries.ts';
import { scoreStation } from '@eg/meal';

export default async function AdminStationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const stations = await listStations();
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="站點治理"
        subtitle="100 分選址模型：需求 30、成本 20、冷鏈 20、補貨 15、競爭 15；食安或場地不合格即淘汰。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="站點清單">
        <Table head={['代碼', '名稱', '類型', '捷運', '步行', '容量', '評分', '狀態']}>
          {stations.map((station) => {
            const score = scoreStation({
              id: station.id,
              name: station.name,
              type: station.type,
              demandScore: station.demand_score,
              costScore: station.cost_score,
              coldChainScore: station.cold_chain_score,
              replenishmentScore: station.replenishment_score,
              competitionScore: station.competition_score,
              foodSafetyPass: station.food_safety_pass,
              venuePass: station.venue_pass,
            });
            return (
              <tr key={station.id}>
                <td className="mono">{station.code}</td>
                <td>{station.name}<div className="muted tiny">{station.address}</div></td>
                <td>{STATION_TYPE_LABELS[station.type] ?? station.type}</td>
                <td className="muted small">{station.mrt_line ?? '—'} {station.mrt_station ?? ''}</td>
                <td className="num">{station.walk_minutes ?? '—'}</td>
                <td className="num">{station.capacity}</td>
                <td className="num"><Badge tone={score.eligible ? (score.grade === 'A' ? 'ok' : 'warn') : 'danger'}>{score.total}</Badge></td>
                <td><Badge tone={station.status === 'active' ? 'ok' : 'muted'}>{station.status}</Badge></td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="新增站點">
        <form action={createStationAction} className="form">
          <input type="hidden" name="redirectTo" value="/admin/stations" />
          <div className="grid grid-3">
            <Field label="代碼"><input name="code" required placeholder="TPE-A01" /></Field>
            <Field label="名稱"><input name="name" required /></Field>
            <Field label="類型">
              <select name="type" defaultValue="A">
                <option value="A">A 型 · 轉運樞紐</option>
                <option value="B">B 型 · 社區取貨</option>
                <option value="C">C 型 · 辦公商圈</option>
                <option value="D">D 型 · 衛星微型</option>
              </select>
            </Field>
          </div>
          <Field label="地址"><input name="address" required /></Field>
          <div className="grid grid-4">
            <Field label="捷運線"><input name="line" placeholder="板南線" /></Field>
            <Field label="捷運站"><input name="mrt" placeholder="市政府" /></Field>
            <Field label="步行分鐘"><input name="walk" type="number" min="0" defaultValue={5} /></Field>
            <Field label="生活圈"><input name="corridor" placeholder="信義" /></Field>
          </div>
          <div className="grid grid-3">
            <Field label="容量"><input name="capacity" type="number" min="0" defaultValue={100} /></Field>
            <Field label="營業時間"><input name="hours" placeholder="07:00-21:00" /></Field>
            <Field label="聯絡方式"><input name="contact" placeholder="02-1234-5678" /></Field>
          </div>
          <div className="grid grid-4">
            <Field label="需求 (30)"><input name="demand" type="number" min="0" max="30" defaultValue={20} /></Field>
            <Field label="成本 (20)"><input name="cost" type="number" min="0" max="20" defaultValue={12} /></Field>
            <Field label="冷鏈 (20)"><input name="cold" type="number" min="0" max="20" defaultValue={15} /></Field>
            <Field label="補貨 (15)"><input name="replenishment" type="number" min="0" max="15" defaultValue={10} /></Field>
          </div>
          <Field label="競爭 (15)"><input name="competition" type="number" min="0" max="15" defaultValue={10} /></Field>
          <button type="submit" className="btn btn-primary">建立站點</button>
        </form>
      </Card>
    </>
  );
}
