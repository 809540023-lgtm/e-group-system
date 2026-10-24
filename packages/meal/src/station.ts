/**
 * 站點選址評分（計畫書第六章）。
 *
 * 100 分草案：需求與預訂 30、成本 20、冷鏈及場地 20、補貨效率 15、競爭與合作 15。
 * 場地或食安條件不合格者，不以高總分補救。
 */

export type StationType = 'A' | 'B' | 'C' | 'D';

export interface StationCandidate {
  readonly id: string;
  readonly name: string;
  readonly type: StationType;
  /** 0–30 */
  readonly demandScore: number;
  /** 0–20 */
  readonly costScore: number;
  /** 0–20 */
  readonly coldChainScore: number;
  /** 0–15 */
  readonly replenishmentScore: number;
  /** 0–15 */
  readonly competitionScore: number;
  readonly foodSafetyPass: boolean;
  readonly venuePass: boolean;
}

export interface StationScore {
  readonly total: number;
  readonly eligible: boolean;
  readonly grade: 'A' | 'B' | 'C' | 'D';
  readonly blockers: readonly string[];
  readonly breakdown: Readonly<Record<'demand' | 'cost' | 'coldChain' | 'replenishment' | 'competition', number>>;
}

const MAX = {
  demand: 30,
  cost: 20,
  coldChain: 20,
  replenishment: 15,
  competition: 15,
} as const;

function clampScore(value: number, max: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`STATION_SCORE_INVALID: ${label} 必須是非負有限數值，收到 ${value}`);
  }
  return Math.min(value, max);
}

export function scoreStation(candidate: StationCandidate): StationScore {
  const breakdown = {
    demand: clampScore(candidate.demandScore, MAX.demand, '需求'),
    cost: clampScore(candidate.costScore, MAX.cost, '成本'),
    coldChain: clampScore(candidate.coldChainScore, MAX.coldChain, '冷鏈'),
    replenishment: clampScore(candidate.replenishmentScore, MAX.replenishment, '補貨'),
    competition: clampScore(candidate.competitionScore, MAX.competition, '競爭'),
  };
  const total = Object.values(breakdown).reduce((acc, value) => acc + value, 0);

  const blockers: string[] = [];
  if (!candidate.foodSafetyPass) blockers.push('食安條件不合格');
  if (!candidate.venuePass) blockers.push('場地用途或使用權未確認');

  const eligible = blockers.length === 0;
  const grade: StationScore['grade'] = !eligible ? 'D' : total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : 'D';

  return { total, eligible, grade, blockers, breakdown };
}

/** 三站試點應盡量落在同一配送走廊，避免把位置差異誤認為站型效果。 */
export function sameCorridor(stations: readonly { readonly corridor: string }[]): boolean {
  if (stations.length === 0) return false;
  const first = stations[0]?.corridor;
  return stations.every((station) => station.corridor === first);
}

export function stationTypeLabel(type: StationType): string {
  switch (type) {
    case 'A':
      return 'A 型：店中取貨站';
    case 'B':
      return 'B 型：自助冷鏈櫃';
    case 'C':
      return 'C 型：加熱組餐服務站';
    case 'D':
      return 'D 型：區域補給站';
  }
}
