import { one, query } from './db.ts';
import {
  complianceCost,
  concentrationReport,
  distributionWaterfall,
  rwaEligibility,
  rule144Lockup,
  stoGate,
  stressScenarios,
  type ComplianceCost,
  type ConcentrationReport,
  type Distribution,
  type RwaAssetInput,
  type RwaEligibility,
  type StoGate,
  type StoRequirement,
  type StressResult,
  type TokenAcquisition,
  type TokenState,
} from '@eg/meal';

/* ------------------------------------------------------------------ */
/* RWA                                                                 */
/* ------------------------------------------------------------------ */

export interface AssetPassportRow {
  id: string;
  asset_no: string;
  kind: string;
  serial_no: string | null;
  invoice_no: string | null;
  owner_legal_entity: string | null;
  location_station_id: string | null;
  station_name: string | null;
  maintenance_current: boolean;
  insurance_policy_no: string | null;
  insurance_expires_on: string | null;
  appraised_value_twd: number | null;
  appraisal_date: string | null;
  appraiser: string | null;
  existing_lien_twd: number;
  lien_holder: string | null;
  lease_id: string | null;
  rwa_eligible: boolean;
  eligibility_score: number;
  eligibility_blockers: unknown;
  eligibility_warnings: unknown;
  evaluated_at: string | null;
}

export async function listAssetPassports(): Promise<AssetPassportRow[]> {
  return query<AssetPassportRow>(
    `SELECT p.id, p.asset_no, p.kind, p.serial_no, p.invoice_no, p.owner_legal_entity,
            p.location_station_id, s.name AS station_name, p.maintenance_current,
            p.insurance_policy_no,
            to_char(p.insurance_expires_on, 'YYYY-MM-DD') AS insurance_expires_on,
            p.appraised_value_twd,
            to_char(p.appraisal_date, 'YYYY-MM-DD') AS appraisal_date,
            p.appraiser, p.existing_lien_twd, p.lien_holder, p.lease_id,
            p.rwa_eligible, p.eligibility_score, p.eligibility_blockers, p.eligibility_warnings,
            to_char(p.evaluated_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS evaluated_at
       FROM asset_passports p
       LEFT JOIN stations s ON s.id = p.location_station_id
      ORDER BY p.rwa_eligible DESC, p.eligibility_score DESC, p.asset_no`,
  );
}

export function passportToInput(row: AssetPassportRow, asOf: string): RwaAssetInput {
  return {
    kind: row.kind as RwaAssetInput['kind'],
    serialNo: row.serial_no,
    invoiceNo: row.invoice_no,
    ownerLegalEntity: row.owner_legal_entity,
    locationStationId: row.location_station_id,
    maintenanceCurrent: row.maintenance_current,
    insurancePolicyNo: row.insurance_policy_no,
    insuranceExpiresOn: row.insurance_expires_on,
    appraisedValueTwd: row.appraised_value_twd,
    appraisalDate: row.appraisal_date,
    existingLienTwd: row.existing_lien_twd,
    leaseId: row.lease_id,
    asOf,
  };
}

export interface RwaVehicleRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  legal_counsel: string | null;
  securities_firm: string | null;
  collection_account: string | null;
  maintenance_reserve_pct: string;
  senior_debt_twd: number;
  distributable_basis: string;
  disclosure_url: string | null;
  total_units: number;
  note: string | null;
  asset_count: string;
  allocated_twd: string;
}

export async function listRwaVehicles(): Promise<RwaVehicleRow[]> {
  return query<RwaVehicleRow>(
    `SELECT v.id, v.code, v.name, v.kind, v.status, v.legal_counsel, v.securities_firm,
            v.collection_account, v.maintenance_reserve_pct::text AS maintenance_reserve_pct,
            v.senior_debt_twd, v.distributable_basis, v.disclosure_url, v.total_units, v.note,
            (SELECT count(*) FROM rwa_vehicle_assets a WHERE a.vehicle_id = v.id)::text AS asset_count,
            (SELECT COALESCE(sum(a.allocated_twd), 0) FROM rwa_vehicle_assets a WHERE a.vehicle_id = v.id)::text AS allocated_twd
       FROM rwa_vehicles v
      ORDER BY v.code`,
  );
}

export interface RwaDistributionRow {
  id: string;
  vehicle_code: string;
  period_start: string;
  period_end: string;
  equipment_rent_twd: number;
  operating_revenue_twd: number;
  fees_twd: number;
  maintenance_reserve_twd: number;
  senior_debt_service_twd: number;
  distributable_twd: number;
  per_unit_twd: number;
  status: string;
  note: string | null;
}

export async function listRwaDistributions(limit = 12): Promise<RwaDistributionRow[]> {
  return query<RwaDistributionRow>(
    `SELECT r.id, v.code AS vehicle_code,
            to_char(r.period_start, 'YYYY-MM-DD') AS period_start,
            to_char(r.period_end, 'YYYY-MM-DD') AS period_end,
            r.equipment_rent_twd, r.operating_revenue_twd, r.fees_twd,
            r.maintenance_reserve_twd, r.senior_debt_service_twd,
            r.distributable_twd, r.per_unit_twd, r.status, r.note
       FROM rwa_distribution_runs r
       JOIN rwa_vehicles v ON v.id = r.vehicle_id
      ORDER BY r.period_end DESC, v.code
      LIMIT $1`,
    [limit],
  );
}

export interface RwaStressRow {
  id: string;
  vehicle_code: string;
  scenario: string;
  assumption: string;
  impact_twd: number;
  recovery_twd: number;
  shortfall_twd: number;
  principal_at_risk: boolean;
  evaluated_on: string;
}

export async function listRwaStress(): Promise<RwaStressRow[]> {
  return query<RwaStressRow>(
    `SELECT s.id, v.code AS vehicle_code, s.scenario, s.assumption,
            s.impact_twd, s.recovery_twd, s.shortfall_twd, s.principal_at_risk,
            to_char(s.evaluated_on, 'YYYY-MM-DD') AS evaluated_on
       FROM rwa_stress_scenarios s
       JOIN rwa_vehicles v ON v.id = s.vehicle_id
      ORDER BY v.code, s.scenario`,
  );
}

export interface RwaSummary {
  readonly passports: number;
  readonly eligible: number;
  readonly vehicles: number;
  readonly liveVehicles: number;
  readonly allocatedTwd: number;
  readonly lastDistributableTwd: number;
  readonly scenariosAtRisk: number;
}

export async function getRwaSummary(): Promise<RwaSummary> {
  const row = await one<{
    passports: string;
    eligible: string;
    vehicles: string;
    live_vehicles: string;
    allocated_twd: string;
    last_distributable: string;
    at_risk: string;
  }>(
    `SELECT
       (SELECT count(*) FROM asset_passports)::text AS passports,
       (SELECT count(*) FROM asset_passports WHERE rwa_eligible)::text AS eligible,
       (SELECT count(*) FROM rwa_vehicles)::text AS vehicles,
       (SELECT count(*) FROM rwa_vehicles WHERE status IN ('approved','issuing','live'))::text AS live_vehicles,
       (SELECT COALESCE(sum(allocated_twd), 0) FROM rwa_vehicle_assets)::text AS allocated_twd,
       (SELECT COALESCE(max(distributable_twd), 0) FROM rwa_distribution_runs)::text AS last_distributable,
       (SELECT count(*) FROM rwa_stress_scenarios WHERE principal_at_risk)::text AS at_risk`,
  );
  return {
    passports: Number(row?.passports ?? 0),
    eligible: Number(row?.eligible ?? 0),
    vehicles: Number(row?.vehicles ?? 0),
    liveVehicles: Number(row?.live_vehicles ?? 0),
    allocatedTwd: Number(row?.allocated_twd ?? 0),
    lastDistributableTwd: Number(row?.last_distributable ?? 0),
    scenariosAtRisk: Number(row?.at_risk ?? 0),
  };
}

/** 以資料庫現值重算護照資格，用於頁面顯示與寫回。 */
export function evaluatePassport(row: AssetPassportRow, asOf: string): RwaEligibility {
  return rwaEligibility(passportToInput(row, asOf));
}

export function previewDistribution(
  equipmentRentTwd: number,
  operatingRevenueTwd: number,
  feesTwd: number,
  maintenanceReservePct: number,
  seniorDebtTwd: number,
  units: number,
): Distribution {
  return distributionWaterfall({
    equipmentRentTwd,
    operatingRevenueTwd,
    feesTwd,
    maintenanceReservePct,
    seniorDebtServiceTwd: seniorDebtTwd,
    units,
  });
}

export function previewStress(input: {
  appraisedValueTwd: number;
  existingLienTwd: number;
  monthlyRentTwd: number;
  insuranceCoverageTwd: number;
  residualValueTwd: number;
  outstandingPrincipalTwd: number;
}): readonly StressResult[] {
  return stressScenarios(input);
}

/* ------------------------------------------------------------------ */
/* STO                                                                 */
/* ------------------------------------------------------------------ */

export interface StoProgramRow {
  id: string;
  code: string;
  name: string;
  stage: number;
  status: string;
  target_instrument: string;
  issuer_entity: string | null;
  tpex_regime: string | null;
  professional_investor_only: boolean;
  issuance_cap_twd: number | null;
  disclosure_doc_url: string | null;
  counsel_opinion_url: string | null;
  securities_firm: string | null;
  approved_on: string | null;
  note: string | null;
}

export async function listStoPrograms(): Promise<StoProgramRow[]> {
  return query<StoProgramRow>(
    `SELECT id, code, name, stage, status, target_instrument, issuer_entity, tpex_regime,
            professional_investor_only, issuance_cap_twd, disclosure_doc_url,
            counsel_opinion_url, securities_firm,
            to_char(approved_on, 'YYYY-MM-DD') AS approved_on, note
       FROM sto_programs
      ORDER BY code`,
  );
}

export interface StoRequirementRow {
  id: string;
  program_id: string;
  stage: number;
  key: string;
  label: string;
  category: string;
  status: StoRequirement['status'];
  blocking: boolean;
  evidence: string | null;
  owner: string | null;
  due_on: string | null;
}

export async function listStoRequirements(programId: string): Promise<StoRequirementRow[]> {
  return query<StoRequirementRow>(
    `SELECT id, program_id, stage, key, label, category, status, blocking, evidence, owner,
            to_char(due_on, 'YYYY-MM-DD') AS due_on
       FROM sto_requirements
      WHERE program_id = $1
      ORDER BY stage, category, label`,
    [programId],
  );
}

export interface StoGateView extends StoGate {
  readonly program: StoProgramRow;
}

export async function getStoGate(program: StoProgramRow): Promise<StoGateView> {
  const requirements = await listStoRequirements(program.id);
  const gate = stoGate({
    requirements: requirements.map((item) => ({
      stage: item.stage as StoRequirement['stage'],
      key: item.key,
      label: item.label,
      status: item.status,
      blocking: item.blocking,
    })),
    targetInstrument: program.target_instrument as 'equity' | 'debt' | 'equipment_right',
    professionalInvestorOnly: program.professional_investor_only,
    mixesInstruments: false,
    bindsMealPurchaseToDividend: false,
    promisesGuaranteedReturn: false,
  });
  return { ...gate, program };
}

export interface ComplianceAuditRow {
  id: string;
  program_code: string;
  layer: string;
  auditor: string;
  standard: string;
  status: string;
  report_url: string | null;
  performed_on: string | null;
  findings: string | null;
}

export async function listComplianceAudits(): Promise<ComplianceAuditRow[]> {
  return query<ComplianceAuditRow>(
    `SELECT a.id, p.code AS program_code, a.layer, a.auditor, a.standard, a.status,
            a.report_url, to_char(a.performed_on, 'YYYY-MM-DD') AS performed_on, a.findings
       FROM compliance_audits a
       JOIN sto_programs p ON p.id = a.program_id
      ORDER BY p.code, a.layer`,
  );
}

export interface SafeModeRow {
  id: string;
  program_code: string;
  trigger: string;
  mode: string;
  authorized_by: unknown;
  multi_sig_count: number;
  expires_at: string | null;
  announced_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  note: string | null;
}

export async function listSafeModeEvents(): Promise<SafeModeRow[]> {
  return query<SafeModeRow>(
    `SELECT e.id, p.code AS program_code, e.trigger, e.mode, e.authorized_by, e.multi_sig_count,
            to_char(e.expires_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS expires_at,
            to_char(e.announced_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS announced_at,
            to_char(e.resolved_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS resolved_at,
            e.resolution, e.note
       FROM safe_mode_events e
       JOIN sto_programs p ON p.id = e.program_id
      ORDER BY e.created_at DESC`,
  );
}

export function previewComplianceCost(issuanceSizeUsd: number): {
  readonly traditional: ComplianceCost;
  readonly stoPlus: ComplianceCost;
} {
  return {
    traditional: complianceCost({ issuanceSizeUsd, model: 'traditional_sto' }),
    stoPlus: complianceCost({ issuanceSizeUsd, model: 'sto_plus' }),
  };
}

/* ------------------------------------------------------------------ */
/* 代幣持有人                                                          */
/* ------------------------------------------------------------------ */

export interface TokenHolderRow {
  id: string;
  account_id: string;
  email: string;
  wallet_address: string;
  address_class: string;
  kyc_status: string;
  kyc_verified_on: string | null;
  investor_category: string;
  jurisdiction: string;
  sanctions_checked_on: string | null;
  lots: string;
  quantity: string;
  earned_quantity: string;
  purchased_quantity: string;
}

export async function listTokenHolders(): Promise<TokenHolderRow[]> {
  return query<TokenHolderRow>(
    `SELECT h.id, h.account_id, a.email, h.wallet_address, h.address_class, h.kyc_status,
            to_char(h.kyc_verified_on, 'YYYY-MM-DD') AS kyc_verified_on,
            h.investor_category, h.jurisdiction,
            to_char(h.sanctions_checked_on, 'YYYY-MM-DD') AS sanctions_checked_on,
            (SELECT count(*) FROM token_lots l WHERE l.holder_id = h.id AND l.status = 'active')::text AS lots,
            (SELECT COALESCE(sum(l.quantity), 0) FROM token_lots l WHERE l.holder_id = h.id AND l.status = 'active')::text AS quantity,
            (SELECT COALESCE(sum(l.quantity), 0) FROM token_lots l WHERE l.holder_id = h.id AND l.status = 'active' AND l.acquisition = 'earned')::text AS earned_quantity,
            (SELECT COALESCE(sum(l.quantity), 0) FROM token_lots l WHERE l.holder_id = h.id AND l.status = 'active' AND l.acquisition = 'purchased')::text AS purchased_quantity
       FROM token_holders h
       JOIN accounts a ON a.id = h.account_id
      ORDER BY h.address_class, a.email`,
  );
}

export interface TokenLotRow {
  id: string;
  holder_email: string;
  wallet_address: string;
  address_class: string;
  program_code: string;
  quantity: number;
  acquisition: TokenAcquisition;
  acquired_at: string;
  consideration_twd: number;
  lockup_until: string | null;
  lockup_basis: string;
  contribution_type: string | null;
  contribution_score: string | null;
  state: TokenState;
  status: string;
}

export async function listTokenLots(holderId?: string): Promise<TokenLotRow[]> {
  const params: unknown[] = [];
  const filter = holderId ? 'WHERE l.holder_id = $1' : '';
  if (holderId) params.push(holderId);
  return query<TokenLotRow>(
    `SELECT l.id, a.email AS holder_email, h.wallet_address, h.address_class,
            p.code AS program_code, l.quantity, l.acquisition,
            to_char(l.acquired_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS acquired_at,
            l.consideration_twd,
            to_char(l.lockup_until, 'YYYY-MM-DD') AS lockup_until,
            l.lockup_basis, l.contribution_type, l.contribution_score::text AS contribution_score,
            l.state, l.status
       FROM token_lots l
       JOIN token_holders h ON h.id = l.holder_id
       JOIN accounts a ON a.id = h.account_id
       JOIN sto_programs p ON p.id = l.program_id
       ${filter}
      ORDER BY l.acquired_at DESC`,
    params,
  );
}

export interface TokenTransitionRow {
  id: string;
  holder_email: string;
  from_state: string;
  to_state: string | null;
  trigger: string;
  to_address: string | null;
  to_address_class: string;
  decision_code: string;
  legal_basis: string;
  actor: string;
  occurred_at: string;
}

export async function listTokenTransitions(limit = 20): Promise<TokenTransitionRow[]> {
  return query<TokenTransitionRow>(
    `SELECT t.id, a.email AS holder_email, t.from_state, t.to_state, t.trigger,
            t.to_address, t.to_address_class, t.decision_code, t.legal_basis, t.actor,
            to_char(t.occurred_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS occurred_at
       FROM token_state_transitions t
       JOIN token_lots l ON l.id = t.lot_id
       JOIN token_holders h ON h.id = l.holder_id
       JOIN accounts a ON a.id = h.account_id
      ORDER BY t.occurred_at DESC
      LIMIT $1`,
    [limit],
  );
}

export interface SocialMiningRuleRow {
  id: string;
  program_code: string;
  version: number;
  content_quality_weight: string;
  interaction_depth_weight: string;
  governance_weight: string;
  time_weight: string;
  per_account_cap: number;
  decay_pct: string;
  reset_period_days: number;
  effective_from: string;
  note: string | null;
}

export async function listSocialMiningRules(): Promise<SocialMiningRuleRow[]> {
  return query<SocialMiningRuleRow>(
    `SELECT r.id, p.code AS program_code, r.version,
            r.content_quality_weight::text AS content_quality_weight,
            r.interaction_depth_weight::text AS interaction_depth_weight,
            r.governance_weight::text AS governance_weight,
            r.time_weight::text AS time_weight,
            r.per_account_cap, r.decay_pct::text AS decay_pct, r.reset_period_days,
            to_char(r.effective_from, 'YYYY-MM-DD') AS effective_from, r.note
       FROM social_mining_rules r
       JOIN sto_programs p ON p.id = r.program_id
      ORDER BY p.code, r.version DESC`,
  );
}

export interface SocialMiningAwardRow {
  id: string;
  holder_email: string;
  rule_version: number;
  period_start: string;
  period_end: string;
  content_quality_score: string;
  interaction_depth_score: string;
  governance_score: string;
  time_score: string;
  weighted_score: string;
  requested_quantity: number;
  awarded_quantity: number;
  capped: boolean;
}

export async function listSocialMiningAwards(): Promise<SocialMiningAwardRow[]> {
  return query<SocialMiningAwardRow>(
    `SELECT w.id, a.email AS holder_email, r.version AS rule_version,
            to_char(w.period_start, 'YYYY-MM-DD') AS period_start,
            to_char(w.period_end, 'YYYY-MM-DD') AS period_end,
            w.content_quality_score::text AS content_quality_score,
            w.interaction_depth_score::text AS interaction_depth_score,
            w.governance_score::text AS governance_score,
            w.time_score::text AS time_score,
            w.weighted_score::text AS weighted_score,
            w.requested_quantity, w.awarded_quantity, w.capped
       FROM social_mining_awards w
       JOIN token_holders h ON h.id = w.holder_id
       JOIN accounts a ON a.id = h.account_id
       JOIN social_mining_rules r ON r.id = w.rule_id
      ORDER BY w.period_end DESC, a.email`,
  );
}

export async function getConcentration(): Promise<ConcentrationReport> {
  const rows = await query<{ awarded_quantity: number }>(
    `SELECT awarded_quantity FROM social_mining_awards WHERE awarded_quantity > 0`,
  );
  return concentrationReport(rows.map((row) => row.awarded_quantity));
}

export interface TokenSummary {
  readonly holders: number;
  readonly verified: number;
  readonly lots: number;
  readonly utilityQuantity: number;
  readonly securityQuantity: number;
  readonly earnedQuantity: number;
  readonly purchasedQuantity: number;
  readonly lockedLots: number;
  readonly safeModeOpen: number;
}

export async function getTokenSummary(): Promise<TokenSummary> {
  const row = await one<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM token_holders)::text AS holders,
       (SELECT count(*) FROM token_holders WHERE kyc_status = 'verified')::text AS verified,
       (SELECT count(*) FROM token_lots WHERE status = 'active')::text AS lots,
       (SELECT COALESCE(sum(quantity), 0) FROM token_lots WHERE status = 'active' AND state = 'ST+')::text AS utility_quantity,
       (SELECT COALESCE(sum(quantity), 0) FROM token_lots WHERE status = 'active' AND state = 'ST')::text AS security_quantity,
       (SELECT COALESCE(sum(quantity), 0) FROM token_lots WHERE status = 'active' AND acquisition = 'earned')::text AS earned_quantity,
       (SELECT COALESCE(sum(quantity), 0) FROM token_lots WHERE status = 'active' AND acquisition = 'purchased')::text AS purchased_quantity,
       (SELECT count(*) FROM token_lots WHERE status = 'active' AND lockup_until IS NOT NULL AND lockup_until > current_date)::text AS locked_lots,
       (SELECT count(*) FROM safe_mode_events WHERE resolved_at IS NULL)::text AS safe_mode_open`,
  );
  return {
    holders: Number(row?.holders ?? 0),
    verified: Number(row?.verified ?? 0),
    lots: Number(row?.lots ?? 0),
    utilityQuantity: Number(row?.utility_quantity ?? 0),
    securityQuantity: Number(row?.security_quantity ?? 0),
    earnedQuantity: Number(row?.earned_quantity ?? 0),
    purchasedQuantity: Number(row?.purchased_quantity ?? 0),
    lockedLots: Number(row?.locked_lots ?? 0),
    safeModeOpen: Number(row?.safe_mode_open ?? 0),
  };
}

export function previewLockup(acquisition: TokenAcquisition, acquiredAt: string, asOf: string, issuerReporting: boolean) {
  return rule144Lockup({ acquisition, acquiredAt, asOf, issuerReporting });
}
