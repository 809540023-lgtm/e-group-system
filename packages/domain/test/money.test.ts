import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  addMoney,
  allocate,
  convert,
  formatMoney,
  jpy,
  money,
  mulMoneyByRate,
  roundHalfAwayFromZero,
  subMoney,
  sumMoney,
  twd,
} from '../src/money.ts';

describe('money', () => {
  it('只接受整數最小單位', () => {
    expect(twd(100).amount).toBe(100);
    expect(() => twd(100.5)).toThrow(MoneyError);
    expect(() => jpy(Number.NaN)).toThrow(MoneyError);
    expect(() => twd(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });

  it('拒絕不同幣別相加', () => {
    expect(() => addMoney(twd(100), jpy(100))).toThrow(MoneyError);
    expect(() => sumMoney([twd(1), jpy(1)], 'TWD')).toThrow(MoneyError);
  });

  it('加減與加總保持整數', () => {
    expect(addMoney(twd(250), twd(98)).amount).toBe(348);
    expect(subMoney(twd(348), twd(250)).amount).toBe(98);
    expect(sumMoney([twd(1), twd(2), twd(3)], 'TWD').amount).toBe(6);
  });

  it('四捨五入對負數對稱', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
  });

  it('比例計算回傳整數', () => {
    expect(mulMoneyByRate(twd(348), 0.03).amount).toBe(10);
  });

  it('分攤後加總等於原始金額', () => {
    const parts = allocate(twd(100), [1, 1, 1]);
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
    expect(parts.reduce((acc, p) => acc + p.amount, 0)).toBe(100);
  });

  it('分攤負數金額也守恆', () => {
    const parts = allocate(twd(-100), [1, 1, 1]);
    expect(parts.reduce((acc, p) => acc + p.amount, 0)).toBe(-100);
  });

  it('分攤拒絕空權重與零總和', () => {
    expect(() => allocate(twd(100), [])).toThrow(MoneyError);
    expect(() => allocate(twd(100), [0, 0])).toThrow(MoneyError);
    expect(() => allocate(twd(100), [1, -1])).toThrow(MoneyError);
  });

  it('匯率換算方向必須相符', () => {
    const fx = { rate: 0.21, from: 'JPY' as const, to: 'TWD' as const, effectiveDate: '2026-10-08' };
    expect(convert(jpy(1000), fx).amount).toBe(210);
    expect(() => convert(twd(1000), fx)).toThrow(MoneyError);
  });

  it('格式化顯示幣別符號', () => {
    expect(formatMoney(twd(1234))).toBe('NT$1,234');
    expect(formatMoney(jpy(-500))).toBe('-¥500');
  });

  it('money 保留幣別', () => {
    expect(money(1, 'JPY').currency).toBe('JPY');
  });
});
