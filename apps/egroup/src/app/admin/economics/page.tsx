import { hqBreakEven, sensitivity, stationBreakEven, twoSidedVerdict, unitEconomics } from '@eg/meal';
import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { requireRole } from '../../../lib/auth.ts';
import { getActualUnitEconomics, listStationBreakEven } from '../../../lib/economics.ts';
import { formatTwd } from '../../../lib/format.ts';

/** 計畫書第十三章的示範單筆模型（未稅管理口徑）。 */
const DEMO_MODEL = {
  revenueTwd: 200,
  productCostTwd: 100,
  coldChainTwd: 12,
  packagingTwd: 5,
  stationServiceTwd: 20,
  paymentTwd: 4,
  wasteReserveTwd: 6,
  referralTwd: 8,
} as const;

/** 計畫書第十三章的規劃假設：總部月固定費用 300,000 元。 */
const HQ_FIXED_MONTHLY_TWD = 300_000;
const SENSITIVITY_CONTRIBUTIONS = [30, 45, 60] as const;

export default async function EconomicsPage() {
  await requireRole(['admin']);

  const [actual, stations] = await Promise.all([getActualUnitEconomics(30), listStationBreakEven()]);

  const demo = unitEconomics(DEMO_MODEL);
  const demoHq = hqBreakEven(HQ_FIXED_MONTHLY_TWD, demo.contributionTwd);
  const actualHq = hqBreakEven(HQ_FIXED_MONTHLY_TWD, actual.avg_contribution_twd);
  const rows = sensitivity(HQ_FIXED_MONTHLY_TWD, [...SENSITIVITY_CONTRIBUTIONS]);

  const demoStation = stationBreakEven(30_000, DEMO_MODEL.stationServiceTwd);
  const verdict = twoSidedVerdict(demoStation, demoHq);

  const costLines = [
    { label: '商品成本', value: DEMO_MODEL.productCostTwd },
    { label: '冷鏈配送', value: DEMO_MODEL.coldChainTwd },
    { label: '包材', value: DEMO_MODEL.packagingTwd },
    { label: '站點服務', value: DEMO_MODEL.stationServiceTwd },
    { label: '金流', value: DEMO_MODEL.paymentTwd },
    { label: '耗損退款準備', value: DEMO_MODEL.wasteReserveTwd },
    { label: '推薦行銷', value: DEMO_MODEL.referralTwd },
  ];

  return (
    <>
      <PageHeader
        title="單位經濟與損益兩平"
        subtitle="計畫書第十三章。示範模型是規劃假設，實際數字來自近 30 天交付訂單；兩者並列，不把假設當成結果。"
      />

      <div className="grid grid-4">
        <Stat label="示範單筆貢獻" value={formatTwd(demo.contributionTwd)} hint={`毛利率 ${Math.round(demo.marginRate * 100)}%`} />
        <Stat label="實際單筆貢獻" value={formatTwd(actual.avg_contribution_twd)} hint={`近 30 天 ${actual.delivered_orders} 筆交付`} />
        <Stat label="總部兩平筆數" value={demoHq.ordersPerMonth.toLocaleString('zh-TW')} hint={`每日 ${demoHq.ordersPerDay} 筆（示範模型）`} />
        <Stat label="站點兩平筆數" value={demoStation.ordersPerMonth.toLocaleString('zh-TW')} hint={`每日 ${demoStation.ordersPerDay} 筆（月固定 30,000）`} />
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone={verdict.bothFeasible ? 'ok' : 'warn'}>{verdict.note}</Notice>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card>
          <h2>示範單筆模型</h2>
          <div className="muted small">未稅管理口徑。未含總部固定薪資、租金、系統、折舊、稅費及資金成本。</div>
          <div className="divider" />
          <Table head={['項目', '金額']}>
            <tr>
              <td>顧客商品收入</td>
              <td className="num">{formatTwd(DEMO_MODEL.revenueTwd)}</td>
            </tr>
            {costLines.map((line) => (
              <tr key={line.label}>
                <td className="muted">{line.label}</td>
                <td className="num">−{formatTwd(line.value)}</td>
              </tr>
            ))}
            <tr>
              <td><b>單筆貢獻</b></td>
              <td className="num"><b>{formatTwd(demo.contributionTwd)}</b></td>
            </tr>
          </Table>
        </Card>

        <Card>
          <h2>實際單筆結構（近 30 天）</h2>
          <div className="muted small">以真實交付訂單計算，含退款、推薦獎勵與報廢分攤。</div>
          <div className="divider" />
          <Table head={['項目', '每筆平均']}>
            <tr><td>客單金額</td><td className="num">{formatTwd(actual.avg_ticket_twd)}</td></tr>
            <tr><td className="muted">商品成本</td><td className="num">−{formatTwd(actual.avg_product_cost_twd)}</td></tr>
            <tr><td className="muted">退款</td><td className="num">−{formatTwd(actual.avg_refund_twd)}</td></tr>
            <tr><td className="muted">推薦獎勵</td><td className="num">−{formatTwd(actual.avg_referral_twd)}</td></tr>
            <tr><td className="muted">報廢分攤</td><td className="num">−{formatTwd(actual.avg_scrap_twd)}</td></tr>
            <tr>
              <td><b>單筆貢獻</b></td>
              <td className="num">
                <Badge tone={actual.avg_contribution_twd > 0 ? 'ok' : 'danger'}>
                  {formatTwd(actual.avg_contribution_twd)}
                </Badge>
              </td>
            </tr>
          </Table>
          <div className="divider" />
          <div className="muted small">
            總部月固定費用 {formatTwd(HQ_FIXED_MONTHLY_TWD)} 下，以實際單筆貢獻需{' '}
            {actualHq.feasible ? `${actualHq.ordersPerMonth.toLocaleString('zh-TW')} 筆／月（每日 ${actualHq.ordersPerDay} 筆）` : '無法兩平（單筆貢獻為零或負）'}。
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>敏感度試算</h2>
          <div className="muted small">
            總部月固定費用 {formatTwd(HQ_FIXED_MONTHLY_TWD)}，不同單筆貢獻下的兩平筆數。這是敏感度試算，不是營收預測。
          </div>
          <div className="divider" />
          <Table head={['單筆貢獻', '每月兩平筆數', '每日筆數（30 天）', '10 站平均每日']}>
            {rows.map((row) => (
              <tr key={row.contributionTwd}>
                <td>{formatTwd(row.contributionTwd)}</td>
                <td className="num">{row.ordersPerMonth.toLocaleString('zh-TW')}</td>
                <td className="num">{row.ordersPerDay}</td>
                <td className="num">{(row.ordersPerDay / 10).toFixed(1)}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="muted small">
            10 站平均每日筆數只代表可覆蓋總部固定費用，不代表各加盟站均已獲利；兩端必須分別驗證。
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>各站損益兩平</h2>
          <div className="muted small">月固定成本除以每筆站點服務收入，對照近 30 天實際日均。</div>
          <div className="divider" />
          <Table head={['站點', '型', '月固定成本', '每筆服務費', '需每月', '需每日', '實際每日', '狀態']}>
            {stations.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.type}</td>
                <td className="num">{formatTwd(row.monthly_fixed_cost_twd)}</td>
                <td className="num">{formatTwd(row.station_fee_twd)}</td>
                <td className="num">{row.orders_per_month === null ? '—' : row.orders_per_month.toLocaleString('zh-TW')}</td>
                <td className="num">{row.orders_per_day === null ? '—' : row.orders_per_day}</td>
                <td className="num">{row.actual_orders_per_day}</td>
                <td>
                  <Badge tone={row.reached ? 'ok' : 'warn'}>{row.reached ? '已達兩平' : '未達兩平'}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
