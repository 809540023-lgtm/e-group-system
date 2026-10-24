import { describe, expect, it } from 'vitest';
import {
  applyAwardCap,
  classifyAcquisition,
  complianceCost,
  concentrationReport,
  decideTransition,
  distributionWaterfall,
  rwaEligibility,
  rule144Lockup,
  socialMiningScore,
  stoGate,
  stoStageLabel,
  stressScenarios,
  validateSafeMode,
  DEFAULT_SOCIAL_MINING_WEIGHTS,
  type RwaAssetInput,
  type StoRequirement,
} from '../src/capital.ts';

const AS_OF = '2026-10-24';

function passport(overrides: Partial<RwaAssetInput> = {}): RwaAssetInput {
  return {
    kind: 'equipment',
    serialNo: 'FRZ-2026-0001',
    invoiceNo: 'INV-2026-0001',
    ownerLegalEntity: 'EG 總部',
    locationStationId: 'station-1',
    maintenanceCurrent: true,
    insurancePolicyNo: 'POL-EG-FRZ-0001',
    insuranceExpiresOn: '2027-05-12',
    appraisedValueTwd: 68_000,
    appraisalDate: '2026-09-09',
    existingLienTwd: 0,
    leaseId: 'lease-1',
    asOf: AS_OF,
    ...overrides,
  };
}

describe('RWA 資產護照', () => {
  it('九項欄位齊備時通過資格檢查', () => {
    const result = rwaEligibility(passport());
    expect(result.eligible).toBe(true);
    expect(result.score).toBe(100);
    expect(result.blockers).toHaveLength(0);
    expect(result.checks).toHaveLength(11);
  });

  it('食品庫存不得作為第一階段公開投資標的', () => {
    const result = rwaEligibility(passport({ kind: 'inventory' }));
    expect(result.eligible).toBe(false);
    expect(result.blockers.join()).toContain('庫存');
  });

  it('缺少發票與估值即為阻擋項', () => {
    const result = rwaEligibility(passport({ invoiceNo: null, appraisedValueTwd: null }));
    expect(result.eligible).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(2);
    expect(result.score).toBeLessThan(100);
  });

  it('保險過期即為阻擋項', () => {
    const result = rwaEligibility(passport({ insuranceExpiresOn: '2026-01-01' }));
    expect(result.eligible).toBe(false);
    expect(result.blockers.join()).toContain('保險');
  });

  it('既有擔保不低於估值即為阻擋項', () => {
    const result = rwaEligibility(passport({ existingLienTwd: 68_000 }));
    expect(result.eligible).toBe(false);
    expect(result.blockers.join()).toContain('擔保');
  });

  it('估值過舊只列警告，不阻擋', () => {
    const result = rwaEligibility(passport({ appraisalDate: '2024-01-01' }));
    expect(result.eligible).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });
});

describe('RWA 分配瀑布', () => {
  it('可分配基礎只有設備租金，營運收入全數排除', () => {
    const result = distributionWaterfall({
      equipmentRentTwd: 12_000,
      operatingRevenueTwd: 480_000,
      feesTwd: 600,
      maintenanceReservePct: 0.05,
      seniorDebtServiceTwd: 0,
      units: 1_000,
    });
    expect(result.grossTwd).toBe(12_000);
    expect(result.maintenanceReserveTwd).toBe(600);
    expect(result.distributableTwd).toBe(10_800);
    expect(result.perUnitTwd).toBe(10);
    expect(result.excludedOperatingRevenueTwd).toBe(480_000);
  });

  it('債務順位先於投資人分配', () => {
    const result = distributionWaterfall({
      equipmentRentTwd: 12_000,
      operatingRevenueTwd: 0,
      feesTwd: 0,
      maintenanceReservePct: 0,
      seniorDebtServiceTwd: 9_000,
      units: 1_000,
    });
    expect(result.distributableTwd).toBe(3_000);
    expect(result.perUnitTwd).toBe(3);
  });

  it('扣除後為負數時可分配金額歸零', () => {
    const result = distributionWaterfall({
      equipmentRentTwd: 1_000,
      operatingRevenueTwd: 0,
      feesTwd: 0,
      maintenanceReservePct: 0,
      seniorDebtServiceTwd: 5_000,
      units: 1_000,
    });
    expect(result.distributableTwd).toBe(0);
    expect(result.perUnitTwd).toBe(0);
  });

  it('單位數為零時每單位金額為零，不除以零', () => {
    const result = distributionWaterfall({
      equipmentRentTwd: 12_000,
      operatingRevenueTwd: 0,
      feesTwd: 0,
      maintenanceReservePct: 0,
      seniorDebtServiceTwd: 0,
      units: 0,
    });
    expect(result.perUnitTwd).toBe(0);
  });

  it('負數金額直接拒絕', () => {
    expect(() =>
      distributionWaterfall({
        equipmentRentTwd: -1,
        operatingRevenueTwd: 0,
        feesTwd: 0,
        maintenanceReservePct: 0,
        seniorDebtServiceTwd: 0,
        units: 1,
      }),
    ).toThrow(/DISTRIBUTION_INVALID/);
  });
});

describe('RWA 壓力情境', () => {
  const base = {
    appraisedValueTwd: 68_000,
    existingLienTwd: 0,
    monthlyRentTwd: 2_833,
    insuranceCoverageTwd: 68_000,
    residualValueTwd: 20_400,
    outstandingPrincipalTwd: 68_000,
  };

  it('六種情境全部產出', () => {
    const results = stressScenarios(base);
    expect(results).toHaveLength(6);
    expect(results.map((row) => row.key)).toEqual([
      'station_closure',
      'lessee_default',
      'equipment_damage',
      'double_financing',
      'insurance_denial',
      'residual_shortfall',
    ]);
  });

  it('保險拒賠與殘值不足會造成本金受損', () => {
    const results = stressScenarios(base);
    const denial = results.find((row) => row.key === 'insurance_denial');
    const residual = results.find((row) => row.key === 'residual_shortfall');
    expect(denial?.principalAtRisk).toBe(true);
    expect(residual?.principalAtRisk).toBe(true);
    expect(residual?.shortfallTwd).toBe(68_000 - 20_400);
  });

  it('保險足額時設備損壞不損及本金', () => {
    const results = stressScenarios(base);
    const damage = results.find((row) => row.key === 'equipment_damage');
    expect(damage?.shortfallTwd).toBe(0);
    expect(damage?.principalAtRisk).toBe(false);
  });

  it('既有擔保會壓縮重複融資的回收空間', () => {
    const results = stressScenarios({ ...base, existingLienTwd: 40_000, outstandingPrincipalTwd: 20_000 });
    const double = results.find((row) => row.key === 'double_financing');
    expect(double?.recoveryTwd).toBe(8_000);
    expect(double?.shortfallTwd).toBe(12_000);
    expect(double?.principalAtRisk).toBe(true);
  });
});

describe('STO 三階段關卡', () => {
  const requirements: StoRequirement[] = [
    { stage: 1, key: 'a', label: 'A', status: 'done', blocking: true },
    { stage: 1, key: 'b', label: 'B', status: 'done', blocking: true },
    { stage: 2, key: 'c', label: 'C', status: 'done', blocking: true },
    { stage: 2, key: 'd', label: 'D', status: 'pending', blocking: true },
    { stage: 3, key: 'e', label: 'E', status: 'pending', blocking: true },
  ];

  const base = {
    requirements,
    targetInstrument: 'equipment_right' as const,
    professionalInvestorOnly: true,
    mixesInstruments: false,
    bindsMealPurchaseToDividend: false,
    promisesGuaranteedReturn: false,
  };

  it('第一階段完成但第二階段未完成時不得跳關', () => {
    const gate = stoGate(base);
    expect(gate.currentStage).toBe(2);
    expect(gate.canAdvance).toBe(false);
    expect(gate.nextStage).toBe(3);
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it('第二階段完成後才進入第三階段，但第三階段未完成仍不得發行', () => {
    const gate = stoGate({
      ...base,
      requirements: requirements.map((row) => (row.key === 'd' ? { ...row, status: 'done' as const } : row)),
    });
    expect(gate.currentStage).toBe(3);
    expect(gate.nextStage).toBeNull();
    expect(gate.canAdvance).toBe(false);
    expect(gate.blockers.join()).toContain('第 3 階段未完成');
  });

  it('三階段全部完成且無法規阻擋時才可發行', () => {
    const gate = stoGate({
      ...base,
      requirements: requirements.map((row) => ({ ...row, status: 'done' as const })),
    });
    expect(gate.currentStage).toBe(3);
    expect(gate.canAdvance).toBe(true);
    expect(gate.blockers).toHaveLength(0);
  });

  it('把多種權利混成一顆代幣即為阻擋項', () => {
    const gate = stoGate({ ...base, mixesInstruments: true });
    expect(gate.canAdvance).toBe(false);
    expect(gate.blockers.join()).toContain('權利');
  });

  it('把買餐與分紅代幣綁定即為阻擋項', () => {
    const gate = stoGate({ ...base, bindsMealPurchaseToDividend: true });
    expect(gate.canAdvance).toBe(false);
    expect(gate.blockers.join()).toContain('餐');
  });

  it('保本保息即為阻擋項', () => {
    const gate = stoGate({ ...base, promisesGuaranteedReturn: true });
    expect(gate.canAdvance).toBe(false);
    expect(gate.blockers.join()).toContain('保');
  });

  it('三階段各有中文說明', () => {
    expect(stoStageLabel(1)).toContain('第一階段');
    expect(stoStageLabel(2)).toContain('第二階段');
    expect(stoStageLabel(3)).toContain('第三階段');
  });
});

describe('Rule 144 鎖定期', () => {
  it('購買取得適用 6 個月鎖定（申報發行人）', () => {
    const result = rule144Lockup({
      acquisition: 'purchased',
      acquiredAt: '2026-01-01',
      asOf: '2026-03-01',
      issuerReporting: true,
    });
    expect(result.basis).toBe('rule_144');
    expect(result.months).toBe(6);
    expect(result.locked).toBe(true);
    expect(result.lockupUntil).toBe('2026-07-01');
  });

  it('購買取得適用 12 個月鎖定（非申報發行人）', () => {
    const result = rule144Lockup({
      acquisition: 'purchased',
      acquiredAt: '2026-01-01',
      asOf: '2026-03-01',
      issuerReporting: false,
    });
    expect(result.months).toBe(12);
    expect(result.lockupUntil).toBe('2027-01-01');
  });

  it('賺取取得依勞務對價豁免鎖定期', () => {
    const result = rule144Lockup({
      acquisition: 'earned',
      acquiredAt: '2026-01-01',
      asOf: '2026-01-02',
      issuerReporting: true,
    });
    expect(result.basis).toBe('earned_exempt');
    expect(result.months).toBe(0);
    expect(result.locked).toBe(false);
    expect(result.lockupUntil).toBeNull();
  });

  it('鎖定期屆滿後解鎖', () => {
    const result = rule144Lockup({
      acquisition: 'purchased',
      acquiredAt: '2026-01-01',
      asOf: '2026-08-01',
      issuerReporting: true,
    });
    expect(result.locked).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });
});

describe('STO+ 狀態機', () => {
  const base = {
    from: 'ST+' as const,
    toAddressClass: 'secondary_market' as const,
    holderKycStatus: 'verified' as const,
    holderInvestorCategory: 'professional' as const,
    programProfessionalOnly: true,
    lotLocked: false,
    safeMode: false,
  };

  it('轉入合規二級市場觸發證券狀態', () => {
    const decision = decideTransition(base);
    expect(decision.allowed).toBe(true);
    expect(decision.to).toBe('ST');
    expect(decision.code).toBe('UTILITY_TO_SECURITY');
  });

  it('轉回平台內部錢包觸發效用狀態', () => {
    const decision = decideTransition({ ...base, from: 'ST', toAddressClass: 'platform' });
    expect(decision.allowed).toBe(true);
    expect(decision.to).toBe('ST+');
    expect(decision.code).toBe('SECURITY_TO_UTILITY');
  });

  it('合規託管地址不觸發轉換', () => {
    const decision = decideTransition({ ...base, toAddressClass: 'custody' });
    expect(decision.allowed).toBe(true);
    expect(decision.to).toBe('ST+');
    expect(decision.code).toBe('CUSTODY_HOLD');
  });

  it('安全模式啟動時一律阻擋並要求人工複核', () => {
    const decision = decideTransition({ ...base, safeMode: true });
    expect(decision.allowed).toBe(false);
    expect(decision.to).toBeNull();
    expect(decision.requiresManualReview).toBe(true);
  });

  it('KYC 未完成不得收受代幣', () => {
    const decision = decideTransition({ ...base, holderKycStatus: 'pending' });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('KYC_REQUIRED');
  });

  it('限專業投資人的計畫不得讓一般投資人進入證券狀態', () => {
    const decision = decideTransition({ ...base, holderInvestorCategory: 'general' });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('INVESTOR_NOT_ELIGIBLE');
  });

  it('鎖定期內不得把證券狀態轉回效用狀態', () => {
    const decision = decideTransition({ ...base, from: 'ST', toAddressClass: 'platform', lotLocked: true });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('LOCKUP_ACTIVE');
    expect(decision.requiresManualReview).toBe(true);
  });
});

describe('Social Mining', () => {
  it('依論文權重計算加權分數', () => {
    const result = socialMiningScore({ contentQuality: 100, interactionDepth: 0, governance: 0, time: 0 });
    expect(result.weighted).toBeCloseTo(40, 6);
    expect(result.normalized).toBeCloseTo(0.4, 6);
  });

  it('預設權重為 40/25/20/15', () => {
    expect(DEFAULT_SOCIAL_MINING_WEIGHTS).toEqual({
      contentQuality: 0.4,
      interactionDepth: 0.25,
      governance: 0.2,
      time: 0.15,
    });
  });

  it('權重合計不為 1 時拒絕計算', () => {
    expect(() =>
      socialMiningScore(
        { contentQuality: 50, interactionDepth: 50, governance: 50, time: 50 },
        { contentQuality: 0.5, interactionDepth: 0.5, governance: 0.5, time: 0.5 },
      ),
    ).toThrow(/SOCIAL_MINING_INVALID/);
  });

  it('分數超出 0 至 100 時拒絕計算', () => {
    expect(() => socialMiningScore({ contentQuality: 101, interactionDepth: 0, governance: 0, time: 0 })).toThrow(
      /SOCIAL_MINING_INVALID/,
    );
  });

  it('單一帳戶上限會截斷超額申請', () => {
    const result = applyAwardCap(120, 450, 500);
    expect(result.awarded).toBe(50);
    expect(result.capped).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('未達上限時全額發放', () => {
    const result = applyAwardCap(30, 0, 500);
    expect(result.awarded).toBe(30);
    expect(result.capped).toBe(false);
  });

  it('長尾分配符合論文預期', () => {
    const report = concentrationReport([120, 100, 90, 30]);
    expect(report.longTail).toBe(true);
    expect(report.top10PctShare).toBeLessThanOrEqual(0.5);
  });

  it('少數帳戶獨大時判定為集中', () => {
    const report = concentrationReport([900, 20, 20, 20, 20, 20, 20, 20, 20, 20]);
    expect(report.longTail).toBe(false);
    expect(report.top10PctShare).toBeGreaterThan(0.5);
  });

  it('無獎勵紀錄時不除以零', () => {
    const report = concentrationReport([]);
    expect(report.top10PctShare).toBe(0);
    expect(report.longTail).toBe(true);
  });
});

describe('賺取與購買的定性', () => {
  it('有對價且可市場替代時定性為購買', () => {
    const result = classifyAcquisition({
      paidConsideration: true,
      exAnteContributionRule: false,
      verifiableContribution: false,
      marketSubstitutable: true,
      platformDependent: false,
    });
    expect(result.acquisition).toBe('purchased');
  });

  it('無對價、事前規則、可驗證且依賴平台時定性為賺取', () => {
    const result = classifyAcquisition({
      paidConsideration: false,
      exAnteContributionRule: true,
      verifiableContribution: true,
      marketSubstitutable: false,
      platformDependent: true,
    });
    expect(result.acquisition).toBe('earned');
  });

  it('同時具備對價與勞務特徵時保守預設為購買', () => {
    const result = classifyAcquisition({
      paidConsideration: true,
      exAnteContributionRule: true,
      verifiableContribution: true,
      marketSubstitutable: false,
      platformDependent: true,
    });
    expect(result.acquisition).toBe('purchased');
    expect(result.reasons.join()).toContain('保守預設');
  });

  it('完全無對價且無勞務特徵時仍不認定為購買', () => {
    const result = classifyAcquisition({
      paidConsideration: false,
      exAnteContributionRule: false,
      verifiableContribution: false,
      marketSubstitutable: false,
      platformDependent: false,
    });
    expect(result.acquisition).toBe('earned');
  });
});

describe('合規成本', () => {
  it('傳統 STO 一次性成本落在 80 萬至 150 萬美元', () => {
    const result = complianceCost({ issuanceSizeUsd: 3_000_000, model: 'traditional_sto' });
    expect(result.oneTimeLowUsd).toBe(800_000);
    expect(result.oneTimeHighUsd).toBe(1_500_000);
  });

  it('STO+ 一次性成本下降 22% 至 30%', () => {
    const result = complianceCost({ issuanceSizeUsd: 3_000_000, model: 'sto_plus' });
    expect(result.oneTimeSavingsPct).toBeGreaterThanOrEqual(0.219);
    expect(result.oneTimeSavingsPct).toBeLessThanOrEqual(0.301);
  });

  it('STO+ 年度成本低於傳統 STO', () => {
    const traditional = complianceCost({ issuanceSizeUsd: 3_000_000, model: 'traditional_sto' });
    const stoPlus = complianceCost({ issuanceSizeUsd: 3_000_000, model: 'sto_plus' });
    expect(stoPlus.annualHighUsd).toBeLessThan(traditional.annualHighUsd);
  });

  it('發行規模非正數時拒絕計算', () => {
    expect(() => complianceCost({ issuanceSizeUsd: 0, model: 'sto_plus' })).toThrow(/COMPLIANCE_COST_INVALID/);
  });
});

describe('安全模式', () => {
  const base = {
    trigger: 'oracle_error' as const,
    authorizedBy: ['財務長', '法務', '技術長'],
    multiSigThreshold: 2,
    expiresAt: '2026-10-30T00:00:00Z',
    announcedAt: '2026-10-24T00:00:00Z',
  };

  it('多簽、限期與公告齊備時成立', () => {
    const result = validateSafeMode(base);
    expect(result.valid).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.defaultAction).toContain('預言機');
  });

  it('多簽門檻低於 2 人時不成立', () => {
    const result = validateSafeMode({ ...base, multiSigThreshold: 1 });
    expect(result.valid).toBe(false);
    expect(result.blockers.join()).toContain('多簽門檻');
  });

  it('授權人數未達門檻時不成立', () => {
    const result = validateSafeMode({ ...base, authorizedBy: ['財務長'], multiSigThreshold: 2 });
    expect(result.valid).toBe(false);
    expect(result.blockers.join()).toContain('授權人數');
  });

  it('未設定失效時間時不成立', () => {
    const result = validateSafeMode({ ...base, expiresAt: null });
    expect(result.valid).toBe(false);
    expect(result.blockers.join()).toContain('失效時間');
  });

  it('未公告時不成立', () => {
    const result = validateSafeMode({ ...base, announcedAt: null });
    expect(result.valid).toBe(false);
    expect(result.blockers.join()).toContain('公告');
  });

  it('失效時間格式無法解析時不成立', () => {
    const result = validateSafeMode({ ...base, expiresAt: 'not-a-date' });
    expect(result.valid).toBe(false);
  });
});
