import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { formatTwd } from '../../../lib/format.ts';
import {
  getConcentration,
  getTokenSummary,
  listSocialMiningAwards,
  listSocialMiningRules,
  listTokenHolders,
  listTokenLots,
  listTokenTransitions,
} from '../../../lib/capital.ts';
import { requireRole } from '../../../lib/auth.ts';

const ADDRESS_CLASS_LABEL: Readonly<Record<string, string>> = {
  platform: '平台內部錢包',
  secondary_market: '合規二級市場',
  custody: '合規託管',
};

const ADDRESS_CLASS_TONE: Readonly<Record<string, string>> = {
  platform: 'info',
  secondary_market: 'warn',
  custody: 'muted',
};

const KYC_LABEL: Readonly<Record<string, string>> = {
  verified: '已驗證',
  pending: '待驗證',
  rejected: '未通過',
};

const KYC_TONE: Readonly<Record<string, string>> = {
  verified: 'ok',
  pending: 'warn',
  rejected: 'danger',
};

const INVESTOR_LABEL: Readonly<Record<string, string>> = {
  general: '一般投資人',
  professional: '專業投資人',
  accredited: '合格投資人',
};

const ACQUISITION_LABEL: Readonly<Record<string, string>> = {
  purchased: '購買取得',
  earned: '賺取取得',
};

const LOCKUP_LABEL: Readonly<Record<string, string>> = {
  rule_144: 'Rule 144 鎖定',
  earned_exempt: '勞務對價豁免',
  none: '無',
};

const DECISION_LABEL: Readonly<Record<string, string>> = {
  UTILITY_TO_SECURITY: '效用 → 證券',
  SECURITY_TO_UTILITY: '證券 → 效用',
  ALREADY_SECURITY: '維持證券狀態',
  ALREADY_UTILITY: '維持效用狀態',
  CUSTODY_HOLD: '託管持有，狀態不變',
  SAFE_MODE: '安全模式阻擋',
  KYC_REQUIRED: 'KYC 未完成阻擋',
  ADDRESS_UNKNOWN: '地址未綁定阻擋',
  INVESTOR_NOT_ELIGIBLE: '投資人不適格阻擋',
  LOCKUP_ACTIVE: '鎖定期阻擋',
};

export default async function TokenPage() {
  await requireRole(['admin']);

  const [summary, holders, lots, transitions, rules, awards, concentration] = await Promise.all([
    getTokenSummary(),
    listTokenHolders(),
    listTokenLots(),
    listTokenTransitions(),
    listSocialMiningRules(),
    listSocialMiningAwards(),
    getConcentration(),
  ]);

  const unverified = holders.filter((row) => row.kyc_status !== 'verified');

  return (
    <>
      <PageHeader
        title="STO+ 混合代幣"
        subtitle="論文《證券型代幣的範式轉移》。同一顆代幣依接收地址性質自動切換證券狀態與效用狀態，轉換全程留痕。"
      />

      <div className="grid grid-4">
        <Stat label="持有人" value={`${summary.verified} / ${summary.holders}`} hint="已完成 KYC" />
        <Stat label="效用狀態數量" value={summary.utilityQuantity} hint="平台內部錢包持有" />
        <Stat label="證券狀態數量" value={summary.securityQuantity} hint="合規二級市場持有" />
        <Stat label="鎖定期批次" value={summary.lockedLots} hint="購買取得適用 Rule 144" />
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">
          代幣採身分綁定，每個地址都必須對應已驗證身分。未完成 KYC 的地址不得收受代幣，也不得參與 Social Mining 發放。
        </Notice>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>持有人與地址</h2>
          <div className="muted small">
            平台內部錢包只能持有效用狀態；合規二級市場地址只能持有證券狀態；合規託管地址可持有任一狀態。
          </div>
          <div className="divider" />
          <Table head={['帳號', '錢包地址', '地址性質', 'KYC', '投資人類別', '管轄', '批次', '總數量', '賺取', '購買']}>
            {holders.map((holder) => (
              <tr key={holder.id}>
                <td className="small">{holder.email}</td>
                <td className="small muted">{holder.wallet_address}</td>
                <td>
                  <Badge tone={ADDRESS_CLASS_TONE[holder.address_class] ?? 'muted'}>
                    {ADDRESS_CLASS_LABEL[holder.address_class] ?? holder.address_class}
                  </Badge>
                </td>
                <td>
                  <Badge tone={KYC_TONE[holder.kyc_status] ?? 'muted'}>
                    {KYC_LABEL[holder.kyc_status] ?? holder.kyc_status}
                  </Badge>
                </td>
                <td className="small">{INVESTOR_LABEL[holder.investor_category] ?? holder.investor_category}</td>
                <td className="small">{holder.jurisdiction}</td>
                <td>{holder.lots}</td>
                <td>
                  <strong>{holder.quantity}</strong>
                </td>
                <td>{holder.earned_quantity}</td>
                <td>{holder.purchased_quantity}</td>
              </tr>
            ))}
          </Table>
          {unverified.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <Notice tone="danger">有 {unverified.length} 個地址尚未完成 KYC，不得收受代幣。</Notice>
            </div>
          ) : null}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>代幣批次</h2>
          <div className="muted small">
            購買取得適用完整 Rule 144 鎖定期；賺取取得依勞務對價定性豁免鎖定期，但仍受反濫用條件約束。
          </div>
          <div className="divider" />
          <Table head={['持有人', '計畫', '數量', '取得方式', '取得時間', '對價', '鎖定依據', '鎖定至', '狀態', '法律狀態']}>
            {lots.map((lot) => (
              <tr key={lot.id}>
                <td className="small">{lot.holder_email}</td>
                <td>{lot.program_code}</td>
                <td>{lot.quantity}</td>
                <td>
                  <Badge tone={lot.acquisition === 'earned' ? 'info' : 'warn'}>
                    {ACQUISITION_LABEL[lot.acquisition] ?? lot.acquisition}
                  </Badge>
                </td>
                <td className="small">{lot.acquired_at}</td>
                <td>{lot.consideration_twd > 0 ? formatTwd(lot.consideration_twd) : '無'}</td>
                <td className="small">{LOCKUP_LABEL[lot.lockup_basis] ?? lot.lockup_basis}</td>
                <td className="small">{lot.lockup_until ?? '—'}</td>
                <td>
                  <Badge tone={lot.status === 'active' ? 'ok' : 'muted'}>{lot.status === 'active' ? '有效' : lot.status}</Badge>
                </td>
                <td>
                  <Badge tone={lot.state === 'ST' ? 'warn' : 'info'}>{lot.state}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>狀態轉換紀錄</h2>
          <div className="muted small">
            轉換由接收地址性質自動判斷，不由使用者手動選擇。所有權人未變，僅規範面向切換。
          </div>
          <div className="divider" />
          <Table head={['時間', '持有人', '轉換', '觸發', '接收地址性質', '判定', '法律依據']}>
            {transitions.map((row) => (
              <tr key={row.id}>
                <td className="small">{row.occurred_at}</td>
                <td className="small">{row.holder_email}</td>
                <td>
                  {row.from_state} → {row.to_state ?? '（不變）'}
                </td>
                <td className="small">{row.trigger === 'address_class' ? '地址性質' : row.trigger === 'safe_mode' ? '安全模式' : '人工介入'}</td>
                <td className="small">{ADDRESS_CLASS_LABEL[row.to_address_class] ?? row.to_address_class}</td>
                <td>
                  <Badge tone={row.to_state === null ? 'danger' : 'ok'}>
                    {DECISION_LABEL[row.decision_code] ?? row.decision_code}
                  </Badge>
                </td>
                <td className="small muted">{row.legal_basis}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>Social Mining 規則</h2>
          <div className="muted small">
            權重事前公開且可稽核。反集中機制包含單一帳戶上限、遞減權重、定期重置與反女巫。
          </div>
          <div className="divider" />
          <Table head={['計畫', '版本', '內容品質', '互動深度', '治理參與', '時間', '單帳戶上限', '遞減', '重置週期', '生效日']}>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.program_code}</td>
                <td>v{rule.version}</td>
                <td>{Math.round(Number(rule.content_quality_weight) * 100)}%</td>
                <td>{Math.round(Number(rule.interaction_depth_weight) * 100)}%</td>
                <td>{Math.round(Number(rule.governance_weight) * 100)}%</td>
                <td>{Math.round(Number(rule.time_weight) * 100)}%</td>
                <td>{rule.per_account_cap}</td>
                <td>{Math.round(Number(rule.decay_pct) * 100)}%</td>
                <td>{rule.reset_period_days} 天</td>
                <td className="small">{rule.effective_from}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>Social Mining 發放</h2>
          <div className="muted small">
            加權分數 = 內容品質 × 權重 + 互動深度 × 權重 + 治理參與 × 權重 + 時間 × 權重。超過單一帳戶上限即截斷。
          </div>
          <div className="divider" />
          <Table head={['持有人', '規則版本', '期間', '內容', '互動', '治理', '時間', '加權分數', '申請', '實發', '截斷']}>
            {awards.map((award) => (
              <tr key={award.id}>
                <td className="small">{award.holder_email}</td>
                <td>v{award.rule_version}</td>
                <td className="small">
                  {award.period_start} → {award.period_end}
                </td>
                <td>{Number(award.content_quality_score).toFixed(0)}</td>
                <td>{Number(award.interaction_depth_score).toFixed(0)}</td>
                <td>{Number(award.governance_score).toFixed(0)}</td>
                <td>{Number(award.time_score).toFixed(0)}</td>
                <td>
                  <strong>{Number(award.weighted_score).toFixed(2)}</strong>
                </td>
                <td>{award.requested_quantity}</td>
                <td>{award.awarded_quantity}</td>
                <td>
                  <Badge tone={award.capped ? 'warn' : 'ok'}>{award.capped ? '是' : '否'}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>集中度檢查</h2>
          <div className="muted small">
            論文所載 Knowpia 規格：前 10% 約 38%、前 20% 約 56%，屬長尾分布。前 10 名占比超過 50% 或前 20 名超過 70% 即視為集中。
          </div>
          <div className="divider" />
          <div className="grid grid-4">
            <Stat label="前 10 名占比" value={`${(concentration.top10PctShare * 100).toFixed(1)}%`} hint="門檻 50%" />
            <Stat label="前 20 名占比" value={`${(concentration.top20PctShare * 100).toFixed(1)}%`} hint="門檻 70%" />
            <Stat label="吉尼係數" value={concentration.gini.toFixed(3)} hint="0 為完全平均" />
            <Stat label="分布型態" value={concentration.longTail ? '長尾' : '集中'} hint={concentration.longTail ? '符合論文預期' : '須調整權重'} />
          </div>
          {!concentration.longTail ? (
            <div style={{ marginTop: 12 }}>
              <Notice tone="warn">
                目前發放偏集中。依論文要求，須調整單一帳戶上限、遞減權重或定期重置，並公開演算法變更紀錄。
              </Notice>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
