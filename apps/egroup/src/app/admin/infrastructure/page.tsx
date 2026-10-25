import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { formatNumber } from '../../../lib/format.ts';
import { requireRole } from '../../../lib/auth.ts';
import {
  REFERENCE,
  assessTrinity,
  daoFormLabel,
  decentralizationOf,
  functionLabel,
  getInfrastructureSummary,
  listActivityAssessments,
  listCrossBorderTiers,
  listDaoRegistrations,
  listDecentralizationSnapshots,
  listNoActionPrecedents,
  listProtocolTokenStages,
  listProtocolTokenTransitions,
  listTechnologyFunctions,
  listTokenClassifications,
  overallLabel,
  roleLabel,
  stageLabel,
  tokenClassLabel,
} from '../../../lib/infrastructure.ts';
import {
  CONTROL_HOLDER_THRESHOLD,
  DAO_ENTITY_FORM_LABELS,
  TAX_ACCOUNTING_LAYER_LABELS,
  TECHNOLOGY_FUNCTION_LABELS,
} from '@eg/meal';

const BAND_LABEL: Readonly<Record<string, string>> = {
  centralized: '集中',
  emerging: '發展中',
  diffuse: '充分分散',
};

const BAND_TONE: Readonly<Record<string, string>> = {
  centralized: 'danger',
  emerging: 'warn',
  diffuse: 'ok',
};

const RISK_LABEL: Readonly<Record<string, string>> = {
  high: '高',
  medium: '中',
  low: '低',
};

const RISK_TONE: Readonly<Record<string, string>> = {
  high: 'danger',
  medium: 'warn',
  low: 'ok',
};

const DECISION_LABEL: Readonly<Record<string, string>> = {
  INFRASTRUCTURE_EXEMPT: '基礎設施豁免',
  INTERMEDIARY_REVIEW: '須中介審查',
  SUBJECT_REQUIRED: '缺主體',
  ROLE_REQUIRED: '缺角色',
  INVALID_COMPENSATION: '報酬結構無效',
  TOKEN_NOT_FOUND: '找不到代幣',
  ALREADY_FUNCTIONAL: '已於功能階段',
  REMAINS_PRE_FUNCTIONALITY: '仍屬前功能階段',
  STAGE_REGRESSION_BLOCKED: '階段回退受阻',
  ADVANCED_TO_FUNCTIONAL: '推進至功能階段',
};

const DECISION_TONE: Readonly<Record<string, string>> = {
  INFRASTRUCTURE_EXEMPT: 'ok',
  INTERMEDIARY_REVIEW: 'warn',
  ADVANCED_TO_FUNCTIONAL: 'ok',
  ALREADY_FUNCTIONAL: 'muted',
  REMAINS_PRE_FUNCTIONALITY: 'warn',
  STAGE_REGRESSION_BLOCKED: 'danger',
  TOKEN_NOT_FOUND: 'danger',
};

const COMPENSATION_LABEL: Readonly<Record<string, string>> = {
  fixed: '固定費用',
  usage: '使用量基礎',
  transaction: '交易基礎',
  remote: '與結果無關',
};

const TAX_LAYER_DETAIL: Readonly<Record<string, string>> = {
  income_nature: '驗證者報酬、質押獎勵屬普通所得；技術功能不排除稅法上構成所得。',
  timing: '取得支配權與控制權時認列；本金質押本身是否為處分須依權利是否改變判斷。',
  cost_basis: '質押獎勵與原持有代幣分別追蹤成本基礎及公允價值。',
  disposal_gain: '流動性質押憑證是否構成交換仍有爭議，不可直接斷言不課稅。',
  issuer_accounting: 'SAB 122 後不再機械式認列 safeguarding liability，改依 ASC 450-20 或 IAS 37 判斷。',
  custody_obligation: '託管會計現代化不等於免除風險揭露、內控與資本要求。',
};

export default async function InfrastructurePage() {
  await requireRole(['admin']);

  const [tokens, chains, assessments, precedents, functions, stages, transitions, daos, tiers, summary] =
    await Promise.all([
      listTokenClassifications(),
      listDecentralizationSnapshots(),
      listActivityAssessments(),
      listNoActionPrecedents(),
      listTechnologyFunctions(),
      listProtocolTokenStages(),
      listProtocolTokenTransitions(),
      listDaoRegistrations(),
      listCrossBorderTiers(),
      getInfrastructureSummary(),
    ]);

  // 三重奏綜合評估示範：以 EG 冷鏈設備收益權代幣走完三個測試。
  const trinity = assessTrinity({
    token: {
      representsTangibleAsset: true,
      representsServiceClaim: false,
      representsFinancialClaim: true,
      indispensableToProtocol: false,
      peggedToReference: false,
      resaleProfitIsPrimaryPurpose: true,
    },
    howey: {
      moneyInvestment: true,
      commonEnterprise: true,
      profitExpectation: true,
      effortsOfOthers: true,
    },
    activity: {
      role: 'broker',
      regularBusinessForOthers: true,
      transactionBasedCompensation: true,
      activeSolicitation: true,
      actsAsMiddleman: true,
      custodyClientAssets: true,
      discretionaryAuthority: false,
      personalizedAdvice: false,
      passiveTechnicalFunction: false,
      fixedOrUsageFee: false,
      publisherException: false,
    },
    technology: {
      function: 'reward_distribution',
      intrinsicToProtocol: true,
      necessaryForOperation: true,
      capitalContribution: true,
      commonEnterprise: true,
      profitExpectation: true,
      issuerRelationship: true,
      consumptiveUse: false,
      custodialStaking: true,
    },
  });

  const egChain = chains.find((row) => row.chain.startsWith('EG-Chain'));
  const egChainProfile = egChain
    ? decentralizationOf({
        nakamotoCoefficient: egChain.nakamoto_coefficient,
        gini: Number(egChain.gini),
        countryCount: egChain.country_count,
        top5CountryShare: Number(egChain.top5_country_share),
        stakingRatio: Number(egChain.staking_ratio),
        usageDensity: Number(egChain.usage_density),
        singleEntityControl: egChain.single_entity_control,
        governanceConcentration: Number(egChain.governance_concentration),
      })
    : null;

  return (
    <>
      <PageHeader
        title="區塊鏈基礎設施與三重奏框架"
        subtitle="論文三。資產本質、活動本質與技術中性三個測試各回答一個不同問題，不可互相取代。"
      />

      <div className="grid grid-4">
        <Stat label="代幣分類" value={summary.tokenCount} hint={`${summary.highRiskCount} 個高證券風險`} />
        <Stat
          label="去中心化量測"
          value={summary.chainCount}
          hint={`${summary.diffuseChainCount} 條判為充分分散`}
        />
        <Stat
          label="活動本質評估"
          value={summary.assessmentCount}
          hint={`${summary.exemptCount} 件基礎設施豁免`}
        />
        <Stat
          label="跨境三層次"
          value={`${summary.tierSatisfiedCount}/${summary.tierTotalCount}`}
          hint={`${summary.blockedTransitionCount} 次階段回退受阻`}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">
          技術中性不是「技術免責」。同一個代幣在機構銷售與程序化銷售下可有不同法律地位；同一個技術功能在自託管與託管質押下也可有不同定性。
        </Notice>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>三重奏框架</h2>
          <div className="muted small">
            論文第一章。三個測試的分工是：資產本質問「這是什麼」，活動本質問「誰該被監管」，技術中性問「技術功能本身是否構成證券交易」。
          </div>
          <div className="divider" />
          <Table head={['支柱', '回答的問題', '方法', '論文章節']}>
            {REFERENCE.trinity.map((pillar) => (
              <tr key={pillar.pillar}>
                <td>
                  <strong>{pillar.label}</strong>
                </td>
                <td>{pillar.question}</td>
                <td className="small">{pillar.method}</td>
                <td className="small">{pillar.chapter}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="muted small">
            綜合判斷示範（EG 冷鏈設備收益權代幣）：
            <Badge
              tone={
                trinity.overall === 'security'
                  ? 'danger'
                  : trinity.overall === 'infrastructure_exempt'
                    ? 'ok'
                    : 'warn'
              }
            >
              {overallLabel(trinity.overall)}
            </Badge>
            <span style={{ marginLeft: 8 }}>{trinity.reasons.join(' ')}</span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>五大代幣類別</h2>
          <div className="muted small">
            論文第二章。分類依亞里斯多德本質主義、韋伯理想類型與法律經濟學三重方法論建構。數位化不改變資產本質：
            {REFERENCE.uccArticle12.article}處理{REFERENCE.uccArticle12.scope}，資產基礎分類法處理監管歸屬。
          </div>
          <div className="divider" />
          <Table head={['類別', '定義', '法律類比', '主管法規', '關鍵問題']}>
            {REFERENCE.tokenClasses.map((entry) => (
              <tr key={entry.tokenClass}>
                <td>
                  <strong>{entry.label}</strong>
                </td>
                <td className="small">{entry.definition}</td>
                <td className="small">{entry.legalAnalogy}</td>
                <td className="small">{entry.regulator}</td>
                <td className="small">{entry.keyQuestion}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['代幣', '名稱', '類別', '證券風險', '須 Howey', 'Howey 四要件', '法律類比', '說明']}>
            {tokens.map((token) => {
              const howey = [
                token.howey_money_investment ? '資金' : null,
                token.howey_common_enterprise ? '共同事業' : null,
                token.howey_profit_expectation ? '利潤期待' : null,
                token.howey_efforts_of_others ? '他人努力' : null,
              ].filter((item): item is string => item !== null);
              return (
                <tr key={token.id}>
                  <td>
                    <strong>{token.symbol}</strong>
                  </td>
                  <td>{token.name}</td>
                  <td className="small">{tokenClassLabel(token.token_class)}</td>
                  <td>
                    <Badge tone={RISK_TONE[token.securities_risk] ?? 'muted'}>
                      {RISK_LABEL[token.securities_risk] ?? token.securities_risk}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={token.howey_needed ? 'warn' : 'muted'}>{token.howey_needed ? '是' : '否'}</Badge>
                  </td>
                  <td className="small">{howey.length > 0 ? howey.join('、') : '—'}</td>
                  <td className="small">{token.legal_analogy ?? '—'}</td>
                  <td className="small">{token.note ?? '—'}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>去中心化的法學解構</h2>
          <div className="muted small">
            論文第三章。去中心化無法成為獨立法律測試，只能作為 Howey「他人努力」要件的輔助判斷因素。三種定義各有操作困難：
          </div>
          <div className="divider" />
          <Table head={['定義', '判準', '操作困難']}>
            {REFERENCE.decentralizationDefinitions.map((entry) => (
              <tr key={entry.dimension}>
                <td>
                  <strong>{entry.label}</strong>
                </td>
                <td className="small">{entry.criteria.join('、')}</td>
                <td className="small">{entry.difficulty}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['不可行性', '說明']}>
            {REFERENCE.decentralizationInfeasibility.map((entry) => (
              <tr key={entry.problem}>
                <td>
                  <strong>{entry.problem}</strong>
                </td>
                <td className="small">{entry.detail}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table
            head={[
              '鏈',
              '量測日',
              'Nakamoto',
              'Gini',
              '國家數',
              '前五國佔比',
              '質押率',
              '使用密度',
              '判定',
              '他人努力',
              '說明',
            ]}
          >
            {chains.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.chain}</strong>
                </td>
                <td className="small">{row.measured_on}</td>
                <td>{row.nakamoto_coefficient}</td>
                <td>{Number(row.gini).toFixed(2)}</td>
                <td>{row.country_count}</td>
                <td>{(Number(row.top5_country_share) * 100).toFixed(0)}%</td>
                <td>{(Number(row.staking_ratio) * 100).toFixed(0)}%</td>
                <td>{(Number(row.usage_density) * 100).toFixed(2)}%</td>
                <td>
                  <Badge tone={BAND_TONE[row.band] ?? 'muted'}>{BAND_LABEL[row.band] ?? row.band}</Badge>
                </td>
                <td>
                  <Badge tone={row.efforts_of_others ? 'danger' : 'ok'}>
                    {row.efforts_of_others ? '成立' : '不成立'}
                  </Badge>
                </td>
                <td className="small">{row.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
          {egChainProfile ? (
            <>
              <div className="divider" />
              <div className="muted small">自建聯盟鏈判定：{egChainProfile.caveat}</div>
            </>
          ) : null}
          <div className="divider" />
          <Table head={['交易情境', '買方知悉交易對手', '依賴發行人努力', '構成投資契約', '理由']}>
            {REFERENCE.rippleHoldings.map((entry) => (
              <tr key={entry.context}>
                <td>
                  <strong>{entry.label}</strong>
                </td>
                <td>
                  <Badge tone={entry.buyerKnowsCounterparty ? 'warn' : 'muted'}>
                    {entry.buyerKnowsCounterparty ? '是' : '否'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={entry.reliesOnIssuerEfforts ? 'warn' : 'muted'}>
                    {entry.reliesOnIssuerEfforts ? '是' : '否'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={entry.investmentContract ? 'danger' : 'ok'}>
                    {entry.investmentContract ? '是' : '否'}
                  </Badge>
                </td>
                <td className="small">{entry.reasoning}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>活動本質測試</h2>
          <div className="muted small">
            論文第四章。核心因素指向中介，否定因素指向基礎設施。三項豁免論證：
            {REFERENCE.exemptionArguments.map((entry) => entry.label).join('、')}。
          </div>
          <div className="divider" />
          <Table head={['主體', '角色', '分類', '被動性', '中立性', '報酬結構', '報酬種類', '結論', '核心因素']}>
            {assessments.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.subject}</strong>
                </td>
                <td className="small">{roleLabel(row.role)}</td>
                <td>
                  <Badge tone={row.classification === 'infrastructure' ? 'ok' : 'warn'}>
                    {row.classification === 'infrastructure' ? '基礎設施' : '中介'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={row.passivity_satisfied ? 'ok' : 'danger'}>
                    {row.passivity_satisfied ? '符合' : '不符'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={row.neutrality_satisfied ? 'ok' : 'danger'}>
                    {row.neutrality_satisfied ? '符合' : '不符'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={row.compensation_satisfied ? 'ok' : 'danger'}>
                    {row.compensation_satisfied ? '符合' : '不符'}
                  </Badge>
                </td>
                <td className="small">{COMPENSATION_LABEL[row.compensation_kind] ?? row.compensation_kind}</td>
                <td>
                  <Badge tone={row.exempt ? 'ok' : 'warn'}>{row.exempt ? '豁免' : '須審查'}</Badge>
                </td>
                <td className="small">{row.core_factors.length > 0 ? row.core_factors.join('；') : '無'}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['角色', '類比', '被動性', '中立性', '報酬', '關鍵區分']}>
            {REFERENCE.roleAssessments.map((entry) => (
              <tr key={entry.role}>
                <td>
                  <strong>{entry.label}</strong>
                </td>
                <td className="small">{entry.analogy}</td>
                <td className="small">{entry.passivity}</td>
                <td className="small">{entry.neutrality}</td>
                <td className="small">{entry.compensation}</td>
                <td className="small">{entry.boundary}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>不採取行動信函的三原則與先例</h2>
          <div className="muted small">
            論文第五章。1984 至 2024 年間 SEC 核發 40 餘封不採取行動信函，可歸納為被動性、中立性與報酬結構三原則。
          </div>
          <div className="divider" />
          <Table head={['日期', '先例', '類別', '標的', '原則']}>
            {precedents.map((row) => (
              <tr key={row.id}>
                <td className="small">{row.decided_on}</td>
                <td>
                  <strong>{row.reference}</strong>
                </td>
                <td className="small">{row.category === 'broker' ? '經紀商' : '投資顧問'}</td>
                <td className="small">{row.subject}</td>
                <td className="small">{row.principle}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['審計層', '主責', '標準', '產出']}>
            {REFERENCE.auditLayers.map((layer) => (
              <tr key={layer.layer}>
                <td>
                  <strong>{layer.label}</strong>
                </td>
                <td className="small">{layer.owner}</td>
                <td className="small">{layer.standard}</td>
                <td className="small">{layer.output}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['觸發情境', '預設處理', '人工介入', '後續']}>
            {REFERENCE.safeModeTriggers.map((trigger) => (
              <tr key={trigger.trigger}>
                <td>
                  <strong>{trigger.label}</strong>
                </td>
                <td className="small">{trigger.defaultHandling}</td>
                <td className="small">{trigger.humanIntervention}</td>
                <td className="small">{trigger.followUp}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>技術功能的內在性</h2>
          <div className="muted small">
            論文第六章。技術功能須同時具備內在性與必要性，且無發行人關係與利潤期待，方不構成證券交易。監管對稱性原則：相同功能應受相同監管，無論其技術實現方式。
          </div>
          <div className="divider" />
          <Table
            head={[
              '代幣',
              '技術功能',
              '內在',
              '必要',
              '出資',
              '共同事業',
              '利潤期待',
              '發行人關係',
              '消費性使用',
              '託管質押',
              '結論',
              '阻擋項',
            ]}
          >
            {functions.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.token_symbol}</strong>
                </td>
                <td className="small">{functionLabel(row.function)}</td>
                <td>{row.intrinsic_to_protocol ? '✓' : '—'}</td>
                <td>{row.necessary_for_operation ? '✓' : '—'}</td>
                <td>{row.capital_contribution ? '✓' : '—'}</td>
                <td>{row.common_enterprise ? '✓' : '—'}</td>
                <td>{row.profit_expectation ? '✓' : '—'}</td>
                <td>{row.issuer_relationship ? '✓' : '—'}</td>
                <td>{row.consumptive_use ? '✓' : '—'}</td>
                <td>{row.custodial_staking ? '✓' : '—'}</td>
                <td>
                  <Badge tone={row.non_security ? 'ok' : 'danger'}>{row.non_security ? '非證券' : '證券'}</Badge>
                </td>
                <td className="small">{row.blockers.length > 0 ? row.blockers.join('；') : '—'}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['功能', '傳統基礎設施', '區塊鏈基礎設施', '處理']}>
            {REFERENCE.regulatorySymmetry.map((row) => (
              <tr key={row.function}>
                <td>
                  <strong>{row.function}</strong>
                </td>
                <td className="small">{row.traditionalInfrastructure}</td>
                <td className="small">{row.blockchainInfrastructure}</td>
                <td className="small">{row.treatment}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="muted small">
            Gas 市場競爭性：base fee 中位數 {REFERENCE.gasMarket.baseFeeMedianGwei} gwei、標準差{' '}
            {REFERENCE.gasMarket.baseFeeStdDevGwei} gwei。{REFERENCE.gasMarket.mechanism}
            {REFERENCE.gasMarket.conclusion}
          </div>
          <div className="divider" />
          <Table head={['鏈', 'Nakamoto', 'Gini', '國家數', '前五國佔比', '質押率', '使用密度', 'Gas 中位數（USD）']}>
            {REFERENCE.chainBenchmarks.map((row) => (
              <tr key={row.chain}>
                <td>
                  <strong>{row.chain}</strong>
                </td>
                <td>{row.nakamotoCoefficient}</td>
                <td>{row.gini.toFixed(2)}</td>
                <td>{row.countryCount}</td>
                <td>{(row.top5CountryShare * 100).toFixed(0)}%</td>
                <td>{(row.stakingRatio * 100).toFixed(0)}%</td>
                <td>{(row.usageDensity * 100).toFixed(2)}%</td>
                <td>{row.gasMedianUsd}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>協議代幣的兩階段模型</h2>
          <div className="muted small">
            論文第七章。{REFERENCE.protocolTokenDefinition.definition}排除事由：
            {REFERENCE.protocolTokenDefinition.exclusions.join('、')}。Regulation PT 上限為 USD{' '}
            {formatNumber(REFERENCE.regulationPt.capUsd)} 與已發行代幣總值{' '}
            {(REFERENCE.regulationPt.capPercentOfOutstanding * 100).toFixed(0)}% 兩者之較高者。
          </div>
          <div className="divider" />
          <Table
            head={[
              '代幣',
              '階段',
              '程式化必要',
              '實際部署',
              '核心功能完備',
              '單一發行人努力',
              '採 Reg PT',
              '上限（USD）',
              '發行額（USD）',
              '轉換時間',
              '說明',
            ]}
          >
            {stages.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.token_symbol}</strong>
                </td>
                <td>
                  <Badge tone={row.stage === 'functional' ? 'ok' : 'warn'}>{stageLabel(row.stage)}</Badge>
                </td>
                <td>{row.programmed_as_indispensable ? '✓' : '—'}</td>
                <td>{row.deployed_for_actual_use ? '✓' : '—'}</td>
                <td>{row.core_features_complete ? '✓' : '—'}</td>
                <td>
                  <Badge tone={row.single_issuer_efforts ? 'danger' : 'ok'}>
                    {row.single_issuer_efforts ? '存在' : '不存在'}
                  </Badge>
                </td>
                <td>{row.regulation_pt_used ? '✓' : '—'}</td>
                <td className="small">
                  {row.regulation_pt_cap_usd ? formatNumber(Number(row.regulation_pt_cap_usd)) : '—'}
                </td>
                <td className="small">
                  {row.regulation_pt_offering_usd ? formatNumber(Number(row.regulation_pt_offering_usd)) : '—'}
                </td>
                <td className="small">{row.transitioned_at ?? '—'}</td>
                <td className="small">{row.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['時間', '代幣', '原階段', '新階段', '決策碼', '執行者', '說明']}>
            {transitions.map((row) => (
              <tr key={row.id}>
                <td className="small">{row.created_at}</td>
                <td>
                  <strong>{row.token_symbol}</strong>
                </td>
                <td className="small">{stageLabel(row.from_stage)}</td>
                <td className="small">{stageLabel(row.to_stage)}</td>
                <td>
                  <Badge tone={DECISION_TONE[row.decision_code] ?? 'muted'}>
                    {DECISION_LABEL[row.decision_code] ?? row.decision_code}
                  </Badge>
                </td>
                <td className="small">{row.actor_id ?? '—'}</td>
                <td className="small">{row.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="muted small">
            階段回退一律阻擋：功能階段退回前功能階段必須經安全模式與人工複核，不得由程式自動完成。
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>DAO 責任分配</h2>
          <div className="muted small">
            論文第七章第六節。未採任何州法法人形式者，依 Sarcuni v. bZx DAO 推定為普通合夥，成員負連帶責任。投票權重達{' '}
            {(CONTROL_HOLDER_THRESHOLD * 100).toFixed(0)}% 之持有人課以控制股東忠實義務。
          </div>
          <div className="divider" />
          <Table
            head={['名稱', '法人形式', '治理透明', '有限責任', '最低治理標準', '普通合夥推定', '安全港', '登記日', '說明']}
          >
            {daos.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td className="small">{daoFormLabel(row.entity_form)}</td>
                <td>{row.governance_transparent ? '✓' : '—'}</td>
                <td>
                  <Badge tone={row.member_limited_liability ? 'ok' : 'danger'}>
                    {row.member_limited_liability ? '有' : '無'}
                  </Badge>
                </td>
                <td>{row.minimum_governance_standards ? '✓' : '—'}</td>
                <td>
                  <Badge tone={row.general_partnership_presumption ? 'danger' : 'muted'}>
                    {row.general_partnership_presumption ? '適用' : '不適用'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={row.safe_harbor ? 'ok' : 'warn'}>{row.safe_harbor ? '成立' : '不成立'}</Badge>
                </td>
                <td className="small">{row.registered_on ?? '—'}</td>
                <td className="small">{row.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['損害來源', '主要責任人', '次要責任人', '依據']}>
            {REFERENCE.daoDamageTiers.map((tier) => (
              <tr key={tier.source}>
                <td>
                  <strong>{tier.label}</strong>
                </td>
                <td className="small">{tier.primaryLiable}</td>
                <td className="small">{tier.secondaryLiable}</td>
                <td className="small">{tier.authority}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="muted small">可採用的法人形式：{Object.values(DAO_ENTITY_FORM_LABELS).join('、')}。</div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>跨境三層次解方</h2>
          <div className="muted small">
            論文第七章第七節。{REFERENCE.mtGox.case}（{REFERENCE.mtGox.year}）：{REFERENCE.mtGox.problem}
            {REFERENCE.mtGox.lesson}
          </div>
          <div className="divider" />
          <Table head={['層次', '要求', '參考']}>
            {REFERENCE.crossBorderTiers.map((tier) => (
              <tr key={tier.tier}>
                <td>
                  <strong>
                    {tier.order}. {tier.label}
                  </strong>
                </td>
                <td className="small">{tier.requirement}</td>
                <td className="small">{tier.reference}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['代幣', '層次', '達成', '要求', '參考', '量測日', '說明']}>
            {tiers.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.token_symbol}</strong>
                </td>
                <td className="small">
                  {REFERENCE.crossBorderTiers.find((tier) => tier.tier === row.tier)?.label ?? row.tier}
                </td>
                <td>
                  <Badge tone={row.satisfied ? 'ok' : 'warn'}>{row.satisfied ? '已達成' : '未達成'}</Badge>
                </td>
                <td className="small">{row.requirement}</td>
                <td className="small">{row.reference ?? '—'}</td>
                <td className="small">{row.assessed_on}</td>
                <td className="small">{row.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2>稅務與會計的六個層次</h2>
          <div className="muted small">
            論文第六章第六節。技術功能本身不應被過度證券化，但技術功能所產生的收益、費用、庫存與託管義務，仍須依 IRS 與 FASB 的既有框架處理。
          </div>
          <div className="divider" />
          <Table head={['層次', '處理重點']}>
            {Object.entries(TAX_ACCOUNTING_LAYER_LABELS).map(([key, label]) => (
              <tr key={key}>
                <td>
                  <strong>{label}</strong>
                </td>
                <td className="small">{TAX_LAYER_DETAIL[key] ?? '—'}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <Table head={['交易類型', '所得處理', '會計處理', '限制', '依據']}>
            {REFERENCE.taxTreatments.map((row) => (
              <tr key={row.activity}>
                <td>
                  <strong>{row.activity}</strong>
                </td>
                <td className="small">{row.taxTreatment}</td>
                <td className="small">{row.accountingTreatment}</td>
                <td className="small">{row.limitation}</td>
                <td className="small">{row.authority}</td>
              </tr>
            ))}
          </Table>
          <div className="divider" />
          <div className="muted small">
            技術功能清單：{Object.values(TECHNOLOGY_FUNCTION_LABELS).join('、')}。
          </div>
        </Card>
      </div>
    </>
  );
}
