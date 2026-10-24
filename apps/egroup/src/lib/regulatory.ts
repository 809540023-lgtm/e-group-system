import { one, query } from './db.ts';
import {
  CLARITY_ACT_STATUS,
  ENFORCEMENT_2020_2024,
  JURISDICTIONS,
  POLICY_TIMELINE,
  TAX_ACCOUNTING,
  crossBorderGuard,
  disclosureChecklist,
  equivalenceAssessment,
  legitimacyCheck,
  safeHarborCheck,
  type CrossBorderDecision,
  type DisclosureChecklist,
  type DisclosureItem,
  type DisclosureSubject,
  type EquivalenceAssessment,
  type Jurisdiction,
  type LegitimacyCheck,
  type PolicyEvent,
  type RegulatoryPosture,
  type SafeHarborCheck,
  type SafeHarborKind,
  type TaxAccountingTreatment,
} from '@eg/meal';

/* ------------------------------------------------------------------ */
/* 監理體制                                                            */
/* ------------------------------------------------------------------ */

export interface RegulatoryRegimeRow {
  id: string;
  code: string;
  name: string;
  posture: RegulatoryPosture;
  framework: string;
  retail_allowed: boolean;
  professional_only: boolean;
  equivalence_required: boolean;
  local_license_held: boolean;
  equivalence_determined: boolean;
  effective_from: string | null;
  source: string | null;
  note: string | null;
}

export async function listRegimes(): Promise<RegulatoryRegimeRow[]> {
  return query<RegulatoryRegimeRow>(
    `SELECT id, code, name, posture, framework, retail_allowed, professional_only,
            equivalence_required, local_license_held, equivalence_determined,
            to_char(effective_from, 'YYYY-MM-DD') AS effective_from, source, note
       FROM regulatory_regimes
      ORDER BY CASE posture
                 WHEN 'restricted' THEN 0
                 WHEN 'equivalence_required' THEN 1
                 WHEN 'enforcement_led' THEN 2
                 ELSE 3
               END, code`,
  );
}

export interface RegulatoryEventRow {
  id: string;
  regime_code: string;
  event_date: string;
  kind: string;
  title: string;
  summary: string;
  posture_after: RegulatoryPosture;
  source: string | null;
}

export async function listEvents(limit = 40): Promise<RegulatoryEventRow[]> {
  return query<RegulatoryEventRow>(
    `SELECT id, regime_code, to_char(event_date, 'YYYY-MM-DD') AS event_date,
            kind, title, summary, posture_after, source
       FROM regulatory_events
      ORDER BY event_date DESC, title
      LIMIT $1`,
    [limit],
  );
}

export interface PostureShift {
  readonly from: RegulatoryPosture;
  readonly to: RegulatoryPosture;
  readonly on: string;
  readonly title: string;
}

/**
 * 找出監理姿態真正改變的那一天。論文的核心主張是「關鍵時刻」，
 * 所以這裡只回傳姿態前後不同的那一筆，而不是整條時間軸。
 */
export function findPostureShift(events: readonly RegulatoryEventRow[]): PostureShift | null {
  const ordered = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date));
  let previous: RegulatoryPosture | null = null;
  for (const event of ordered) {
    if (previous !== null && previous !== event.posture_after) {
      return { from: previous, to: event.posture_after, on: event.event_date, title: event.title };
    }
    previous = event.posture_after;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 安全港                                                              */
/* ------------------------------------------------------------------ */

export interface SafeHarborRow {
  id: string;
  reference_no: string;
  kind: SafeHarborKind;
  regime_code: string;
  applicant: string;
  subject: string;
  status: string;
  good_faith: boolean;
  compliance_measures: boolean;
  reporting_cadence: 'none' | 'quarterly' | 'semiannual' | 'annual';
  opened_on: string | null;
  expires_on: string | null;
  extension_months: number;
  user_cap: number | null;
  volume_cap_twd: number | null;
  exit_mechanism: 'none' | 'approved' | 'modified' | 'terminated';
  published: boolean;
  blockers: string[];
  warnings: string[];
}

export async function listSafeHarbors(): Promise<SafeHarborRow[]> {
  return query<SafeHarborRow>(
    `SELECT id, reference_no, kind, regime_code, applicant, subject, status,
            good_faith, compliance_measures, reporting_cadence,
            to_char(opened_on, 'YYYY-MM-DD') AS opened_on,
            to_char(expires_on, 'YYYY-MM-DD') AS expires_on,
            extension_months, user_cap, volume_cap_twd,
            exit_mechanism, published, blockers, warnings
       FROM safe_harbor_applications
      ORDER BY CASE status WHEN 'granted' THEN 0 WHEN 'submitted' THEN 1 ELSE 2 END,
               opened_on DESC NULLS LAST`,
  );
}

export function evaluateSafeHarbor(row: SafeHarborRow): SafeHarborCheck {
  return safeHarborCheck({
    kind: row.kind,
    goodFaith: row.good_faith,
    complianceMeasures: row.compliance_measures,
    reportingCadence: row.reporting_cadence,
    openedOn: row.opened_on ?? '',
    expiresOn: row.expires_on,
    extensionMonths: row.extension_months,
    userCap: row.user_cap,
    volumeCapTwd: row.volume_cap_twd,
    exitMechanism: row.exit_mechanism,
    published: row.published,
  });
}

/* ------------------------------------------------------------------ */
/* 揭露義務                                                            */
/* ------------------------------------------------------------------ */

export interface DisclosureRow {
  id: string;
  subject_type: DisclosureSubject;
  subject_ref: string;
  item_key: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  evidence: string | null;
  due_on: string | null;
}

export async function listDisclosures(): Promise<DisclosureRow[]> {
  return query<DisclosureRow>(
    `SELECT id, subject_type, subject_ref, item_key, label, required, satisfied, evidence,
            to_char(due_on, 'YYYY-MM-DD') AS due_on
       FROM disclosure_obligations
      ORDER BY subject_type, subject_ref, item_key`,
  );
}

export interface DisclosureGroup {
  readonly subjectType: DisclosureSubject;
  readonly subjectRef: string;
  readonly checklist: DisclosureChecklist;
  readonly items: readonly DisclosureRow[];
}

export function groupDisclosures(rows: readonly DisclosureRow[]): DisclosureGroup[] {
  const groups = new Map<string, DisclosureRow[]>();
  for (const row of rows) {
    const key = `${row.subject_type}::${row.subject_ref}`;
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [row]);
    else bucket.push(row);
  }

  const result: DisclosureGroup[] = [];
  for (const bucket of groups.values()) {
    const first = bucket[0];
    if (first === undefined) continue;
    const items: DisclosureItem[] = bucket.map((row) => ({
      key: row.item_key,
      label: row.label,
      satisfied: row.satisfied,
      evidence: row.evidence,
    }));
    result.push({
      subjectType: first.subject_type,
      subjectRef: first.subject_ref,
      checklist: disclosureChecklist(first.subject_type, items),
      items: bucket,
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* 跨境要約                                                            */
/* ------------------------------------------------------------------ */

export interface CrossBorderRow {
  id: string;
  program_id: string | null;
  program_code: string | null;
  destination_code: string;
  destination_name: string | null;
  token_state: 'ST' | 'ST+';
  holder_category: 'general' | 'professional' | 'accredited';
  allowed: boolean;
  decision_code: string;
  reason: string;
  assessed_by: string;
  assessed_at: string;
}

export async function listCrossBorderAssessments(limit = 20): Promise<CrossBorderRow[]> {
  return query<CrossBorderRow>(
    `SELECT c.id, c.program_id, p.code AS program_code, c.destination_code,
            r.name AS destination_name, c.token_state, c.holder_category,
            c.allowed, c.decision_code, c.reason, c.assessed_by,
            to_char(c.assessed_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') AS assessed_at
       FROM cross_border_assessments c
       LEFT JOIN sto_programs p ON p.id = c.program_id
       LEFT JOIN regulatory_regimes r ON r.code = c.destination_code
      ORDER BY c.assessed_at DESC
      LIMIT $1`,
    [limit],
  );
}

export function previewCrossBorder(input: {
  destinationCode: string;
  tokenState: 'ST' | 'ST+';
  programProfessionalOnly: boolean;
  holderCategory: 'general' | 'professional' | 'accredited';
  equivalenceDetermined: boolean;
  localLicenseHeld: boolean;
}): CrossBorderDecision {
  return crossBorderGuard(input);
}

/* ------------------------------------------------------------------ */
/* 稅務與會計                                                          */
/* ------------------------------------------------------------------ */

export async function listTaxAccounting(): Promise<readonly TaxAccountingTreatment[]> {
  const rows = await query<TaxAccountingTreatment>(
    `SELECT kind, label, tax_treatment AS "taxTreatment",
            accounting_treatment AS "accountingTreatment", caveat, authority
       FROM tax_accounting_treatments
      ORDER BY kind`,
  );
  return rows.length > 0 ? rows : TAX_ACCOUNTING;
}

/* ------------------------------------------------------------------ */
/* 正當性                                                              */
/* ------------------------------------------------------------------ */

export interface LegitimacyRow {
  transparent_rulemaking: boolean;
  multi_stakeholder: boolean;
  continuous_disclosure: boolean;
  independent_judgment: boolean;
  accountability: boolean;
}

export async function getLegitimacy(): Promise<LegitimacyCheck> {
  const row = await one<LegitimacyRow>(
    `SELECT transparent_rulemaking, multi_stakeholder, continuous_disclosure,
            independent_judgment, accountability
       FROM regulatory_regimes
      WHERE code = 'US'`,
  );
  if (row === null) {
    return legitimacyCheck({
      transparentRulemaking: false,
      multiStakeholder: false,
      continuousDisclosure: false,
      independentJudgment: false,
      accountability: false,
    });
  }
  return legitimacyCheck({
    transparentRulemaking: row.transparent_rulemaking,
    multiStakeholder: row.multi_stakeholder,
    continuousDisclosure: row.continuous_disclosure,
    independentJudgment: row.independent_judgment,
    accountability: row.accountability,
  });
}

/* ------------------------------------------------------------------ */
/* 摘要                                                                */
/* ------------------------------------------------------------------ */

export interface RegulatorySummary {
  readonly regimeCount: number;
  readonly restrictedCount: number;
  readonly equivalenceRequiredCount: number;
  readonly eventCount: number;
  readonly grantedSafeHarbors: number;
  readonly openDisclosures: number;
  readonly blockedCrossBorder: number;
  readonly postureShift: PostureShift | null;
}

export async function getRegulatorySummary(): Promise<RegulatorySummary> {
  const [regimes, events, harbors, disclosures, crossBorder] = await Promise.all([
    listRegimes(),
    listEvents(60),
    listSafeHarbors(),
    listDisclosures(),
    listCrossBorderAssessments(50),
  ]);

  return {
    regimeCount: regimes.length,
    restrictedCount: regimes.filter((row) => row.posture === 'restricted').length,
    equivalenceRequiredCount: regimes.filter((row) => row.equivalence_required).length,
    eventCount: events.length,
    grantedSafeHarbors: harbors.filter((row) => row.status === 'granted').length,
    openDisclosures: disclosures.filter((row) => row.required && !row.satisfied).length,
    blockedCrossBorder: crossBorder.filter((row) => !row.allowed).length,
    postureShift: findPostureShift(events),
  };
}

/* ------------------------------------------------------------------ */
/* 靜態參考資料                                                        */
/* ------------------------------------------------------------------ */

export const REFERENCE = {
  jurisdictions: JURISDICTIONS,
  timeline: POLICY_TIMELINE,
  enforcement: ENFORCEMENT_2020_2024,
  clarityAct: CLARITY_ACT_STATUS,
} as const;

export function jurisdictionOf(code: string): Jurisdiction | null {
  return JURISDICTIONS.find((item) => item.code === code) ?? null;
}

export function timelineOf(): readonly PolicyEvent[] {
  return POLICY_TIMELINE;
}

export function equivalenceOf(input: {
  substantiveEquivalence: boolean;
  infoSharingMou: boolean;
  reciprocalAccess: boolean;
  localBranchAvailable: boolean;
}): EquivalenceAssessment {
  return equivalenceAssessment(input);
}
