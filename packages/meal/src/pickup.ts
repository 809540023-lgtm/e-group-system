/**
 * 取貨碼（計畫書第十五章核心驗收）。
 *
 * 規則：
 * 1. 取貨碼只存雜湊，不存明文。
 * 2. 一次性使用；已使用、過期、召回中的訂單不得交付。
 * 3. 驗證使用 timingSafeEqual，避免時序側通道。
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const PICKUP_CODE_LENGTH = 6;
export const PICKUP_CODE_TTL_HOURS = 72;

export interface PickupCodeState {
  readonly codeHash: string;
  readonly usedAt: string | null;
  readonly expiresAt: string;
  readonly orderStatus: string;
  readonly recalled: boolean;
}

export interface PickupCheck {
  readonly ok: boolean;
  readonly reason: string | null;
}

export function generatePickupCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(PICKUP_CODE_LENGTH, '0');
}

export function hashPickupCode(code: string, secret: string): string {
  if (secret.trim() === '') throw new Error('PICKUP_SECRET_MISSING: 取貨碼簽章密鑰不可為空。');
  return createHmac('sha256', secret).update(code.trim(), 'utf8').digest('hex');
}

export function verifyPickupCode(code: string, expectedHash: string, secret: string): boolean {
  const actual = Buffer.from(hashPickupCode(code, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function pickupExpiry(now: Date, ttlHours = PICKUP_CODE_TTL_HOURS): string {
  return new Date(now.getTime() + ttlHours * 3_600_000).toISOString();
}

/** 交付前檢查；任何一項不通過都不得核銷。 */
export function canDeliver(state: PickupCodeState, now: Date): PickupCheck {
  if (state.recalled) return { ok: false, reason: '批次召回中，停止交付並依召回流程處理。' };
  if (state.usedAt !== null) return { ok: false, reason: '取貨碼已使用，不可重複核銷。' };
  if (state.orderStatus === 'cancelled') return { ok: false, reason: '訂單已取消。' };
  if (state.orderStatus === 'refunded') return { ok: false, reason: '訂單已退款。' };
  if (state.orderStatus !== 'ready' && state.orderStatus !== 'preparing') {
    return { ok: false, reason: `訂單狀態 ${state.orderStatus} 不可交付。` };
  }
  const expires = new Date(state.expiresAt);
  if (Number.isNaN(expires.getTime()) || expires.getTime() < now.getTime()) {
    return { ok: false, reason: '取貨碼已過期。' };
  }
  return { ok: true, reason: null };
}

/** 離線掃碼事件重送時，以 clientEventId 去重。 */
export function dedupeOfflineEvents<T extends { readonly clientEventId: string }>(events: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const event of events) {
    if (seen.has(event.clientEventId)) continue;
    seen.add(event.clientEventId);
    result.push(event);
  }
  return result;
}
