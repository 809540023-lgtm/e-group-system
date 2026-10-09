/**
 * 員工 session 與權限檢查（規劃書 10、15、17 章；模組 03）。
 *
 * 每次 API 寫入都在服務端查角色；前端隱藏按鈕不能替代後端檢查。
 * 正式模式拒絕啟動 dev-only auth。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  assertPermission,
  assertSessionValid,
  assertStaffActive,
  permissionsFor,
  type Permission,
  type StaffPrincipal,
  type StaffRole,
} from '@jp/domain';
import { assertDevAuthAllowed, readWebEnv, type WebEnv } from './env.ts';

export const SESSION_COOKIE = 'jp_session';
export const SESSION_TTL_MINUTES = 480;

export interface SessionPayload {
  readonly staffId: string;
  readonly roles: readonly StaffRole[];
  readonly sessionEpoch: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = base64url(JSON.stringify(payload));
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/**
 * 建立 session payload。
 * 有效期限由伺服器決定，呼叫端不得自行指定，避免簽出永不過期的登入。
 */
export function createSessionPayload(
  input: { readonly staffId: string; readonly roles: readonly StaffRole[]; readonly sessionEpoch: number },
  now: Date = new Date(),
): SessionPayload {
  return {
    staffId: input.staffId,
    roles: input.roles,
    sessionEpoch: input.sessionEpoch,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000).toISOString(),
  };
}

export function verifySession(token: string, secret: string, now: Date = new Date()): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts as [string, string];
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromBase64url(body)) as SessionPayload;
  } catch {
    return null;
  }
  if (new Date(payload.expiresAt).getTime() <= now.getTime()) return null;
  return payload;
}

export interface AuthContext {
  readonly principal: StaffPrincipal;
  readonly permissions: ReadonlySet<Permission>;
}

export class AuthError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';
  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

/**
 * 由 cookie 建立授權情境。
 * `lookup` 必須向資料庫查目前角色與 sessionEpoch，不能相信 cookie 內的角色。
 */
export async function requireStaff(
  cookieValue: string | undefined,
  lookup: (staffId: string) => Promise<StaffPrincipal | null>,
  options: { readonly env?: WebEnv; readonly now?: Date } = {},
): Promise<AuthContext> {
  const env = options.env ?? readWebEnv();
  const now = options.now ?? new Date();
  if (env.sessionSecret === null) {
    throw new AuthError('UNAUTHENTICATED', '尚未設定 SESSION_SECRET，無法驗證登入。');
  }
  if (cookieValue === undefined || cookieValue === '') {
    throw new AuthError('UNAUTHENTICATED', '請先登入。');
  }
  const payload = verifySession(cookieValue, env.sessionSecret, now);
  if (payload === null) {
    throw new AuthError('UNAUTHENTICATED', '登入已過期，請重新登入。');
  }
  const principal = await lookup(payload.staffId);
  if (principal === null) {
    throw new AuthError('UNAUTHENTICATED', '找不到員工帳號。');
  }
  try {
    assertStaffActive(principal);
    assertSessionValid(principal, payload.sessionEpoch);
  } catch (cause) {
    throw new AuthError('UNAUTHENTICATED', cause instanceof Error ? cause.message : '登入已失效。');
  }
  return { principal, permissions: permissionsFor(principal.roles) };
}

/** 服務端權限檢查；失敗即拒絕，不依賴前端。 */
export function requirePermission(context: AuthContext, permission: Permission): void {
  try {
    assertPermission(context.principal, permission);
  } catch (cause) {
    throw new AuthError('FORBIDDEN', cause instanceof Error ? cause.message : '權限不足。');
  }
}

export interface DevAuthUser {
  readonly staffId: string;
  readonly roles: readonly StaffRole[];
}

/** dev-only auth：僅在非正式模式且明確開啟時可用。 */
export function devAuthUsers(env: WebEnv = readWebEnv()): readonly DevAuthUser[] {
  assertDevAuthAllowed(env);
  if (!env.devAuthEnabled) return [];
  return [
    { staffId: 'dev-owner', roles: ['owner'] },
    { staffId: 'dev-catalog', roles: ['catalog'] },
    { staffId: 'dev-support', roles: ['support'] },
    { staffId: 'dev-finance', roles: ['finance'] },
    { staffId: 'dev-logistics', roles: ['logistics'] },
    { staffId: 'dev-marketing', roles: ['marketing'] },
  ];
}

export function devAuthPrincipal(staffId: string, env: WebEnv = readWebEnv()): StaffPrincipal | null {
  const user = devAuthUsers(env).find((u) => u.staffId === staffId);
  if (user === undefined) return null;
  return { staffId: user.staffId, roles: user.roles, active: true, sessionEpoch: 1 };
}

export function sessionCookieOptions(env: WebEnv = readWebEnv()): {
  readonly httpOnly: true;
  readonly sameSite: 'lax';
  readonly secure: boolean;
  readonly path: '/';
  readonly maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.mode === 'production',
    path: '/',
    maxAge: SESSION_TTL_MINUTES * 60,
  };
}
