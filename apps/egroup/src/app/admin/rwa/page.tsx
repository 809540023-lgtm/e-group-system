import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { formatTwd } from '../../../lib/format.ts';
import {
  evaluatePassport,
  getRwaSummary,
  listAssetPassports,
  listRwaDistributions,
  listRwaStress,
  listRwaVehicles,
  previewDistribution,
  previewStress,
} from '../../../lib/capital.ts';
import { requireRole } from '../../../lib/auth.ts';

const KIND_LABEL: Readonly<Record<string, string>> = {
  equipment: '冷鏈設備',
  receivable: '應收帳款',
  inventory: '食品庫存',
};

const VEHICLE_STATUS_LABEL: Readonly<Record<string, string>> = {
  draft: '草稿',
  structuring: '結構設計',
  legal_review: '法律審閱',
  approved: '已核准',
  issuing: '發行中',
  live: '存續中',
  suspended: '暫停',
  closed: '已結束',
};

const VEHICLE_STATUS_TONE: Readonly<Record<string, string>> = {
  draft: 'muted',
  structuring: 'info',
  legal_review: 'warn',
  approved: 'ok',
  issuing: 'ok',
  live: 'ok',
  suspended: 'danger',
  closed: 'muted',
};

const SCENARIO_LABEL: Readonly<Record<string, string>> = {
  station_closure: '站點歇業',
  lessee_default: '承租人欠款',
  equipment_damage: '設備損壞',
  double_financing: '資產重複融資',
  insurance_denial: '保險拒賠',
  residual_shortfall: '殘值不足',
};

export default async function RwaPage() {
  await requireRole(['admin']);

  const asOf = new Date().toISOString().slice(0, 10);
  const [summary, passports, vehicles, distributions, stress] = await Promise.all([
    getRwaSummary(),
    listAssetPassports(),
    listRwaVehicles(),
    listRwaDistributions(),
    listRwaStress(),
  ]);

  const evaluated = passports.map((row) => ({ row, result: evaluatePassport(row, asOf) }));
  const blocked = evaluated.filter((item) => !item.result.eligible);
  const atRisk = stress.filter((row) => row.principal_at_risk);

  const demoVehicle = vehicles[0];
  const demoDistribution = demoVehicle
    ? previewDistribution(
        12_000,
        480_000,
        600,
        Number(demoVehicle.maintenance_reserve_pct),
        demoVehicle.senior_debt_twd,
        demoVehicle.total_units,
      )
    : null;

  const demoStress = previewStress({
    appraisedValueTwd: 68_000,
    existingLienTwd: 0,
    monthlyRentTwd: 2_833,
    insuranceCoverageTwd: 68_000,
    residualValueTwd: 20_400,
    outstandingPrincipalTwd: 68_000,
  });

  return (
    <>
      <PageHeader
        title="RWA 資產代幣化"
        subtitle="計畫書第十章。第一階段只做可辨識的冷鏈設備與真實設備租約；食品庫存不得作為第一階段公開投資標的。"
      />

      <div className="grid grid-4">
        <Stat label="資產護照" value={`${summary.eligible} / ${summary.passports}`} hint="通過資格檢查" />
        <Stat label="RWA 載體" value={summary.vehicles} hint={`${summary.liveVehicles} 個已核准或存續`} />
        <Stat label="已配置資產" value={formatTwd(summary.allocatedTwd)} hint="載體內資產帳面合計" />
        <Stat label="本金受損情境" value={summary.scenariosAtRisk} hint="壓力測試中本金有缺口" />
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">
          資產數位化不等於公開募集。RWA 名稱本身不帶來任何監理豁免；權利人必須依法律文件行使權利，不能只憑鏈上標籤。
        </Notice>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>資產護照</h2>
          <div className="muted small">
            九項欄位：序號、發票、所有人、所在地、維修、保險、估值、既有擔保、租約。任一阻擋項未通過即不得進入載體。
          </div>
          <div className="divider" />
          <Table head={['資產編號', '類型', '位置', '帳面估值', '既有擔保', '評分', '資格', '阻擋項']}>
            {evaluated.map(({ row, result }) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.asset_no}</strong>
                  <div className="muted small">{row.serial_no ?? '—'}</div>
                </td>
                <td>{KIND_LABEL[row.kind] ?? row.kind}</td>
                <td>{row.station_name ?? '—'}</td>
                <td>{row.appraised_value_twd === null ? '未估值' : formatTwd(row.appraised_value_twd)}</td>
                <td>{row.existing_lien_twd > 0 ? formatTwd(row.existing_lien_twd) : '無'}</td>
                <td>{result.score}</td>
                <td>
                  <Badge tone={result.eligible ? 'ok' : 'danger'}>{result.eligible ? '合格' : '不合格'}</Badge>
                </td>
                <td className="small">
                  {result.blockers.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    result.blockers.map((item) => <div key={item}>{item}</div>)
                  )}
                  {result.warnings.map((item) => (
                    <div key={item} className="muted">
                      {item}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </Table>
          {blocked.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <Notice tone="danger">
                有 {blocked.length} 項資產未通過資格檢查，不得納入任何 RWA 載體，也不得對外揭露為投資標的。
              </Notice>
            </div>
          ) : null}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>RWA 載體</h2>
          <div className="muted small">
            每個載體只能對應一種權利。收款帳戶、必要費用、維修準備、債務順位與可分配金額必須逐項列出。
          </div>
          <div className="divider" />
          <Table head={['代號', '名稱', '權利類型', '狀態', '資產數', '配置金額', '單位數', '維修準備', '債務順位']}>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>
                  <strong>{vehicle.code}</strong>
                </td>
                <td>{vehicle.name}</td>
                <td>{vehicle.distributable_basis === 'equipment_rent' ? '設備租金' : '應收帳款回收'}</td>
                <td>
                  <Badge tone={VEHICLE_STATUS_TONE[vehicle.status] ?? 'muted'}>
                    {VEHICLE_STATUS_LABEL[vehicle.status] ?? vehicle.status}
                  </Badge>
                </td>
                <td>{vehicle.asset_count}</td>
                <td>{formatTwd(Number(vehicle.allocated_twd))}</td>
                <td>{vehicle.total_units}</td>
                <td>{Math.round(Number(vehicle.maintenance_reserve_pct) * 100)}%</td>
                <td>{vehicle.senior_debt_twd > 0 ? formatTwd(vehicle.senior_debt_twd) : '無'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>分配瀑布</h2>
          <div className="muted small">
            可分配基礎只有設備租金。營運收入只記錄、不分配，避免把整筆餐食營收當作可分配收益。
          </div>
          <div className="divider" />
          <Table head={['載體', '期間', '設備租金', '營運收入（排除）', '費用', '維修準備', '債務清償', '可分配', '每單位', '狀態']}>
            {distributions.map((run) => (
              <tr key={run.id}>
                <td>{run.vehicle_code}</td>
                <td className="small">
                  {run.period_start} → {run.period_end}
                </td>
                <td>{formatTwd(run.equipment_rent_twd)}</td>
                <td className="muted">{formatTwd(run.operating_revenue_twd)}</td>
                <td>{formatTwd(run.fees_twd)}</td>
                <td>{formatTwd(run.maintenance_reserve_twd)}</td>
                <td>{formatTwd(run.senior_debt_service_twd)}</td>
                <td>
                  <strong>{formatTwd(run.distributable_twd)}</strong>
                </td>
                <td>{formatTwd(run.per_unit_twd)}</td>
                <td>
                  <Badge tone={run.status === 'paid' ? 'ok' : run.status === 'void' ? 'danger' : 'muted'}>
                    {run.status === 'paid' ? '已分配' : run.status === 'approved' ? '已核准' : run.status === 'void' ? '作廢' : '草稿'}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
          {demoDistribution ? (
            <div style={{ marginTop: 12 }} className="small muted">
              試算：設備租金 NT$12,000、營運收入 NT$480,000、費用 NT$600、維修準備{' '}
              {Math.round(Number(demoVehicle?.maintenance_reserve_pct ?? 0) * 100)}% → 可分配{' '}
              {formatTwd(demoDistribution.distributableTwd)}，每單位 {formatTwd(demoDistribution.perUnitTwd)}；
              營運收入 {formatTwd(demoDistribution.excludedOperatingRevenueTwd)} 全數排除。
            </div>
          ) : null}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>壓力情境</h2>
          <div className="muted small">
            設備可轉移不等於一定能回收本金。六種情境都要算出缺口，並標示本金是否受損。
          </div>
          <div className="divider" />
          <Table head={['載體', '情境', '假設', '影響', '可回收', '缺口', '本金受損']}>
            {stress.map((row) => (
              <tr key={row.id}>
                <td>{row.vehicle_code}</td>
                <td>{SCENARIO_LABEL[row.scenario] ?? row.scenario}</td>
                <td className="small">{row.assumption}</td>
                <td>{formatTwd(row.impact_twd)}</td>
                <td>{formatTwd(row.recovery_twd)}</td>
                <td>
                  <strong>{formatTwd(row.shortfall_twd)}</strong>
                </td>
                <td>
                  <Badge tone={row.principal_at_risk ? 'danger' : 'ok'}>{row.principal_at_risk ? '是' : '否'}</Badge>
                </td>
              </tr>
            ))}
          </Table>
          {atRisk.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <Notice tone="danger">
                有 {atRisk.length} 種情境會造成本金缺口。依計畫書要求，必須在揭露文件中明示，且不得對外宣稱保本。
              </Notice>
            </div>
          ) : null}
          <div style={{ marginTop: 12 }} className="small muted">
            單一設備試算（帳面 NT$68,000、月租 NT$2,833、殘值 NT$20,400）：
            {demoStress.map((item) => `${item.label} 缺口 ${formatTwd(item.shortfallTwd)}`).join('；')}。
          </div>
        </Card>
      </div>
    </>
  );
}
