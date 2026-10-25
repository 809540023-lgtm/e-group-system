import { describe, expect, it } from 'vitest';
import {
  AUDIT_LAYERS,
  CHAIN_BENCHMARKS,
  CONTROL_HOLDER_THRESHOLD,
  CROSS_BORDER_TIERS,
  DAO_DAMAGE_TIERS,
  DAO_ENTITY_FORM_LABELS,
  DECENTRALIZATION_DEFINITIONS,
  DECENTRALIZATION_INFEASIBILITY,
  EXEMPTION_ARGUMENTS,
  GAS_MARKET_EVIDENCE,
  INFRASTRUCTURE_ROLE_ASSESSMENTS,
  MT_GOX_LESSON,
  NO_ACTION_PRECEDENTS,
  NO_ACTION_PRINCIPLE_LABELS,
  PROTOCOL_TOKEN_DEFINITION,
  PROTOCOL_TOKEN_STAGE_LABELS,
  REGULATION_PT,
  REGULATORY_SYMMETRY,
  RIPPLE_HOLDINGS,
  SAFE_MODE_TRIGGERS,
  TAX_ACCOUNTING_LAYER_LABELS,
  TECHNOLOGY_FUNCTIONS,
  TECHNOLOGY_FUNCTION_LABELS,
  TECHNOLOGY_TAX_TREATMENTS,
  TOKEN_CLASSES,
  TOKEN_CLASS_LABELS,
  TRINITY_OVERALL_LABELS,
  TRINITY_PILLARS,
  UCC_ARTICLE_12,
  activitySubstanceTest,
  claritySection504,
  classifyToken,
  crossBorderSolution,
  daoLiabilityTier,
  decentralizationProfile,
  defiExclusion,
  findChainBenchmark,
  findRippleHolding,
  findTokenClass,
  findTrinityPillar,
  giniCoefficient,
  howeyTest,
  intrinsicalityTest,
  isProtocolToken,
  nakamotoCoefficient,
  noActionLetterCheck,
  protocolTokenStage,
  regulationPtCheck,
  trinityAssessment,
  type ActivitySubstanceInput,
  type DaoEntityForm,
  type IntrinsicalityInput,
  type NoActionInput,
  type TokenClassificationInput,
} from '../src/infrastructure.ts';

/* ------------------------------------------------------------------ */
/* 三重奏框架                                                          */
/* ------------------------------------------------------------------ */

describe('三重奏框架', () => {
  it('三個支柱各回答不同問題', () => {
    expect(TRINITY_PILLARS).toHaveLength(3);
    expect(TRINITY_PILLARS.map((pillar) => pillar.pillar)).toEqual([
      'asset_substance',
      'activity_substance',
      'technology_neutrality',
    ]);
    const questions = new Set(TRINITY_PILLARS.map((pillar) => pillar.question));
    expect(questions.size).toBe(3);
  });

  it('findTrinityPillar 可依代碼查找', () => {
    expect(findTrinityPillar('activity_substance')?.chapter).toBe('第四章');
    expect(findTrinityPillar('technology_neutrality')?.label).toBe('技術中性');
  });

  it('findTrinityPillar 對未知代碼回 undefined', () => {
    expect(findTrinityPillar('unknown' as never)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* 五大代幣類別                                                        */
/* ------------------------------------------------------------------ */

describe('五大代幣類別', () => {
  it('五個類別齊備且標籤完整', () => {
    expect(TOKEN_CLASSES).toHaveLength(5);
    for (const entry of TOKEN_CLASSES) {
      expect(TOKEN_CLASS_LABELS[entry.tokenClass]).toBe(entry.label);
      expect(entry.definition.length).toBeGreaterThan(0);
      expect(entry.examples.length).toBeGreaterThan(0);
    }
  });

  it('findTokenClass 可依代碼查找', () => {
    expect(findTokenClass('native_dlt')?.regulator).toContain('新類別');
    expect(findTokenClass('stablecoin')?.legalAnalogy).toContain('支付');
  });

  it('代表有形資產者優先歸為實體資產代幣', () => {
    const result = classifyToken({
      representsTangibleAsset: true,
      representsServiceClaim: true,
      representsFinancialClaim: true,
      indispensableToProtocol: true,
      peggedToReference: true,
      resaleProfitIsPrimaryPurpose: false,
    });
    expect(result.tokenClass).toBe('physical_asset');
    expect(result.securitiesRisk).toBe('low');
    expect(result.howeyNeeded).toBe(false);
  });

  it('實體資產代幣若以轉售獲利為主要目的則風險升為中', () => {
    const result = classifyToken({
      representsTangibleAsset: true,
      representsServiceClaim: false,
      representsFinancialClaim: false,
      indispensableToProtocol: false,
      peggedToReference: false,
      resaleProfitIsPrimaryPurpose: true,
    });
    expect(result.securitiesRisk).toBe('medium');
    expect(result.howeyNeeded).toBe(true);
  });

  it('服務代幣以轉售獲利為主要目的時風險為高', () => {
    const result = classifyToken({
      representsTangibleAsset: false,
      representsServiceClaim: true,
      representsFinancialClaim: false,
      indispensableToProtocol: false,
      peggedToReference: false,
      resaleProfitIsPrimaryPurpose: true,
    });
    expect(result.tokenClass).toBe('services');
    expect(result.securitiesRisk).toBe('high');
    expect(result.reasons.join('')).toContain('Telegram');
  });

  it('金融請求權一律須 Howey 且風險為高', () => {
    const result = classifyToken({
      representsTangibleAsset: false,
      representsServiceClaim: false,
      representsFinancialClaim: true,
      indispensableToProtocol: false,
      peggedToReference: false,
      resaleProfitIsPrimaryPurpose: false,
    });
    expect(result.tokenClass).toBe('intangible_asset');
    expect(result.securitiesRisk).toBe('high');
    expect(result.howeyNeeded).toBe(true);
  });

  it('掛鉤參考價值者歸為穩定幣', () => {
    const result = classifyToken({
      representsTangibleAsset: false,
      representsServiceClaim: false,
      representsFinancialClaim: false,
      indispensableToProtocol: false,
      peggedToReference: true,
      resaleProfitIsPrimaryPurpose: false,
    });
    expect(result.tokenClass).toBe('stablecoin');
    expect(result.securitiesRisk).toBe('low');
  });

  it('對協議不可或缺者歸為原生 DLT 代幣', () => {
    const result = classifyToken({
      representsTangibleAsset: false,
      representsServiceClaim: false,
      representsFinancialClaim: false,
      indispensableToProtocol: true,
      peggedToReference: false,
      resaleProfitIsPrimaryPurpose: false,
    });
    expect(result.tokenClass).toBe('native_dlt');
    expect(result.reasons.join('')).toContain('他人努力');
  });

  it('未符合任何主要特徵時回到個案審查', () => {
    const result = classifyToken({
      representsTangibleAsset: false,
      representsServiceClaim: false,
      representsFinancialClaim: false,
      indispensableToProtocol: false,
      peggedToReference: false,
      resaleProfitIsPrimaryPurpose: false,
    });
    expect(result.tokenClass).toBe('intangible_asset');
    expect(result.securitiesRisk).toBe('high');
    expect(result.reasons.join('')).toContain('個案審查');
  });

  it('UCC 第 12 條與資產基礎分類法分工明確', () => {
    expect(UCC_ARTICLE_12.article).toContain('第 12 條');
    expect(UCC_ARTICLE_12.concept).toContain('CERs');
    expect(UCC_ARTICLE_12.divisionOfLabor).toContain('財產法');
  });
});

/* ------------------------------------------------------------------ */
/* Howey 四要件                                                        */
/* ------------------------------------------------------------------ */

describe('Howey 四要件', () => {
  it('四要件齊備構成投資契約', () => {
    const result = howeyTest({
      moneyInvestment: true,
      commonEnterprise: true,
      profitExpectation: true,
      effortsOfOthers: true,
    });
    expect(result.isInvestmentContract).toBe(true);
    expect(result.failedElements).toHaveLength(0);
    expect(result.note).toContain('構成投資契約');
  });

  it('缺少他人努力即不構成投資契約', () => {
    const result = howeyTest({
      moneyInvestment: true,
      commonEnterprise: true,
      profitExpectation: true,
      effortsOfOthers: false,
    });
    expect(result.isInvestmentContract).toBe(false);
    expect(result.failedElements).toEqual(['利潤來自他人努力']);
  });

  it('四要件全缺時列出全部缺項', () => {
    const result = howeyTest({
      moneyInvestment: false,
      commonEnterprise: false,
      profitExpectation: false,
      effortsOfOthers: false,
    });
    expect(result.failedElements).toHaveLength(4);
    expect(result.note).toContain('金錢投資');
  });
});

/* ------------------------------------------------------------------ */
/* 去中心化計量                                                        */
/* ------------------------------------------------------------------ */

describe('去中心化計量', () => {
  it('三種定義與三類不可行性齊備', () => {
    expect(DECENTRALIZATION_DEFINITIONS).toHaveLength(3);
    expect(DECENTRALIZATION_INFEASIBILITY).toHaveLength(3);
    expect(DECENTRALIZATION_DEFINITIONS.map((entry) => entry.dimension)).toEqual([
      'computer_science',
      'economics',
      'political_science',
    ]);
  });

  it('Nakamoto 係數：單一實體掌握三分之一即為 1', () => {
    expect(nakamotoCoefficient([40, 20, 20, 20])).toBe(1);
  });

  it('Nakamoto 係數：平均分布時需多個實體', () => {
    expect(nakamotoCoefficient([10, 10, 10, 10, 10, 10])).toBe(2);
  });

  it('Nakamoto 係數：空輸入回 0', () => {
    expect(nakamotoCoefficient([])).toBe(0);
    expect(nakamotoCoefficient([0, 0])).toBe(0);
  });

  it('Gini 係數：完全平均為 0', () => {
    expect(giniCoefficient([5, 5, 5, 5])).toBeCloseTo(0, 10);
  });

  it('Gini 係數：高度集中時接近 1', () => {
    expect(giniCoefficient([100, 1, 1, 1])).toBeGreaterThan(0.7);
  });

  it('Gini 係數：空輸入回 0', () => {
    expect(giniCoefficient([])).toBe(0);
  });

  it('充分分散的鏈不成立他人努力要件', () => {
    const profile = decentralizationProfile({
      nakamotoCoefficient: 28,
      gini: 0.51,
      countryCount: 47,
      top5CountryShare: 0.51,
      stakingRatio: 0.56,
      usageDensity: 0.0084,
      singleEntityControl: false,
      governanceConcentration: 0.35,
    });
    expect(profile.band).toBe('diffuse');
    expect(profile.effortsOfOthers).toBe(false);
    expect(profile.caveat).toContain('不能取代整個 Howey 測試');
  });

  it('單一實體可控時即使指標良好仍判為集中', () => {
    const profile = decentralizationProfile({
      nakamotoCoefficient: 2,
      gini: 0.92,
      countryCount: 1,
      top5CountryShare: 1,
      stakingRatio: 0,
      usageDensity: 0.0002,
      singleEntityControl: true,
      governanceConcentration: 0.88,
    });
    expect(profile.band).toBe('centralized');
    expect(profile.effortsOfOthers).toBe(true);
    expect(profile.reasons.join('')).toContain('單一實體');
  });

  it('中等指標落入發展中區間', () => {
    const profile = decentralizationProfile({
      nakamotoCoefficient: 10,
      gini: 0.65,
      countryCount: 30,
      top5CountryShare: 0.7,
      stakingRatio: 0.4,
      usageDensity: 0.005,
      singleEntityControl: false,
      governanceConcentration: 0.3,
    });
    expect(profile.band).toBe('emerging');
    expect(profile.effortsOfOthers).toBe(true);
  });

  it('鏈基準資料可依名稱查找且大小寫不敏感', () => {
    expect(CHAIN_BENCHMARKS).toHaveLength(3);
    expect(findChainBenchmark('ethereum')?.nakamotoCoefficient).toBe(4);
    expect(findChainBenchmark('AVALANCHE')?.gini).toBe(0.51);
    expect(findChainBenchmark('unknown')).toBeUndefined();
  });

  it('Ripple 判決以交易情境區分法律地位', () => {
    expect(RIPPLE_HOLDINGS).toHaveLength(3);
    expect(findRippleHolding('institutional')?.investmentContract).toBe(true);
    expect(findRippleHolding('programmatic')?.investmentContract).toBe(false);
    expect(findRippleHolding('secondary_market')?.buyerKnowsCounterparty).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 活動本質測試                                                        */
/* ------------------------------------------------------------------ */

const passiveInfrastructure: ActivitySubstanceInput = {
  role: 'validator',
  regularBusinessForOthers: false,
  transactionBasedCompensation: false,
  activeSolicitation: false,
  actsAsMiddleman: false,
  custodyClientAssets: false,
  discretionaryAuthority: false,
  passiveTechnicalFunction: true,
  fixedOrUsageFee: true,
  personalizedAdvice: false,
  publisherException: false,
};

describe('活動本質測試', () => {
  it('純技術角色無核心因素時歸為基礎設施', () => {
    const result = activitySubstanceTest(passiveInfrastructure);
    expect(result.classification).toBe('infrastructure');
    expect(result.coreFactors).toHaveLength(0);
    expect(result.roleLabel).toBe('驗證者');
    expect(result.note).toContain('基礎設施提供者');
  });

  it('出現任一核心因素即歸為中介', () => {
    const result = activitySubstanceTest({
      ...passiveInfrastructure,
      role: 'broker',
      transactionBasedCompensation: true,
    });
    expect(result.classification).toBe('intermediary');
    expect(result.coreFactors).toHaveLength(1);
    expect(result.blockers).toEqual(result.coreFactors);
  });

  it('否定因素不能抵銷核心因素', () => {
    const result = activitySubstanceTest({
      ...passiveInfrastructure,
      role: 'broker',
      actsAsMiddleman: true,
      passiveTechnicalFunction: true,
      fixedOrUsageFee: true,
      publisherException: true,
    });
    expect(result.classification).toBe('intermediary');
    expect(result.negativeFactors.length).toBeGreaterThanOrEqual(4);
  });

  it('七項核心因素全部列出', () => {
    const result = activitySubstanceTest({
      role: 'investment_adviser',
      regularBusinessForOthers: true,
      transactionBasedCompensation: true,
      activeSolicitation: true,
      actsAsMiddleman: true,
      custodyClientAssets: true,
      discretionaryAuthority: true,
      passiveTechnicalFunction: false,
      fixedOrUsageFee: false,
      personalizedAdvice: true,
      publisherException: false,
    });
    expect(result.coreFactors).toHaveLength(7);
  });

  it('中介角色標籤可正確解析', () => {
    const result = activitySubstanceTest({ ...passiveInfrastructure, role: 'investment_adviser' });
    expect(result.roleLabel).toBe('投資顧問');
  });

  it('三項豁免論證齊備', () => {
    expect(EXEMPTION_ARGUMENTS).toHaveLength(3);
    expect(EXEMPTION_ARGUMENTS.map((entry) => entry.argument)).toEqual(['analogy', 'function', 'risk']);
  });

  it('四類基礎設施角色各有關鍵區分', () => {
    expect(INFRASTRUCTURE_ROLE_ASSESSMENTS).toHaveLength(4);
    for (const entry of INFRASTRUCTURE_ROLE_ASSESSMENTS) {
      expect(entry.boundary.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 不採取行動信函                                                      */
/* ------------------------------------------------------------------ */

const passivePlatform: NoActionInput = {
  participatesInTradingDecisions: false,
  managesClientRelationships: false,
  executesTrades: false,
  recommendsSpecificSecurities: false,
  negotiatesBetweenParties: false,
  selectsCounterparties: false,
  compensationKind: 'fixed',
};

describe('不採取行動信函三原則', () => {
  it('三原則齊備時落入豁免', () => {
    const result = noActionLetterCheck(passivePlatform);
    expect(result.exempt).toBe(true);
    expect(result.principles).toHaveLength(3);
    expect(result.blockers).toHaveLength(0);
  });

  it('使用量基礎報酬仍符合報酬結構原則', () => {
    const result = noActionLetterCheck({ ...passivePlatform, compensationKind: 'usage' });
    expect(result.exempt).toBe(true);
  });

  it('交易基礎報酬破壞報酬結構原則', () => {
    const result = noActionLetterCheck({ ...passivePlatform, compensationKind: 'transaction' });
    expect(result.exempt).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain('交易基礎');
  });

  it('參與交易決策破壞被動性', () => {
    const result = noActionLetterCheck({ ...passivePlatform, participatesInTradingDecisions: true });
    expect(result.exempt).toBe(false);
    expect(result.principles.find((entry) => entry.principle === 'passivity')?.satisfied).toBe(false);
  });

  it('推薦特定證券破壞中立性', () => {
    const result = noActionLetterCheck({ ...passivePlatform, recommendsSpecificSecurities: true });
    expect(result.exempt).toBe(false);
    expect(result.principles.find((entry) => entry.principle === 'neutrality')?.satisfied).toBe(false);
  });

  it('三原則全破時列出三項阻擋', () => {
    const result = noActionLetterCheck({
      participatesInTradingDecisions: true,
      managesClientRelationships: true,
      executesTrades: true,
      recommendsSpecificSecurities: true,
      negotiatesBetweenParties: true,
      selectsCounterparties: true,
      compensationKind: 'transaction',
    });
    expect(result.blockers).toHaveLength(3);
  });

  it('三原則標籤齊備', () => {
    expect(Object.keys(NO_ACTION_PRINCIPLE_LABELS)).toEqual([
      'passivity',
      'neutrality',
      'compensation_structure',
    ]);
  });

  it('九個先例涵蓋經紀商與投資顧問兩類', () => {
    expect(NO_ACTION_PRECEDENTS).toHaveLength(9);
    expect(NO_ACTION_PRECEDENTS.filter((entry) => entry.category === 'broker').length).toBeGreaterThan(0);
    expect(NO_ACTION_PRECEDENTS.filter((entry) => entry.category === 'adviser').length).toBeGreaterThan(0);
  });

  it('四層審計與三類安全模式觸發齊備', () => {
    expect(AUDIT_LAYERS).toHaveLength(4);
    expect(SAFE_MODE_TRIGGERS).toHaveLength(3);
    expect(SAFE_MODE_TRIGGERS.map((entry) => entry.trigger)).toEqual([
      'code_vulnerability',
      'legal_conflict',
      'governance_abuse',
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* 技術功能內在性                                                      */
/* ------------------------------------------------------------------ */

const selfStaking: IntrinsicalityInput = {
  function: 'staking',
  intrinsicToProtocol: true,
  necessaryForOperation: true,
  capitalContribution: false,
  commonEnterprise: false,
  profitExpectation: false,
  issuerRelationship: false,
  consumptiveUse: true,
  custodialStaking: false,
};

describe('技術功能內在性', () => {
  it('自行質押不構成證券交易', () => {
    const result = intrinsicalityTest(selfStaking);
    expect(result.nonSecurity).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.arguments.join('')).toContain('自行質押');
  });

  it('託管質押產生阻擋項', () => {
    const result = intrinsicalityTest({ ...selfStaking, custodialStaking: true });
    expect(result.nonSecurity).toBe(false);
    expect(result.blockers.join('')).toContain('委託第三方質押服務商');
  });

  it('存在發行人關係時回到資產本質審查', () => {
    const result = intrinsicalityTest({ ...selfStaking, issuerRelationship: true });
    expect(result.nonSecurity).toBe(false);
    expect(result.blockers.join('')).toContain('發行人關係');
  });

  it('功能非協議必要時屬外部附加活動', () => {
    const result = intrinsicalityTest({ ...selfStaking, necessaryForOperation: false });
    expect(result.nonSecurity).toBe(false);
    expect(result.blockers.join('')).toContain('外部附加活動');
  });

  it('Howey 四要件齊備時技術外觀不能排除投資契約', () => {
    const result = intrinsicalityTest({
      function: 'reward_distribution',
      intrinsicToProtocol: true,
      necessaryForOperation: true,
      capitalContribution: true,
      commonEnterprise: true,
      profitExpectation: true,
      issuerRelationship: true,
      consumptiveUse: false,
      custodialStaking: true,
    });
    expect(result.nonSecurity).toBe(false);
    expect(result.howey.isInvestmentContract).toBe(true);
    expect(result.blockers.join('')).toContain('Howey 四要件齊備');
  });

  it('九項技術功能與標籤齊備', () => {
    expect(TECHNOLOGY_FUNCTIONS).toHaveLength(9);
    for (const fn of TECHNOLOGY_FUNCTIONS) {
      expect(TECHNOLOGY_FUNCTION_LABELS[fn]).toBeTruthy();
    }
  });

  it('監管對稱性五列齊備', () => {
    expect(REGULATORY_SYMMETRY).toHaveLength(5);
    expect(REGULATORY_SYMMETRY.map((row) => row.function)).toContain('清算結算');
  });

  it('Gas 市場證據支持競爭性結論', () => {
    expect(GAS_MARKET_EVIDENCE.baseFeeMedianGwei).toBe(12);
    expect(GAS_MARKET_EVIDENCE.mechanism).toContain('EIP-1559');
    expect(GAS_MARKET_EVIDENCE.conclusion).toContain('非單一中介');
  });

  it('稅務與會計六個層次齊備', () => {
    expect(Object.keys(TAX_ACCOUNTING_LAYER_LABELS)).toHaveLength(6);
    expect(TECHNOLOGY_TAX_TREATMENTS).toHaveLength(6);
    for (const row of TECHNOLOGY_TAX_TREATMENTS) {
      expect(row.authority.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 協議代幣兩階段模型                                                  */
/* ------------------------------------------------------------------ */

describe('協議代幣兩階段模型', () => {
  it('定義排除三類權利', () => {
    expect(PROTOCOL_TOKEN_DEFINITION.exclusions).toHaveLength(3);
    expect(PROTOCOL_TOKEN_DEFINITION.coreElements).toHaveLength(5);
  });

  it('符合定義者為協議代幣', () => {
    const result = isProtocolToken({
      intangible: true,
      fungible: true,
      indispensableToProtocol: true,
      grantsDebtOrEquity: false,
      grantsLiquidationRight: false,
      grantsIncomeDistribution: false,
    });
    expect(result.isProtocolToken).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('賦予收益分配權者不是協議代幣', () => {
    const result = isProtocolToken({
      intangible: true,
      fungible: true,
      indispensableToProtocol: true,
      grantsDebtOrEquity: false,
      grantsLiquidationRight: false,
      grantsIncomeDistribution: true,
    });
    expect(result.isProtocolToken).toBe(false);
    expect(result.blockers).toHaveLength(1);
  });

  it('三項排除事由同時成立時列出三項阻擋', () => {
    const result = isProtocolToken({
      intangible: false,
      fungible: false,
      indispensableToProtocol: false,
      grantsDebtOrEquity: true,
      grantsLiquidationRight: true,
      grantsIncomeDistribution: true,
    });
    expect(result.blockers).toHaveLength(6);
  });

  it('三項條件齊備時進入功能階段', () => {
    const result = protocolTokenStage({
      programmedAsIndispensable: true,
      deployedForActualUse: true,
      coreFeaturesComplete: true,
      singleIssuerEfforts: false,
    });
    expect(result.stage).toBe('functional');
    expect(result.rebuttablePresumption).toBe(false);
    expect(result.exemptions).toHaveLength(0);
  });

  it('任一條件未滿足即留在前功能階段', () => {
    const result = protocolTokenStage({
      programmedAsIndispensable: true,
      deployedForActualUse: false,
      coreFeaturesComplete: true,
      singleIssuerEfforts: true,
    });
    expect(result.stage).toBe('pre_functionality');
    expect(result.rebuttablePresumption).toBe(true);
    expect(result.exemptions).toHaveLength(3);
  });

  it('階段標籤齊備', () => {
    expect(PROTOCOL_TOKEN_STAGE_LABELS.pre_functionality).toBe('功能前階段');
    expect(PROTOCOL_TOKEN_STAGE_LABELS.functional).toBe('功能階段');
  });

  it('Regulation PT 上限取兩者之較高者', () => {
    const small = regulationPtCheck({
      offeringUsd: 10_000_000,
      outstandingUsd: 100_000_000,
      buyerAgreementsRecorded: true,
      filedWithSec: true,
      amlKycScreening: true,
    });
    expect(small.capUsd).toBe(50_000_000);
    expect(small.eligible).toBe(true);
    expect(small.headroomUsd).toBe(40_000_000);

    const large = regulationPtCheck({
      offeringUsd: 10_000_000,
      outstandingUsd: 1_000_000_000,
      buyerAgreementsRecorded: true,
      filedWithSec: true,
      amlKycScreening: true,
    });
    expect(large.capUsd).toBe(100_000_000);
  });

  it('超過上限與三項程序缺失同時列出', () => {
    const result = regulationPtCheck({
      offeringUsd: 60_000_000,
      outstandingUsd: 0,
      buyerAgreementsRecorded: false,
      filedWithSec: false,
      amlKycScreening: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toHaveLength(4);
    expect(result.headroomUsd).toBe(0);
  });

  it('Regulation PT 四項要求齊備', () => {
    expect(REGULATION_PT.requirements).toHaveLength(4);
    expect(REGULATION_PT.filingDeadlineDays).toBe(30);
  });

  it('DeFi 活動符合去中心化架構時排除於交易法範圍', () => {
    const result = defiExclusion({
      deploysSmartContracts: true,
      providesLiquidity: false,
      decentralizedGovernance: false,
      singlePointOfFailure: false,
      centralAuthorityCanAlterData: false,
      registeredIntermediaryOffersAccess: false,
    });
    expect(result.excluded).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('存在單點故障時不得排除', () => {
    const result = defiExclusion({
      deploysSmartContracts: true,
      providesLiquidity: false,
      decentralizedGovernance: false,
      singlePointOfFailure: true,
      centralAuthorityCanAlterData: true,
      registeredIntermediaryOffersAccess: false,
    });
    expect(result.excluded).toBe(false);
    expect(result.blockers).toHaveLength(2);
  });

  it('排除不等於免責：註冊中介仍負 AML 義務', () => {
    const result = defiExclusion({
      deploysSmartContracts: true,
      providesLiquidity: false,
      decentralizedGovernance: false,
      singlePointOfFailure: false,
      centralAuthorityCanAlterData: false,
      registeredIntermediaryOffersAccess: true,
    });
    expect(result.excluded).toBe(true);
    expect(result.retainedObligations.length).toBeGreaterThanOrEqual(3);
    expect(result.retainedObligations.join('')).toContain('反洗錢');
  });
});

/* ------------------------------------------------------------------ */
/* DAO 責任分配                                                        */
/* ------------------------------------------------------------------ */

describe('DAO 責任分配', () => {
  it('未登記 DAO 推定為普通合夥並負連帶責任', () => {
    const result = daoLiabilityTier({
      entityForm: 'none',
      governanceTransparent: false,
      memberLimitedLiability: false,
      minimumGovernanceStandards: false,
    });
    expect(result.generalPartnershipPresumption).toBe(true);
    expect(result.memberLiability).toBe('joint_and_several');
    expect(result.safeHarbor).toBe(false);
    expect(result.precedent).toContain('Sarcuni');
  });

  it('Wyoming DAO LLC 三項條件齊備時成立安全港', () => {
    const result = daoLiabilityTier({
      entityForm: 'wyoming_dao_llc',
      governanceTransparent: true,
      memberLimitedLiability: true,
      minimumGovernanceStandards: true,
    });
    expect(result.safeHarbor).toBe(true);
    expect(result.memberLiability).toBe('limited');
    expect(result.blockers).toHaveLength(0);
  });

  it('已登記但缺最低治理標準時安全港不成立', () => {
    const result = daoLiabilityTier({
      entityForm: 'tennessee_dao',
      governanceTransparent: true,
      memberLimitedLiability: true,
      minimumGovernanceStandards: false,
    });
    expect(result.safeHarbor).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.memberLiability).toBe('joint_and_several');
  });

  it('五種法人形式標籤齊備', () => {
    const forms: DaoEntityForm[] = ['none', 'wyoming_dao_llc', 'duna', 'tennessee_dao', 'utah_dao'];
    for (const form of forms) {
      expect(DAO_ENTITY_FORM_LABELS[form]).toBeTruthy();
    }
  });

  it('四類損害來源各有主要與次要責任人', () => {
    expect(DAO_DAMAGE_TIERS).toHaveLength(4);
    for (const tier of DAO_DAMAGE_TIERS) {
      expect(tier.primaryLiable.length).toBeGreaterThan(0);
      expect(tier.secondaryLiable.length).toBeGreaterThan(0);
    }
  });

  it('控制股東忠實義務門檻為 5%', () => {
    expect(CONTROL_HOLDER_THRESHOLD).toBe(0.05);
  });

  it('CLARITY Act 第 504 條以條件語氣表述', () => {
    const result = claritySection504({
      daoForm: 'duna',
      smartContractAutonomous: true,
      governanceTokenDistribution: true,
      federalStateInfoSharing: true,
    });
    expect(result.eligible).toBe(true);
    expect(result.phrasing).toContain('若');
    expect(result.conditions).toHaveLength(3);
  });

  it('未採法人形式時無法適用第 504 條安全港', () => {
    const result = claritySection504({
      daoForm: 'none',
      smartContractAutonomous: true,
      governanceTokenDistribution: true,
      federalStateInfoSharing: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* 跨境三層次解方                                                      */
/* ------------------------------------------------------------------ */

describe('跨境三層次解方', () => {
  it('三層次依序排列', () => {
    expect(CROSS_BORDER_TIERS).toHaveLength(3);
    expect(CROSS_BORDER_TIERS.map((tier) => tier.order)).toEqual([1, 2, 3]);
  });

  it('三層次全部達成時可跨境流通', () => {
    const result = crossBorderSolution({
      mutualRecognition: true,
      whitePaperDisclosed: true,
      auditReportDisclosed: true,
      coreTeamDisclosed: true,
      incidentSharingChannel: true,
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.tiers.every((tier) => tier.satisfied)).toBe(true);
  });

  it('分層申報需三項揭露齊備', () => {
    const result = crossBorderSolution({
      mutualRecognition: true,
      whitePaperDisclosed: true,
      auditReportDisclosed: false,
      coreTeamDisclosed: true,
      incidentSharingChannel: true,
    });
    expect(result.ready).toBe(false);
    expect(result.tiers.find((tier) => tier.tier === 'tiered_reporting')?.satisfied).toBe(false);
    expect(result.blockers).toHaveLength(1);
  });

  it('全部未達成時列出五項阻擋', () => {
    const result = crossBorderSolution({
      mutualRecognition: false,
      whitePaperDisclosed: false,
      auditReportDisclosed: false,
      coreTeamDisclosed: false,
      incidentSharingChannel: false,
    });
    expect(result.blockers).toHaveLength(5);
  });

  it('Mt. Gox 教訓指出國際私法失靈', () => {
    expect(MT_GOX_LESSON.year).toBe(2014);
    expect(MT_GOX_LESSON.lesson).toContain('住所地原則');
  });
});

/* ------------------------------------------------------------------ */
/* 三重奏綜合判斷                                                      */
/* ------------------------------------------------------------------ */

const securityToken: TokenClassificationInput = {
  representsTangibleAsset: false,
  representsServiceClaim: false,
  representsFinancialClaim: true,
  indispensableToProtocol: false,
  peggedToReference: false,
  resaleProfitIsPrimaryPurpose: true,
};

const brokerActivity: ActivitySubstanceInput = {
  role: 'broker',
  regularBusinessForOthers: true,
  transactionBasedCompensation: true,
  activeSolicitation: true,
  actsAsMiddleman: true,
  custodyClientAssets: true,
  discretionaryAuthority: false,
  passiveTechnicalFunction: false,
  fixedOrUsageFee: false,
  personalizedAdvice: false,
  publisherException: false,
};

describe('三重奏綜合判斷', () => {
  it('資產本質指向證券時其他環節不能抵銷', () => {
    const result = trinityAssessment({
      token: securityToken,
      howey: {
        moneyInvestment: true,
        commonEnterprise: true,
        profitExpectation: true,
        effortsOfOthers: true,
      },
      activity: passiveInfrastructure,
      technology: selfStaking,
    });
    expect(result.overall).toBe('security');
    expect(result.reasons.join('')).toContain('不能抵銷');
  });

  it('三環節均未出現證券定性時落入基礎設施豁免', () => {
    const result = trinityAssessment({
      token: {
        representsTangibleAsset: false,
        representsServiceClaim: false,
        representsFinancialClaim: false,
        indispensableToProtocol: true,
        peggedToReference: false,
        resaleProfitIsPrimaryPurpose: false,
      },
      howey: {
        moneyInvestment: false,
        commonEnterprise: false,
        profitExpectation: false,
        effortsOfOthers: false,
      },
      activity: passiveInfrastructure,
      technology: selfStaking,
    });
    expect(result.overall).toBe('infrastructure_exempt');
    expect(result.activityClassification).toBe('infrastructure');
    expect(result.technologyNonSecurity).toBe(true);
  });

  it('部分環節未通過時須個案審查', () => {
    const result = trinityAssessment({
      token: {
        representsTangibleAsset: false,
        representsServiceClaim: false,
        representsFinancialClaim: false,
        indispensableToProtocol: true,
        peggedToReference: false,
        resaleProfitIsPrimaryPurpose: false,
      },
      howey: {
        moneyInvestment: false,
        commonEnterprise: false,
        profitExpectation: false,
        effortsOfOthers: false,
      },
      activity: brokerActivity,
      technology: selfStaking,
    });
    expect(result.overall).toBe('needs_review');
    expect(result.activityClassification).toBe('intermediary');
  });

  it('綜合判斷標籤齊備', () => {
    expect(TRINITY_OVERALL_LABELS.security).toBe('構成證券');
    expect(TRINITY_OVERALL_LABELS.infrastructure_exempt).toBe('基礎設施豁免');
    expect(TRINITY_OVERALL_LABELS.needs_review).toBe('須個案審查');
  });
});
