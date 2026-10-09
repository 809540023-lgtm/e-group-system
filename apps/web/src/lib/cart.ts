/**
 * 購物車（規劃書 06 章；模組 07）。
 *
 * 購物車只存 SKU 與數量；價格、運費與可售量一律在伺服器重新計算。
 * 前端傳來的價格、付款狀態、員工角色與運費不能直接相信。
 */

import { cookies } from 'next/headers';
import { AppError, validateLineInputs, type QuoteLineInput } from '@jp/domain';

export const CART_COOKIE = 'jp_cart';
export const CART_MAX_LINES = 30;

export interface CartLine {
  readonly sku: string;
  readonly quantity: number;
}

export function parseCart(raw: string | undefined): readonly CartLine[] {
  if (raw === undefined || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const lines: CartLine[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const sku = (entry as { sku?: unknown }).sku;
    const quantity = (entry as { quantity?: unknown }).quantity;
    if (typeof sku !== 'string' || sku.trim() === '') continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) continue;
    lines.push({ sku, quantity: Math.min(quantity, 999) });
  }
  return mergeLines(lines);
}

export function mergeLines(lines: readonly CartLine[]): readonly CartLine[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.sku, Math.min((merged.get(line.sku) ?? 0) + line.quantity, 999));
  }
  return [...merged.entries()].map(([sku, quantity]) => ({ sku, quantity }));
}

export function serializeCart(lines: readonly CartLine[]): string {
  return JSON.stringify(mergeLines(lines).slice(0, CART_MAX_LINES));
}

export function addLine(lines: readonly CartLine[], sku: string, quantity: number): readonly CartLine[] {
  if (sku.trim() === '' || !Number.isInteger(quantity) || quantity <= 0) return lines;
  return mergeLines([...lines, { sku, quantity }]).slice(0, CART_MAX_LINES);
}

export function removeLine(lines: readonly CartLine[], sku: string): readonly CartLine[] {
  return lines.filter((l) => l.sku !== sku);
}

export function setQuantity(lines: readonly CartLine[], sku: string, quantity: number): readonly CartLine[] {
  if (quantity <= 0) return removeLine(lines, sku);
  return mergeLines([...removeLine(lines, sku), { sku, quantity: Math.min(quantity, 999) }]);
}

export function toQuoteInputs(lines: readonly CartLine[]): readonly QuoteLineInput[] {
  return lines.map((l) => ({ sku: l.sku, quantity: l.quantity }));
}

/** 送出前先在伺服器驗證輸入，避免把明顯錯誤帶進報價。 */
export function assertCartValid(lines: readonly CartLine[]): void {
  if (lines.length > CART_MAX_LINES) {
    throw new AppError('VALIDATION_FAILED', `購物車品項上限為 ${CART_MAX_LINES} 項`);
  }
  validateLineInputs(toQuoteInputs(lines));
}

export async function readCart(): Promise<readonly CartLine[]> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

export function cartCookieOptions(): {
  readonly httpOnly: true;
  readonly sameSite: 'lax';
  readonly secure: boolean;
  readonly path: '/';
  readonly maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.APP_MODE === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };
}
