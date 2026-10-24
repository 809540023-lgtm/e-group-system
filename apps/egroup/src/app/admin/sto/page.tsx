import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { formatTwd } from '../../../lib/format.ts';
import {
  getStoGate,
  listComplianceAudits,
  listSafeModeEvents,
  listStoPrograms,
  listStoRequirements,
  previewComplianceCost,
} from '../../../lib/capital.ts';
import { requireRole } from '../../../lib/auth.ts';

const STAGE_LABEL: Readonly<Record<number, string>> = {
  1: '第一階段 · 自有資本與租賃',
  2: '第二階段 · 法律與證券商評估',
  3: '第三階段 · 發行與託管',
};

const STATUS_LABEL: Readonly<Record<string, string>> = {
  preparation: '籌備',
  structuring: '結構設計',
  legal_review: '法律審閱',
  approved: '已核准',
  issuing: '發行中',
  live: '存續中',
  suspended: '暫停',
  abandoned: '已放棄',
};

const STATUS_TONE: Readonly<Record<string, string>> = {
  preparation: 'muted',
  structuring: 'info',
  legal_review: 'warn',
  approved: 'ok',
  issuing: 'ok',
  live: 'ok',
  suspended: 'danger',
  abandoned: 'muted',
};

const INSTRUMENT_LABEL: Readonly<Record<string, string>> = {
  equity: '營運公司股權',
  debt: '債權',
  equipment_right: '設備相關權利',
};

const REQ_STATUS_LABEL: Readonly<Record<string, string>> = {
  pending: '未開始',
  in_progress: '進行中',
  done: '完成',
  blocked: '受阻',
};

const REQ_STATUS_TONE: Readonly<Record<string, string>> = {
  pending: 'muted',
  in_progress: 'info',
  done: 'ok',
  blocked: 'danger',
};

const LAYER_LABEL: Readonly<Record<string, string>> = {
  code_security: '程式碼安全',
  legal: '法律',
  governance: '治理與營運',
  regulatory: '監理與沙盒',
};

const AUDIT_STATUS_LABEL: Readonly<Record<string, string>> = {
  pending: '未開始',
  in_progress: '進行中',
  passed: '通過',
  failed: '未通過',
  waived: '豁免',
};

const AUDIT_STATUS_TONE: Readonly<Record<string, string>> = {
  pending: 'muted',
  in_progress: 'info',
  passed: 'ok',
  failed: 'danger',
  waived: 'warn',
};

const TRIGGER_LABEL: Readonly<Record<string, string>> = {
  code_vulnerability: '程式碼漏洞',
  oracle_error: '預言機錯誤',
  legal_conflict: '法律衝突',
  governance_conflict: '治理衝突',
};

const MODE_LABEL: Readonly<Record<string, string>> = {
  pause_transfer: '暫停轉讓',
  pause_conversion: '暫停轉換',
  manual_review: '人工複核',
};

export default async function StoPage() {
  await requireRole(['admin']);

  const programs = await listStoPrograms();
  const gates = await Promise.all(programs.map((program) => getStoGate(program)));
  const requirements = await Promise.all(programs.map((program) => listStoRequirements(program.id)));
  const [audits, safeModes] = await Promise.all([listComplianceAudits(), listSafeModeEvents()]);

  const primary = gates[0];
  const cost = previewComplianceCost(3_000_000);
  const openSafeMode = safeModes.filter((row) => row.resolved_at === null);
  const failedAudits = audits.filter((row) => row.status === 'failed');

  return (
    <>
      <PageHeader
        title="STO 三階段與合規"
        subtitle="計畫書第十一章。三階段不得跳關；建立平台不等於取得發行或交易許可。"
      />

      <div className="grid grid-4">
        <Stat label="STO 計畫" value={programs.length} hint={`${programs.filter((p) => p.stage === 3).length} 個進入第三階段`} />
        <Stat
          label="主要計畫關卡"
          value={primary ? `${primary.stageProgress.filter((s) => s.complete).length} / 3` : '—'}
          hint={primary ? (primary.canAdvance ? '可推進下一階段' : '尚有阻擋項') : '尚無計畫'}
        />
        <Stat label="合規審計未通過" value={failedAudits.length} hint="四層審計：程式、法律、治理、監理" />
        <Stat label="安全模式" value={openSafeMode.length} hint={openSafeMode.length === 0 ? '目前未啟動' : '須人工複核'} />
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">
          不得把一般會員的買餐行為與取得可分紅證券代幣綁定；不得保本保息；不得用後期加盟金支付前期投資人；不得任意跨境募資。
        </Notice>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>STO 計畫</h2>
          <div className="muted small">
            投資標的必須是營運公司股權、債權或設備相關權利三者之一，法律審閱前不得把多種權利混成一顆代幣。
          </div>
          <div className="divider" />
          <Table head={['代號', '名稱', '階段', '狀態', '投資標的', '發行人', '櫃買規範', '限專業投資人', '發行上限']}>
            {programs.map((program) => (
              <tr key={program.id}>
                <td>
                  <strong>{program.code}</strong>
                </td>
                <td>{program.name}</td>
                <td className="small">{STAGE_LABEL[program.stage] ?? program.stage}</td>
                <td>
                  <Badge tone={STATUS_TONE[program.status] ?? 'muted'}>{STATUS_LABEL[program.status] ?? program.status}</Badge>
                </td>
                <td>{INSTRUMENT_LABEL[program.target_instrument] ?? program.target_instrument}</td>
                <td className="small">{program.issuer_entity ?? '—'}</td>
                <td className="small">{program.tpex_regime ?? '—'}</td>
                <td>
                  <Badge tone={program.professional_investor_only ? 'warn' : 'muted'}>
                    {program.professional_investor_only ? '是' : '否'}
                  </Badge>
                </td>
                <td>{program.issuance_cap_twd === null ? '未定' : formatTwd(program.issuance_cap_twd)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {gates.map((gate, index) => (
        <div key={gate.program.id} style={{ marginTop: 16 }}>
          <Card>
            <h2>{gate.program.code} 階段關卡</h2>
            <div className="muted small">{gate.verdict}</div>
            <div className="divider" />
            <div className="grid grid-3">
              {gate.stageProgress.map((progress) => (
                <div key={progress.stage}>
                  <div className="small muted">{STAGE_LABEL[progress.stage]}</div>
                  <div>
                    <strong>
                      {progress.done} / {progress.total}
                    </strong>{' '}
                    <Badge tone={progress.complete ? 'ok' : 'warn'}>{progress.complete ? '完成' : '未完成'}</Badge>
                  </div>
                </div>
              ))}
            </div>
            {gate.blockers.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <Notice tone="danger">
                  {gate.blockers.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </Notice>
              </div>
            ) : null}
            <div className="divider" />
            <Table head={['階段', '項目', '類別', '狀態', '阻擋', '負責人', '證據']}>
              {(requirements[index] ?? []).map((req) => (
                <tr key={req.id}>
                  <td>{req.stage}</td>
                  <td>{req.label}</td>
                  <td className="small">{req.category}</td>
                  <td>
                    <Badge tone={REQ_STATUS_TONE[req.status] ?? 'muted'}>
                      {REQ_STATUS_LABEL[req.status] ?? req.status}
                    </Badge>
                  </td>
                  <td>{req.blocking ? '是' : '否'}</td>
                  <td className="small">{req.owner ?? '—'}</td>
                  <td className="small muted">{req.evidence ?? '—'}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>四層合規審計</h2>
          <div className="muted small">程式碼安全、法律、治理與營運、監理與沙盒。四層都通過才可進入發行。</div>
          <div className="divider" />
          <Table head={['計畫', '層級', '稽核者', '標準', '狀態', '執行日', '發現']}>
            {audits.map((audit) => (
              <tr key={audit.id}>
                <td>{audit.program_code}</td>
                <td>{LAYER_LABEL[audit.layer] ?? audit.layer}</td>
                <td className="small">{audit.auditor}</td>
                <td className="small">{audit.standard}</td>
                <td>
                  <Badge tone={AUDIT_STATUS_TONE[audit.status] ?? 'muted'}>
                    {AUDIT_STATUS_LABEL[audit.status] ?? audit.status}
                  </Badge>
                </td>
                <td className="small">{audit.performed_on ?? '—'}</td>
                <td className="small muted">{audit.findings ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>安全模式紀錄</h2>
          <div className="muted small">
            法律優先、保守預設、可追溯介入。任何人工介入都須事前授權、多簽、限期、留存紀錄並事後公告。
          </div>
          <div className="divider" />
          <Table head={['計畫', '觸發原因', '模式', '多簽數', '到期', '公告', '解除', '說明']}>
            {safeModes.map((event) => (
              <tr key={event.id}>
                <td>{event.program_code}</td>
                <td>{TRIGGER_LABEL[event.trigger] ?? event.trigger}</td>
                <td>{MODE_LABEL[event.mode] ?? event.mode}</td>
                <td>{event.multi_sig_count}</td>
                <td className="small">{event.expires_at ?? '—'}</td>
                <td className="small">{event.announced_at ?? '未公告'}</td>
                <td className="small">{event.resolved_at ?? '未解除'}</td>
                <td className="small muted">{event.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>合規成本比較</h2>
          <div className="muted small">
            以發行規模 USD 3,000,000 試算。傳統 Reg D 506(c) STO 與 STO+ 統一雙重性架構的落差。
          </div>
          <div className="divider" />
          <Table head={['架構', '一次性成本（低）', '一次性成本（高）', '年度成本（低）', '年度成本（高）', '一次性節省', '年度節省']}>
            <tr>
              <td>傳統 STO</td>
              <td>US$ {cost.traditional.oneTimeLowUsd.toLocaleString('en-US')}</td>
              <td>US$ {cost.traditional.oneTimeHighUsd.toLocaleString('en-US')}</td>
              <td>US$ {Math.round(cost.traditional.annualLowUsd).toLocaleString('en-US')}</td>
              <td>US$ {Math.round(cost.traditional.annualHighUsd).toLocaleString('en-US')}</td>
              <td className="muted">—</td>
              <td className="muted">—</td>
            </tr>
            <tr>
              <td>STO+</td>
              <td>US$ {cost.stoPlus.oneTimeLowUsd.toLocaleString('en-US')}</td>
              <td>US$ {cost.stoPlus.oneTimeHighUsd.toLocaleString('en-US')}</td>
              <td>US$ {Math.round(cost.stoPlus.annualLowUsd).toLocaleString('en-US')}</td>
              <td>US$ {Math.round(cost.stoPlus.annualHighUsd).toLocaleString('en-US')}</td>
              <td>
                <strong>{(cost.stoPlus.oneTimeSavingsPct * 100).toFixed(0)}%</strong>
              </td>
              <td>
                <strong>{(cost.stoPlus.annualSavingsPct * 100).toFixed(1)}%</strong>
              </td>
            </tr>
          </Table>
          <div style={{ marginTop: 12 }} className="small muted">
            {cost.stoPlus.assumptions.join('；')}
          </div>
        </Card>
      </div>
    </>
  );
}
