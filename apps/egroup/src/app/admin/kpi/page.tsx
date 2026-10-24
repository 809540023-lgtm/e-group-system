import { Badge, Card, Empty, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { requireRole } from '../../../lib/auth.ts';
import { formatNumber, formatTwd } from '../../../lib/format.ts';
import { listKpis, listStationEconomics } from '../../../lib/kpi.ts';

export default async function AdminKpiPage() {
  await requireRole(['admin']);

  const [kpis, economics] = await Promise.all([listKpis(), listStationEconomics()]);
  const passed = kpis.filter((kpi) => kpi.passed).length;
  const totalContribution = economics.reduce((sum, row) => sum + row.contribution_twd, 0);

  return (
    <>
      <PageHeader
        title="績效指標"
        subtitle="計畫書第十七章的驗收指標與第十三章的單站損益。未達標不得以隱匿溫度超標或調整分母達成。"
      />

      <div className="grid grid-3">
        <Stat label="達標指標" value={`${passed} / ${kpis.length}`} hint="依計畫書門檻判定" />
        <Stat label="全站貢獻" value={formatTwd(totalContribution)} hint="營收 − 成本 − 退款 − 推薦 − 報廢" />
        <Stat label="營運站點" value={economics.length} hint="含未出單站點" />
      </div>

      <Card title="驗收指標">
        <Table head={['指標', '現值', '門檻', '判定', '說明']}>
          {kpis.map((kpi) => (
            <tr key={kpi.key}>
              <td>{kpi.label}</td>
              <td className="mono">{kpi.unit === 'percent' ? `${formatNumber(kpi.value, 2)}%` : formatNumber(kpi.value)}</td>
              <td className="muted small">
                {kpi.comparator === 'gte' ? '≥' : '<'} {kpi.unit === 'percent' ? `${kpi.target}%` : formatNumber(kpi.target)}
              </td>
              <td>
                <Badge tone={kpi.passed ? 'ok' : 'danger'}>{kpi.passed ? '達標' : '未達標'}</Badge>
              </td>
              <td className="muted small">{kpi.detail}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="單站損益">
        {economics.length === 0 ? <Empty>尚無站點資料。</Empty> : (
          <Table head={['站點', '型態', '已交付', '客單', '營收', '商品成本', '毛利', '退款', '推薦', '報廢', '貢獻', '每單貢獻']}>
            {economics.map((row) => (
              <tr key={row.station_id}>
                <td>{row.name}<div className="muted tiny mono">{row.code}</div></td>
                <td><Badge tone="info">{row.type}</Badge></td>
                <td className="mono">{formatNumber(row.delivered_orders)}</td>
                <td className="mono">{formatTwd(row.avg_ticket_twd)}</td>
                <td className="mono">{formatTwd(row.revenue_twd)}</td>
                <td className="mono muted">{formatTwd(row.cogs_twd)}</td>
                <td className="mono">{formatTwd(row.gross_margin_twd)}</td>
                <td className="mono muted">{formatTwd(row.refund_twd)}</td>
                <td className="mono muted">{formatTwd(row.referral_twd)}</td>
                <td className="mono muted">{formatTwd(row.scrap_twd)}</td>
                <td className="mono"><strong>{formatTwd(row.contribution_twd)}</strong></td>
                <td className="mono">{formatTwd(row.contribution_per_order_twd)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="判讀原則">
        <ul className="list">
          <li>準時備妥以訂單承諾時間為準；承諾時間依站型給定前置時間（C 型 2 小時、A 型 4 小時、B 型 6 小時、D 型 8 小時）。</li>
          <li>帳物差異率比對庫存異動帳與批次保留量，不是比對盤點結果；盤點差異另走調整並留稽核。</li>
          <li>報廢以成本計價，不以售價計價，避免高價商品稀釋報廢率。</li>
          <li>貢獻未扣站點工時與冷鏈運費；這兩項須由加盟契約與物流帳單另行帶入。</li>
          <li>擴點關卡要求連續 8 週單筆貢獻為正，單週達標不得作為擴點依據。</li>
        </ul>
      </Card>
    </>
  );
}
