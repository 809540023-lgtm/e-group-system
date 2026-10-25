import { cookies } from 'next/headers';
import { permissionsFor, type Permission, type StaffPrincipal, type StaffRole } from '@jp/domain';
import { AuthError, SESSION_COOKIE, devAuthPrincipal, requirePermission, requireStaff, type AuthContext } from './auth';
import { withClient } from './db';
import { readWebEnv, type WebEnv } from './env';

/**
 * 後臺授權（規劃書 03 章；模組 03）。
 *
 * 角色一律由伺服器查詢，cookie 只帶 staffId 與 sessionEpoch。
 * 未登入或權限不足時丟出 AuthError，由頁面轉成明確的拒絕畫面。
 */
export async function loadAdminContext(env: WebEnv = readWebEnv()): Promise<AuthContext> {
  const store = await cookies();
  const cookieValue = store.get(SESSION_COOKIE)?.value;

  if (env.devAuthEnabled && env.mode !== 'production') {
    const principal = devAuthPrincipal(cookieValue ?? '', env);
    if (principal !== null) {
      return { principal, permissions: permissionsFor(principal.roles) };
    }
  }

  return requireStaff(cookieValue, (staffId) => lookupPrincipal(staffId), { env });
}

export async function requireAdminPermission(permission: Permission, env: WebEnv = readWebEnv()): Promise<AuthContext> {
  const context = await loadAdminContext(env);
  requirePermission(context, permission);
  return context;
}

export function describeAuthError(cause: unknown): { readonly code: string; readonly message: string } {
  if (cause instanceof AuthError) return { code: cause.code, message: cause.message };
  return { code: 'UNAUTHENTICATED', message: '請先登入。' };
}

async function lookupPrincipal(staffId: string): Promise<StaffPrincipal | null> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') return null;
  return withClient(url, async (client) => {
    const result = await client.query<{ staff_id: string; active: boolean; session_epoch: number; roles: string[] | null }>(
      `SELECT s.staff_id, s.active, s.session_epoch,
              COALESCE(array_agg(sp.role) FILTER (WHERE sp.role IS NOT NULL), '{}') AS roles
         FROM staff s
         LEFT JOIN staff_permissions sp ON sp.staff_id = s.staff_id
        WHERE s.staff_id = $1
        GROUP BY s.staff_id, s.active, s.session_epoch`,
      [staffId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      staffId: row.staff_id,
      roles: (row.roles ?? []) as readonly StaffRole[],
      active: row.active,
      sessionEpoch: row.session_epoch,
    };
  });
}
