import { describe, expect, it } from 'vitest';
import {
  CLARITY_ACT_STATUS,
  DISCLOSURE_LABELS,
  ENFORCEMENT_2020_2024,
  JURISDICTIONS,
  POLICY_TIMELINE,
  POSTURE_LABELS,
  SANDBOX_LIMITS,
  TAX_ACCOUNTING,
  clarityActPhrasing,
  crossBorderGuard,
  disclosureChecklist,
  equivalenceAssessment,
  findJurisdiction,
  findTaxAccounting,
  legitimacyCheck,
  safeHarborCheck,
  type DisclosureItem,
  type SafeHarborInput,
} from '../src/regulatory.ts';

const baseHarbor: SafeHarborInput = {
  kind: 'temporary_safe_harbor',
  goodFaith: true,
  complianceMeasures: true,
  reportingCadence: 'semiannual',
  openedOn: '2026-01-01',
  expiresOn: '2027-12-31',
  extensionMonths: 0,
  userCap: null,
  volumeCapTwd: null,
  exitMechanism: 'none',
  published: true,
};

describe('監理姿態', () => {
  it('五個司法管轄區都有姿態標籤', () => {
    expect(JURISDICTIONS).toHaveLength(5);
    for (const jurisdiction of JURISDICTIONS) {
      expect(POSTURE_LABELS[jurisdiction.posture]).toBeTruthy();
    }
  });

  it('findJurisdiction 找得到已知代碼、找不到未知代碼', () => {
    expect(findJurisdiction('US')?.name).toBe('美國');
    expect(findJurisdiction('TW')?.posture).toBe('restricted');
    expect(findJurisdiction('ZZ')).toBeNull();
  });

  it('台灣屬限制類且限專業投資人', () => {
    const tw = findJurisdiction('TW');
    expect(tw?.posture).toBe('restricted');
    expect(tw?.professionalOnly).toBe(true);
    expect(tw?.retailAllowed).toBe(false);
  });

  it('歐盟要求等同性認定', () => {
    expect(findJurisdiction('EU')?.equivalenceRequired).toBe(true);
  });
});

describe('政策時間軸', () => {
  it('時間軸依日期遞增且每筆都有姿態', () => {
    const dates = POLICY_TIMELINE.map((event) => event.date);
    expect([...dates].sort()).toEqual(dates);
    for (const event of POLICY_TIMELINE) {
      expect(POSTURE_LABELS[event.postureAfter]).toBeTruthy();
    }
  });

  it('2025-01-20 之後姿態由執法監管轉為創新導向', () => {
    const before = POLICY_TIMELINE.filter((event) => event.date < '2025-01-20');
    const after = POLICY_TIMELINE.filter((event) => event.date > '2025-01-20');
    expect(before.every((event) => event.postureAfter === 'enforcement_led')).toBe(true);
    expect(after.every((event) => event.postureAfter === 'innovation_oriented')).toBe(true);
  });

  it('執法期統計與論文一致', () => {
    expect(ENFORCEMENT_2020_2024.actions).toBe(125);
    expect(ENFORCEMENT_2020_2024.fraudSharePct).toBe(66);
    expect(ENFORCEMENT_2020_2024.unregisteredSharePct).toBe(63);
    expect(ENFORCEMENT_2020_2024.developerShareFromPct).toBeGreaterThan(
      ENFORCEMENT_2020_2024.developerShareToPct,
    );
  });
});

describe('等同性認定', () => {
  it('三項判準齊備才取得等同性', () => {
    const result = equivalenceAssessment({
      substantiveEquivalence: true,
      infoSharingMou: true,
      reciprocalAccess: true,
      localBranchAvailable: false,
    });
    expect(result.determined).toBe(true);
    expect(result.route).toBe('equivalence');
    expect(result.blockers).toHaveLength(0);
  });

  it('缺一項即不成立，且列出該項', () => {
    const result = equivalenceAssessment({
      substantiveEquivalence: true,
      infoSharingMou: false,
      reciprocalAccess: true,
      localBranchAvailable: false,
    });
    expect(result.determined).toBe(false);
    expect(result.route).toBe('none');
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain('ESMA');
  });

  it('三項皆缺但有分支機構時走 local_branch', () => {
    const result = equivalenceAssessment({
      substantiveEquivalence: false,
      infoSharingMou: false,
      reciprocalAccess: false,
      localBranchAvailable: true,
    });
    expect(result.determined).toBe(false);
    expect(result.route).toBe('local_branch');
    expect(result.blockers).toHaveLength(3);
  });

  it('三項皆缺且無分支機構時無可用路徑', () => {
    const result = equivalenceAssessment({
      substantiveEquivalence: false,
      infoSharingMou: false,
      reciprocalAccess: false,
      localBranchAvailable: false,
    });
    expect(result.route).toBe('none');
  });
});

describe('安全港', () => {
  it('條件齊備的臨時安全港成立', () => {
    const result = safeHarborCheck(baseHarbor);
    expect(result.valid).toBe(true);
    expect(result.maxMonths).toBe(24);
    expect(result.blockers).toHaveLength(0);
  });

  it('缺少善意認定與合規措施即不成立', () => {
    const result = safeHarborCheck({ ...baseHarbor, goodFaith: false, complianceMeasures: false });
    expect(result.valid).toBe(false);
    expect(result.blockers).toHaveLength(2);
  });

  it('缺少定期報告即不成立', () => {
    const result = safeHarborCheck({ ...baseHarbor, reportingCadence: 'none' });
    expect(result.valid).toBe(false);
    expect(result.blockers.some((item) => item.includes('定期報告'))).toBe(true);
  });

  it('缺少到期日即不成立，安全港不得無限期', () => {
    const result = safeHarborCheck({ ...baseHarbor, expiresOn: null });
    expect(result.valid).toBe(false);
    expect(result.blockers.some((item) => item.includes('無限期'))).toBe(true);
  });

  it('期間超過 24 個月上限即不成立', () => {
    const result = safeHarborCheck({ ...baseHarbor, expiresOn: '2029-01-01' });
    expect(result.valid).toBe(false);
    expect(result.blockers.some((item) => item.includes('超過上限'))).toBe(true);
  });

  it('沙盒上限 36 個月，且須有用戶與金額上限及退出機制', () => {
    const result = safeHarborCheck({
      ...baseHarbor,
      kind: 'sandbox',
      expiresOn: '2028-12-31',
      userCap: null,
      volumeCapTwd: null,
      exitMechanism: 'none',
    });
    expect(result.maxMonths).toBe(36);
    expect(result.valid).toBe(false);
    expect(result.blockers).toHaveLength(3);
  });

  it('沙盒延長不得超過 12 個月', () => {
    const ok = safeHarborCheck({
      ...baseHarbor,
      kind: 'sandbox',
      expiresOn: '2028-12-31',
      userCap: 200,
      volumeCapTwd: 5_000_000,
      exitMechanism: 'approved',
      extensionMonths: SANDBOX_LIMITS.maxExtensionMonths,
    });
    expect(ok.valid).toBe(true);

    const tooLong = safeHarborCheck({
      ...baseHarbor,
      kind: 'sandbox',
      expiresOn: '2028-12-31',
      userCap: 200,
      volumeCapTwd: 5_000_000,
      exitMechanism: 'approved',
      extensionMonths: 18,
    });
    expect(tooLong.valid).toBe(false);
    expect(tooLong.blockers.some((item) => item.includes('延長'))).toBe(true);
  });

  it('未公開的不採取行動信函只警告不阻擋', () => {
    const result = safeHarborCheck({
      ...baseHarbor,
      kind: 'no_action_letter',
      published: false,
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it('臨時安全港採年報只警告不阻擋', () => {
    const result = safeHarborCheck({ ...baseHarbor, reportingCadence: 'annual' });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((item) => item.includes('每半年'))).toBe(true);
  });
});

describe('揭露義務', () => {
  const stakingItems: DisclosureItem[] = [
    { key: 'yield_calculation', label: '收益率計算方法', satisfied: true, evidence: '白皮書 §4.2' },
    { key: 'slashing_risk', label: '削減風險', satisfied: true, evidence: '風險揭露 §6.1' },
    { key: 'unlock_period', label: '解鎖期', satisfied: false, evidence: null },
  ];

  it('質押三項必要揭露缺一項即不完整', () => {
    const result = disclosureChecklist('staking', stakingItems);
    expect(result.complete).toBe(false);
    expect(result.satisfiedCount).toBe(2);
    expect(result.requiredCount).toBe(3);
    expect(result.missing).toEqual([DISCLOSURE_LABELS['unlock_period']]);
  });

  it('三項齊備即完整', () => {
    const result = disclosureChecklist(
      'staking',
      stakingItems.map((item) => ({ ...item, satisfied: true, evidence: '已備' })),
    );
    expect(result.complete).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('有 satisfaction 但沒有證據視為未完成', () => {
    const result = disclosureChecklist(
      'staking',
      stakingItems.map((item) => ({ ...item, satisfied: true, evidence: '   ' })),
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toHaveLength(3);
  });

  it('代幣發行需要四項揭露', () => {
    const result = disclosureChecklist('token_issuance', []);
    expect(result.requiredCount).toBe(4);
    expect(result.complete).toBe(false);
  });

  it('託管需要三項揭露', () => {
    expect(disclosureChecklist('custody', []).requiredCount).toBe(3);
  });
});

describe('跨境要約守門', () => {
  const base = {
    destinationCode: 'US',
    tokenState: 'ST' as const,
    programProfessionalOnly: true,
    holderCategory: 'professional' as const,
    equivalenceDetermined: false,
    localLicenseHeld: false,
  };

  it('未登錄體制一律阻擋', () => {
    const result = crossBorderGuard({ ...base, destinationCode: 'ZZ' });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('REGIME_UNKNOWN');
  });

  it('限制或禁止類一律阻擋', () => {
    const result = crossBorderGuard({ ...base, destinationCode: 'TW' });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RESTRICTED_JURISDICTION');
  });

  it('須等同性認定而未取得即阻擋', () => {
    const result = crossBorderGuard({ ...base, destinationCode: 'EU' });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('EQUIVALENCE_MISSING');
  });

  it('取得等同性後歐盟放行', () => {
    const result = crossBorderGuard({ ...base, destinationCode: 'EU', equivalenceDetermined: true });
    expect(result.allowed).toBe(true);
    expect(result.code).toBe('ALLOWED');
  });

  it('設立當地分支機構亦可放行歐盟', () => {
    const result = crossBorderGuard({ ...base, destinationCode: 'EU', localLicenseHeld: true });
    expect(result.allowed).toBe(true);
  });

  it('限專業投資人的計畫不得由一般投資人持有證券狀態', () => {
    const result = crossBorderGuard({ ...base, destinationCode: 'US', holderCategory: 'general' });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('PROFESSIONAL_ONLY');
  });

  it('ST+ 效用狀態不受專業投資人限制', () => {
    const result = crossBorderGuard({
      ...base,
      destinationCode: 'US',
      tokenState: 'ST+',
      holderCategory: 'general',
    });
    expect(result.allowed).toBe(true);
  });

  it('美國與香港對專業投資人放行', () => {
    expect(crossBorderGuard({ ...base, destinationCode: 'US' }).code).toBe('ALLOWED');
    expect(crossBorderGuard({ ...base, destinationCode: 'HK' }).code).toBe('ALLOWED');
  });
});

describe('稅務與會計', () => {
  it('六種交易類型都有稅務、會計、注意事項與依據', () => {
    expect(TAX_ACCOUNTING).toHaveLength(6);
    for (const row of TAX_ACCOUNTING) {
      expect(row.taxTreatment.length).toBeGreaterThan(0);
      expect(row.accountingTreatment.length).toBeGreaterThan(0);
      expect(row.caveat.length).toBeGreaterThan(0);
      expect(row.authority.length).toBeGreaterThan(0);
    }
  });

  it('findTaxAccounting 找得到已知類型、找不到未知類型', () => {
    expect(findTaxAccounting('staking_reward')?.authority).toContain('2023-14');
    expect(findTaxAccounting('platform_custody')?.authority).toContain('SAB 122');
    expect(findTaxAccounting('nope' as never)).toBeNull();
  });
});

describe('創新導向監管的正當性', () => {
  const allTrue = {
    transparentRulemaking: true,
    multiStakeholder: true,
    continuousDisclosure: true,
    independentJudgment: true,
    accountability: true,
  };

  it('五項條件齊備才具正當性，且不列風險', () => {
    const result = legitimacyCheck(allTrue);
    expect(result.legitimate).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.risks).toHaveLength(0);
  });

  it('缺一項即不具正當性，並列出四項風險', () => {
    const result = legitimacyCheck({ ...allTrue, accountability: false });
    expect(result.legitimate).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.risks).toHaveLength(4);
  });

  it('五項全缺時列出五個阻擋', () => {
    const result = legitimacyCheck({
      transparentRulemaking: false,
      multiStakeholder: false,
      continuousDisclosure: false,
      independentJudgment: false,
      accountability: false,
    });
    expect(result.blockers).toHaveLength(5);
  });
});

describe('CLARITY Act 條件語氣', () => {
  it('截至 2026-05-31 尚未成法', () => {
    expect(CLARITY_ACT_STATUS.isLaw).toBe(false);
    expect(CLARITY_ACT_STATUS.billNo).toBe('H.R. 3633');
    expect(CLARITY_ACT_STATUS.remainingSteps).toHaveLength(3);
  });

  it('措辭必須是條件語氣，不得寫成已實施', () => {
    const phrasing = clarityActPhrasing();
    expect(phrasing).toContain('尚未成法');
    expect(phrasing).toContain('H.R. 3633');
    expect(phrasing).toContain('參議院全院審議');
    expect(phrasing).not.toContain('已成為法律');
  });
});
