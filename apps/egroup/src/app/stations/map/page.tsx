import Link from 'next/link';
import { Badge, Card, Notice, PageHeader, Stat } from '../../../components/ui.tsx';
import { STATION_TYPE_LABELS } from '../../../lib/format.ts';
import { createProjector } from '../../../lib/geo.ts';
import { listStations } from '../../../lib/queries.ts';

const TYPE_COLORS: Readonly<Record<string, string>> = {
  A: '#2563eb',
  B: '#0d9488',
  C: '#d97706',
  D: '#7c3aed',
};

export default async function StationMapPage() {
  const stations = await listStations();
  const located = stations
    .map((station) => ({
      station,
      lat: station.lat === null ? null : Number(station.lat),
      lng: station.lng === null ? null : Number(station.lng),
    }))
    .filter(
      (item): item is { station: (typeof stations)[number]; lat: number; lng: number } =>
        item.lat !== null && item.lng !== null && Number.isFinite(item.lat) && Number.isFinite(item.lng),
    );

  const missing = stations.length - located.length;
  const projector = createProjector(located.map((item) => ({ lat: item.lat, lng: item.lng })));
  const points = located.map((item) => ({ ...item, ...projector.project({ lat: item.lat, lng: item.lng }) }));

  const corridors = [
    ...new Set(
      stations.map((station) => station.corridor).filter((value): value is string => Boolean(value)),
    ),
  ];

  return (
    <>
      <PageHeader
        title="站點地圖"
        subtitle="以站點座標呈現取貨網路分布。地圖由系統自行繪製，不載入外部圖磚，避免位置資料外流。"
      />

      <div className="grid grid-4">
        <Stat label="已定位站點" value={located.length} hint={`共 ${stations.length} 站`} />
        <Stat label="營運中" value={stations.filter((station) => station.status === 'active').length} />
        <Stat label="走廊" value={corridors.length} hint={corridors.join('、') || '—'} />
        <Stat label="待補座標" value={missing} hint={missing > 0 ? '請於後台補齊經緯度' : '全部完成'} />
      </div>

      {missing > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Notice tone="warn">有 {missing} 個站點尚未填寫經緯度，不會出現在地圖上。</Notice>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Card>
          <div className="spread">
            <h2>雙北試點網路</h2>
            <Link className="btn btn-ghost" href="/stations">回站點列表</Link>
          </div>
          <div className="divider" />

          {points.length === 0 ? (
            <Notice>目前沒有可定位的站點。</Notice>
          ) : (
            <svg
              viewBox={`0 0 ${projector.width} ${projector.height}`}
              width="100%"
              role="img"
              aria-label="取貨站點分布圖"
              style={{ display: 'block', background: '#f8fafc', borderRadius: 12 }}
            >
              <defs>
                <pattern id="eg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={projector.width} height={projector.height} fill="url(#eg-grid)" />

              {points.map((point) => (
                <g key={point.station.id}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={26}
                    fill={TYPE_COLORS[point.station.type] ?? '#475569'}
                    opacity={0.12}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={9}
                    fill={TYPE_COLORS[point.station.type] ?? '#475569'}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <text x={point.x} y={point.y - 20} textAnchor="middle" fontSize={13} fontWeight={600} fill="#0f172a">
                    {point.station.name}
                  </text>
                  <text x={point.x} y={point.y + 30} textAnchor="middle" fontSize={11} fill="#475569">
                    {point.station.code} · {point.station.type} 型
                  </text>
                </g>
              ))}
            </svg>
          )}

          <div className="divider" />
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            {(['A', 'B', 'C', 'D'] as const).map((type) => (
              <span key={type} className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: TYPE_COLORS[type],
                    display: 'inline-block',
                  }}
                />
                <span className="small">{STATION_TYPE_LABELS[type]}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        {points.map((point) => (
          <Card key={point.station.id}>
            <div className="spread">
              <div>
                <h2>{point.station.name}</h2>
                <div className="muted small">{point.station.code} · {STATION_TYPE_LABELS[point.station.type]}</div>
              </div>
              <Badge tone={point.station.status === 'active' ? 'ok' : 'info'}>{point.station.status}</Badge>
            </div>
            <div className="divider" />
            <div className="stack">
              <div className="spread"><span className="muted small">地址</span><span style={{ textAlign: 'right', maxWidth: '65%' }}>{point.station.address}</span></div>
              <div className="spread"><span className="muted small">捷運</span><span>{point.station.mrt_line} {point.station.mrt_station} · 步行 {point.station.walk_minutes} 分</span></div>
              <div className="spread"><span className="muted small">座標</span><span>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span></div>
              <div className="spread"><span className="muted small">走廊</span><span>{point.station.corridor ?? '—'}</span></div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
