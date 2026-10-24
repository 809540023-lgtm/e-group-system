import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { formatTwd } from '../../../lib/format.ts';
import {
  getWeeklyContribution,
  listGates,
  listStationSustainability,
  listStopConditions,
} from '../../../lib/gates.ts';
import { requireRole } from '../../../lib/auth.ts';

const GATE_TONE: Readonly<Record<string, string>> = { pass: 'ok', fail: 'danger', unknown: 'muted' };
const GATE_LABEL: Readonly<Record<string, string>> = { pass: '通過', fail: '未通過', unknown: '資料不足' };

export default async function GatesPage() {
  await requireRole(['admin']);

  const [gates, stops, weeks, stations] = await Promise.all([
    listGates(),
    listStopConditions(),
    getWeeklyContribution(),
    listStationSustainability(),
  ]);

  const passed = gates.filter((gate) => gate.status === 'pass').length;
  const triggered = stops.filter((stop) => stop.triggered).length;
  const canExpand = passed === gates.length && triggered === 0;

  return (
    <>
      <PageHeader
        title="擴點關卡與停止條件"
        subtitle="計畫書第十七章。關卡決定能不能開下一站，停止條件決定要不要縮減；兩者方向相反，必須分開判讀。"
      />

      <div className="grid grid-4">
        <Stat label="擴點關卡" value={`${passed} / ${gates.length}`} hint="全部通過才可擴點" />
        <Stat label="已觸發停止條件" value={triggered} hint={triggered === 0 ? '目前無觸發' : '須立即處理'} />
        <Stat label="近 8 週單筆貢獻" value={formatTwd(weeks.at(-1)?.contribution_per_order_twd ?? 0)} hint="最新一週" />
        <Stat label="可持續站點" value={`${stations.filter((row) => row.net_twd > 0).length} / ${stations.length}`} hint="近 30 天淨額為正" />
      </div>

      <div style={{ marginTop: 16 }}>
        {canExpand ? (
          <Notice tone="ok">五項擴點關卡全部通過，且無停止條件觸發。仍須確認新站資金與配送能力後才投入下一批站點。</Notice>
        ) : triggered > 0 ? (
          <Notice tone="danger">
            有 {triggered} 項停止條件已觸發。依計畫書處理順序：保護顧客、隔離資產與商品、履行退款，再檢討復業條件。
          </Notice>
        ) : (
          <Notice tone="warn">尚有 {gates.length - passed} 項擴點關卡未通過，不得新增站點。</Notice>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>擴點關卡</h2>
          <div className="muted small">連續 8 週單筆貢獻為正、加盟站可持續、資金到位、配送能力、無未結重大食安事件。</div>
          <div className="divider" />
          <Table head={['關卡', '狀態', '判讀', '證據']}>
            {gates.map((gate) => (
              <tr key={gate.key}>
                <td>{gate.label}</td>
                <td><Badge tone={GATE_TONE[gate.status] ?? 'info'}>{GATE_LABEL[gate.status] ?? gate.status}</Badge></td>
                <td>{gate.detail}</td>
                <td className="muted small">{gate.evidence}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>停止或縮減條件</h2>
          <div className="muted small">任一條件觸發即應停止擴點並啟動處理程序，不以其他指標良好為由延後。</div>
          <div className="divider" />
          <Table head={['條件', '狀態', '判讀', '處理']}>
            {stops.map((stop) => (
              <tr key={stop.key}>
                <td>{stop.label}</td>
                <td><Badge tone={stop.triggered ? 'danger' : 'ok'}>{stop.triggered ? '已觸發' : '未觸發'}</Badge></td>
                <td>{stop.detail}</td>
                <td className="muted small">{stop.action}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card>
          <h2>近 8 週單筆貢獻</h2>
          <div className="muted small">交付訂單營收扣除商品成本、退款、推薦獎勵與報廢後，除以交付筆數。</div>
          <div className="divider" />
          <Table head={['週起日', '交付筆數', '貢獻', '單筆']}>
            {weeks.map((week) => (
              <tr key={week.week_start}>
                <td>{week.week_start}</td>
                <td>{week.orders}</td>
                <td>{formatTwd(week.contribution_twd)}</td>
                <td>
                  <Badge tone={week.orders === 0 ? 'muted' : week.contribution_per_order_twd > 0 ? 'ok' : 'danger'}>
                    {formatTwd(week.contribution_per_order_twd)}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <h2>站點可持續性（近 30 天）</h2>
          <div className="muted small">貢獻金額扣除站點每月固定增量成本（工時、租金、電費、維護）。</div>
          <div className="divider" />
          <Table head={['站點', '型', '交付', '貢獻', '固定成本', '淨額']}>
            {stations.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.type}</td>
                <td>{row.delivered_orders}</td>
                <td>{formatTwd(row.monthly_contribution_twd)}</td>
                <td>{formatTwd(row.monthly_fixed_cost_twd)}</td>
                <td>
                  <Badge tone={row.net_twd > 0 ? 'ok' : 'danger'}>{formatTwd(row.net_twd)}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
