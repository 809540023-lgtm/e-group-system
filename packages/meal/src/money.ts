/**
 * 金額一律使用整數新台幣元，不使用浮點數。
 * 所有對外顯示與契約金額都以此為最小單位。
 */

export type Currency = 'TWD';

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function assertInteger(amount: number, label = '金額'): void {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new MoneyError(`${label} 必須是整數元，收到 ${amount}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError(`${label} 超出安全整數範圍，收到 ${amount}`);
  }
}

export function twd(amount: number): Money {
  assertInteger(amount);
  return { amount, currency: 'TWD' };
}

export function addMoney(a: Money, b: Money): Money {
  return twd(a.amount + b.amount);
}

export function subMoney(a: Money, b: Money): Money {
  return twd(a.amount - b.amount);
}

export function sumMoney(values: readonly Money[]): Money {
  return twd(values.reduce((acc, value) => acc + value.amount, 0));
}

export function formatMoney(value: Money): string {
  const sign = value.amount < 0 ? '-' : '';
  return `${sign}NT$${Math.abs(value.amount).toLocaleString('en-US')}`;
}

/** 最大餘數法分攤，保證各份加總等於原始金額。 */
export function allocate(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) throw new MoneyError('分攤權重不可為空');
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) throw new MoneyError('分攤權重必須是非負有限數值');
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum <= 0) throw new MoneyError('分攤權重總和必須大於零');

  const sign = total.amount < 0 ? -1 : 1;
  const absolute = Math.abs(total.amount);
  const exact = weights.map((w) => (absolute * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = absolute - floors.reduce((acc, v) => acc + v, 0);
  const order = exact
    .map((v, index) => ({ index, fraction: v - Math.floor(v) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] = (result[index] ?? 0) + 1;
    remainder -= 1;
  }
  return result.map((v) => twd(sign * v));
}
