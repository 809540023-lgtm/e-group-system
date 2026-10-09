/**
 * 金額一律使用整數最小單位。
 * TWD 以「元」為最小單位，JPY 以「円」為最小單位，兩者皆為整數，不使用浮點數。
 */

export type Currency = 'TWD' | 'JPY';

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

function assertInteger(amount: number, label: string): void {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new MoneyError(`${label} 必須是整數最小單位，收到 ${amount}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError(`${label} 超出安全整數範圍，收到 ${amount}`);
  }
}

export function money(amount: number, currency: Currency): Money {
  assertInteger(amount, '金額');
  return { amount, currency };
}

export function twd(amount: number): Money {
  return money(amount, 'TWD');
}

export function jpy(amount: number): Money {
  return money(amount, 'JPY');
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`幣別不一致：${a.currency} 與 ${b.currency} 不可直接相加`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function sumMoney(values: readonly Money[], currency: Currency): Money {
  let total = 0;
  for (const value of values) {
    if (value.currency !== currency) {
      throw new MoneyError(`幣別不一致：預期 ${currency}，收到 ${value.currency}`);
    }
    total += value.amount;
  }
  return money(total, currency);
}

/** 四捨五入，且對負數採「遠離零」的對稱行為，避免正負金額處理不一致。 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`無法四捨五入非有限數值 ${value}`);
  }
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** 依比例計算金額，結果為整數最小單位。 */
export function mulMoneyByRate(base: Money, rate: number): Money {
  if (!Number.isFinite(rate)) {
    throw new MoneyError(`比例必須是有限數值，收到 ${rate}`);
  }
  return money(roundHalfAwayFromZero(base.amount * rate), base.currency);
}

/**
 * 依權重把金額拆成多份，保證各份加總等於原始金額（最大餘數法）。
 * 用於運費分攤、多包裹拆帳、採購成本分攤。
 */
export function allocate(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyError('分攤權重不可為空');
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError('分攤權重必須是非負有限數值');
  }
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum <= 0) {
    throw new MoneyError('分攤權重總和必須大於零');
  }

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

  return result.map((v) => money(sign * v, total.currency));
}

export function formatMoney(value: Money): string {
  const symbol = value.currency === 'TWD' ? 'NT$' : '¥';
  const sign = value.amount < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(value.amount).toLocaleString('en-US')}`;
}

/** 匯率以固定精度儲存，避免浮點誤差累積。 */
export interface FxRate {
  /** 1 單位來源幣別可換得的目標幣別最小單位。 */
  readonly rate: number;
  readonly from: Currency;
  readonly to: Currency;
  /** 匯率生效日（ISO 日期），報價與成交都保存當時版本。 */
  readonly effectiveDate: string;
}

export function convert(value: Money, fx: FxRate): Money {
  if (value.currency !== fx.from) {
    throw new MoneyError(`匯率方向不符：${value.currency} → ${fx.to}，但匯率為 ${fx.from} → ${fx.to}`);
  }
  return money(roundHalfAwayFromZero(value.amount * fx.rate), fx.to);
}
