/**
 * 區塊鏈基礎設施監管的法學方法論：資產本質、活動本質與技術中性的三重奏。
 *
 * 規範來源：博士論文《區塊鏈基礎設施監管的法學方法論 —— 資產本質、活動本質與技術中性的三重奏》。
 * 素材基礎：Sidley Austin 代表 Ava Labs 於 2025 年向 SEC 提交的三份意見書。
 *
 * 四條不可跨越的界線：
 * 1. 分類看資產本質，不看技術形式；同一法律權利記在紙本、資料庫或鏈上，性質不變。
 * 2. 去中心化不是獨立的法律測試，只能作為 Howey「他人努力」要件的判斷因素。
 * 3. 基礎設施豁免只保護被動、中立、非交易基礎報酬的活動；一旦參與撮合、保管、收益分配或市場推廣，就回到活動本質審查。
 * 4. 技術功能不構成證券，不代表不產生所得、不產生會計義務、不產生責任。
 *
 * 本模組只做規則判斷，不代替法律、稅務或會計意見。
 */

/* ------------------------------------------------------------------ */
/* 第一章：三重奏框架                                                  */
/* ------------------------------------------------------------------ */

export type TrinityPillar = 'asset_substance' | 'activity_substance' | 'technology_neutrality';

export interface TrinityPillarProfile {
  readonly pillar: TrinityPillar;
  readonly label: string;
  readonly question: string;
  readonly method: string;
  readonly chapter: string;
}

/**
 * 論文第一章的核心主張：三個測試各回答一個不同問題，不可互相取代。
 * 資產本質問「這是什麼」，活動本質問「誰該被監管」，技術中性問「技術功能本身是否構成證券交易」。
 */
export const TRINITY_PILLARS: readonly TrinityPillarProfile[] = [
  {
    pillar: 'asset_substance',
    label: '資產本質',
    question: '這個代幣代表什麼法律權利？',
    method: '五大代幣類別的資產基礎分類法，再以 Howey 四要件檢驗',
    chapter: '第二章',
  },
  {
    pillar: 'activity_substance',
    label: '活動本質',
    question: '這個主體從事的是基礎設施還是證券中介？',
    method: '經紀商／自營商／投資顧問的核心因素與否定因素',
    chapter: '第四章',
  },
  {
    pillar: 'technology_neutrality',
    label: '技術中性',
    question: '這個技術功能本身是否構成證券交易？',
    method: '內在性與必要性論證、監管對稱性、計量證據',
    chapter: '第六章',
  },
];

export function findTrinityPillar(pillar: TrinityPillar): TrinityPillarProfile | undefined {
  return TRINITY_PILLARS.find((entry) => entry.pillar === pillar);
}

/* ------------------------------------------------------------------ */
/* 第二章：五大代幣類別                                                */
/* ------------------------------------------------------------------ */

export type TokenClass =
  | 'physical_asset'
  | 'services'
  | 'intangible_asset'
  | 'native_dlt'
  | 'stablecoin';

export interface TokenClassProfile {
  readonly tokenClass: TokenClass;
  readonly label: string;
  readonly definition: string;
  readonly legalAnalogy: string;
  readonly regulator: string;
  readonly keyQuestion: string;
  readonly examples: readonly string[];
}

export const TOKEN_CLASS_LABELS: Readonly<Record<TokenClass, string>> = {
  physical_asset: '實體資產代幣',
  services: '服務代幣',
  intangible_asset: '無形資產代幣',
  native_dlt: '原生 DLT 代幣',
  stablecoin: '穩定幣',
};

/**
 * 論文第二章第二節。分類依亞里斯多德本質主義、韋伯理想類型與法律經濟學三重方法論建構；
 * 現實中的代幣可能同時具備多類特徵，須識別其主要特徵並適用相應規則。
 */
export const TOKEN_CLASSES: readonly TokenClassProfile[] = [
  {
    tokenClass: 'physical_asset',
    label: '實體資產代幣',
    definition: '任何有形資產在區塊鏈或分散式帳本上的數位表示。',
    legalAnalogy: '倉單、提單、所有權狀',
    regulator: '財產法，並視資產類型適用商品法或不動產法',
    keyQuestion: '代幣是否真正代表對實體資產的權利？須審查資產儲備、持有人權利與兌換機制。',
    examples: ['黃金代幣 PAXG', '房地產代幣', '藝術品代幣', '冷鏈設備收益權代幣'],
  },
  {
    tokenClass: 'services',
    label: '服務代幣',
    definition: '任何服務的數位表示，由特定主體向他人提供。',
    legalAnalogy: '禮券、預付卡、服務合約',
    regulator: '消費者保護法與契約法',
    keyQuestion: '代幣是否真正代表服務請求權？若價值主要來自轉售獲利預期，可能構成證券。',
    examples: ['雲端算力代幣', '法律服務代幣', '餐食兌換代幣'],
  },
  {
    tokenClass: 'intangible_asset',
    label: '無形資產代幣',
    definition: '證券代幣與非證券無形資產代幣的統稱，涵蓋債權、智慧財產權與忠誠度積分。',
    legalAnalogy: '債權憑證、智慧財產授權、會員積分',
    regulator: '證券法（證券代幣）或債權法、智慧財產權法、消費者保護法',
    keyQuestion: '無形資產的法律性質為何？須以 Howey 四要件判斷是否為證券代幣。',
    examples: ['收益權證券型代幣', '債權代幣', '專利授權代幣', '忠誠度積分'],
  },
  {
    tokenClass: 'native_dlt',
    label: '原生 DLT 代幣',
    definition: '對協議運作不可或缺的代幣，具資源分配、網路安全與治理參與三重功能。',
    legalAnalogy: '無直接類比；數位原生資產，價值來自網路效應與功能性使用',
    regulator: '須建立新類別（論文第七章協議代幣監管框架）',
    keyQuestion: '是否存在單一發行人的管理或創業努力可供依賴？充分去中心化時「他人努力」要件不成立。',
    examples: ['BTC', 'ETH', 'SOL', 'AVAX'],
  },
  {
    tokenClass: 'stablecoin',
    label: '穩定幣',
    definition: '設計用於對某些底層參考（通常是法定貨幣）維持穩定價值的代幣。',
    legalAnalogy: '貨幣、電子支付工具、資產參考代幣',
    regulator: '支付法規；若價值來自發行人資產管理且持有人期待利潤，可能構成證券',
    keyQuestion: '是交易媒介與價值儲存，還是發行人資產管理下的利潤期待？',
    examples: ['覆蓋性支付穩定幣', '資產參考代幣 ART', '電子貨幣代幣 EMT'],
  },
];

export function findTokenClass(tokenClass: TokenClass): TokenClassProfile | undefined {
  return TOKEN_CLASSES.find((entry) => entry.tokenClass === tokenClass);
}

export interface TokenClassificationInput {
  readonly representsTangibleAsset: boolean;
  readonly representsServiceClaim: boolean;
  readonly representsFinancialClaim: boolean;
  readonly indispensableToProtocol: boolean;
  readonly peggedToReference: boolean;
  readonly resaleProfitIsPrimaryPurpose: boolean;
}

export interface TokenClassification {
  readonly tokenClass: TokenClass;
  readonly label: string;
  readonly securitiesRisk: 'low' | 'medium' | 'high';
  readonly reasons: readonly string[];
  readonly howeyNeeded: boolean;
}

/**
 * 論文第二章第二節的分類判斷。順序刻意如此：先問是否代表實體資產，再問服務請求權，
 * 再問金融請求權，最後才問是否為協議運作所不可或缺。穩定幣與原生 DLT 代幣放最後，
 * 因為兩者都可能同時具備前述特徵，須以「主要功能」定之。
 */
export function classifyToken(input: TokenClassificationInput): TokenClassification {
  const reasons: string[] = [];

  if (input.representsTangibleAsset) {
    reasons.push('代幣代表有形資產，法律效果取決於所代表的有形資產而非帳本形式。');
    return {
      tokenClass: 'physical_asset',
      label: TOKEN_CLASS_LABELS.physical_asset,
      securitiesRisk: input.resaleProfitIsPrimaryPurpose ? 'medium' : 'low',
      reasons,
      howeyNeeded: input.resaleProfitIsPrimaryPurpose,
    };
  }

  if (input.representsServiceClaim) {
    reasons.push('代幣代表服務請求權，原則上受消費者保護法與契約法規範。');
    if (input.resaleProfitIsPrimaryPurpose) {
      reasons.push('購買者主要目的為轉售獲利而非使用服務，可能構成投資契約（SEC v. Telegram 類型）。');
    }
    return {
      tokenClass: 'services',
      label: TOKEN_CLASS_LABELS.services,
      securitiesRisk: input.resaleProfitIsPrimaryPurpose ? 'high' : 'low',
      reasons,
      howeyNeeded: input.resaleProfitIsPrimaryPurpose,
    };
  }

  if (input.representsFinancialClaim) {
    reasons.push('代幣代表對特定主體的債權、股權或收益分配請求權，須以 Howey 四要件檢驗。');
    return {
      tokenClass: 'intangible_asset',
      label: TOKEN_CLASS_LABELS.intangible_asset,
      securitiesRisk: 'high',
      reasons,
      howeyNeeded: true,
    };
  }

  if (input.peggedToReference) {
    reasons.push('代幣設計用於對底層參考維持穩定價值，屬支付工具性質。');
    if (input.resaleProfitIsPrimaryPurpose) {
      reasons.push('若價值來自發行人的資產管理且持有人合理期待利潤，仍可能滿足 Howey 測試。');
    }
    return {
      tokenClass: 'stablecoin',
      label: TOKEN_CLASS_LABELS.stablecoin,
      securitiesRisk: input.resaleProfitIsPrimaryPurpose ? 'medium' : 'low',
      reasons,
      howeyNeeded: input.resaleProfitIsPrimaryPurpose,
    };
  }

  if (input.indispensableToProtocol) {
    reasons.push('代幣對協議運作不可或缺，具資源分配、網路安全與治理參與三重功能。');
    reasons.push('關鍵在「他人努力」要件：充分去中心化時不存在單一發行人的管理或創業努力。');
    return {
      tokenClass: 'native_dlt',
      label: TOKEN_CLASS_LABELS.native_dlt,
      securitiesRisk: 'low',
      reasons,
      howeyNeeded: true,
    };
  }

  reasons.push('未符合任何類別的主要特徵，須回到個案審查其經濟實質。');
  return {
    tokenClass: 'intangible_asset',
    label: TOKEN_CLASS_LABELS.intangible_asset,
    securitiesRisk: 'high',
    reasons,
    howeyNeeded: true,
  };
}

/* ------------------------------------------------------------------ */
/* 第二章第三節：與 Howey 及 UCC 的協調                                */
/* ------------------------------------------------------------------ */

export interface HoweyInput {
  readonly moneyInvestment: boolean;
  readonly commonEnterprise: boolean;
  readonly profitExpectation: boolean;
  readonly effortsOfOthers: boolean;
}

export interface HoweyResult {
  readonly isInvestmentContract: boolean;
  readonly failedElements: readonly string[];
  readonly note: string;
}

/**
 * 論文第二章第三節第一款。資產基礎分類法不取代 Howey，而是為其提供更精確的適用框架。
 * 「他人努力」應理解為「特定發行人的努力」，而非廣義的「他人貢獻」。
 */
export function howeyTest(input: HoweyInput): HoweyResult {
  const failedElements: string[] = [];
  if (!input.moneyInvestment) failedElements.push('金錢投資');
  if (!input.commonEnterprise) failedElements.push('共同事業');
  if (!input.profitExpectation) failedElements.push('合理期待利潤');
  if (!input.effortsOfOthers) failedElements.push('利潤來自他人努力');

  return {
    isInvestmentContract: failedElements.length === 0,
    failedElements,
    note:
      failedElements.length === 0
        ? '四要件齊備，構成投資契約。'
        : `缺少${failedElements.join('、')}，不構成投資契約。`,
  };
}

export interface UccArticle12Profile {
  readonly article: string;
  readonly concept: string;
  readonly scope: string;
  readonly divisionOfLabor: string;
}

/**
 * 論文第二章第三節第二款。2022 年 UCC 修正案第 12 條為「可控電子記錄」（CERs）建立框架，
 * 體現「數位化不改變資產本質」原則：第 12 條處理財產法問題，資產基礎分類法處理監管歸屬問題。
 */
export const UCC_ARTICLE_12: UccArticle12Profile = {
  article: 'UCC 第 12 條（2022 年修正案）',
  concept: '可控電子記錄（Controllable Electronic Records, CERs）',
  scope: '控制、轉讓、擔保等財產法問題',
  divisionOfLabor: '第 12 條處理財產法，資產基礎分類法處理監管歸屬，兩者分工明確、相輔相成。',
};

/* ------------------------------------------------------------------ */
/* 第三章：去中心化的法學解構                                          */
/* ------------------------------------------------------------------ */

export type DecentralizationDimension = 'computer_science' | 'economics' | 'political_science';

export interface DecentralizationDefinition {
  readonly dimension: DecentralizationDimension;
  readonly label: string;
  readonly criteria: readonly string[];
  readonly difficulty: string;
}

/**
 * 論文第三章第一節。三種定義各有其操作困難，任何一種都無法直接轉化為法律測試。
 */
export const DECENTRALIZATION_DEFINITIONS: readonly DecentralizationDefinition[] = [
  {
    dimension: 'computer_science',
    label: '電腦科學定義',
    criteria: ['無單點故障', '無單一資料來源', '無單一權威'],
    difficulty: '衡量的是容錯能力而非權利義務關係；不同共識機制的去中心化程度差異巨大。',
  },
  {
    dimension: 'economics',
    label: '經濟學定義',
    criteria: ['無市場支配', '無寡佔共謀'],
    difficulty: '需市場界定、HHI 集中度與進入障礙分析；全球性、24/7、高流動性使傳統工具難以適用。',
  },
  {
    dimension: 'political_science',
    label: '政治學定義',
    criteria: ['無單一治理權威', '分散式決策'],
    difficulty: '實證顯示多數 DAO 治理權高度集中，投票參與率極低，分散式決策多為理想而非現實。',
  },
];

export interface DecentralizationInfeasibility {
  readonly problem: string;
  readonly detail: string;
}

/**
 * 論文第三章第二節。去中心化作為獨立法律測試的三類不可行性。
 */
export const DECENTRALIZATION_INFEASIBILITY: readonly DecentralizationInfeasibility[] = [
  {
    problem: '認識論問題：誰來判斷？',
    detail: '技術專家判斷但法院擁有最終解釋權；主觀判斷難以一致，客觀判斷難以量化；靜態與動態之爭無解。',
  },
  {
    problem: '時間問題：光譜還是門檻？',
    detail: '去中心化是連續光譜，任何門檻設定都武斷；程度動態變化將使代幣法律地位隨時間變動。',
  },
  {
    problem: '實務操作困難',
    detail: '資料取得不完整、指標選擇與加權無共識、多數網路處於灰色地帶、跨國標準不一導致監管套利。',
  },
];

export interface DecentralizationMetrics {
  readonly nakamotoCoefficient: number;
  readonly gini: number;
  readonly countryCount: number;
  readonly top5CountryShare: number;
  readonly stakingRatio: number;
  readonly usageDensity: number;
  readonly singleEntityControl: boolean;
  readonly governanceConcentration: number;
}

export type DecentralizationBand = 'centralized' | 'emerging' | 'diffuse';

export interface DecentralizationProfile {
  readonly band: DecentralizationBand;
  readonly label: string;
  readonly effortsOfOthers: boolean;
  readonly reasons: readonly string[];
  readonly caveat: string;
}

/**
 * 論文第三章第三節。去中心化最適合作為 Howey「他人努力」要件的判斷因素，而非獨立測試。
 * 因此本函式只輸出「他人努力要件是否成立」，不輸出「是否為證券」。
 */
export function decentralizationProfile(input: DecentralizationMetrics): DecentralizationProfile {
  const reasons: string[] = [];
  let score = 0;

  if (input.nakamotoCoefficient >= 20) {
    score += 2;
    reasons.push(`Nakamoto 係數 ${input.nakamotoCoefficient}，控制三分之一共識權需多個實體。`);
  } else if (input.nakamotoCoefficient >= 8) {
    score += 1;
    reasons.push(`Nakamoto 係數 ${input.nakamotoCoefficient}，集中度中等。`);
  } else {
    reasons.push(`Nakamoto 係數僅 ${input.nakamotoCoefficient}，少數實體即可影響共識。`);
  }

  if (input.gini <= 0.55) {
    score += 2;
    reasons.push(`質押量 Gini 係數 ${input.gini.toFixed(2)}，分布相對平均。`);
  } else if (input.gini <= 0.7) {
    score += 1;
    reasons.push(`質押量 Gini 係數 ${input.gini.toFixed(2)}，分布中度不均。`);
  } else {
    reasons.push(`質押量 Gini 係數 ${input.gini.toFixed(2)}，分布高度不均。`);
  }

  if (input.countryCount >= 40 && input.top5CountryShare <= 0.55) {
    score += 2;
    reasons.push(`驗證者分布於 ${input.countryCount} 國，前五大國家合計 ${(input.top5CountryShare * 100).toFixed(0)}%。`);
  } else if (input.countryCount >= 25) {
    score += 1;
    reasons.push(`驗證者分布於 ${input.countryCount} 國，地理分散度中等。`);
  } else {
    reasons.push(`驗證者僅分布於 ${input.countryCount} 國，地理集中。`);
  }

  if (input.singleEntityControl) {
    score -= 3;
    reasons.push('仍有單一實體可單方面變更協議規則或狀態。');
  }
  if (input.governanceConcentration >= 0.5) {
    score -= 1;
    reasons.push(`治理投票權集中度 ${(input.governanceConcentration * 100).toFixed(0)}%，少數地址主導決策。`);
  }

  const band: DecentralizationBand = score >= 5 ? 'diffuse' : score >= 2 ? 'emerging' : 'centralized';
  const label =
    band === 'diffuse' ? '充分分散' : band === 'emerging' ? '發展中' : '集中';

  return {
    band,
    label,
    effortsOfOthers: band !== 'diffuse',
    reasons,
    caveat:
      '去中心化程度只影響 Howey「他人努力」要件，不能取代整個 Howey 測試；' +
      '即使網路充分去中心化，若代幣本質上是對特定資產的債權或股權，仍可能構成證券。',
  };
}

/**
 * Nakamoto 係數：控制三分之一共識權所需的最少實體數。
 * 論文第六章第五節引用 Messari（2024）之測量方法。
 */
export function nakamotoCoefficient(shares: readonly number[]): number {
  const total = shares.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  const sorted = [...shares].sort((a, b) => b - a);
  let cumulative = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    cumulative += sorted[index] ?? 0;
    if (cumulative / total >= 1 / 3) return index + 1;
  }
  return sorted.length;
}

/**
 * Gini 係數：以驗證者質押量衡量分布不均程度。0 為完全平均，1 為完全集中。
 */
export function giniCoefficient(values: readonly number[]): number {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  const count = positive.length;
  if (count === 0) return 0;
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  let weighted = 0;
  for (let index = 0; index < count; index += 1) {
    weighted += (index + 1) * (positive[index] ?? 0);
  }
  return (2 * weighted) / (count * total) - (count + 1) / count;
}

export interface ChainDecentralizationBenchmark {
  readonly chain: string;
  readonly nakamotoCoefficient: number;
  readonly gini: number;
  readonly countryCount: number;
  readonly top5CountryShare: number;
  readonly stakingRatio: number;
  readonly usageDensity: number;
  readonly gasMedianUsd: number;
}

/**
 * 論文第六章第五節的計量證據。數值為論文引用之 2024–2025 年測量結果，
 * 用途是支持「驗證者經濟顯著較傳統證券市場分散」的規範主張。
 */
export const CHAIN_BENCHMARKS: readonly ChainDecentralizationBenchmark[] = [
  {
    chain: 'Ethereum',
    nakamotoCoefficient: 4,
    gini: 0.81,
    countryCount: 39,
    top5CountryShare: 0.62,
    stakingRatio: 0.28,
    usageDensity: 0.0051,
    gasMedianUsd: 3.2,
  },
  {
    chain: 'Solana',
    nakamotoCoefficient: 21,
    gini: 0.65,
    countryCount: 47,
    top5CountryShare: 0.51,
    stakingRatio: 0.67,
    usageDensity: 0.0142,
    gasMedianUsd: 0.0008,
  },
  {
    chain: 'Avalanche',
    nakamotoCoefficient: 28,
    gini: 0.51,
    countryCount: 47,
    top5CountryShare: 0.51,
    stakingRatio: 0.56,
    usageDensity: 0.0084,
    gasMedianUsd: 0.014,
  },
];

export function findChainBenchmark(chain: string): ChainDecentralizationBenchmark | undefined {
  return CHAIN_BENCHMARKS.find((entry) => entry.chain.toLowerCase() === chain.toLowerCase());
}

/* ------------------------------------------------------------------ */
/* 第三章第四節：SEC v. Ripple Labs                                    */
/* ------------------------------------------------------------------ */

export type SaleContext = 'institutional' | 'programmatic' | 'secondary_market';

export interface RippleHolding {
  readonly context: SaleContext;
  readonly label: string;
  readonly buyerKnowsCounterparty: boolean;
  readonly reliesOnIssuerEfforts: boolean;
  readonly investmentContract: boolean;
  readonly reasoning: string;
}

/**
 * 論文第三章第四節。法院對「去中心化」保持沉默，改以「交易情境」區分：
 * 機構銷售構成投資契約，程序化銷售不構成。同一資產在不同情境下可有不同法律地位。
 */
export const RIPPLE_HOLDINGS: readonly RippleHolding[] = [
  {
    context: 'institutional',
    label: '機構銷售',
    buyerKnowsCounterparty: true,
    reliesOnIssuerEfforts: true,
    investmentContract: true,
    reasoning: '機構投資者知道購買來自 Ripple，且合理期待 Ripple 的管理努力將提升代幣價值。',
  },
  {
    context: 'programmatic',
    label: '程序化銷售',
    buyerKnowsCounterparty: false,
    reliesOnIssuerEfforts: false,
    investmentContract: false,
    reasoning: '公開市場買家不知道交易對手是誰，無法合理期待利潤來自發行人的特定努力。',
  },
  {
    context: 'secondary_market',
    label: '二級市場交易',
    buyerKnowsCounterparty: false,
    reliesOnIssuerEfforts: false,
    investmentContract: false,
    reasoning: '二級市場交易適用證券交易法之不同規定，與初級發行的定性分離。',
  },
];

export function findRippleHolding(context: SaleContext): RippleHolding | undefined {
  return RIPPLE_HOLDINGS.find((entry) => entry.context === context);
}

/* ------------------------------------------------------------------ */
/* 第四章：活動本質測試                                                */
/* ------------------------------------------------------------------ */

export type InfrastructureRole =
  | 'validator'
  | 'node_operator'
  | 'wallet_developer'
  | 'smart_contract_developer';

export type IntermediaryRole = 'broker' | 'dealer' | 'investment_adviser' | 'exchange' | 'clearing_agency';

export const INFRASTRUCTURE_ROLE_LABELS: Readonly<Record<InfrastructureRole, string>> = {
  validator: '驗證者',
  node_operator: '節點營運商',
  wallet_developer: '錢包開發商',
  smart_contract_developer: '智能合約開發商',
};

export const INTERMEDIARY_ROLE_LABELS: Readonly<Record<IntermediaryRole, string>> = {
  broker: '經紀商',
  dealer: '自營商',
  investment_adviser: '投資顧問',
  exchange: '交易所',
  clearing_agency: '清算機構',
};

export interface ActivitySubstanceInput {
  readonly role: InfrastructureRole | IntermediaryRole;
  readonly regularBusinessForOthers: boolean;
  readonly transactionBasedCompensation: boolean;
  readonly activeSolicitation: boolean;
  readonly actsAsMiddleman: boolean;
  readonly custodyClientAssets: boolean;
  readonly discretionaryAuthority: boolean;
  readonly passiveTechnicalFunction: boolean;
  readonly fixedOrUsageFee: boolean;
  readonly personalizedAdvice: boolean;
  readonly publisherException: boolean;
}

export interface ActivitySubstanceResult {
  readonly classification: 'infrastructure' | 'intermediary';
  readonly roleLabel: string;
  readonly coreFactors: readonly string[];
  readonly negativeFactors: readonly string[];
  readonly blockers: readonly string[];
  readonly note: string;
}

/**
 * 論文第四章第二節至第三節。核心因素指向中介，否定因素指向基礎設施。
 * 只要出現任一核心因素，就不能主張基礎設施豁免；否定因素只能強化、不能抵銷核心因素。
 */
export function activitySubstanceTest(input: ActivitySubstanceInput): ActivitySubstanceResult {
  const coreFactors: string[] = [];
  const negativeFactors: string[] = [];

  if (input.regularBusinessForOthers) coreFactors.push('規律性為他人帳戶買賣證券。');
  if (input.transactionBasedCompensation) coreFactors.push('收取交易基礎報酬，與交易量或交易價值直接掛鉤。');
  if (input.activeSolicitation) coreFactors.push('主動招攬證券交易或尋找投資者。');
  if (input.actsAsMiddleman) coreFactors.push('作為買賣雙方的中介，參與撮合、協商或執行。');
  if (input.custodyClientAssets) coreFactors.push('保管客戶資金或證券。');
  if (input.discretionaryAuthority) coreFactors.push('對客戶資產具裁量控制權。');
  if (input.personalizedAdvice) coreFactors.push('針對特定客戶提供個人化投資建議。');

  if (input.passiveTechnicalFunction) negativeFactors.push('僅提供軟體或技術平臺，不參與交易決策。');
  if (!input.discretionaryAuthority) negativeFactors.push('對交易無裁量權，僅執行用戶指令。');
  if (!input.custodyClientAssets) negativeFactors.push('不接觸客戶資金或證券，不負信託義務。');
  if (input.fixedOrUsageFee) negativeFactors.push('報酬為固定費用或使用量基礎，非交易基礎。');
  if (input.publisherException) negativeFactors.push('適用出版者例外，僅提供一般性資訊。');

  const classification = coreFactors.length === 0 ? 'infrastructure' : 'intermediary';
  const roleLabel =
    INFRASTRUCTURE_ROLE_LABELS[input.role as InfrastructureRole] ??
    INTERMEDIARY_ROLE_LABELS[input.role as IntermediaryRole] ??
    input.role;

  return {
    classification,
    roleLabel,
    coreFactors,
    negativeFactors,
    blockers: coreFactors,
    note:
      classification === 'infrastructure'
        ? '未出現任何核心因素，屬基礎設施提供者；仍須依是否實際參與撮合、保管、收益分配或市場推廣作具體判斷。'
        : '出現核心因素，須依活動本質接受證券中介審查；否定因素不能抵銷核心因素。',
  };
}

export interface InfrastructureExemptionArgument {
  readonly argument: 'analogy' | 'function' | 'risk';
  readonly label: string;
  readonly content: string;
}

/**
 * 論文第四章第四節。基礎設施提供者系統性豁免的三種論證。
 */
export const EXEMPTION_ARGUMENTS: readonly InfrastructureExemptionArgument[] = [
  {
    argument: 'analogy',
    label: '類比論證',
    content:
      '郵政服務傳遞股票證書與資金、電信業者提供通訊基礎設施、瀏覽器提供市場訪問工具，均未被視為證券中介。',
  },
  {
    argument: 'function',
    label: '功能論證',
    content: '基礎設施提供者僅提供「管道」不參與「交易」：被動性、中立性、不可見性三特徵。',
  },
  {
    argument: 'risk',
    label: '風險論證',
    content: '無資訊優勢、無代理成本、無系統性風險；證券法監管中介所要解決的問題在此不存在。',
  },
];

/* ------------------------------------------------------------------ */
/* 第五章：不採取行動信函                                              */
/* ------------------------------------------------------------------ */

export type NoActionPrinciple = 'passivity' | 'neutrality' | 'compensation_structure';

export const NO_ACTION_PRINCIPLE_LABELS: Readonly<Record<NoActionPrinciple, string>> = {
  passivity: '被動性',
  neutrality: '中立性',
  compensation_structure: '報酬結構',
};

export type CompensationKind = 'fixed' | 'usage' | 'transaction' | 'remote';

export const COMPENSATION_KIND_LABELS: Readonly<Record<CompensationKind, string>> = {
  fixed: '固定費用',
  usage: '使用量基礎',
  transaction: '交易基礎',
  remote: '遠程關聯',
};

export interface NoActionInput {
  readonly participatesInTradingDecisions: boolean;
  readonly managesClientRelationships: boolean;
  readonly executesTrades: boolean;
  readonly recommendsSpecificSecurities: boolean;
  readonly negotiatesBetweenParties: boolean;
  readonly selectsCounterparties: boolean;
  readonly compensationKind: CompensationKind;
}

export interface NoActionPrincipleResult {
  readonly principle: NoActionPrinciple;
  readonly label: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface NoActionResult {
  readonly exempt: boolean;
  readonly principles: readonly NoActionPrincipleResult[];
  readonly blockers: readonly string[];
}

/**
 * 論文第五章第四節。SEC 四十年不採取行動信函提煉出的三項核心原則。
 * 三項全部滿足才落入豁免；任一項不滿足即回到活動本質審查。
 */
export function noActionLetterCheck(input: NoActionInput): NoActionResult {
  const passivitySatisfied =
    !input.participatesInTradingDecisions && !input.managesClientRelationships && !input.executesTrades;
  const neutralitySatisfied =
    !input.recommendsSpecificSecurities && !input.negotiatesBetweenParties && !input.selectsCounterparties;
  const compensationSatisfied = input.compensationKind === 'fixed' || input.compensationKind === 'usage';

  const principles: NoActionPrincipleResult[] = [
    {
      principle: 'passivity',
      label: NO_ACTION_PRINCIPLE_LABELS.passivity,
      satisfied: passivitySatisfied,
      reason: passivitySatisfied
        ? '不參與交易決策、不管理客戶關係、不執行交易。'
        : '參與交易決策、客戶關係管理或交易執行，不具被動性。',
    },
    {
      principle: 'neutrality',
      label: NO_ACTION_PRINCIPLE_LABELS.neutrality,
      satisfied: neutralitySatisfied,
      reason: neutralitySatisfied
        ? '不推薦特定證券、不參與談判、不選擇交易對手。'
        : '推薦特定證券、參與談判或選擇交易對手，不具中立性。',
    },
    {
      principle: 'compensation_structure',
      label: NO_ACTION_PRINCIPLE_LABELS.compensation_structure,
      satisfied: compensationSatisfied,
      reason: compensationSatisfied
        ? `報酬為${COMPENSATION_KIND_LABELS[input.compensationKind]}，非交易基礎報酬。`
        : `報酬為${COMPENSATION_KIND_LABELS[input.compensationKind]}，與交易量或交易價值掛鉤。`,
    },
  ];

  const blockers = principles.filter((entry) => !entry.satisfied).map((entry) => entry.reason);

  return { exempt: blockers.length === 0, principles, blockers };
}

export interface NoActionPrecedent {
  readonly reference: string;
  readonly date: string;
  readonly category: 'broker' | 'adviser';
  readonly subject: string;
  readonly principle: string;
}

/**
 * 論文第五章第一節至第三節整理的信函類型學。1984 至 2024 年間 40 餘份信函，
 * 顯示 SEC 對被動技術提供者的豁免立場一貫，而非針對特定技術的權宜之計。
 */
export const NO_ACTION_PRECEDENTS: readonly NoActionPrecedent[] = [
  {
    reference: 'Venture Capital Network',
    date: '1984-05-07',
    category: 'adviser',
    subject: '配對服務',
    principle: '連結投資人與創業者、非營利、無結果基礎報酬，不構成投資顧問。',
  },
  {
    reference: 'Instinet',
    date: '1989-01-01',
    category: 'broker',
    subject: '電子交易系統',
    principle: '新技術不自動觸發新監管；郵件、電話、電傳從未被主張管轄權。',
  },
  {
    reference: 'Technology Capital Network',
    date: '1992-06-05',
    category: 'adviser',
    subject: '配對服務',
    principle: '不參與交易決策、不提供個人化建議，即使促進投資活動亦不構成投資顧問。',
  },
  {
    reference: 'EJV Partners, L.P.',
    date: '1992-12-07',
    category: 'adviser',
    subject: '被動資訊平臺',
    principle: '出版者例外：僅提供研究報告訪問，不針對特定客戶提供個人化建議。',
  },
  {
    reference: 'Real Goods Trading Corp.',
    date: '1996-06-24',
    category: 'broker',
    subject: '股東服務平臺',
    principle: '協助股東間直接交易、無中介角色、無報酬、無參與談判。',
  },
  {
    reference: 'Charles Schwab',
    date: '1996-11-27',
    category: 'broker',
    subject: '數據與資訊服務',
    principle: '僅提供資訊不構成經紀商，即使資訊可能間接影響交易決策。',
  },
  {
    reference: 'Evare, LLC',
    date: '1998-11-30',
    category: 'broker',
    subject: '電子通訊平臺',
    principle: '扮演被動角色、系統對交易實現嚴格中立、收取固定或使用量基礎費用。',
  },
  {
    reference: 'Portland Brewing Co.',
    date: '1999-12-14',
    category: 'broker',
    subject: '股東服務平臺',
    principle: '發行人設立以促進股票流動性，不參與交易決策、不收取交易基礎報酬。',
  },
  {
    reference: 'Broker-to-Broker Networks',
    date: '2000-12-01',
    category: 'broker',
    subject: '電子通訊平臺',
    principle: '僅傳遞訊息、不參與交易執行、無交易裁量權、無客戶資產接觸。',
  },
];

export interface InfrastructureRoleAssessment {
  readonly role: InfrastructureRole;
  readonly label: string;
  readonly analogy: string;
  readonly passivity: string;
  readonly neutrality: string;
  readonly compensation: string;
  readonly boundary: string;
}

/**
 * 論文第五章第五節。三原則對四類區塊鏈基礎設施提供者的適用結果。
 * 每一類都附上「關鍵區分」，因為豁免只保護純技術活動。
 */
export const INFRASTRUCTURE_ROLE_ASSESSMENTS: readonly InfrastructureRoleAssessment[] = [
  {
    role: 'validator',
    label: '驗證者',
    analogy: '傳統礦工；以質押而非算力取得驗證權',
    passivity: '僅驗證與記錄交易，不參與交易決策。',
    neutrality: '對所有交易一視同仁，不能選擇驗證哪些交易。',
    compensation: '報酬為區塊獎勵，與特定交易無關。',
    boundary: '若同時提供託管質押服務，可能構成投資契約。',
  },
  {
    role: 'node_operator',
    label: '節點營運商',
    analogy: '網際網路服務提供者（ISP）',
    passivity: '僅提供網路連接，不參與共識、不驗證交易。',
    neutrality: '不篩選轉發的交易內容。',
    compensation: '費用若為固定，不構成交易基礎報酬。',
    boundary: '若實際參與撮合、保管、收益分配或市場推廣，須具體審查。',
  },
  {
    role: 'wallet_developer',
    label: '錢包開發商',
    analogy: '瀏覽器；提供訪問區塊鏈的介面',
    passivity: '不執行關鍵交易功能：無訂單管理、無撮合、無資產保管。',
    neutrality: '不選擇允許哪些用戶使用。',
    compensation: '固定服務費，不與交易量掛鉤。',
    boundary: '自託管錢包適用豁免；託管錢包（服務商管理私鑰）不適用。',
  },
  {
    role: 'smart_contract_developer',
    label: '智能合約開發商',
    analogy: '軟體開發商',
    passivity: '僅提供軟體工具，不控制合約的部署或使用。',
    neutrality: '合約一旦部署即自動執行預設規則。',
    compensation: '不收取交易基礎報酬。',
    boundary: '純軟體開發適用豁免；參與運營（管理資金、執行升級、收取交易費用）則不適用。',
  },
];

/* ------------------------------------------------------------------ */
/* 第五章：智能合約的四層審計與人工介入                                */
/* ------------------------------------------------------------------ */

export type AuditLayer = 'code_security' | 'legal_compliance' | 'governance_operations' | 'regulatory_review';

export interface AuditLayerProfile {
  readonly layer: AuditLayer;
  readonly label: string;
  readonly owner: string;
  readonly standard: string;
  readonly output: string;
}

/**
 * 論文第五章的合規架構。技術內嵌合規不是以程式碼取代法律審查，
 * 而是「技術審計、法律審計、治理審計與事故應變」四層共同構成。
 */
export const AUDIT_LAYERS: readonly AuditLayerProfile[] = [
  {
    layer: 'code_security',
    label: '程式碼安全審計',
    owner: '獨立區塊鏈安全審計機構、核心開發團隊、必要時之外部滲透測試者',
    standard: '重入攻擊、權限控制、升級金鑰、多簽門檻、預言機依賴、橋接風險、事件日誌、測試覆蓋率、形式驗證可行性',
    output: '智能合約審計報告、漏洞修補紀錄、測試報告、部署前後版本差異紀錄',
  },
  {
    layer: 'legal_compliance',
    label: '法律合規審計',
    owner: '證券法律師、合規長、發行人董事會或合規委員會',
    standard: '狀態機是否正確反映證券法、轉售限制、投資人資格、KYC/AML、制裁名單、揭露義務、跨境限制',
    output: '法律意見書、規則對照矩陣、狀態轉換表、投資人分類與限制清單',
  },
  {
    layer: 'governance_operations',
    label: '治理與營運審計',
    owner: 'DAO 法人主體、治理委員會、託管人或受監管平台',
    standard: '誰有權暫停、升級、回復或否決合約操作；人工介入是否有多簽、利益衝突迴避、公告與異議程序',
    output: '治理決議、介入紀錄、事故報告、使用者通知與申訴處理紀錄',
  },
  {
    layer: 'regulatory_review',
    label: '監管或沙盒審查',
    owner: 'SEC、FinHub、SRO 或監理沙盒主管機關',
    standard: '審計報告是否足以支持不採取行動、豁免或安全港申請；重大事件後可要求補充揭露或重新審計',
    output: '監管申請附件、定期運營報告、重大事件通報、重新審計證明',
  },
];

export type InfrastructureSafeModeTrigger = 'code_vulnerability' | 'legal_conflict' | 'governance_abuse';

export interface SafeModeTriggerProfile {
  readonly trigger: InfrastructureSafeModeTrigger;
  readonly label: string;
  readonly defaultHandling: string;
  readonly humanIntervention: string;
  readonly followUp: string;
}

/**
 * 論文第五章的觸發情境表。核心原則是「法律優先、保守預設、可追溯介入」：
 * 法律規則優先於程式碼結果；不確定時進入限制性較高的安全模式；任何人工 override 須事前授權、多人簽核、時間限制、紀錄留存與事後公告。
 */
export const SAFE_MODE_TRIGGERS: readonly SafeModeTriggerProfile[] = [
  {
    trigger: 'code_vulnerability',
    label: '程式碼漏洞、駭客攻擊或預言機錯誤',
    defaultHandling: '啟動 pause／safe mode，暫停高風險轉讓或轉換。',
    humanIntervention: '由合規委員會、技術審計人與多簽管理者共同確認修補方案。',
    followUp: '漏洞報告、補丁紀錄、重新審計報告、使用者公告。',
  },
  {
    trigger: 'legal_conflict',
    label: '狀態轉換結果與證券法或 KYC/AML 規則衝突',
    defaultHandling: '採取較嚴格監管狀態，暫緩交易或限制轉讓。',
    humanIntervention: '由證券法律師與合規長作成書面判斷；必要時向 SEC 或平台合規部門通報。',
    followUp: '法律意見補充、規則對照修正、白皮書或揭露文件更新。',
  },
  {
    trigger: 'governance_abuse',
    label: '治理提案可能造成利益輸送或市場操縱',
    defaultHandling: '暫緩執行治理結果，要求冷卻期與利益衝突揭露。',
    humanIntervention: '由 DAO 法人主體或治理委員會進行合規審查，重大事項交由成員重新表決。',
    followUp: '治理紀錄、投票資料、利益衝突揭露與申訴處理結果。',
  },
];

/* ------------------------------------------------------------------ */
/* 第六章：技術功能的內在性                                            */
/* ------------------------------------------------------------------ */

export type TechnologyFunction =
  | 'staking'
  | 'validation'
  | 'reward_distribution'
  | 'locking'
  | 'minting_burning'
  | 'gas_payment'
  | 'protocol_testing'
  | 'airdrop_claim'
  | 'onchain_transfer';

export const TECHNOLOGY_FUNCTION_LABELS: Readonly<Record<TechnologyFunction, string>> = {
  staking: '質押',
  validation: '驗證',
  reward_distribution: '獎勵分配',
  locking: '代幣鎖定',
  minting_burning: '鑄造與銷毀',
  gas_payment: 'Gas 費支付',
  protocol_testing: '協議測試與參與',
  airdrop_claim: '空投領取',
  onchain_transfer: '鏈上轉移',
};

export const TECHNOLOGY_FUNCTIONS: readonly TechnologyFunction[] = [
  'staking',
  'validation',
  'reward_distribution',
  'locking',
  'minting_burning',
  'gas_payment',
  'protocol_testing',
  'airdrop_claim',
  'onchain_transfer',
];

export interface IntrinsicalityInput {
  readonly function: TechnologyFunction;
  readonly intrinsicToProtocol: boolean;
  readonly necessaryForOperation: boolean;
  readonly capitalContribution: boolean;
  readonly commonEnterprise: boolean;
  readonly profitExpectation: boolean;
  readonly issuerRelationship: boolean;
  readonly consumptiveUse: boolean;
  readonly custodialStaking: boolean;
}

export interface IntrinsicalityResult {
  readonly nonSecurity: boolean;
  readonly functionLabel: string;
  readonly howey: HoweyResult;
  readonly arguments: readonly string[];
  readonly blockers: readonly string[];
}

/**
 * 論文第六章第三節。技術功能非證券交易的三項論證：無投資契約、無發行人關係與消費性使用、技術必要性。
 * 關鍵區分：自行質押（非託管）不構成投資契約；委託第三方質押服務商則可能構成。
 */
export function intrinsicalityTest(input: IntrinsicalityInput): IntrinsicalityResult {
  const argumentsList: string[] = [];
  const blockers: string[] = [];

  if (input.intrinsicToProtocol && input.necessaryForOperation) {
    argumentsList.push('功能為協議設計的固有組成且對運作不可或缺，屬技術必要性。');
  } else {
    blockers.push('功能非協議運作所必要，屬外部附加活動。');
  }

  if (input.consumptiveUse) {
    argumentsList.push('代幣作為消費性使用，價值來自當下使用而非未來轉售。');
  }

  if (!input.issuerRelationship) {
    argumentsList.push('不存在與發行人的關係：協議非法律實體，原生代幣不賦予對協議的法律權利。');
  } else {
    blockers.push('存在可識別的發行人關係，須回到資產本質審查。');
  }

  if (input.custodialStaking) {
    blockers.push('委託第三方質押服務商，存在委託關係，可能構成投資契約。');
  } else if (input.function === 'staking') {
    argumentsList.push('自行質押（非託管），代幣仍屬用戶且可隨時解除，不存在委託關係。');
  }

  const howey = howeyTest({
    moneyInvestment: input.capitalContribution,
    commonEnterprise: input.commonEnterprise,
    profitExpectation: input.profitExpectation,
    effortsOfOthers: input.issuerRelationship,
  });

  if (howey.isInvestmentContract) {
    blockers.push('Howey 四要件齊備，技術功能之外觀不能排除投資契約定性。');
  }

  return {
    nonSecurity: blockers.length === 0,
    functionLabel: TECHNOLOGY_FUNCTION_LABELS[input.function],
    howey,
    arguments: argumentsList,
    blockers,
  };
}

export interface RegulatorySymmetryRow {
  readonly function: string;
  readonly traditionalInfrastructure: string;
  readonly blockchainInfrastructure: string;
  readonly treatment: string;
}

/**
 * 論文第六章第四節的監管對稱性原則：相同功能應受相同監管，無論其技術實現方式。
 */
export const REGULATORY_SYMMETRY: readonly RegulatorySymmetryRow[] = [
  {
    function: '交易執行',
    traditionalInfrastructure: '交易所、經紀商（須註冊）',
    blockchainInfrastructure: '智能合約自動執行',
    treatment: '不應視為中介',
  },
  {
    function: '清算結算',
    traditionalInfrastructure: 'DTCC、清算所（須註冊）',
    blockchainInfrastructure: '共識機制自動處理',
    treatment: '不應要求註冊',
  },
  {
    function: '資產保管',
    traditionalInfrastructure: '託管銀行',
    blockchainInfrastructure: '自託管錢包（用戶自行管理）',
    treatment: '不應視為託管',
  },
  {
    function: '資訊傳遞',
    traditionalInfrastructure: '彭博、路透',
    blockchainInfrastructure: '區塊鏈瀏覽器',
    treatment: '兩者皆不視為中介',
  },
  {
    function: '支付處理',
    traditionalInfrastructure: '銀行、信用卡公司',
    blockchainInfrastructure: '原生代幣轉移自動完成',
    treatment: '不應視為匯兌',
  },
];

export interface GasMarketEvidence {
  readonly baseFeeMedianGwei: number;
  readonly baseFeeStdDevGwei: number;
  readonly mechanism: string;
  readonly conclusion: string;
}

/**
 * 論文第六章第五節第二款的 Gas 費市場競爭性證據。base fee 依前一區塊擁塞程度自動調整，
 * 不受單一行動者控制；priority fee 呈雙邊拍賣均衡。
 */
export const GAS_MARKET_EVIDENCE: GasMarketEvidence = {
  baseFeeMedianGwei: 12,
  baseFeeStdDevGwei: 8.4,
  mechanism: 'EIP-1559：base fee 依前一區塊擁塞程度自動調整，priority fee 由使用者競價。',
  conclusion: '價格差異反映各鏈共識成本與網路效應，而非單一中介的定價權力。',
};

/* ------------------------------------------------------------------ */
/* 第六章第六節：技術功能的稅會處理                                    */
/* ------------------------------------------------------------------ */

export type TaxAccountingLayer =
  | 'income_nature'
  | 'timing'
  | 'cost_basis'
  | 'disposal_gain'
  | 'issuer_accounting'
  | 'custody_obligation';

export const TAX_ACCOUNTING_LAYER_LABELS: Readonly<Record<TaxAccountingLayer, string>> = {
  income_nature: '所得性質',
  timing: '課稅時點',
  cost_basis: '成本基礎',
  disposal_gain: '處分損益',
  issuer_accounting: '發行人／平台會計',
  custody_obligation: '託管義務',
};

export interface TechnologyTaxTreatment {
  readonly activity: string;
  readonly taxTreatment: string;
  readonly accountingTreatment: string;
  readonly limitation: string;
  readonly authority: string;
}

/**
 * 論文第六章第六節的「交易類型—稅會處理」對照表。
 * 雙層結論：技術功能本身不應被過度證券化；但技術功能所產生的收益、費用、庫存與託管義務，
 * 仍須依 IRS 與 FASB 的既有框架處理。
 */
export const TECHNOLOGY_TAX_TREATMENTS: readonly TechnologyTaxTreatment[] = [
  {
    activity: 'PoW 挖礦或 PoS 驗證者報酬',
    taxTreatment: '取得可支配控制時按公允市場價值認列普通所得；營業活動可能另有自雇稅或營業費用扣除。',
    accountingTreatment: '符合 ASU 2023-08 範圍者，後續按公允價值衡量，變動進入損益。',
    limitation: '證券法上屬技術功能，不排除稅法上構成所得。',
    authority: 'IRS Rev. Rul. 2023-14；FASB ASU 2023-08',
  },
  {
    activity: '非託管質押',
    taxTreatment: '質押獎勵於取得支配權與控制權時認列；本金質押本身是否為處分須依權利是否改變判斷。',
    accountingTreatment: '質押獎勵與原持有代幣分別追蹤成本基礎及公允價值。',
    limitation: '須區分自行質押與第三方託管質押，避免把證券法分析與稅法時點混同。',
    authority: 'IRS Rev. Rul. 2023-14',
  },
  {
    activity: '流動性質押代幣',
    taxTreatment: '換成流動性質押憑證可能被主張為非處分，也可能因權利 materially different 而被視為交換；爭議未定。',
    accountingTreatment: '須揭露衍生代幣估值、贖回風險、折價與流動性風險。',
    limitation: '不可直接斷言不課稅；IRS 尚未提供完整專門規則。',
    authority: 'Eisner v. Macomber；Cottage Savings；Latham & Watkins (2024)',
  },
  {
    activity: 'Gas 費與 priority fee',
    taxTreatment: '若為取得或處分資產所必要，可能資本化為成本基礎或處分成本；營業使用可能作為營業費用。',
    accountingTreatment: '平台或驗證者收取 priority fee 時按收入確認邏輯處理。',
    limitation: '個人投資人、企業、平台三者處理不同；TCJA 後個人雜項扣除受限。',
    authority: 'IRS Notice 2014-21；ASC 720；ASC 805',
  },
  {
    activity: '平台託管或混合託管',
    taxTreatment: '重點在受益所有權與資訊申報；是否產生所得取決於資產處分或收益分配。',
    accountingTreatment: 'SAB 122 後不再機械式認列 safeguarding liability，改依 ASC 450-20 或 IAS 37 判斷。',
    limitation: '託管會計現代化不等於免除風險揭露、內控與資本要求。',
    authority: 'SEC SAB 122；ASC 450-20；IAS 37',
  },
  {
    activity: '跨境申報與 CARF',
    taxTreatment: '平台與中介可能面臨資訊申報、交換資料與 Form 1099-DA 等制度銜接。',
    accountingTreatment: '須建立使用者、地址、交易與受益所有權資料的可稽核流程。',
    limitation: '跨境稅務合作可能與隱私、去中心化及資料最小化原則發生張力。',
    authority: 'CARF；Form 1099-DA',
  },
];

/* ------------------------------------------------------------------ */
/* 第七章：協議代幣監管框架                                            */
/* ------------------------------------------------------------------ */

export interface ProtocolTokenDefinition {
  readonly definition: string;
  readonly coreElements: readonly string[];
  readonly exclusions: readonly string[];
}

/**
 * 論文第七章第一節。協議代幣是無形、商業上可替代、對協議運作不可或缺的資產；
 * 定義明確排除賦予債務、股權、清算權或利息股息分配權的資產。
 */
export const PROTOCOL_TOKEN_DEFINITION: ProtocolTokenDefinition = {
  definition: '一種無形的、商業上可替代的資產，對協議的運作不可或缺，無論該協議是分散式帳本、區塊鏈、智能合約或其他類型的軟體協議。',
  coreElements: ['無形性', '可替代性', '功能必要性', '經濟普遍性', '權利限制性'],
  exclusions: [
    '對某人的債務或股權權益',
    '對某人的清算權利',
    '從某人獲得利息、股息、分配或其他類似支付的權利',
  ],
};

export interface ProtocolTokenInput {
  readonly intangible: boolean;
  readonly fungible: boolean;
  readonly indispensableToProtocol: boolean;
  readonly grantsDebtOrEquity: boolean;
  readonly grantsLiquidationRight: boolean;
  readonly grantsIncomeDistribution: boolean;
}

export interface ProtocolTokenResult {
  readonly isProtocolToken: boolean;
  readonly blockers: readonly string[];
  readonly note: string;
}

/**
 * 論文第七章第一節的定義檢驗。任一排除事由成立即不是協議代幣，須回到證券法或財產法處理。
 */
export function isProtocolToken(input: ProtocolTokenInput): ProtocolTokenResult {
  const blockers: string[] = [];
  if (!input.intangible) blockers.push('非無形資產。');
  if (!input.fungible) blockers.push('非商業上可替代。');
  if (!input.indispensableToProtocol) blockers.push('對協議運作非不可或缺。');
  if (input.grantsDebtOrEquity) blockers.push('賦予對某人的債務或股權權益。');
  if (input.grantsLiquidationRight) blockers.push('賦予對某人的清算權利。');
  if (input.grantsIncomeDistribution) blockers.push('賦予從某人獲得利息、股息或分配的權利。');

  return {
    isProtocolToken: blockers.length === 0,
    blockers,
    note:
      blockers.length === 0
        ? '符合協議代幣定義，適用兩階段監管模型。'
        : '不符合協議代幣定義，須回到資產本質分類與 Howey 測試。',
  };
}

export type ProtocolTokenStage = 'pre_functionality' | 'functional';

export const PROTOCOL_TOKEN_STAGE_LABELS: Readonly<Record<ProtocolTokenStage, string>> = {
  pre_functionality: '功能前階段',
  functional: '功能階段',
};

export interface ProtocolTokenStageInput {
  readonly programmedAsIndispensable: boolean;
  readonly deployedForActualUse: boolean;
  readonly coreFeaturesComplete: boolean;
  readonly singleIssuerEfforts: boolean;
}

export interface ProtocolTokenStageResult {
  readonly stage: ProtocolTokenStage;
  readonly label: string;
  readonly legalStatus: string;
  readonly rebuttablePresumption: boolean;
  readonly exemptions: readonly string[];
  readonly disclosure: readonly string[];
}

/**
 * 論文第七章第二節的兩階段模型。「功能性」是明確的轉換點：
 * 功能前階段可反駁推定為投資契約；功能階段為非證券、非商品的新型資產類別。
 */
export function protocolTokenStage(input: ProtocolTokenStageInput): ProtocolTokenStageResult {
  const functional =
    input.programmedAsIndispensable && input.deployedForActualUse && input.coreFeaturesComplete;

  if (functional) {
    return {
      stage: 'functional',
      label: PROTOCOL_TOKEN_STAGE_LABELS.functional,
      legalStatus: '非證券、非商品，新型資產類別；交易仍須透過 SEC 註冊中介進行。',
      rebuttablePresumption: false,
      exemptions: [],
      disclosure: ['網路資訊', '代幣資訊', '治理結構', '風險因素'],
    };
  }

  return {
    stage: 'pre_functionality',
    label: PROTOCOL_TOKEN_STAGE_LABELS.pre_functionality,
    legalStatus: '可反駁推定為投資契約。',
    rebuttablePresumption: true,
    exemptions: ['Reg D（合格投資者私募）', 'Reg S（離岸發行）', 'Regulation PT（協議代幣專用）'],
    disclosure: ['網路資訊', '代幣資訊', '治理結構', '風險因素'],
  };
}

export interface RegulationPtProfile {
  readonly name: string;
  readonly capUsd: number;
  readonly capPercentOfOutstanding: number;
  readonly filingDeadlineDays: number;
  readonly requirements: readonly string[];
}

/**
 * 論文第七章第三節。Regulation PT 豁免上限為「5,000 萬美元」與「已發行代幣總美元價值 10%」兩者之較高者。
 */
export const REGULATION_PT: RegulationPtProfile = {
  name: 'Regulation PT（Protocol Token）',
  capUsd: 50_000_000,
  capPercentOfOutstanding: 0.1,
  filingDeadlineDays: 30,
  requirements: [
    '揭露義務：網路資訊、代幣資訊、治理、風險因素',
    '購買者協議：書面記錄每筆銷售、納入公開揭露文件、禁止免責聲明',
    '向 SEC 備案：首次發行和銷售後 30 天內提交類似 Form D 的通知',
    'AML／KYC／制裁檢查',
  ],
};

export interface RegulationPtInput {
  readonly offeringUsd: number;
  readonly outstandingUsd: number;
  readonly buyerAgreementsRecorded: boolean;
  readonly filedWithSec: boolean;
  readonly amlKycScreening: boolean;
}

export interface RegulationPtResult {
  readonly eligible: boolean;
  readonly capUsd: number;
  readonly headroomUsd: number;
  readonly blockers: readonly string[];
}

/**
 * 論文第七章第三節第二款。上限取「5,000 萬美元」與「已發行代幣總美元價值 10%」之較高者，
 * 避免無限稀釋現有持有者。
 */
export function regulationPtCheck(input: RegulationPtInput): RegulationPtResult {
  const capUsd = Math.max(REGULATION_PT.capUsd, input.outstandingUsd * REGULATION_PT.capPercentOfOutstanding);
  const blockers: string[] = [];

  if (input.offeringUsd > capUsd) {
    blockers.push(`發行金額 ${input.offeringUsd} 超過豁免上限 ${capUsd}。`);
  }
  if (!input.buyerAgreementsRecorded) blockers.push('未書面記錄每筆購買者協議。');
  if (!input.filedWithSec) blockers.push(`未於發行後 ${REGULATION_PT.filingDeadlineDays} 天內向 SEC 備案。`);
  if (!input.amlKycScreening) blockers.push('未執行 AML／KYC／制裁檢查。');

  return {
    eligible: blockers.length === 0,
    capUsd,
    headroomUsd: Math.max(0, capUsd - input.offeringUsd),
    blockers,
  };
}

export interface DefiExclusionInput {
  readonly deploysSmartContracts: boolean;
  readonly providesLiquidity: boolean;
  readonly decentralizedGovernance: boolean;
  readonly singlePointOfFailure: boolean;
  readonly centralAuthorityCanAlterData: boolean;
  readonly registeredIntermediaryOffersAccess: boolean;
}

export interface DefiExclusionResult {
  readonly excluded: boolean;
  readonly retainedObligations: readonly string[];
  readonly blockers: readonly string[];
}

/**
 * 論文第七章第五節。DeFi 活動原則上排除於《交易法》範圍之外，但排除不等於沒有責任：
 * 註冊中介提供 DeFi 訪問仍須遵守 AML 與制裁義務；智能合約開發商參與運營仍可能負責。
 */
export function defiExclusion(input: DefiExclusionInput): DefiExclusionResult {
  const blockers: string[] = [];
  if (input.singlePointOfFailure) blockers.push('存在單點故障，不符合去中心化架構。');
  if (input.centralAuthorityCanAlterData) blockers.push('存在可更改交易數據的中心權威。');

  const excluded =
    blockers.length === 0 &&
    (input.deploysSmartContracts || input.providesLiquidity || input.decentralizedGovernance);

  const retainedObligations: string[] = [];
  if (input.registeredIntermediaryOffersAccess) {
    retainedObligations.push('註冊中介提供 DeFi 訪問，須確保客戶了解風險並實施風險管理。');
    retainedObligations.push('註冊中介參與 DeFi 協議，仍須遵守反洗錢與制裁法規。');
  }
  if (excluded) {
    retainedObligations.push('智能合約開發商若參與合約運營，仍可能承擔相應責任。');
  }

  return { excluded, retainedObligations, blockers };
}

/* ------------------------------------------------------------------ */
/* 第七章第六節：DAO 責任歸屬                                          */
/* ------------------------------------------------------------------ */

export type DaoEntityForm = 'none' | 'wyoming_dao_llc' | 'duna' | 'tennessee_dao' | 'utah_dao';

export const DAO_ENTITY_FORM_LABELS: Readonly<Record<DaoEntityForm, string>> = {
  none: '未採特定法律外觀',
  wyoming_dao_llc: 'Wyoming DAO LLC',
  duna: 'DUNA（去中心化非營利組織）',
  tennessee_dao: '田納西州 DAO 立法',
  utah_dao: '猶他州 DAO 立法',
};

export interface DaoLiabilityInput {
  readonly entityForm: DaoEntityForm;
  readonly governanceTransparent: boolean;
  readonly memberLimitedLiability: boolean;
  readonly minimumGovernanceStandards: boolean;
}

export interface DaoLiabilityResult {
  readonly formLabel: string;
  readonly generalPartnershipPresumption: boolean;
  readonly memberLiability: 'joint_and_several' | 'limited';
  readonly safeHarbor: boolean;
  readonly blockers: readonly string[];
  readonly precedent: string;
}

/**
 * 論文第七章第六節第二款至第三款。Sarcuni v. bZx DAO 認定未具特定法律外觀的 DAO 構成普通合夥，
 * 治理代幣持有人對駭客攻擊所致損失負連帶責任。Wyoming DAO LLC 與 DUNA 提供安全港。
 */
export function daoLiabilityTier(input: DaoLiabilityInput): DaoLiabilityResult {
  const blockers: string[] = [];
  const hasForm = input.entityForm !== 'none';

  if (!hasForm) {
    blockers.push('未採任何州法法人形式，推定為普通合夥，成員負連帶責任。');
  }
  if (hasForm && !input.memberLimitedLiability) blockers.push('所採形式未提供成員有限責任。');
  if (hasForm && !input.governanceTransparent) blockers.push('治理透明性要求未滿足。');
  if (hasForm && !input.minimumGovernanceStandards) blockers.push('最低治理標準未滿足。');

  const safeHarbor = hasForm && blockers.length === 0;

  return {
    formLabel: DAO_ENTITY_FORM_LABELS[input.entityForm],
    generalPartnershipPresumption: !hasForm,
    memberLiability: safeHarbor ? 'limited' : 'joint_and_several',
    safeHarbor,
    blockers,
    precedent: 'Sarcuni v. bZx DAO, 664 F. Supp. 3d 1100 (S.D. Cal. 2023)',
  };
}

export type DaoDamageSource = 'protocol_error' | 'governance_resolution' | 'external_hack' | 'large_holder';

export interface DaoDamageTier {
  readonly source: DaoDamageSource;
  readonly label: string;
  readonly primaryLiable: string;
  readonly secondaryLiable: string;
  readonly authority: string;
}

/**
 * 論文第七章第六節第四款的層級化責任設計。
 */
export const DAO_DAMAGE_TIERS: readonly DaoDamageTier[] = [
  {
    source: 'protocol_error',
    label: '協議錯誤所致之損害',
    primaryLiable: 'DAO 法人主體',
    secondaryLiable: '智能合約開發團隊（產品瑕疵責任）',
    authority: 'Restatement (Third) of Torts: Products Liability §1',
  },
  {
    source: 'governance_resolution',
    label: '治理決議所致之損害',
    primaryLiable: 'DAO 法人主體',
    secondaryLiable: '惡意提案之提案人或共謀投票者（侵權責任）',
    authority: '侵權行為法',
  },
  {
    source: 'external_hack',
    label: '外部駭客攻擊所致之損害',
    primaryLiable: '攻擊者',
    secondaryLiable: '可能涉及證券市場操縱責任',
    authority: 'SEC v. Mango Markets (2024)',
  },
  {
    source: 'large_holder',
    label: '投票權重達門檻之大型持有人',
    primaryLiable: '大型代幣持有人（控制股東忠實義務）',
    secondaryLiable: 'DAO 法人主體',
    authority: 'Reyes (2021)',
  },
];

/** 論文第七章第六節第四款：課以控制股東忠實義務的投票權重門檻。 */
export const CONTROL_HOLDER_THRESHOLD = 0.05;

export interface ClaritySection504Input {
  readonly daoForm: DaoEntityForm;
  readonly smartContractAutonomous: boolean;
  readonly governanceTokenDistribution: boolean;
  readonly federalStateInfoSharing: boolean;
}

export interface ClaritySection504Result {
  readonly eligible: boolean;
  readonly conditions: readonly string[];
  readonly blockers: readonly string[];
  readonly phrasing: string;
}

/**
 * 論文第七章第六節第五款。CLARITY Act 第 504 條的安全港將「實質上由智能合約自主執行之協議活動」
 * 排除於經紀商與交易所的註冊要求外，但未直接解決 DAO 的法律實體地位。
 * 截至 2026-05-31 尚未成法，所有表述須用條件語氣。
 */
export function claritySection504(input: ClaritySection504Input): ClaritySection504Result {
  const blockers: string[] = [];
  if (input.daoForm === 'none') blockers.push('未採 DUNA 或 Wyoming DAO LLC 形式，無法自動適用第 504 條安全港。');
  if (!input.smartContractAutonomous) blockers.push('協議活動非實質上由智能合約自主執行。');
  if (!input.federalStateInfoSharing) blockers.push('缺少 SEC 與州政府的資訊共享機制。');

  return {
    eligible: blockers.length === 0,
    conditions: [
      '採取 DUNA 或 Wyoming DAO LLC 形式者得自動適用第 504 條安全港。',
      '允許 DAO 以治理代幣形式進行終端用戶分配，視同非投資性勞務報酬。',
      '建立 SEC 與州政府之資訊共享機制，使合規狀態於聯邦與州層次同步。',
    ],
    blockers,
    phrasing: '若 CLARITY Act 最終成法，且實施規則保留相關條款',
  };
}

/* ------------------------------------------------------------------ */
/* 第七章第七節：跨國管轄衝突                                          */
/* ------------------------------------------------------------------ */

export type CrossBorderTier = 'framework_alignment' | 'tiered_reporting' | 'real_time_sharing';

export interface CrossBorderTierProfile {
  readonly tier: CrossBorderTier;
  readonly order: number;
  readonly label: string;
  readonly requirement: string;
  readonly reference: string;
}

/**
 * 論文第七章第七節第四款的三層次解方。
 */
export const CROSS_BORDER_TIERS: readonly CrossBorderTierProfile[] = [
  {
    tier: 'framework_alignment',
    order: 1,
    label: '框架對接',
    requirement: '美國 CLARITY Act 與歐盟 MiCA 完成「協議代幣對應條款」雙邊互認，明確無發行人之充分去中心化代幣於兩地之共通法律地位。',
    reference: '參考 GDPR Privacy Shield 框架經驗',
  },
  {
    tier: 'tiered_reporting',
    order: 2,
    label: '分層申報',
    requirement: '跨境流通之協議代幣於兩地分別完成最低限度資訊揭露：協議白皮書、智能合約稽核報告、核心開發團隊（若可識別）之揭露。',
    reference: 'ESMA 與 SEC 雙邊申報',
  },
  {
    tier: 'real_time_sharing',
    order: 3,
    label: '即時資訊共享',
    requirement: 'SEC 與 ESMA 建立協議代幣專用資訊共享平台，重大協議事件（駭客攻擊、硬分叉、治理爭議）24 小時內雙邊通報。',
    reference: 'IOSCO (2023)',
  },
];

export interface CrossBorderSolutionInput {
  readonly mutualRecognition: boolean;
  readonly whitePaperDisclosed: boolean;
  readonly auditReportDisclosed: boolean;
  readonly coreTeamDisclosed: boolean;
  readonly incidentSharingChannel: boolean;
}

export interface CrossBorderSolutionResult {
  readonly ready: boolean;
  readonly tiers: readonly { readonly tier: CrossBorderTier; readonly label: string; readonly satisfied: boolean }[];
  readonly blockers: readonly string[];
}

/**
 * 論文第七章第七節第四款。三層次依序推進：沒有框架對接，分層申報就沒有共同格式；
 * 沒有分層申報，即時資訊共享就沒有可信資料來源。
 */
export function crossBorderSolution(input: CrossBorderSolutionInput): CrossBorderSolutionResult {
  const tiers = [
    { tier: 'framework_alignment' as const, label: '框架對接', satisfied: input.mutualRecognition },
    {
      tier: 'tiered_reporting' as const,
      label: '分層申報',
      satisfied: input.whitePaperDisclosed && input.auditReportDisclosed && input.coreTeamDisclosed,
    },
    { tier: 'real_time_sharing' as const, label: '即時資訊共享', satisfied: input.incidentSharingChannel },
  ];

  const blockers: string[] = [];
  if (!input.mutualRecognition) blockers.push('尚未完成協議代幣對應條款之雙邊互認。');
  if (!input.whitePaperDisclosed) blockers.push('未揭露協議白皮書。');
  if (!input.auditReportDisclosed) blockers.push('未揭露智能合約稽核報告。');
  if (!input.coreTeamDisclosed) blockers.push('未揭露核心開發團隊（若可識別）。');
  if (!input.incidentSharingChannel) blockers.push('未建立重大協議事件 24 小時通報管道。');

  return { ready: blockers.length === 0, tiers, blockers };
}

export interface MultilateralBody {
  readonly body: string;
  readonly action: string;
  readonly purpose: string;
}

/**
 * 論文第七章第七節第五款的多邊框架。
 */
export const MULTILATERAL_BODIES: readonly MultilateralBody[] = [
  {
    body: 'IOSCO',
    action: '修訂《加密資產監管原則》，將「無發行人之協議代幣」納入專門條款',
    purpose: '明定資訊揭露、市場誠信、跨境執法之共通要求',
  },
  {
    body: 'FSB',
    action: '推動《全球加密資產監管框架》第二版修訂',
    purpose: '將協議代幣與 DeFi 之系統性風險納入監管考量',
  },
  {
    body: 'G20 / MDARS',
    action: '倡議「數位資產監管最低標準」（Minimum Digital Asset Regulatory Standards）',
    purpose: '使技術中性主張於全球層次具備規範錨定，避免淪為合規最低公分母',
  },
];

export interface MtGoxLesson {
  readonly case: string;
  readonly year: number;
  readonly problem: string;
  readonly lesson: string;
}

/**
 * 論文第七章第七節第二款。Mt. Gox 破產案歷經十年仍未完全解決，
 * 反映傳統國際私法「住所地原則」與「行為地原則」於協議代幣場景下的失靈。
 */
export const MT_GOX_LESSON: MtGoxLesson = {
  case: 'In re Mt. Gox Co., Ltd.（東京地方法院）',
  year: 2014,
  problem: '交易所總部設於日本但用戶分布全球；日本法院主導破產程序，美歐星債權人於本國提起並行訴訟。',
  lesson: '傳統國際私法之住所地原則與行為地原則於協議代幣場景下難以提供清晰解答。',
};

/* ------------------------------------------------------------------ */
/* 第八章：三重奏綜合判斷                                              */
/* ------------------------------------------------------------------ */

export interface TrinityAssessmentInput {
  readonly token: TokenClassificationInput;
  readonly howey: HoweyInput;
  readonly activity: ActivitySubstanceInput;
  readonly technology: IntrinsicalityInput;
}

export interface TrinityAssessmentResult {
  readonly tokenClass: TokenClass;
  readonly tokenLabel: string;
  readonly securitiesRisk: 'low' | 'medium' | 'high';
  readonly activityClassification: 'infrastructure' | 'intermediary';
  readonly technologyNonSecurity: boolean;
  readonly overall: 'security' | 'infrastructure_exempt' | 'needs_review';
  readonly reasons: readonly string[];
}

/**
 * 論文第八章第一節。三重奏不是三個獨立測試的串聯，而是三個問題的並行回答：
 * 資產本質問「這是什麼」，活動本質問「誰該被監管」，技術中性問「技術功能本身是否構成證券交易」。
 * 任一環節出現證券定性，就不能靠其他環節的豁免抵銷。
 */
export function trinityAssessment(input: TrinityAssessmentInput): TrinityAssessmentResult {
  const token = classifyToken(input.token);
  const howey = howeyTest(input.howey);
  const activity = activitySubstanceTest(input.activity);
  const technology = intrinsicalityTest(input.technology);

  const reasons: string[] = [];
  reasons.push(`資產本質：${token.label}（證券風險 ${token.securitiesRisk}）。`);
  reasons.push(`活動本質：${activity.roleLabel} 屬${activity.classification === 'infrastructure' ? '基礎設施' : '證券中介'}。`);
  reasons.push(`技術中性：${technology.functionLabel}${technology.nonSecurity ? '不構成證券交易' : '存在證券定性阻擋'}。`);

  let overall: TrinityAssessmentResult['overall'];
  if (howey.isInvestmentContract || token.securitiesRisk === 'high') {
    overall = 'security';
    reasons.push('資產本質或 Howey 測試已指向證券定性，其他環節的豁免不能抵銷。');
  } else if (activity.classification === 'infrastructure' && technology.nonSecurity) {
    overall = 'infrastructure_exempt';
    reasons.push('三環節均未出現證券定性，落入基礎設施豁免範圍。');
  } else {
    overall = 'needs_review';
    reasons.push('部分環節未通過，須回到個案審查。');
  }

  return {
    tokenClass: token.tokenClass,
    tokenLabel: token.label,
    securitiesRisk: token.securitiesRisk,
    activityClassification: activity.classification,
    technologyNonSecurity: technology.nonSecurity,
    overall,
    reasons,
  };
}

export const TRINITY_OVERALL_LABELS: Readonly<Record<TrinityAssessmentResult['overall'], string>> = {
  security: '構成證券',
  infrastructure_exempt: '基礎設施豁免',
  needs_review: '須個案審查',
};
