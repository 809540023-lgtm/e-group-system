import { query } from './db.ts';
import {
  AUDIT_LAYERS,
  CHAIN_BENCHMARKS,
  CROSS_BORDER_TIERS,
  DAO_DAMAGE_TIERS,
  DAO_ENTITY_FORM_LABELS,
  DECENTRALIZATION_DEFINITIONS,
  DECENTRALIZATION_INFEASIBILITY,
  EXEMPTION_ARGUMENTS,
  GAS_MARKET_EVIDENCE,
  INFRASTRUCTURE_ROLE_ASSESSMENTS,
  INFRASTRUCTURE_ROLE_LABELS,
  INTERMEDIARY_ROLE_LABELS,
  MT_GOX_LESSON,
  NO_ACTION_PRECEDENTS,
  NO_ACTION_PRINCIPLE_LABELS,
  PROTOCOL_TOKEN_DEFINITION,
  PROTOCOL_TOKEN_STAGE_LABELS,
  REGULATION_PT,
  REGULATORY_SYMMETRY,
  RIPPLE_HOLDINGS,
  SAFE_MODE_TRIGGERS,
  TECHNOLOGY_FUNCTION_LABELS,
  TECHNOLOGY_TAX_TREATMENTS,
  TOKEN_CLASSES,
  TOKEN_CLASS_LABELS,
  TRINITY_OVERALL_LABELS,
  TRINITY_PILLARS,
  UCC_ARTICLE_12,
  activitySubstanceTest,
  crossBorderSolution,
  decentralizationProfile,
  intrinsicalityTest,
  isProtocolToken,
  noActionLetterCheck,
  protocolTokenStage,
  regulationPtCheck,
  trinityAssessment,
  type ActivitySubstanceResult,
  type CrossBorderSolutionResult,
  type DecentralizationProfile,
  type IntrinsicalityResult,
  type NoActionResult,
  type ProtocolTokenResult,
  type ProtocolTokenStageResult,
  type RegulationPtResult,
  type TrinityAssessmentResult,
} from '@eg/meal';

/* ------------------------------------------------------------------ */
/* 代幣分類（論文第二章）                                              */
/* ------------------------------------------------------------------ */

export interface TokenClassificationRow {
  id: string;
  symbol: string;
  name: string;
  token_class: string;
  represents_tangible: boolean;
  represents_service: boolean;
  represents_financial: boolean;
  indispensable: boolean;
  pegged_to_reference: boolean;
  resale_profit_primary: boolean;
  securities_risk: string;
  howey_needed: boolean;
  howey_money_investment: boolean;
  howey_common_enterprise: boolean;
  howey_profit_expectation: boolean;
  howey_efforts_of_others: boolean;
  legal_analogy: string | null;
  regulator: string | null;
  note: string | null;
}

export async function listTokenClassifications(): Promise<TokenClassificationRow[]> {
  return query<TokenClassificationRow>(
    `SELECT id, symbol, name, token_class, represents_tangible, represents_service,
            represents_financial, indispensable, pegged_to_reference, resale_profit_primary,
            securities_risk, howey_needed, howey_money_investment, howey_common_enterprise,
            howey_profit_expectation, howey_efforts_of_others, legal_analogy, regulator, note
       FROM token_classifications
      ORDER BY CASE securities_risk WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, symbol`,
  );
}

export function tokenClassLabel(tokenClass: string): string {
  return TOKEN_CLASS_LABELS[tokenClass as keyof typeof TOKEN_CLASS_LABELS] ?? tokenClass;
}

/* ------------------------------------------------------------------ */
/* 去中心化計量（論文第三章）                                          */
/* ------------------------------------------------------------------ */

export interface DecentralizationSnapshotRow {
  id: string;
  chain: string;
  measured_on: string;
  nakamoto_coefficient: number;
  gini: string;
  country_count: number;
  top5_country_share: string;
  staking_ratio: string;
  usage_density: string;
  single_entity_control: boolean;
  governance_concentration: string;
  band: string;
  efforts_of_others: boolean;
  source: string | null;
  note: string | null;
}

export async function listDecentralizationSnapshots(): Promise<DecentralizationSnapshotRow[]> {
  return query<DecentralizationSnapshotRow>(
    `SELECT id, chain, to_char(measured_on, 'YYYY-MM-DD') AS measured_on,
            nakamoto_coefficient, gini, country_count, top5_country_share,
            staking_ratio, usage_density, single_entity_control, governance_concentration,
            band, efforts_of_others, source, note
       FROM decentralization_snapshots
      ORDER BY nakamoto_coefficient DESC, chain`,
  );
}

export function decentralizationOf(input: {
  nakamotoCoefficient: number;
  gini: number;
  countryCount: number;
  top5CountryShare: number;
  stakingRatio: number;
  usageDensity: number;
  singleEntityControl: boolean;
  governanceConcentration: number;
}): DecentralizationProfile {
  return decentralizationProfile(input);
}

/* ------------------------------------------------------------------ */
/* 活動本質（論文第四章）                                              */
/* ------------------------------------------------------------------ */

export interface ActivityAssessmentRow {
  id: string;
  subject: string;
  role: string;
  classification: string;
  core_factors: readonly string[];
  negative_factors: readonly string[];
  blockers: readonly string[];
  passivity_satisfied: boolean;
  neutrality_satisfied: boolean;
  compensation_satisfied: boolean;
  compensation_kind: string;
  exempt: boolean;
  assessed_on: string;
  note: string | null;
}

export async function listActivityAssessments(): Promise<ActivityAssessmentRow[]> {
  return query<ActivityAssessmentRow>(
    `SELECT id, subject, role, classification, core_factors, negative_factors, blockers,
            passivity_satisfied, neutrality_satisfied, compensation_satisfied,
            compensation_kind, exempt, to_char(assessed_on, 'YYYY-MM-DD') AS assessed_on, note
       FROM activity_substance_assessments
      ORDER BY exempt DESC, subject`,
  );
}

export function roleLabel(role: string): string {
  return (
    INFRASTRUCTURE_ROLE_LABELS[role as keyof typeof INFRASTRUCTURE_ROLE_LABELS] ??
    INTERMEDIARY_ROLE_LABELS[role as keyof typeof INTERMEDIARY_ROLE_LABELS] ??
    role
  );
}

export function assessActivity(input: Parameters<typeof activitySubstanceTest>[0]): ActivitySubstanceResult {
  return activitySubstanceTest(input);
}

/* ------------------------------------------------------------------ */
/* 不採取行動信函（論文第五章）                                        */
/* ------------------------------------------------------------------ */

export interface NoActionPrecedentRow {
  id: string;
  reference: string;
  decided_on: string;
  category: string;
  subject: string;
  principle: string;
  source: string | null;
}

export async function listNoActionPrecedents(): Promise<NoActionPrecedentRow[]> {
  return query<NoActionPrecedentRow>(
    `SELECT id, reference, to_char(decided_on, 'YYYY-MM-DD') AS decided_on,
            category, subject, principle, source
       FROM no_action_precedents
      ORDER BY decided_on`,
  );
}

export function principleLabel(principle: string): string {
  return NO_ACTION_PRINCIPLE_LABELS[principle as keyof typeof NO_ACTION_PRINCIPLE_LABELS] ?? principle;
}

export function checkNoAction(input: Parameters<typeof noActionLetterCheck>[0]): NoActionResult {
  return noActionLetterCheck(input);
}

/* ------------------------------------------------------------------ */
/* 技術功能內在性（論文第六章）                                        */
/* ------------------------------------------------------------------ */

export interface TechnologyFunctionRow {
  id: string;
  token_symbol: string;
  function: string;
  intrinsic_to_protocol: boolean;
  necessary_for_operation: boolean;
  capital_contribution: boolean;
  common_enterprise: boolean;
  profit_expectation: boolean;
  issuer_relationship: boolean;
  consumptive_use: boolean;
  custodial_staking: boolean;
  non_security: boolean;
  blockers: readonly string[];
  assessed_on: string;
  note: string | null;
}

export async function listTechnologyFunctions(): Promise<TechnologyFunctionRow[]> {
  return query<TechnologyFunctionRow>(
    `SELECT id, token_symbol, function, intrinsic_to_protocol, necessary_for_operation,
            capital_contribution, common_enterprise, profit_expectation, issuer_relationship,
            consumptive_use, custodial_staking, non_security, blockers,
            to_char(assessed_on, 'YYYY-MM-DD') AS assessed_on, note
       FROM technology_function_assessments
      ORDER BY token_symbol, non_security DESC, function`,
  );
}

export function functionLabel(fn: string): string {
  return TECHNOLOGY_FUNCTION_LABELS[fn as keyof typeof TECHNOLOGY_FUNCTION_LABELS] ?? fn;
}

export function checkIntrinsicality(input: Parameters<typeof intrinsicalityTest>[0]): IntrinsicalityResult {
  return intrinsicalityTest(input);
}

/* ------------------------------------------------------------------ */
/* 協議代幣兩階段模型（論文第七章）                                    */
/* ------------------------------------------------------------------ */

export interface ProtocolTokenStageRow {
  id: string;
  token_symbol: string;
  stage: string;
  programmed_as_indispensable: boolean;
  deployed_for_actual_use: boolean;
  core_features_complete: boolean;
  single_issuer_efforts: boolean;
  regulation_pt_used: boolean;
  regulation_pt_cap_usd: string | null;
  regulation_pt_offering_usd: string | null;
  transitioned_at: string | null;
  note: string | null;
}

export async function listProtocolTokenStages(): Promise<ProtocolTokenStageRow[]> {
  return query<ProtocolTokenStageRow>(
    `SELECT id, token_symbol, stage, programmed_as_indispensable, deployed_for_actual_use,
            core_features_complete, single_issuer_efforts, regulation_pt_used,
            regulation_pt_cap_usd, regulation_pt_offering_usd,
            to_char(transitioned_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS transitioned_at,
            note
       FROM protocol_token_stages
      ORDER BY CASE stage WHEN 'pre_functionality' THEN 0 ELSE 1 END, token_symbol`,
  );
}

export interface ProtocolTokenTransitionRow {
  id: string;
  token_symbol: string;
  from_stage: string;
  to_stage: string;
  decision_code: string;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export async function listProtocolTokenTransitions(): Promise<ProtocolTokenTransitionRow[]> {
  return query<ProtocolTokenTransitionRow>(
    `SELECT id, token_symbol, from_stage, to_stage, decision_code, actor_id, note,
            to_char(created_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS') AS created_at
       FROM protocol_token_transitions
      ORDER BY created_at DESC`,
  );
}

export function stageLabel(stage: string): string {
  return PROTOCOL_TOKEN_STAGE_LABELS[stage as keyof typeof PROTOCOL_TOKEN_STAGE_LABELS] ?? stage;
}

export function checkProtocolToken(input: Parameters<typeof isProtocolToken>[0]): ProtocolTokenResult {
  return isProtocolToken(input);
}

export function checkProtocolTokenStage(
  input: Parameters<typeof protocolTokenStage>[0],
): ProtocolTokenStageResult {
  return protocolTokenStage(input);
}

export function checkRegulationPt(input: Parameters<typeof regulationPtCheck>[0]): RegulationPtResult {
  return regulationPtCheck(input);
}

/* ------------------------------------------------------------------ */
/* DAO 責任分配（論文第七章第四節）                                    */
/* ------------------------------------------------------------------ */

export interface DaoRegistrationRow {
  id: string;
  name: string;
  entity_form: string;
  governance_transparent: boolean;
  member_limited_liability: boolean;
  minimum_governance_standards: boolean;
  general_partnership_presumption: boolean;
  safe_harbor: boolean;
  control_holder_threshold: string;
  registered_on: string | null;
  note: string | null;
}

export async function listDaoRegistrations(): Promise<DaoRegistrationRow[]> {
  return query<DaoRegistrationRow>(
    `SELECT id, name, entity_form, governance_transparent, member_limited_liability,
            minimum_governance_standards, general_partnership_presumption, safe_harbor,
            control_holder_threshold, to_char(registered_on, 'YYYY-MM-DD') AS registered_on, note
       FROM dao_registrations
      ORDER BY safe_harbor DESC, name`,
  );
}

export function daoFormLabel(form: string): string {
  return DAO_ENTITY_FORM_LABELS[form as keyof typeof DAO_ENTITY_FORM_LABELS] ?? form;
}

/* ------------------------------------------------------------------ */
/* 跨境三層次解方（論文第七章第五節）                                  */
/* ------------------------------------------------------------------ */

export interface CrossBorderTierRow {
  id: string;
  token_symbol: string;
  tier: string;
  satisfied: boolean;
  requirement: string;
  reference: string | null;
  assessed_on: string;
  note: string | null;
}

export async function listCrossBorderTiers(): Promise<CrossBorderTierRow[]> {
  return query<CrossBorderTierRow>(
    `SELECT id, token_symbol, tier, satisfied, requirement, reference,
            to_char(assessed_on, 'YYYY-MM-DD') AS assessed_on, note
       FROM cross_border_tier_assessments
      ORDER BY token_symbol, CASE tier
                 WHEN 'framework_alignment' THEN 0
                 WHEN 'tiered_reporting' THEN 1
                 ELSE 2
               END`,
  );
}

export function checkCrossBorderSolution(
  input: Parameters<typeof crossBorderSolution>[0],
): CrossBorderSolutionResult {
  return crossBorderSolution(input);
}

/* ------------------------------------------------------------------ */
/* 三重奏綜合評估（論文第八章）                                        */
/* ------------------------------------------------------------------ */

export function assessTrinity(input: Parameters<typeof trinityAssessment>[0]): TrinityAssessmentResult {
  return trinityAssessment(input);
}

export function overallLabel(overall: string): string {
  return TRINITY_OVERALL_LABELS[overall as keyof typeof TRINITY_OVERALL_LABELS] ?? overall;
}

/* ------------------------------------------------------------------ */
/* 摘要                                                                */
/* ------------------------------------------------------------------ */

export interface InfrastructureSummary {
  tokenCount: number;
  highRiskCount: number;
  chainCount: number;
  diffuseChainCount: number;
  assessmentCount: number;
  exemptCount: number;
  precedentCount: number;
  functionCount: number;
  nonSecurityFunctionCount: number;
  preFunctionalityCount: number;
  blockedTransitionCount: number;
  daoCount: number;
  daoHarborCount: number;
  tierSatisfiedCount: number;
  tierTotalCount: number;
}

export async function getInfrastructureSummary(): Promise<InfrastructureSummary> {
  const [tokens, chains, assessments, precedents, functions, stages, transitions, daos, tiers] =
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
    ]);

  return {
    tokenCount: tokens.length,
    highRiskCount: tokens.filter((row) => row.securities_risk === 'high').length,
    chainCount: chains.length,
    diffuseChainCount: chains.filter((row) => row.band === 'diffuse').length,
    assessmentCount: assessments.length,
    exemptCount: assessments.filter((row) => row.exempt).length,
    precedentCount: precedents.length,
    functionCount: functions.length,
    nonSecurityFunctionCount: functions.filter((row) => row.non_security).length,
    preFunctionalityCount: stages.filter((row) => row.stage === 'pre_functionality').length,
    blockedTransitionCount: transitions.filter((row) => row.decision_code === 'STAGE_REGRESSION_BLOCKED')
      .length,
    daoCount: daos.length,
    daoHarborCount: daos.filter((row) => row.safe_harbor).length,
    tierSatisfiedCount: tiers.filter((row) => row.satisfied).length,
    tierTotalCount: tiers.length,
  };
}

/* ------------------------------------------------------------------ */
/* 靜態參考資料                                                        */
/* ------------------------------------------------------------------ */

export const REFERENCE = {
  trinity: TRINITY_PILLARS,
  tokenClasses: TOKEN_CLASSES,
  uccArticle12: UCC_ARTICLE_12,
  decentralizationDefinitions: DECENTRALIZATION_DEFINITIONS,
  decentralizationInfeasibility: DECENTRALIZATION_INFEASIBILITY,
  chainBenchmarks: CHAIN_BENCHMARKS,
  rippleHoldings: RIPPLE_HOLDINGS,
  exemptionArguments: EXEMPTION_ARGUMENTS,
  noActionPrecedents: NO_ACTION_PRECEDENTS,
  roleAssessments: INFRASTRUCTURE_ROLE_ASSESSMENTS,
  auditLayers: AUDIT_LAYERS,
  safeModeTriggers: SAFE_MODE_TRIGGERS,
  regulatorySymmetry: REGULATORY_SYMMETRY,
  gasMarket: GAS_MARKET_EVIDENCE,
  taxTreatments: TECHNOLOGY_TAX_TREATMENTS,
  protocolTokenDefinition: PROTOCOL_TOKEN_DEFINITION,
  regulationPt: REGULATION_PT,
  daoDamageTiers: DAO_DAMAGE_TIERS,
  crossBorderTiers: CROSS_BORDER_TIERS,
  mtGox: MT_GOX_LESSON,
} as const;
