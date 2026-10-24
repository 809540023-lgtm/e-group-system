/**
 * 監理環境：從「執法監管」到「創新導向」的制度轉型。
 *
 * 規範來源：博士論文《美國數位資產監管政策的制度轉型 —— 從「執法監管」到「創新導向」的典範轉移》。
 *
 * 四條不可跨越的界線：
 * 1. 創新導向監管不是監管鬆綁；它要求更清楚的規則、更透明的程序與更強的問責。
 * 2. 證券法上不構成證券，不代表稅法上不構成所得；會計採公允價值，也不決定課稅時點。
 * 3. 代幣在 A 國合法，不代表可在 B 國要約；跨境要約須先確認等同性認定或當地許可。
 * 4. 安全港、不採取行動信函與監理沙盒都有期限、揭露與退出機制，不得當成永久豁免。
 *
 * 本模組只做規則判斷，不代替法律或稅務意見。
 */

/* ------------------------------------------------------------------ */
/* 監理姿態                                                            */
/* ------------------------------------------------------------------ */

export type RegulatoryPosture =
  | 'enforcement_led'
  | 'innovation_oriented'
  | 'equivalence_required'
  | 'restricted';

export interface Jurisdiction {
  readonly code: string;
  readonly name: string;
  readonly posture: RegulatoryPosture;
  readonly framework: string;
  readonly retailAllowed: boolean;
  readonly professionalOnly: boolean;
  readonly equivalenceRequired: boolean;
  readonly note: string;
}

export const POSTURE_LABELS: Readonly<Record<RegulatoryPosture, string>> = {
  enforcement_led: '執法監管',
  innovation_oriented: '創新導向',
  equivalence_required: '須等同性認定',
  restricted: '限制或禁止',
};

/**
 * 論文第七章第三節的全球監理競爭評估。美國在 2025 年由執法導向轉為創新導向；
 * 歐盟走規則導向（MiCA）；新加坡與香港走選擇性開放。台灣以櫃買中心規範為主。
 */
export const JURISDICTIONS: readonly Jurisdiction[] = [
  {
    code: 'US',
    name: '美國',
    posture: 'innovation_oriented',
    framework: 'SEC／CFTC 聯合框架（Project Crypto）',
    retailAllowed: true,
    professionalOnly: false,
    equivalenceRequired: false,
    note: '2025 年由執法導向轉為規則導向；CLARITY Act 尚未成法，須用條件語氣。',
  },
  {
    code: 'EU',
    name: '歐盟',
    posture: 'equivalence_required',
    framework: 'MiCA',
    retailAllowed: true,
    professionalOnly: false,
    equivalenceRequired: true,
    note: '第三國發行人須經等同性認定或設立歐盟分支機構（MiCA 第 16、60 條）。',
  },
  {
    code: 'SG',
    name: '新加坡',
    posture: 'innovation_oriented',
    framework: '支付服務法（PSA）',
    retailAllowed: true,
    professionalOnly: false,
    equivalenceRequired: false,
    note: 'MAS 以監理沙盒與創新加速器扶植，為亞洲樞紐。',
  },
  {
    code: 'HK',
    name: '香港',
    posture: 'innovation_oriented',
    framework: 'SFC 虛擬資產服務提供者（VASP）牌照',
    retailAllowed: true,
    professionalOnly: false,
    equivalenceRequired: false,
    note: '2023 年起開放零售參與，採選擇性開放。',
  },
  {
    code: 'TW',
    name: '台灣',
    posture: 'restricted',
    framework: '證券交易法與櫃買中心證券型代幣規範',
    retailAllowed: false,
    professionalOnly: true,
    equivalenceRequired: false,
    note: '有專業投資人人數上限；建立平台不等於取得發行或交易許可。',
  },
];

export function findJurisdiction(code: string): Jurisdiction | null {
  return JURISDICTIONS.find((item) => item.code === code) ?? null;
}

/* ------------------------------------------------------------------ */
/* 政策時間軸                                                          */
/* ------------------------------------------------------------------ */

export type PolicyEventKind =
  | 'enforcement'
  | 'personnel'
  | 'guidance'
  | 'legislation'
  | 'coordination'
  | 'accounting';

export interface PolicyEvent {
  readonly date: string;
  readonly kind: PolicyEventKind;
  readonly title: string;
  readonly summary: string;
  readonly postureAfter: RegulatoryPosture;
}

export const POLICY_EVENT_KIND_LABELS: Readonly<Record<PolicyEventKind, string>> = {
  enforcement: '執法行動',
  personnel: '人事',
  guidance: '指引',
  legislation: '立法',
  coordination: '跨機關協調',
  accounting: '會計',
};

/**
 * 論文第三章第二節的政策輸出時間序列，加上第二章的執法期起點。
 * 每一筆都標記事件後的監理姿態，用來畫轉折點。
 */
export const POLICY_TIMELINE: readonly PolicyEvent[] = [
  {
    date: '2020-12-22',
    kind: 'enforcement',
    title: 'SEC 對 Ripple 提起訴訟',
    summary: '執法監管期的代表性案件，以訴訟建立規則而非以規則明確標準。',
    postureAfter: 'enforcement_led',
  },
  {
    date: '2023-07-13',
    kind: 'enforcement',
    title: 'SEC v. Ripple Labs 部分敗訴',
    summary: '法院認定 XRP 在程序化銷售中不構成證券，削弱執法立場的法律基礎。',
    postureAfter: 'enforcement_led',
  },
  {
    date: '2023-08-29',
    kind: 'enforcement',
    title: 'Grayscale 案裁定 SEC 拒絕現貨 ETF 為任意反覆',
    summary: '司法挫折累積，成為 2025 年轉向的正當性來源之一。',
    postureAfter: 'enforcement_led',
  },
  {
    date: '2025-01-20',
    kind: 'personnel',
    title: 'Gensler 辭去 SEC 主席',
    summary: '關鍵時刻（critical juncture）：既有制度均衡被打破，新軌跡得以確立。',
    postureAfter: 'enforcement_led',
  },
  {
    date: '2025-01-21',
    kind: 'personnel',
    title: '成立 Crypto Task Force，由 Peirce 領導',
    summary: 'Uyeda 代理主席期間的過渡措施，重啟規則制定議程。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-01-23',
    kind: 'accounting',
    title: '撤銷 SAB 121，改以 SAB 122 處理託管義務',
    summary: '由強制負債認列改為或有負債判斷，解除銀行進入加密託管的會計障礙。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-02-27',
    kind: 'guidance',
    title: '迷因幣指引：通常不構成證券',
    summary: '改採事實導向的個案分析，不再一概而論「大多數代幣都是證券」。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-03-20',
    kind: 'guidance',
    title: 'PoW 挖礦指引：挖礦本身不構成證券交易',
    summary: '礦工以算力換取獎勵屬服務對價，不符合 Howey 的「來自他人努力」。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-04-04',
    kind: 'guidance',
    title: '穩定幣指引：足額儲備的特定穩定幣不構成證券',
    summary: '購買者合理期待價值穩定而非利潤；「充足儲備」範圍仍待明確。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-04-21',
    kind: 'personnel',
    title: 'Paul Atkins 接任 SEC 主席',
    summary: '監理哲學由風險規避轉向創新促進，由執法導向轉向規則導向。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-05-29',
    kind: 'legislation',
    title: 'CLARITY Act（H.R. 3633）提出',
    summary: '試圖劃分 SEC 與 CFTC 管轄權、建立資產分類標準與 DeFi 安全港。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-07-17',
    kind: 'legislation',
    title: 'CLARITY Act 通過眾議院',
    summary: '仍待參議院全院審議、兩院版本協調與總統簽署，尚未成法。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-08-05',
    kind: 'guidance',
    title: '流動性質押指引：非託管質押不構成證券',
    summary: '區分託管與非託管質押；流動性質押代幣的法律地位仍待釐清。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2025-09-02',
    kind: 'coordination',
    title: 'SEC-CFTC 聯合聲明：Project Crypto 與 Crypto Sprint',
    summary: '建立聯合工作組，目標 2026 年完成初步聯合框架，減少監管套利空間。',
    postureAfter: 'innovation_oriented',
  },
  {
    date: '2026-05-14',
    kind: 'legislation',
    title: '參議院銀行委員會以 15-9 通過市場結構法案版本',
    summary: '仍待參議院全院審議、兩院協調與總統簽署；所有引用須用條件語氣。',
    postureAfter: 'innovation_oriented',
  },
];

/* ------------------------------------------------------------------ */
/* 執法監管期的量化觀測                                                */
/* ------------------------------------------------------------------ */

export interface EnforcementStats {
  readonly actions: number;
  readonly fraudSharePct: number;
  readonly unregisteredSharePct: number;
  readonly settlementUsd: number;
  readonly developerShareFromPct: number;
  readonly developerShareToPct: number;
  readonly usIncorporationFromPct: number;
  readonly usIncorporationToPct: number;
  readonly vcShareFromPct: number;
  readonly vcShareToPct: number;
}

/**
 * 論文第二章第一節與第五節。三組獨立資料（Electric Capital、PitchBook、Galaxy Research）
 * 方向一致：執法監管期伴隨可觀的產業重心外移。此為描述性觀測，不構成因果識別。
 */
export const ENFORCEMENT_2020_2024: EnforcementStats = {
  actions: 125,
  fraudSharePct: 66,
  unregisteredSharePct: 63,
  settlementUsd: 5_000_000_000,
  developerShareFromPct: 38.0,
  developerShareToPct: 25.7,
  usIncorporationFromPct: 47,
  usIncorporationToPct: 31,
  vcShareFromPct: 44,
  vcShareToPct: 33,
};

/* ------------------------------------------------------------------ */
/* 等同性認定                                                          */
/* ------------------------------------------------------------------ */

export interface EquivalenceInput {
  readonly substantiveEquivalence: boolean;
  readonly infoSharingMou: boolean;
  readonly reciprocalAccess: boolean;
  readonly localBranchAvailable: boolean;
}

export interface EquivalenceAssessment {
  readonly determined: boolean;
  readonly route: 'equivalence' | 'local_branch' | 'none';
  readonly blockers: readonly string[];
}

/**
 * MiCA 第 16、60 條：第三國發行人要在歐盟提供代幣，須經等同性認定或設立歐盟分支機構。
 * 等同性認定有三項判準，缺一不可；三項都不成立時只能走分支機構，兩者皆無則不得要約。
 */
export function equivalenceAssessment(input: EquivalenceInput): EquivalenceAssessment {
  const blockers: string[] = [];
  if (!input.substantiveEquivalence) blockers.push('本國監理制度與 MiCA 核心原則未達實質等同。');
  if (!input.infoSharingMou) blockers.push('監理機關與 ESMA 之間缺少資訊共享與執法協作機制。');
  if (!input.reciprocalAccess) blockers.push('未對歐盟客戶提供互惠市場准入待遇。');

  const determined = blockers.length === 0;
  const route: EquivalenceAssessment['route'] = determined
    ? 'equivalence'
    : input.localBranchAvailable
      ? 'local_branch'
      : 'none';

  return { determined, route, blockers };
}

/* ------------------------------------------------------------------ */
/* 安全港與過渡期機制                                                  */
/* ------------------------------------------------------------------ */

export type SafeHarborKind = 'temporary_safe_harbor' | 'no_action_letter' | 'sandbox';

export const SAFE_HARBOR_LABELS: Readonly<Record<SafeHarborKind, string>> = {
  temporary_safe_harbor: '臨時安全港',
  no_action_letter: '不採取行動信函',
  sandbox: '監理沙盒',
};

export interface SafeHarborInput {
  readonly kind: SafeHarborKind;
  readonly goodFaith: boolean;
  readonly complianceMeasures: boolean;
  readonly reportingCadence: 'none' | 'quarterly' | 'semiannual' | 'annual';
  readonly openedOn: string;
  readonly expiresOn: string | null;
  readonly extensionMonths: number;
  readonly userCap: number | null;
  readonly volumeCapTwd: number | null;
  readonly exitMechanism: 'none' | 'approved' | 'modified' | 'terminated';
  readonly published: boolean;
}

export interface SafeHarborCheck {
  readonly valid: boolean;
  readonly maxMonths: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

const SAFE_HARBOR_MAX_MONTHS: Readonly<Record<SafeHarborKind, number>> = {
  temporary_safe_harbor: 24,
  no_action_letter: 24,
  sandbox: 36,
};

const SANDBOX_BASE_MONTHS = 24;
const SANDBOX_MAX_EXTENSION_MONTHS = 12;

function monthsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return (to - from) / (30.44 * 86_400_000);
}

/**
 * 論文第五章第四節。安全港不是永久豁免：必須有善意認定、合理合規措施、定期報告、
 * 明確期限與退出機制。沙盒另有規模上限，且延長不得超過 12 個月。
 */
export function safeHarborCheck(input: SafeHarborInput): SafeHarborCheck {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const maxMonths = SAFE_HARBOR_MAX_MONTHS[input.kind];

  if (!input.goodFaith) blockers.push('缺少善意非證券認定，安全港不成立。');
  if (!input.complianceMeasures) blockers.push('未採取合理合規措施，安全港不成立。');
  if (input.reportingCadence === 'none') blockers.push('缺少定期報告機制，安全港不成立。');
  if (!input.expiresOn) {
    blockers.push('缺少到期日，安全港不得無限期。');
  } else {
    const months = monthsBetween(input.openedOn, input.expiresOn);
    if (Number.isNaN(months)) {
      blockers.push('日期格式無法解析。');
    } else if (months > maxMonths) {
      blockers.push(`期間 ${months.toFixed(1)} 個月超過上限 ${maxMonths} 個月。`);
    }
  }
  if (input.kind === 'sandbox') {
    if (input.extensionMonths > SANDBOX_MAX_EXTENSION_MONTHS) {
      blockers.push(`沙盒延長 ${input.extensionMonths} 個月超過上限 ${SANDBOX_MAX_EXTENSION_MONTHS} 個月。`);
    }
    if (input.userCap === null) blockers.push('沙盒缺少用戶數上限。');
    if (input.volumeCapTwd === null) blockers.push('沙盒缺少交易金額上限。');
    if (input.exitMechanism === 'none') blockers.push('沙盒缺少退出機制。');
  }
  if (input.kind === 'no_action_letter' && !input.published) {
    warnings.push('信函未公開，無法轉化為市場指引。');
  }
  if (input.kind === 'temporary_safe_harbor' && input.reportingCadence === 'annual') {
    warnings.push('臨時安全港建議至少每半年報告一次營運情況。');
  }

  return { valid: blockers.length === 0, maxMonths, blockers, warnings };
}

export const SANDBOX_LIMITS = {
  baseMonths: SANDBOX_BASE_MONTHS,
  maxExtensionMonths: SANDBOX_MAX_EXTENSION_MONTHS,
} as const;

/* ------------------------------------------------------------------ */
/* 揭露義務                                                            */
/* ------------------------------------------------------------------ */

export type DisclosureSubject = 'staking' | 'custody' | 'token_issuance';

export interface DisclosureItem {
  readonly key: string;
  readonly label: string;
  readonly satisfied: boolean;
  readonly evidence: string | null;
}

export interface DisclosureChecklist {
  readonly complete: boolean;
  readonly missing: readonly string[];
  readonly satisfiedCount: number;
  readonly requiredCount: number;
}

const REQUIRED_DISCLOSURES: Readonly<Record<DisclosureSubject, readonly string[]>> = {
  staking: ['yield_calculation', 'slashing_risk', 'unlock_period'],
  custody: ['key_management', 'self_custody_right', 'segregation'],
  token_issuance: ['underlying_asset', 'transfer_restriction', 'investor_eligibility', 'risk_factors'],
};

export const DISCLOSURE_LABELS: Readonly<Record<string, string>> = {
  yield_calculation: '收益率計算方法',
  slashing_risk: '削減風險（Slashing）',
  unlock_period: '解鎖期',
  key_management: '私鑰管理',
  self_custody_right: '自託管權利',
  segregation: '客戶資產隔離',
  underlying_asset: '底層資產',
  transfer_restriction: '轉讓限制',
  investor_eligibility: '投資人適格條件',
  risk_factors: '風險因素',
};

/**
 * 論文第五章第二節第三款與第三節第三款。揭露不只是提供資訊，還要讓人看得懂、
 * 用得上；缺少必要項目即不得對外提供服務。
 */
export function disclosureChecklist(
  subject: DisclosureSubject,
  items: readonly DisclosureItem[],
): DisclosureChecklist {
  const required = REQUIRED_DISCLOSURES[subject];
  const byKey = new Map(items.map((item) => [item.key, item]));
  const missing: string[] = [];
  let satisfiedCount = 0;

  for (const key of required) {
    const item = byKey.get(key);
    if (item === undefined || !item.satisfied || item.evidence === null || item.evidence.trim().length === 0) {
      missing.push(DISCLOSURE_LABELS[key] ?? key);
    } else {
      satisfiedCount += 1;
    }
  }

  return {
    complete: missing.length === 0,
    missing,
    satisfiedCount,
    requiredCount: required.length,
  };
}

/* ------------------------------------------------------------------ */
/* 跨境要約                                                            */
/* ------------------------------------------------------------------ */

export type CrossBorderCode =
  | 'ALLOWED'
  | 'REGIME_UNKNOWN'
  | 'RESTRICTED_JURISDICTION'
  | 'EQUIVALENCE_MISSING'
  | 'LOCAL_LICENSE_MISSING'
  | 'RETAIL_NOT_ALLOWED'
  | 'PROFESSIONAL_ONLY';

export interface CrossBorderInput {
  readonly destinationCode: string;
  readonly tokenState: 'ST' | 'ST+';
  readonly programProfessionalOnly: boolean;
  readonly holderCategory: 'general' | 'professional' | 'accredited';
  readonly equivalenceDetermined: boolean;
  readonly localLicenseHeld: boolean;
}

export interface CrossBorderDecision {
  readonly allowed: boolean;
  readonly code: CrossBorderCode;
  readonly reason: string;
}

/**
 * 論文第七章第四節。代幣在 A 國合法不代表可在 B 國要約；跨境前必須確認
 * 目的地監理姿態、等同性認定或當地許可，以及零售／專業投資人限制。
 */
export function crossBorderGuard(input: CrossBorderInput): CrossBorderDecision {
  const regime = findJurisdiction(input.destinationCode);
  if (regime === null) {
    return {
      allowed: false,
      code: 'REGIME_UNKNOWN',
      reason: `未登錄 ${input.destinationCode} 的監理姿態，不得要約。`,
    };
  }
  if (regime.posture === 'restricted') {
    return {
      allowed: false,
      code: 'RESTRICTED_JURISDICTION',
      reason: `${regime.name} 屬限制或禁止類，不得對外要約。`,
    };
  }
  if (regime.equivalenceRequired && !input.equivalenceDetermined && !input.localLicenseHeld) {
    return {
      allowed: false,
      code: 'EQUIVALENCE_MISSING',
      reason: `${regime.name} 須經等同性認定或設立當地分支機構，兩者皆缺。`,
    };
  }
  if (regime.professionalOnly && input.holderCategory === 'general') {
    return {
      allowed: false,
      code: 'RETAIL_NOT_ALLOWED',
      reason: `${regime.name} 不開放零售參與，一般投資人不得受讓。`,
    };
  }
  if (input.tokenState === 'ST' && input.programProfessionalOnly && input.holderCategory === 'general') {
    return {
      allowed: false,
      code: 'PROFESSIONAL_ONLY',
      reason: '本計畫限專業投資人，證券狀態不得由一般投資人持有。',
    };
  }
  return {
    allowed: true,
    code: 'ALLOWED',
    reason: `${regime.name} 的監理姿態與投資人類別均符合，可進行要約。`,
  };
}

/* ------------------------------------------------------------------ */
/* 稅務與會計                                                          */
/* ------------------------------------------------------------------ */

export type TaxAccountingKind =
  | 'mining_reward'
  | 'staking_reward'
  | 'liquid_staking_swap'
  | 'gas_fee'
  | 'platform_custody'
  | 'cross_border_reporting';

export interface TaxAccountingTreatment {
  readonly kind: TaxAccountingKind;
  readonly label: string;
  readonly taxTreatment: string;
  readonly accountingTreatment: string;
  readonly caveat: string;
  readonly authority: string;
}

/**
 * 論文第五章第五節的「交易類型—稅會處理」對照表。核心立場：
 * 證券法上不構成證券，不代表稅法上不構成所得；會計採公允價值，也不決定課稅時點。
 */
export const TAX_ACCOUNTING: readonly TaxAccountingTreatment[] = [
  {
    kind: 'mining_reward',
    label: 'PoW 挖礦或 PoS 驗證者報酬',
    taxTreatment: '取得可支配控制時，按公允市場價值認列普通所得；營業活動可能另有自雇稅或費用扣除。',
    accountingTreatment: '符合 ASU 2023-08 範圍者，後續按公允價值衡量，變動計入損益。',
    caveat: '證券法上屬技術功能，不排除稅法上構成所得。',
    authority: 'IRS Notice 2014-21；FASB ASU 2023-08',
  },
  {
    kind: 'staking_reward',
    label: '非託管質押獎勵',
    taxTreatment: '依 Rev. Rul. 2023-14，於取得支配權與控制權時按公允市場價值認列。',
    accountingTreatment: '獎勵與原持有代幣分別追蹤成本基礎及公允價值。',
    caveat: '須區分自行質押與第三方託管質押，避免把證券法分析與稅法時點混同。',
    authority: 'Rev. Rul. 2023-14',
  },
  {
    kind: 'liquid_staking_swap',
    label: '流動性質押代幣交換',
    taxTreatment: '可能被主張為非處分，也可能因權利實質不同而被視為交換；爭議未定。',
    accountingTreatment: '須揭露衍生代幣估值、贖回風險、折價與流動性風險。',
    caveat: '不可斷言不課稅；IRS 尚未提供完整專門規則。',
    authority: 'Eisner v. Macomber；Cottage Savings',
  },
  {
    kind: 'gas_fee',
    label: 'Gas fee 與優先費',
    taxTreatment: '若為取得或處分資產所必要，可能資本化為成本基礎或處分成本；營業使用可作費用。',
    accountingTreatment: '平台或驗證者收取優先費時，按收入確認邏輯處理。',
    caveat: '個人投資人、企業、平台三者處理不同。',
    authority: 'IRS Notice 2014-21',
  },
  {
    kind: 'platform_custody',
    label: '平台託管或混合託管',
    taxTreatment: '重點在受益所有權與資訊申報；是否產生所得取決於資產處分或收益分配。',
    accountingTreatment: 'SAB 122 後不再機械式認列託管負債，改依 ASC 450-20 或 IAS 37 判斷。',
    caveat: '託管會計現代化不等於免除風險揭露、內控與資本要求。',
    authority: 'SEC SAB 122；ASC 450-20／IAS 37',
  },
  {
    kind: 'cross_border_reporting',
    label: '跨境申報與 CARF',
    taxTreatment: '平台與中介可能面臨資訊申報、資料交換與 Form 1099-DA 等制度銜接。',
    accountingTreatment: '須建立使用者、地址、交易與受益所有權的可稽核流程。',
    caveat: '跨境稅務合作可能與隱私、去中心化及資料最小化原則衝突。',
    authority: 'OECD CARF；IRS Form 1099-DA',
  },
];

export function findTaxAccounting(kind: TaxAccountingKind): TaxAccountingTreatment | null {
  return TAX_ACCOUNTING.find((item) => item.kind === kind) ?? null;
}

/* ------------------------------------------------------------------ */
/* 創新導向監管的正當性條件                                            */
/* ------------------------------------------------------------------ */

export interface LegitimacyInput {
  readonly transparentRulemaking: boolean;
  readonly multiStakeholder: boolean;
  readonly continuousDisclosure: boolean;
  readonly independentJudgment: boolean;
  readonly accountability: boolean;
}

export interface LegitimacyCheck {
  readonly legitimate: boolean;
  readonly blockers: readonly string[];
  readonly risks: readonly string[];
}

const LEGITIMACY_RISKS: readonly string[] = [
  '監管俘虜：長期依賴產業提供技術知識，議程可能被大型業者主導。',
  '安全港濫用：缺少期限、揭露與退出機制時，安全港會變成事實上的豁免區。',
  '資訊不對稱：發行人與平台掌握的資訊遠高於一般投資人。',
  '產業遊說：封閉決策過程與不對稱資訊流動會侵蝕公共利益。',
];

/**
 * 論文第八章第一節第四款。創新導向監管不是監管鬆綁，而是監管品質的提升；
 * 其正當性建立在五項條件之上，缺一項就退回「共謀」而非「對話」。
 */
export function legitimacyCheck(input: LegitimacyInput): LegitimacyCheck {
  const blockers: string[] = [];
  if (!input.transparentRulemaking) blockers.push('缺少公開透明的規則制定程序。');
  if (!input.multiStakeholder) blockers.push('缺少多元利害關係人參與。');
  if (!input.continuousDisclosure) blockers.push('缺少充分且持續的資訊揭露。');
  if (!input.independentJudgment) blockers.push('監理機關未能維持獨立判斷。');
  if (!input.accountability) blockers.push('缺少事後問責與救濟機制。');

  return {
    legitimate: blockers.length === 0,
    blockers,
    risks: blockers.length === 0 ? [] : [...LEGITIMACY_RISKS],
  };
}

/* ------------------------------------------------------------------ */
/* CLARITY Act 狀態                                                    */
/* ------------------------------------------------------------------ */

export interface ClarityActStatus {
  readonly isLaw: boolean;
  readonly billNo: string;
  readonly housePassedOn: string;
  readonly senateCommitteeOn: string;
  readonly senateCommitteeVote: string;
  readonly remainingSteps: readonly string[];
  readonly requiredPhrasing: string;
}

/**
 * 論文第五章第三節的條件語氣修正。截至 2026-05-31 尚未成法，
 * 所有引用都必須寫成「若最終成法」「依目前草案」，不得寫成已實施。
 */
export const CLARITY_ACT_STATUS: ClarityActStatus = {
  isLaw: false,
  billNo: 'H.R. 3633',
  housePassedOn: '2025-07-17',
  senateCommitteeOn: '2026-05-14',
  senateCommitteeVote: '15-9',
  remainingSteps: ['參議院全院審議', '兩院版本協調', '總統簽署'],
  requiredPhrasing: '若最終成法',
};

export function clarityActPhrasing(): string {
  return CLARITY_ACT_STATUS.isLaw
    ? 'CLARITY Act 已成為法律。'
    : `CLARITY Act（${CLARITY_ACT_STATUS.billNo}）截至 2026-05-31 尚未成法；` +
        `眾議院於 ${CLARITY_ACT_STATUS.housePassedOn} 通過，參議院銀行委員會於 ` +
        `${CLARITY_ACT_STATUS.senateCommitteeOn} 以 ${CLARITY_ACT_STATUS.senateCommitteeVote} 通過版本，` +
        `仍待${CLARITY_ACT_STATUS.remainingSteps.join('、')}。`;
}
