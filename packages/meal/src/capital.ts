/**
 * 資本市場：RWA 資產設計與 STO+ 混合代幣。
 *
 * 規範來源：計畫書第十、十一章；博士論文《證券型代幣的範式轉移 —— STO+ 混合代幣模型的法學建構與監管創新》。
 *
 * 三條不可跨越的界線：
 * 1. 資產數位化不等於對外募集投資；RWA 名稱本身不提供法規豁免。
 * 2. 建立平台不等於可發行或交易；STO 必須走完三階段與必要核准。
 * 3. 一般會員買餐不得與可分紅證券代幣綁定。
 *
 * 本模組只做規則計算與狀態判斷，不代替法律意見。任何對外募集行為都必須先取得
 * 台灣證券法律專業人員與具相關資格之證券商評估，並完成適用程序與必要核准。
 */

/* ------------------------------------------------------------------ */
/* RWA 資產護照                                                        */
/* ------------------------------------------------------------------ */

export type RwaAssetKind = 'equipment' | 'receivable' | 'inventory';

export interface RwaAssetInput {
  readonly kind: RwaAssetKind;
  readonly serialNo: string | null;
  readonly invoiceNo: string | null;
  readonly ownerLegalEntity: string | null;
  readonly locationStationId: string | null;
  readonly maintenanceCurrent: boolean;
  readonly insurancePolicyNo: string | null;
  readonly insuranceExpiresOn: string | null;
  readonly appraisedValueTwd: number | null;
  readonly appraisalDate: string | null;
  readonly existingLienTwd: number;
  readonly leaseId: string | null;
  readonly asOf: string;
}

export interface RwaCheck {
  readonly key: string;
  readonly label: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface RwaEligibility {
  readonly eligible: boolean;
  readonly score: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly checks: readonly RwaCheck[];
}

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.floor((to - from) / DAY_MS);
}

/**
 * 設備資產護照的九項必備欄位：序號、發票、所有人、所在地、維修、保險、估值、
 * 既有擔保與租約。缺一項即不得列為第一階段 RWA 標的。
 *
 * 食品庫存先做追溯與存貨管理，不作第一階段公開投資標的，因此 kind='inventory'
 * 一律阻擋。
 */
export function rwaEligibility(input: RwaAssetInput): RwaEligibility {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checks: RwaCheck[] = [];

  const add = (key: string, label: string, passed: boolean, detail: string): void => {
    checks.push({ key, label, passed, detail });
    if (!passed) blockers.push(`${label}：${detail}`);
  };

  if (input.kind === 'inventory') {
    blockers.push('食品庫存：先做追溯與存貨管理，不作第一階段公開投資標的');
    checks.push({
      key: 'kind',
      label: '標的類型',
      passed: false,
      detail: '食品庫存不得作為第一階段公開投資標的',
    });
  } else {
    checks.push({
      key: 'kind',
      label: '標的類型',
      passed: true,
      detail: input.kind === 'equipment' ? '冷鏈設備與設備租約為第一優先' : '可確認且可轉讓之應收帳款為第二優先',
    });
  }

  add('serial', '序號', Boolean(input.serialNo), input.serialNo ? input.serialNo : '缺少設備序號');
  add('invoice', '發票', Boolean(input.invoiceNo), input.invoiceNo ? input.invoiceNo : '缺少發票憑證');
  add(
    'owner',
    '所有人',
    Boolean(input.ownerLegalEntity),
    input.ownerLegalEntity ? input.ownerLegalEntity : '缺少法律上所有權人',
  );
  add(
    'location',
    '所在地',
    Boolean(input.locationStationId),
    input.locationStationId ? '已標示站點' : '缺少實體所在地',
  );
  add(
    'maintenance',
    '維修狀態',
    input.maintenanceCurrent,
    input.maintenanceCurrent ? '保養紀錄在期限內' : '保養逾期，殘值與可用性無法確認',
  );
  add(
    'insurance',
    '保險',
    Boolean(input.insurancePolicyNo),
    input.insurancePolicyNo ? input.insurancePolicyNo : '缺少保單',
  );

  if (input.insuranceExpiresOn) {
    const remaining = daysBetween(input.asOf, input.insuranceExpiresOn);
    if (Number.isNaN(remaining)) {
      blockers.push('保險到期日格式無法解析');
      checks.push({ key: 'insurance_valid', label: '保險有效', passed: false, detail: '到期日格式無法解析' });
    } else if (remaining < 0) {
      blockers.push(`保險已於 ${input.insuranceExpiresOn} 到期`);
      checks.push({ key: 'insurance_valid', label: '保險有效', passed: false, detail: `已逾期 ${-remaining} 天` });
    } else {
      checks.push({ key: 'insurance_valid', label: '保險有效', passed: true, detail: `尚餘 ${remaining} 天` });
      if (remaining < 60) warnings.push(`保險將於 ${remaining} 天內到期，續保前不得新增投資人`);
    }
  } else {
    blockers.push('缺少保險到期日');
    checks.push({ key: 'insurance_valid', label: '保險有效', passed: false, detail: '缺少到期日' });
  }

  const hasValue = typeof input.appraisedValueTwd === 'number' && input.appraisedValueTwd > 0;
  add(
    'valuation',
    '估值',
    hasValue,
    hasValue ? `NT$${input.appraisedValueTwd}` : '缺少第三方估值',
  );

  if (hasValue && input.appraisalDate) {
    const age = daysBetween(input.appraisalDate, input.asOf);
    if (Number.isNaN(age)) {
      warnings.push('估值日期格式無法解析');
    } else if (age > 365) {
      warnings.push(`估值已 ${age} 天未更新，超過一年須重新評價`);
    }
  } else if (hasValue) {
    warnings.push('缺少估值日期');
  }

  checks.push({
    key: 'lien',
    label: '既有擔保',
    passed: true,
    detail: input.existingLienTwd > 0 ? `已設定擔保 NT$${input.existingLienTwd}，須列為債務順位` : '無既有擔保',
  });
  if (input.existingLienTwd > 0) {
    warnings.push('資產已設定擔保，須揭露債務順位並防止重複融資');
    if (hasValue && input.existingLienTwd >= input.appraisedValueTwd) {
      blockers.push('既有擔保已達或超過估值，無可分配餘額');
    }
  }

  add('lease', '租約', Boolean(input.leaseId), input.leaseId ? '租約已建檔' : '缺少租約，租金現金流無法確認');

  const score = Math.max(0, 100 - blockers.length * 12 - warnings.length * 5);
  return {
    eligible: blockers.length === 0,
    score,
    blockers,
    warnings,
    checks,
  };
}

/* ------------------------------------------------------------------ */
/* 分配瀑布                                                            */
/* ------------------------------------------------------------------ */

export interface DistributionInput {
  readonly equipmentRentTwd: number;
  readonly operatingRevenueTwd: number;
  readonly feesTwd: number;
  readonly maintenanceReservePct: number;
  readonly seniorDebtServiceTwd: number;
  readonly units: number;
}

export interface Distribution {
  readonly grossTwd: number;
  readonly feesTwd: number;
  readonly maintenanceReserveTwd: number;
  readonly seniorDebtServiceTwd: number;
  readonly distributableTwd: number;
  readonly perUnitTwd: number;
  readonly excludedOperatingRevenueTwd: number;
  readonly notes: readonly string[];
}

/**
 * 設備租金、營運收入與投資分配分別記錄。
 *
 * 可分配基礎只有設備租金；整筆餐食營收不得當作可分配收益，因此
 * operatingRevenueTwd 只會被記錄為「排除金額」，永不進入分配。
 */
export function distributionWaterfall(input: DistributionInput): Distribution {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`DISTRIBUTION_INVALID: ${key} 必須是非負有限數值，收到 ${value}`);
    }
  }
  if (input.maintenanceReservePct > 1) {
    throw new Error(`DISTRIBUTION_INVALID: 維修準備比例必須介於 0 與 1，收到 ${input.maintenanceReservePct}`);
  }

  const grossTwd = input.equipmentRentTwd;
  const maintenanceReserveTwd = Math.round(grossTwd * input.maintenanceReservePct);
  const distributableTwd = Math.max(
    0,
    grossTwd - input.feesTwd - maintenanceReserveTwd - input.seniorDebtServiceTwd,
  );
  const perUnitTwd = input.units > 0 ? Math.floor(distributableTwd / input.units) : 0;

  const notes: string[] = ['可分配基礎僅限設備租金；營運收入不列入分配。'];
  if (input.operatingRevenueTwd > 0) {
    notes.push(`已排除營運收入 NT$${input.operatingRevenueTwd}，不得視為可分配收益。`);
  }
  if (input.seniorDebtServiceTwd > 0) {
    notes.push(`已先支付債務順位 NT$${input.seniorDebtServiceTwd}。`);
  }
  if (distributableTwd === 0) {
    notes.push('本期無可分配金額，不得以自有資金補足製造固定回報。');
  }

  return {
    grossTwd,
    feesTwd: input.feesTwd,
    maintenanceReserveTwd,
    seniorDebtServiceTwd: input.seniorDebtServiceTwd,
    distributableTwd,
    perUnitTwd,
    excludedOperatingRevenueTwd: input.operatingRevenueTwd,
    notes,
  };
}

/* ------------------------------------------------------------------ */
/* 壓力情境                                                            */
/* ------------------------------------------------------------------ */

export type StressScenarioKey =
  | 'station_closure'
  | 'lessee_default'
  | 'equipment_damage'
  | 'double_financing'
  | 'insurance_denial'
  | 'residual_shortfall';

export interface StressInput {
  readonly appraisedValueTwd: number;
  readonly existingLienTwd: number;
  readonly monthlyRentTwd: number;
  readonly insuranceCoverageTwd: number;
  readonly residualValueTwd: number;
  readonly outstandingPrincipalTwd: number;
}

export interface StressResult {
  readonly key: StressScenarioKey;
  readonly label: string;
  readonly assumption: string;
  readonly impactTwd: number;
  readonly recoveryTwd: number;
  readonly shortfallTwd: number;
  readonly principalAtRisk: boolean;
}

const STRESS_LABELS: Readonly<Record<StressScenarioKey, string>> = {
  station_closure: '站點歇業',
  lessee_default: '承租人欠款',
  equipment_damage: '設備損壞',
  double_financing: '資產重複融資',
  insurance_denial: '保險拒賠',
  residual_shortfall: '殘值不足',
};

/**
 * 計畫書要求評估六種情境。設備可轉移不等於一定能回收本金，因此每一情境都要
 * 算出缺口，並標示本金是否受損。
 */
export function stressScenarios(input: StressInput): readonly StressResult[] {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`STRESS_INVALID: ${key} 必須是非負有限數值，收到 ${value}`);
    }
  }

  const build = (
    key: StressScenarioKey,
    assumption: string,
    impactTwd: number,
    recoveryTwd: number,
  ): StressResult => {
    const shortfallTwd = Math.max(0, impactTwd - recoveryTwd);
    return {
      key,
      label: STRESS_LABELS[key],
      assumption,
      impactTwd,
      recoveryTwd,
      shortfallTwd,
      principalAtRisk: shortfallTwd > 0,
    };
  };

  const threeMonthsRent = input.monthlyRentTwd * 3;
  const defaultLoss = Math.round(input.monthlyRentTwd * 2 * 1.1);
  const repairCost = Math.round(input.appraisedValueTwd * 0.35);
  const lienRecovery = Math.max(0, input.appraisedValueTwd - input.existingLienTwd - input.outstandingPrincipalTwd);

  return [
    build('station_closure', '站點歇業，連續三個月無租金收入', threeMonthsRent, 0),
    build('lessee_default', '承租人欠款兩個月，另計一成催收成本', defaultLoss, 0),
    build('equipment_damage', '設備損壞，維修成本為估值 35%，以保險理賠回收', repairCost, Math.min(repairCost, input.insuranceCoverageTwd)),
    build('double_financing', '同一資產重複設定擔保，扣除既有擔保與未償本金後回收', input.outstandingPrincipalTwd, lienRecovery),
    build('insurance_denial', '保險拒賠，設備全損且無理賠', input.appraisedValueTwd, 0),
    build('residual_shortfall', '處分時殘值低於未償本金', input.outstandingPrincipalTwd, Math.min(input.residualValueTwd, input.outstandingPrincipalTwd)),
  ];
}

/* ------------------------------------------------------------------ */
/* STO 三階段關卡                                                      */
/* ------------------------------------------------------------------ */

export type StoStage = 1 | 2 | 3;
export type StoRequirementStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type StoInstrument = 'equity' | 'debt' | 'equipment_right';

export interface StoRequirement {
  readonly stage: StoStage;
  readonly key: string;
  readonly label: string;
  readonly status: StoRequirementStatus;
  readonly blocking: boolean;
}

export interface StoStageProgress {
  readonly stage: StoStage;
  readonly done: number;
  readonly total: number;
  readonly complete: boolean;
}

export interface StoGate {
  readonly currentStage: StoStage;
  readonly canAdvance: boolean;
  readonly nextStage: StoStage | null;
  readonly blockers: readonly string[];
  readonly stageProgress: readonly StoStageProgress[];
  readonly verdict: string;
}

export interface StoGateInput {
  readonly requirements: readonly StoRequirement[];
  readonly targetInstrument: StoInstrument;
  readonly professionalInvestorOnly: boolean;
  readonly mixesInstruments: boolean;
  readonly bindsMealPurchaseToDividend: boolean;
  readonly promisesGuaranteedReturn: boolean;
}

const STAGE_LABELS: Readonly<Record<StoStage, string>> = {
  1: '第一階段：以創辦人資本、適法股權、供應商付款條件與設備租賃支持試點',
  2: '第二階段：整理財報、資產清冊、租約、站點績效與風險資料，取得法律與證券商評估',
  3: '第三階段：完成適用程序與必要核准後，才執行發行、投資人審查、申購、託管與分配',
};

export function stoStageLabel(stage: StoStage): string {
  return STAGE_LABELS[stage];
}

/**
 * 三階段不得跳關。第三階段只有在第二階段全部完成、且沒有法規阻擋時才成立。
 *
 * 另外三項硬性禁止（計畫書第十一章）：
 * - 不得把多種權利混成一顆代幣
 * - 不得把一般會員買餐與取得可分紅證券代幣綁定
 * - 不得保本保息
 */
export function stoGate(input: StoGateInput): StoGate {
  const blockers: string[] = [];

  if (input.mixesInstruments) {
    blockers.push('投資標的混用多種權利：須在法律審查前擇一明確設計');
  }
  if (input.bindsMealPurchaseToDividend) {
    blockers.push('一般會員買餐與可分紅證券代幣綁定：計畫書明文禁止');
  }
  if (input.promisesGuaranteedReturn) {
    blockers.push('保本保息或固定回報承諾：計畫書明文禁止');
  }
  if (!input.professionalInvestorOnly) {
    blockers.push('櫃買中心 STO 制度設有專業投資人限制，不得對一般投資人發行');
  }

  const stageProgress: StoStageProgress[] = ([1, 2, 3] as const).map((stage) => {
    const items = input.requirements.filter((item) => item.stage === stage);
    const done = items.filter((item) => item.status === 'done').length;
    return { stage, done, total: items.length, complete: items.length > 0 && done === items.length };
  });

  for (const progress of stageProgress) {
    const pending = input.requirements.filter((item) => item.stage === progress.stage && item.blocking && item.status !== 'done');
    for (const item of pending) {
      blockers.push(`第 ${progress.stage} 階段未完成：${item.label}`);
    }
  }

  const stage1 = stageProgress.find((item) => item.stage === 1);
  const stage2 = stageProgress.find((item) => item.stage === 2);
  const stage3 = stageProgress.find((item) => item.stage === 3);

  let currentStage: StoStage = 1;
  if (stage1?.complete) currentStage = 2;
  if (stage1?.complete && stage2?.complete) currentStage = 3;

  const canAdvance = blockers.length === 0 && currentStage === 3 && Boolean(stage3?.complete);
  const nextStage: StoStage | null = currentStage === 1 ? 2 : currentStage === 2 ? 3 : null;

  const verdict = canAdvance
    ? '三階段與法規條件全部完成，可進入發行程序；仍須逐案取得主管機關與證券商確認。'
    : `目前位於第 ${currentStage} 階段，尚有 ${blockers.length} 項阻擋，不得發行或交易。`;

  return { currentStage, canAdvance, nextStage, blockers, stageProgress, verdict };
}

/* ------------------------------------------------------------------ */
/* Rule 144 鎖定期                                                     */
/* ------------------------------------------------------------------ */

export type TokenAcquisition = 'purchased' | 'earned';

export interface LockupInput {
  readonly acquisition: TokenAcquisition;
  readonly acquiredAt: string;
  readonly asOf: string;
  readonly issuerReporting: boolean;
}

export interface Lockup {
  readonly lockupUntil: string | null;
  readonly basis: 'rule_144' | 'earned_exempt';
  readonly months: number;
  readonly locked: boolean;
  readonly daysRemaining: number;
  readonly rationale: string;
}

/**
 * 「賺取」與「購買」的差異化處理是 STO+ 的核心主張。
 *
 * 購買取得：完整 Rule 144 鎖定期（申報發行人 6 個月、非申報 12 個月）。
 * 賺取取得：依勞務對價定性豁免鎖定期，但仍須通過反濫用條件（KYC、貢獻審核、
 * 反女巫、分配上限、關係人揭露與紀錄保存）。
 */
export function rule144Lockup(input: LockupInput): Lockup {
  if (input.acquisition === 'earned') {
    return {
      lockupUntil: null,
      basis: 'earned_exempt',
      months: 0,
      locked: false,
      daysRemaining: 0,
      rationale: '勞務對價取得，無私募折價轉售之規避風險，依 STO+ 主張豁免 Rule 144 鎖定期。',
    };
  }

  const months = input.issuerReporting ? 6 : 12;
  const acquired = Date.parse(input.acquiredAt);
  const asOf = Date.parse(input.asOf);
  if (Number.isNaN(acquired) || Number.isNaN(asOf)) {
    throw new Error('LOCKUP_INVALID: 日期格式無法解析');
  }
  const until = new Date(acquired);
  until.setUTCMonth(until.getUTCMonth() + months);
  const daysRemaining = Math.max(0, Math.ceil((until.getTime() - asOf) / DAY_MS));

  return {
    lockupUntil: until.toISOString().slice(0, 10),
    basis: 'rule_144',
    months,
    locked: daysRemaining > 0,
    daysRemaining,
    rationale: `資本投入取得，適用 Rule 144 ${months} 個月鎖定期（${input.issuerReporting ? '申報' : '非申報'}發行人）。`,
  };
}

/* ------------------------------------------------------------------ */
/* 代幣法律狀態機                                                      */
/* ------------------------------------------------------------------ */

export type TokenState = 'ST' | 'ST+';
export type AddressClass = 'platform' | 'secondary_market' | 'custody';
export type KycStatus = 'verified' | 'pending' | 'rejected';
export type InvestorCategory = 'general' | 'professional' | 'accredited';

export interface TransitionInput {
  readonly from: TokenState;
  readonly toAddressClass: AddressClass;
  readonly holderKycStatus: KycStatus;
  readonly holderInvestorCategory: InvestorCategory;
  readonly programProfessionalOnly: boolean;
  readonly lotLocked: boolean;
  readonly safeMode: boolean;
}

export interface TransitionDecision {
  readonly allowed: boolean;
  readonly to: TokenState | null;
  readonly code: string;
  readonly reason: string;
  readonly requiresManualReview: boolean;
}

/**
 * 狀態轉換由接收地址的性質自動判斷，不由使用者手動選擇。
 *
 * 平台內部錢包只能持有效用狀態；合規二級市場地址只能持有證券狀態；合規託管地址
 * 可持有任一狀態，因此不觸發轉換。
 *
 * 保守預設：安全模式啟動、KYC 未完成、或鎖定期內想把證券狀態轉回效用狀態時，
 * 一律不放行，並要求人工複核。
 */
export function decideTransition(input: TransitionInput): TransitionDecision {
  if (input.safeMode) {
    return {
      allowed: false,
      to: null,
      code: 'SAFE_MODE',
      reason: '安全模式啟動中，暫停轉讓與狀態轉換，須人工複核後才恢復。',
      requiresManualReview: true,
    };
  }

  if (input.holderKycStatus !== 'verified') {
    return {
      allowed: false,
      to: null,
      code: 'KYC_REQUIRED',
      reason: '代幣採身分綁定，未完成 KYC 的地址不得收受代幣。',
      requiresManualReview: false,
    };
  }

  if (input.toAddressClass === 'custody') {
    return {
      allowed: true,
      to: input.from,
      code: 'CUSTODY_HOLD',
      reason: '合規託管地址可持有任一狀態，法律狀態不變。',
      requiresManualReview: false,
    };
  }

  if (input.toAddressClass === 'secondary_market') {
    if (input.programProfessionalOnly && input.holderInvestorCategory === 'general') {
      return {
        allowed: false,
        to: null,
        code: 'INVESTOR_NOT_ELIGIBLE',
        reason: '本計畫僅限專業投資人，一般投資人不得進入證券狀態。',
        requiresManualReview: false,
      };
    }
    if (input.from === 'ST') {
      return {
        allowed: true,
        to: 'ST',
        code: 'ALREADY_SECURITY',
        reason: '已在證券狀態，維持完整證券法適用。',
        requiresManualReview: false,
      };
    }
    return {
      allowed: true,
      to: 'ST',
      code: 'UTILITY_TO_SECURITY',
      reason: '轉入合規二級市場，觸發證券狀態，適用揭露、反詐欺、適格投資人與轉售限制。',
      requiresManualReview: false,
    };
  }

  // toAddressClass === 'platform'
  if (input.lotLocked) {
    return {
      allowed: false,
      to: null,
      code: 'LOCKUP_ACTIVE',
      reason: '鎖定期內不得把證券狀態轉回效用狀態，否則形成轉售限制之規避。',
      requiresManualReview: true,
    };
  }
  if (input.from === 'ST+') {
    return {
      allowed: true,
      to: 'ST+',
      code: 'ALREADY_UTILITY',
      reason: '已在效用狀態，維持平台內使用之功能性定位。',
      requiresManualReview: false,
    };
  }
  return {
    allowed: true,
    to: 'ST+',
    code: 'SECURITY_TO_UTILITY',
    reason: '轉回平台內部錢包，觸發效用狀態；所有權人未變，僅規範面向切換。',
    requiresManualReview: false,
  };
}

/* ------------------------------------------------------------------ */
/* Social Mining                                                       */
/* ------------------------------------------------------------------ */

export interface SocialMiningWeights {
  readonly contentQuality: number;
  readonly interactionDepth: number;
  readonly governance: number;
  readonly time: number;
}

export interface SocialMiningScores {
  readonly contentQuality: number;
  readonly interactionDepth: number;
  readonly governance: number;
  readonly time: number;
}

/** 論文所載 Knowpia 規格：內容品質 40%、互動深度 25%、治理參與 20%、時間權重 15%。 */
export const DEFAULT_SOCIAL_MINING_WEIGHTS: SocialMiningWeights = {
  contentQuality: 0.4,
  interactionDepth: 0.25,
  governance: 0.2,
  time: 0.15,
};

export interface SocialMiningScore {
  readonly weighted: number;
  readonly normalized: number;
  readonly contributions: Readonly<Record<keyof SocialMiningScores, number>>;
}

export function socialMiningScore(
  scores: SocialMiningScores,
  weights: SocialMiningWeights = DEFAULT_SOCIAL_MINING_WEIGHTS,
): SocialMiningScore {
  const totalWeight = weights.contentQuality + weights.interactionDepth + weights.governance + weights.time;
  if (Math.abs(totalWeight - 1) > 1e-9) {
    throw new Error(`SOCIAL_MINING_INVALID: 權重合計必須為 1，收到 ${totalWeight}`);
  }
  for (const [key, value] of Object.entries(scores)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`SOCIAL_MINING_INVALID: ${key} 必須介於 0 與 100，收到 ${value}`);
    }
  }
  const contributions = {
    contentQuality: scores.contentQuality * weights.contentQuality,
    interactionDepth: scores.interactionDepth * weights.interactionDepth,
    governance: scores.governance * weights.governance,
    time: scores.time * weights.time,
  };
  const weighted = Object.values(contributions).reduce((acc, value) => acc + value, 0);
  return { weighted, normalized: weighted / 100, contributions };
}

export interface AwardCapResult {
  readonly awarded: number;
  readonly capped: boolean;
  readonly remaining: number;
}

/** 反集中機制：單一帳戶獎勵上限。 */
export function applyAwardCap(requested: number, alreadyAwarded: number, perAccountCap: number): AwardCapResult {
  if (requested < 0 || alreadyAwarded < 0 || perAccountCap < 0) {
    throw new Error('AWARD_CAP_INVALID: 數量必須為非負數');
  }
  const remaining = Math.max(0, perAccountCap - alreadyAwarded);
  const awarded = Math.min(requested, remaining);
  return { awarded, capped: awarded < requested, remaining: remaining - awarded };
}

export interface ConcentrationReport {
  readonly top10PctShare: number;
  readonly top20PctShare: number;
  readonly gini: number;
  readonly longTail: boolean;
  readonly note: string;
}

/**
 * 論文以 Knowpia 為例：前 10% 高貢獻者約取得 38%、前 20% 約 56%，呈長尾分配。
 * 若集中度顯著高於此區間，代表分配規則偏向少數帳戶，須調整權重或加上限。
 */
export function concentrationReport(awards: readonly number[]): ConcentrationReport {
  const positive = awards.filter((value) => value > 0).sort((a, b) => b - a);
  const total = positive.reduce((acc, value) => acc + value, 0);
  if (total === 0) {
    return { top10PctShare: 0, top20PctShare: 0, gini: 0, longTail: true, note: '尚無獎勵紀錄。' };
  }
  const top10 = Math.max(1, Math.ceil(positive.length * 0.1));
  const top20 = Math.max(1, Math.ceil(positive.length * 0.2));
  const share = (n: number): number => positive.slice(0, n).reduce((acc, value) => acc + value, 0) / total;

  const sorted = [...positive].sort((a, b) => a - b);
  let cumulative = 0;
  let weighted = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    cumulative += sorted[index]!;
    weighted += (index + 1) * sorted[index]!;
  }
  const gini = (2 * weighted) / (sorted.length * cumulative) - (sorted.length + 1) / sorted.length;

  const top10PctShare = share(top10);
  const top20PctShare = share(top20);
  const longTail = top10PctShare <= 0.5 && top20PctShare <= 0.7;

  return {
    top10PctShare,
    top20PctShare,
    gini,
    longTail,
    note: longTail
      ? '分配呈長尾，符合勞務報酬特徵。'
      : '集中度偏高，須檢查演算法權重、單一帳戶上限與反女巫機制。',
  };
}

/* ------------------------------------------------------------------ */
/* 賺取 vs 購買                                                        */
/* ------------------------------------------------------------------ */

export interface EarnedCriteria {
  readonly paidConsideration: boolean;
  readonly exAnteContributionRule: boolean;
  readonly verifiableContribution: boolean;
  readonly marketSubstitutable: boolean;
  readonly platformDependent: boolean;
}

export interface AcquisitionClassification {
  readonly acquisition: TokenAcquisition;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

/**
 * 五項判斷標準。任一項指向資本投入時採保守預設，寧可認定為購買取得並套用
 * Rule 144，也不放寬成勞務對價。
 */
export function classifyAcquisition(criteria: EarnedCriteria): AcquisitionClassification {
  const reasons: string[] = [];
  let earnedPoints = 0;
  let purchasedPoints = 0;

  if (criteria.paidConsideration) {
    purchasedPoints += 3;
    reasons.push('用戶支付金錢對價取得代幣，符合 Howey 之金錢投資要素。');
  } else {
    earnedPoints += 1;
    reasons.push('用戶未支付金錢對價。');
  }
  if (criteria.exAnteContributionRule) {
    earnedPoints += 1;
    reasons.push('取得基於事前公開的貢獻標準。');
  }
  if (criteria.verifiableContribution) {
    earnedPoints += 1;
    reasons.push('貢獻可透過客觀指標驗證。');
  }
  if (criteria.marketSubstitutable) {
    purchasedPoints += 2;
    reasons.push('代幣可透過市場以相近價格購得，削弱勞務對價之獨立性。');
  }
  if (criteria.platformDependent) {
    earnedPoints += 1;
    reasons.push('取得依賴平台獨有機制，具勞務對價特徵。');
  }

  const acquisition: TokenAcquisition = purchasedPoints > 0 && purchasedPoints >= earnedPoints ? 'purchased' : 'earned';
  const total = earnedPoints + purchasedPoints;
  const confidence = total === 0 ? 0 : Math.max(earnedPoints, purchasedPoints) / total;

  if (acquisition === 'purchased' && earnedPoints > 0) {
    reasons.push('存在資本投入特徵，採保守預設認定為購買取得並套用 Rule 144。');
  }

  return { acquisition, confidence, reasons };
}

/* ------------------------------------------------------------------ */
/* 合規成本模型                                                        */
/* ------------------------------------------------------------------ */

export type ComplianceModel = 'traditional_sto' | 'sto_plus';

export interface ComplianceCostInput {
  readonly issuanceSizeUsd: number;
  readonly model: ComplianceModel;
}

export interface ComplianceCost {
  readonly model: ComplianceModel;
  readonly oneTimeLowUsd: number;
  readonly oneTimeHighUsd: number;
  readonly annualLowUsd: number;
  readonly annualHighUsd: number;
  readonly oneTimeSavingsPct: number;
  readonly annualSavingsPct: number;
  readonly assumptions: readonly string[];
}

const TRADITIONAL_ONE_TIME_LOW = 800_000;
const TRADITIONAL_ONE_TIME_HIGH = 1_500_000;
const TRADITIONAL_ANNUAL_LOW_PCT = 0.021;
const TRADITIONAL_ANNUAL_HIGH_PCT = 0.035;

/** STO+ 統一雙重性：一次性成本下降 22% 至 30%，年度成本下降 0.8 至 1.2 個百分點。 */
const STO_PLUS_ONE_TIME_LOW_FACTOR = 0.78;
const STO_PLUS_ONE_TIME_HIGH_FACTOR = 0.7;
const STO_PLUS_ANNUAL_LOW_PCT = 0.013;
const STO_PLUS_ANNUAL_HIGH_PCT = 0.023;

export function complianceCost(input: ComplianceCostInput): ComplianceCost {
  if (!Number.isFinite(input.issuanceSizeUsd) || input.issuanceSizeUsd <= 0) {
    throw new Error(`COMPLIANCE_COST_INVALID: 發行規模必須為正數，收到 ${input.issuanceSizeUsd}`);
  }
  const size = input.issuanceSizeUsd;
  const isStoPlus = input.model === 'sto_plus';

  const oneTimeLowUsd = Math.round(TRADITIONAL_ONE_TIME_LOW * (isStoPlus ? STO_PLUS_ONE_TIME_LOW_FACTOR : 1));
  const oneTimeHighUsd = Math.round(TRADITIONAL_ONE_TIME_HIGH * (isStoPlus ? STO_PLUS_ONE_TIME_HIGH_FACTOR : 1));
  const annualLowPct = isStoPlus ? STO_PLUS_ANNUAL_LOW_PCT : TRADITIONAL_ANNUAL_LOW_PCT;
  const annualHighPct = isStoPlus ? STO_PLUS_ANNUAL_HIGH_PCT : TRADITIONAL_ANNUAL_HIGH_PCT;

  return {
    model: input.model,
    oneTimeLowUsd,
    oneTimeHighUsd,
    annualLowUsd: Math.round(size * annualLowPct),
    annualHighUsd: Math.round(size * annualHighPct),
    oneTimeSavingsPct: isStoPlus ? 1 - STO_PLUS_ONE_TIME_LOW_FACTOR : 0,
    annualSavingsPct: isStoPlus ? TRADITIONAL_ANNUAL_LOW_PCT - STO_PLUS_ANNUAL_LOW_PCT : 0,
    assumptions: isStoPlus
      ? [
          '智能合約審計可合併進行。',
          'KYC/AML 模組由單一身分綁定服務支援。',
          'ATS 上架程序之審查項目可重複利用。',
        ]
      : ['Reg D Rule 506(c) 一次性成本含法律意見書、智能合約審計與託管設置。'],
  };
}

/* ------------------------------------------------------------------ */
/* 安全模式與人工介入                                                  */
/* ------------------------------------------------------------------ */

export type SafeModeTrigger =
  | 'code_vulnerability'
  | 'oracle_error'
  | 'legal_conflict'
  | 'governance_conflict';

export interface SafeModeInput {
  readonly trigger: SafeModeTrigger;
  readonly authorizedBy: readonly string[];
  readonly multiSigThreshold: number;
  readonly expiresAt: string | null;
  readonly announcedAt: string | null;
}

export interface SafeModeValidation {
  readonly valid: boolean;
  readonly blockers: readonly string[];
  readonly defaultAction: string;
}

const SAFE_MODE_DEFAULTS: Readonly<Record<SafeModeTrigger, string>> = {
  code_vulnerability: '啟動 pause/safe mode，暫停高風險轉讓或轉換。',
  oracle_error: '啟動 pause/safe mode，暫停依賴預言機的定價與轉換。',
  legal_conflict: '採取較嚴格監管狀態，暫緩交易或限制轉讓。',
  governance_conflict: '暫緩執行治理結果，要求冷卻期與利益衝突揭露。',
};

/**
 * 「法律優先、保守預設、可追溯介入」：任何人工 override 都必須有事前授權、
 * 多人簽核、時間限制、紀錄留存與事後公告。
 */
export function validateSafeMode(input: SafeModeInput): SafeModeValidation {
  const blockers: string[] = [];
  const signers = new Set(input.authorizedBy.filter((name) => name.trim().length > 0));

  if (input.multiSigThreshold < 2) {
    blockers.push('多簽門檻至少 2 人，單人不得獨自變更代幣法律狀態。');
  }
  if (signers.size < input.multiSigThreshold) {
    blockers.push(`授權人數 ${signers.size} 未達多簽門檻 ${input.multiSigThreshold}。`);
  }
  if (!input.expiresAt) {
    blockers.push('缺少失效時間，人工介入不得無限期。');
  } else if (Number.isNaN(Date.parse(input.expiresAt))) {
    blockers.push('失效時間格式無法解析。');
  }
  if (!input.announcedAt) {
    blockers.push('缺少事後公告時間，使用者無從得知限制狀態。');
  }

  return {
    valid: blockers.length === 0,
    blockers,
    defaultAction: SAFE_MODE_DEFAULTS[input.trigger],
  };
}
