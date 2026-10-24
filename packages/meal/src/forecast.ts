/**
 * 需求預測與即期庫存建議（計畫書第十五章 AI 端）。
 *
 * 只提供建議，不自行解除召回、修改保存期限、批准投資或提供疾病診斷。
 */

export interface SalesPoint {
  readonly date: string;
  readonly quantity: number;
}

export interface ForecastPoint {
  readonly date: string;
  readonly quantity: number;
  readonly basis: 'moving_average' | 'weekday_average';
}

function dayKey(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.getUTCDay();
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * 以最近 window 天移動平均為基礎，若有足夠同星期資料則混合星期平均。
 * 結果取整數，最低為 0。
 */
export function forecastDemand(history: readonly SalesPoint[], horizonDays: number, window = 7): readonly ForecastPoint[] {
  if (horizonDays <= 0) return [];
  if (history.length === 0) return [];
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const recent = sorted.slice(-window);
  const movingAverage = recent.reduce((acc, point) => acc + point.quantity, 0) / recent.length;

  const byWeekday = new Map<number, number[]>();
  for (const point of sorted) {
    const key = dayKey(point.date);
    const list = byWeekday.get(key) ?? [];
    list.push(point.quantity);
    byWeekday.set(key, list);
  }

  const lastDate = sorted[sorted.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const result: ForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i += 1) {
    const date = addDays(lastDate, i);
    const weekdayValues = byWeekday.get(dayKey(date)) ?? [];
    const useWeekday = weekdayValues.length >= 2;
    const weekdayAverage = useWeekday ? weekdayValues.reduce((acc, v) => acc + v, 0) / weekdayValues.length : 0;
    const quantity = useWeekday ? Math.round(movingAverage * 0.4 + weekdayAverage * 0.6) : Math.round(movingAverage);
    result.push({ date, quantity: Math.max(0, quantity), basis: useWeekday ? 'weekday_average' : 'moving_average' });
  }
  return result;
}

export interface ExpiringBatch {
  readonly batchId: string;
  readonly sku: string;
  readonly stationId: string;
  readonly quantity: number;
  readonly expiresOn: string;
  readonly unitPriceTwd: number;
}

export interface ExpirySuggestion {
  readonly batchId: string;
  readonly sku: string;
  readonly stationId: string;
  readonly quantity: number;
  readonly daysLeft: number;
  readonly action: 'discount' | 'bundle' | 'transfer' | 'donate_or_scrap';
  readonly suggestedDiscountRate: number;
  readonly note: string;
}

/** 即期庫存建議；不自動改價，需由總部核准。 */
export function nearExpirySuggestions(batches: readonly ExpiringBatch[], now: Date, thresholdDays = 3): readonly ExpirySuggestion[] {
  const suggestions: ExpirySuggestion[] = [];
  for (const batch of batches) {
    const expires = new Date(`${batch.expiresOn}T00:00:00Z`);
    if (Number.isNaN(expires.getTime())) continue;
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft > thresholdDays) continue;

    let action: ExpirySuggestion['action'];
    let suggestedDiscountRate: number;
    let note: string;
    if (daysLeft <= 0) {
      action = 'donate_or_scrap';
      suggestedDiscountRate = 0;
      note = '已到期，停止銷售並依報廢或捐贈流程處理。';
    } else if (daysLeft === 1) {
      action = 'bundle';
      suggestedDiscountRate = 0.5;
      note = '建議綁組促銷或轉移至需求較高站點。';
    } else if (daysLeft === 2) {
      action = 'discount';
      suggestedDiscountRate = 0.7;
      note = '建議七折促銷，需總部核准。';
    } else {
      action = 'transfer';
      suggestedDiscountRate = 0.85;
      note = '建議轉移至近期需求較高站點。';
    }
    suggestions.push({
      batchId: batch.batchId,
      sku: batch.sku,
      stationId: batch.stationId,
      quantity: batch.quantity,
      daysLeft,
      action,
      suggestedDiscountRate,
      note,
    });
  }
  return suggestions.sort((a, b) => a.daysLeft - b.daysLeft);
}
