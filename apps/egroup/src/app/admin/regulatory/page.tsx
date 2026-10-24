import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { formatTwd } from '../../../lib/format.ts';
import { requireRole } from '../../../lib/auth.ts';
import {
  REFERENCE,
  evaluateSafeHarbor,
  getLegitimacy,
  getRegulatorySummary,
  groupDisclosures,
  listCrossBorderAssessments,
  listDisclosures,
  listEvents,
  listRegimes,
  listSafeHarbors,
  listTaxAccounting,
  previewCrossBorder,
} from '../../../lib/regulatory.ts';
import {
  DISCLOSURE_LABELS,
  POLICY_EVENT_KIND_LABELS,
  POSTURE_LABELS,
  SAFE_HARBOR_LABELS,
  clarityActPhrasing,
  equivalenceAssessment,
  type RegulatoryPosture,
} from '@eg/meal';

const POSTURE_TONE: Readonly<Record<RegulatoryPosture, string>> = {
  enforcement_led: 'danger',
  innovation_oriented: 'ok',
  equivalence_required: 'warn',
  restricted: 'danger',
};

const SUBJECT_LABEL: Readonly<Record<string, string>> = {
  staking: '質押',
  custody: '託管',
  token_issuance: '代幣發行',
};

const HARBOR_STATUS_LABEL: Readonly<Record<string, string>> = {
  draft: '草稿',
  submitted: '已送件',
  granted: '已核發',
  rejected: '已駁回',
  expired: '已到期',
};

const HARBOR_STATUS_TONE: Readonly<Record<string, string>> = {
  draft: 'muted',
  submitted: 'info',
  granted: 'ok',
  rejected: 'danger',
  expired: 'warn',
};

const DECISION_LABEL: Readonly<Record<string, string>> = {
  ALLOWED: '可要約',
  REGIME_UNKNOWN: '未登錄體制',
  RESTRICTED_JURISDICTION: '限制或禁止類',
  EQUIVALENCE_MISSING: '缺等同性認定',
  LOCAL_LICENSE_MISSING: '缺當地許可',
  RETAIL_NOT_ALLOWED: '不開放零售',
  PROFESSIONAL_ONLY: '限專業投資人',
  STAGE_NOT_REACHED: '未達第三階段',
  PROGRAM_NOT_FOUND: '找不到計畫',
};

const HOLDER_LABEL: Readonly<Record<string, string>> = {
  general: '一般投資人',
  professional: '專業投資人',
  accredited: '合格投資人',
};

export default async function RegulatoryPage() {
  await requireRole(['admin']);

  const [regimes, events, harbors, disclosures, crossBorder, tax, legitimacy, summary] = await Promise.all([
    listRegimes(),
    listEvents(40),
    listSafeHarbors(),
    listDisclosures(),
    listCrossBorderAssessments(20),
    listTaxAccounting(),
    getLegitimacy(),
    getRegulatorySummary(),
  ]);

  const groups = groupDisclosures(disclosures);
  const enforcement = REFERENCE.enforcement;
  const equivalence = equivalenceAssessment({
    substantiveEquivalence: false,
    infoSharingMou: false,
    reciprocalAccess: false,
    localBranchAvailable: false,
  });

  // 跨境守門預覽：對每個目的地與投資人類別各跑一次，把決策碼攤開來看。
  const guardMatrix = REFERENCE.jurisdictions.flatMap((jurisdiction) =>
    (['professional', 'general'] as const).map((holder) => ({
      jurisdiction,
      holder,
      decision: previewCrossBorder({
        destinationCode: jurisdiction.code,
        tokenState: 'ST',
        programProfessionalOnly: true,
        holderCategory: holder,
        equivalenceDetermined: false,
        localLicenseHeld: false,
      }),
    })),
  );

  return (
    <>
      <PageHeader
        title="監理環境與跨境要約"
        subtitle="論文二。從執法監管到創新導向的制度轉型，以及代幣化業務的跨境守門條件。"
      />

      <div className="grid grid-4">
        <Stat label="登錄監理體制" value={summary.regimeCount} hint={`${summary.restrictedCount} 個限制或禁止類`} />
        <Stat
          label="政策事件"
          value={summary.eventCount}
          hint={summary.postureShift ? `轉折點 ${summary.postureShift.on}` : '未偵測到姿態轉折'}
        />
        <Stat label="已核發安全港" value={summary.grantedSafeHarbors} hint={`共 ${harbors.length} 件申請`} />
        <Stat label="跨境要約受阻" value={summary.blockedCrossBorder} hint={`${crossBorder.length} 筆評估紀錄`} />
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">{clarityActPhrasing()}</Notice>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>監理姿態矩陣</h2>
          <div className="muted small">
            代幣在 A 國合法不代表可在 B 國要約。姿態決定的是「能不能要約」，不是「代幣有沒有效」。
          </div>
          <div className="divider" />
          <Table head={['代碼', '國家／地區', '姿態', '主要框架', '零售', '限專業', '須等同性', '生效日', '說明']}>
            {regimes.map((regime) => (
              <tr key={regime.id}>
                <td>
                  <strong>{regime.code}</strong>
                </td>
                <td>{regime.name}</td>
                <td>
                  <Badge tone={POSTURE_TONE[regime.posture] ?? 'muted'}>
                    {POSTURE_LABELS[regime.posture] ?? regime.posture}
                  </Badge>
                </td>
                <td className="small">{regime.framework}</td>
                <td>
                  <Badge tone={regime.retail_allowed ? 'ok' : 'danger'}>
                    {regime.retail_allowed ? '開放' : '不開放'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={regime.professional_only ? 'warn' : 'muted'}>
                    {regime.professional_only ? '是' : '否'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={regime.equivalence_required ? 'warn' : 'muted'}>
                    {regime.equivalence_required ? '是' : '否'}
                  </Badge>
                </td>
                <td className="small">{regime.effective_from ?? '—'}</td>
                <td className="small">{regime.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>政策時間軸</h2>
          <div className="muted small">
            論文第三章第二節。2025 年 1 月 20 日 Gensler 辭職是關鍵時刻：既有制度均衡被打破，新軌跡才得以確立。
          </div>
          <div className="divider" />
          <Table head={['日期', '類別', '事件', '事件後姿態', '摘要']}>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="small">{event.event_date}</td>
                <td className="small">
                  {POLICY_EVENT_KIND_LABELS[event.kind as keyof typeof POLICY_EVENT_KIND_LABELS] ?? event.kind}
                </td>
                <td>{event.title}</td>
                <td>
                  <Badge tone={POSTURE_TONE[event.posture_after] ?? 'muted'}>
                    {POSTURE_LABELS[event.posture_after] ?? event.posture_after}
                  </Badge>
                </td>
                <td className="small">{event.summary}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>執法期量化觀測（2020–2024）</h2>
          <div className="muted small">論文第二章。三組獨立資料方向一致，但屬描述性觀測，不構成因果識別。</div>
          <div className="divider" />
          <div className="grid grid-4">
            <Stat
              label="執法行動"
              value={`${enforcement.actions} 件`}
              hint={`${enforcement.fraudSharePct}% 涉詐欺、${enforcement.unregisteredSharePct}% 涉未註冊證券`}
            />
            <Stat
              label="和解金額"
              value={`US$ ${(enforcement.settlementUsd / 1_000_000_000).toFixed(0)}B`}
              hint="累計"
            />
            <Stat
              label="美國開發者占比"
              value={`${enforcement.developerShareFromPct}% → ${enforcement.developerShareToPct}%`}
              hint="Electric Capital"
            />
            <Stat
              label="美國創投占比"
              value={`${enforcement.vcShareFromPct}% → ${enforcement.vcShareToPct}%`}
              hint={`美國註冊占比 ${enforcement.usIncorporationFromPct}% → ${enforcement.usIncorporationToPct}%`}
            />
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>等同性認定（MiCA 第 16、60 條）</h2>
          <div className="muted small">
            三項判準缺一不可；三項都不成立時只能走歐盟分支機構，兩者皆無則不得要約。
          </div>
          <div className="divider" />
          <Table head={['判準', '現況', '說明']}>
            <tr>
              <td>實質等同性</td>
              <td>
                <Badge tone="danger">未取得</Badge>
              </td>
              <td className="small">我國規範與 MiCA 在揭露、資本與治理要求上尚未被認定為實質等同。</td>
            </tr>
            <tr>
              <td>與 ESMA 的資訊交換備忘錄</td>
              <td>
                <Badge tone="danger">未簽署</Badge>
              </td>
              <td className="small">缺少跨境監理資訊交換管道，無法進行持續監控。</td>
            </tr>
            <tr>
              <td>相互市場進入</td>
              <td>
                <Badge tone="danger">未建立</Badge>
              </td>
              <td className="small">單向開放不構成等同性；須有對等安排。</td>
            </tr>
          </Table>
          <div style={{ marginTop: 12 }}>
            <Notice tone={equivalence.determined ? 'ok' : 'danger'}>
              <div>
                認定結果：<strong>{equivalence.determined ? '已取得等同性' : '未取得等同性'}</strong>
                （路徑：
                {equivalence.route === 'equivalence'
                  ? '等同性認定'
                  : equivalence.route === 'local_branch'
                    ? '歐盟分支機構'
                    : '無可用路徑'}
                ）
              </div>
              {equivalence.blockers.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </Notice>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>安全港登記</h2>
          <div className="muted small">
            安全港不是永久豁免：須有善意認定、合理合規措施、定期報告、明確期限與退出機制；沙盒另有規模上限，延長不得超過 12
            個月。
          </div>
          <div className="divider" />
          <Table head={['編號', '類型', '體制', '主體', '狀態', '期間', '上限', '退出機制', '檢查結果']}>
            {harbors.map((harbor) => {
              const check = evaluateSafeHarbor(harbor);
              return (
                <tr key={harbor.id}>
                  <td>
                    <strong>{harbor.reference_no}</strong>
                  </td>
                  <td className="small">{SAFE_HARBOR_LABELS[harbor.kind] ?? harbor.kind}</td>
                  <td>{harbor.regime_code}</td>
                  <td className="small">{harbor.subject}</td>
                  <td>
                    <Badge tone={HARBOR_STATUS_TONE[harbor.status] ?? 'muted'}>
                      {HARBOR_STATUS_LABEL[harbor.status] ?? harbor.status}
                    </Badge>
                  </td>
                  <td className="small">
                    {harbor.opened_on ?? '—'} → {harbor.expires_on ?? '—'}
                    {harbor.extension_months > 0 ? `（延長 ${harbor.extension_months} 個月）` : ''}
                  </td>
                  <td className="small">
                    {harbor.user_cap === null ? '無用戶上限' : `${harbor.user_cap} 人`}
                    <br />
                    {harbor.volume_cap_twd === null ? '無金額上限' : formatTwd(harbor.volume_cap_twd)}
                  </td>
                  <td className="small">{harbor.exit_mechanism === 'none' ? '未定' : harbor.exit_mechanism}</td>
                  <td className="small">
                    <Badge tone={check.valid ? 'ok' : 'danger'}>
                      {check.valid ? '符合' : `${check.blockers.length} 項阻擋`}
                    </Badge>
                    {check.blockers.map((item) => (
                      <div key={item} className="muted">
                        {item}
                      </div>
                    ))}
                    {check.warnings.map((item) => (
                      <div key={item} className="muted">
                        ⚠ {item}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>揭露義務</h2>
          <div className="muted small">
            揭露不只是提供資訊，還要讓人看得懂、用得上；缺少必要項目即不得對外提供服務。
          </div>
          <div className="divider" />
          <Table head={['主體', '對象', '完成度', '缺少項目', '已備證據']}>
            {groups.map((group) => (
              <tr key={`${group.subjectType}-${group.subjectRef}`}>
                <td>{SUBJECT_LABEL[group.subjectType] ?? group.subjectType}</td>
                <td className="small">{group.subjectRef}</td>
                <td>
                  <Badge tone={group.checklist.complete ? 'ok' : 'warn'}>
                    {group.checklist.satisfiedCount} / {group.checklist.requiredCount}
                  </Badge>
                </td>
                <td className="small">
                  {group.checklist.missing.length === 0 ? '—' : group.checklist.missing.join('、')}
                </td>
                <td className="small">
                  {group.items
                    .filter((item) => item.satisfied && item.evidence !== null)
                    .map((item) => `${DISCLOSURE_LABELS[item.item_key] ?? item.item_key}：${item.evidence}`)
                    .join('；') || '—'}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>跨境要約評估紀錄</h2>
          <div className="muted small">被阻擋的評估同樣留痕，否則事後無法證明「當時確實擋下了」。</div>
          <div className="divider" />
          <Table head={['時間', '計畫', '目的地', '代幣狀態', '投資人類別', '結果', '理由']}>
            {crossBorder.map((row) => (
              <tr key={row.id}>
                <td className="small">{row.assessed_at}</td>
                <td className="small">{row.program_code ?? '—'}</td>
                <td>
                  {row.destination_code} {row.destination_name ?? ''}
                </td>
                <td className="small">{row.token_state}</td>
                <td className="small">{HOLDER_LABEL[row.holder_category] ?? row.holder_category}</td>
                <td>
                  <Badge tone={row.allowed ? 'ok' : 'danger'}>
                    {DECISION_LABEL[row.decision_code] ?? row.decision_code}
                  </Badge>
                </td>
                <td className="small">{row.reason}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>跨境守門預覽</h2>
          <div className="muted small">
            以「限專業投資人、未取得等同性、未設當地分支」的現況，對每個目的地各跑一次守門判斷。
          </div>
          <div className="divider" />
          <Table head={['目的地', '姿態', '投資人類別', '結果', '理由']}>
            {guardMatrix.map((row) => (
              <tr key={`${row.jurisdiction.code}-${row.holder}`}>
                <td>
                  {row.jurisdiction.code} {row.jurisdiction.name}
                </td>
                <td>
                  <Badge tone={POSTURE_TONE[row.jurisdiction.posture] ?? 'muted'}>
                    {POSTURE_LABELS[row.jurisdiction.posture] ?? row.jurisdiction.posture}
                  </Badge>
                </td>
                <td className="small">{HOLDER_LABEL[row.holder] ?? row.holder}</td>
                <td>
                  <Badge tone={row.decision.allowed ? 'ok' : 'danger'}>
                    {DECISION_LABEL[row.decision.code] ?? row.decision.code}
                  </Badge>
                </td>
                <td className="small">{row.decision.reason}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>稅務與會計對照</h2>
          <div className="muted small">稅法上的所得時點與證券法上的性質判斷是兩件事，不可互相推論。</div>
          <div className="divider" />
          <Table head={['交易類型', '稅務處理', '會計處理', '注意事項', '依據']}>
            {tax.map((row) => (
              <tr key={row.kind}>
                <td>{row.label}</td>
                <td className="small">{row.taxTreatment}</td>
                <td className="small">{row.accountingTreatment}</td>
                <td className="small">{row.caveat}</td>
                <td className="small">{row.authority}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>創新導向監管的正當性</h2>
          <div className="muted small">
            論文第八章。創新導向監管不是監管鬆綁，而是監管品質的提升；五項條件缺一項就退回「共謀」而非「對話」。
          </div>
          <div className="divider" />
          <Table head={['條件', '現況']}>
            <tr>
              <td>公開透明的規則制定程序</td>
              <td>
                <Badge tone="ok">已具備</Badge>
              </td>
            </tr>
            <tr>
              <td>多元利害關係人參與</td>
              <td>
                <Badge tone="ok">已具備</Badge>
              </td>
            </tr>
            <tr>
              <td>充分且持續的資訊揭露</td>
              <td>
                <Badge tone="ok">已具備</Badge>
              </td>
            </tr>
            <tr>
              <td>監理機關的獨立判斷</td>
              <td>
                <Badge tone="ok">已具備</Badge>
              </td>
            </tr>
            <tr>
              <td>事後問責與救濟機制</td>
              <td>
                <Badge tone={legitimacy.legitimate ? 'ok' : 'danger'}>
                  {legitimacy.legitimate ? '已具備' : '尚未建立'}
                </Badge>
              </td>
            </tr>
          </Table>
          <div style={{ marginTop: 12 }}>
            <Notice tone={legitimacy.legitimate ? 'ok' : 'warn'}>
              <div>
                正當性結論：<strong>{legitimacy.legitimate ? '五項條件齊備' : '尚未齊備'}</strong>
              </div>
              {legitimacy.blockers.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </Notice>
          </div>
          {legitimacy.risks.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div className="small muted">須持續監控的四項風險</div>
              <ul className="small">
                {legitimacy.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
