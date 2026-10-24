import { scoreStation, sameCorridor } from '@eg/meal';
import { Badge, Card, Notice, PageHeader, Stat } from '../../components/ui.tsx';
import { STATION_TYPE_LABELS } from '../../lib/format.ts';
import { listStations } from '../../lib/queries.ts';

export default async function StationsPage() {
  const stations = await listStations();
  const scored = stations.map((station) => ({
    station,
    score: scoreStation({
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
    }),
  }));
  const corridorOk = sameCorridor(stations.map((station) => ({ corridor: station.corridor ?? '' })));

  return (
    <>
      <PageHeader
        title="取貨站點"
        subtitle="A 型店中取貨、B 型自助冷鏈櫃、C 型加熱組餐、D 型區域補給。選址以食安與場地為門檻，再比較 100 分模型。"
      />

      <div className="grid grid-4">
        <Stat label="營運站點" value={stations.filter((station) => station.status === 'active').length} />
        <Stat label="試點走廊" value={corridorOk ? '同一走廊' : '跨走廊'} hint="避免位置差異被誤認為站型效果" />
        <Stat label="平均總分" value={Math.round(scored.reduce((sum, item) => sum + item.score.total, 0) / Math.max(1, scored.length))} hint="滿分 100" />
        <Stat label="不合格站點" value={scored.filter((item) => !item.score.eligible).length} hint="食安或場地未通過" />
      </div>

      {!corridorOk ? (
        <div style={{ marginTop: 16 }}>
          <Notice tone="warn">目前站點不在同一配送走廊，試點比較時應避免把位置差異誤認為站型效果。</Notice>
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        {scored.map(({ station, score }) => (
          <Card key={station.id}>
            <div className="spread">
              <div>
                <h2>{station.name}</h2>
                <div className="muted small">{station.code} · {STATION_TYPE_LABELS[station.type]}</div>
              </div>
              <Badge tone={score.eligible ? (score.grade === 'A' ? 'ok' : 'info') : 'danger'}>
                {score.eligible ? `${score.grade} 級 · ${score.total} 分` : '不合格'}
              </Badge>
            </div>

            <div className="divider" />
            <div className="stack">
              <div className="spread"><span className="muted small">地址</span><span style={{ textAlign: 'right', maxWidth: '65%' }}>{station.address}</span></div>
              <div className="spread"><span className="muted small">捷運</span><span>{station.mrt_line} {station.mrt_station} · 步行 {station.walk_minutes} 分</span></div>
              <div className="spread"><span className="muted small">營業時間</span><span>{station.opening_hours ?? '—'}</span></div>
              <div className="spread"><span className="muted small">聯絡</span><span>{station.contact ?? '—'}</span></div>
              <div className="spread"><span className="muted small">容量</span><span>{station.capacity} 份</span></div>
            </div>

            <div className="divider" />
            <div className="grid grid-3">
              <div className="nutrition-cell"><b>{score.breakdown.demand}/30</b><span>需求與預訂</span></div>
              <div className="nutrition-cell"><b>{score.breakdown.cost}/20</b><span>成本</span></div>
              <div className="nutrition-cell"><b>{score.breakdown.coldChain}/20</b><span>冷鏈與場地</span></div>
              <div className="nutrition-cell"><b>{score.breakdown.replenishment}/15</b><span>補貨效率</span></div>
              <div className="nutrition-cell"><b>{score.breakdown.competition}/15</b><span>競爭與合作</span></div>
              <div className="nutrition-cell"><b>{score.eligible ? '通過' : '阻擋'}</b><span>食安／場地</span></div>
            </div>

            {score.blockers.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <Notice tone="danger">{score.blockers.join('；')}</Notice>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
