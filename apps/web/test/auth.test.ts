import { describe, expect, it } from 'vitest';
import { AuthError, createSessionPayload, devAuthPrincipal, devAuthUsers, requirePermission, requireStaff, signSession, verifySession } from '../src/lib/auth.ts';
import { readWebEnv } from '../src/lib/env.ts';

const SECRET = 'test-secret-value';
const env = readWebEnv({ APP_MODE: 'development', SESSION_SECRET: SECRET, DEV_AUTH_ENABLED: 'true' });

describe('signSession / verifySession', () => {
  it('簽章後可驗證並取回相同內容', () => {
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 3 }), SECRET);
    const payload = verifySession(token, SECRET);
    expect(payload?.staffId).toBe('staff-1');
    expect(payload?.sessionEpoch).toBe(3);
  });

  it('換一把密鑰即無法驗證', () => {
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }), SECRET);
    expect(verifySession(token, 'other-secret')).toBeNull();
  });

  it('竄改內容即無法驗證', () => {
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }), SECRET);
    const [body, mac] = token.split('.');
    const tampered = `${body}x.${mac}`;
    expect(verifySession(tampered, SECRET)).toBeNull();
  });

  it('格式錯誤的 token 回傳 null 而非丟出例外', () => {
    expect(verifySession('not-a-token', SECRET)).toBeNull();
    expect(verifySession('', SECRET)).toBeNull();
  });

  it('超過有效期限即失效', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }, issuedAt), SECRET);
    const later = new Date('2026-01-01T09:00:00.000Z');
    expect(verifySession(token, SECRET, later)).toBeNull();
  });

  it('有效期限由伺服器決定，不接受呼叫端指定', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const payload = createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }, issuedAt);
    expect(new Date(payload.expiresAt).getTime() - issuedAt.getTime()).toBe(480 * 60_000);
  });
});

describe('requireStaff', () => {
  it('未設定 SESSION_SECRET 時拒絕', async () => {
    const noSecret = readWebEnv({ APP_MODE: 'development' });
    await expect(requireStaff('x', async () => null, { env: noSecret })).rejects.toBeInstanceOf(AuthError);
  });

  it('沒有 cookie 時拒絕', async () => {
    await expect(requireStaff(undefined, async () => null, { env })).rejects.toThrow(/請先登入/);
  });

  it('查不到員工時拒絕', async () => {
    const token = signSession(createSessionPayload({ staffId: 'ghost', roles: ['owner'], sessionEpoch: 1 }), SECRET);
    await expect(requireStaff(token, async () => null, { env })).rejects.toThrow(/找不到員工帳號/);
  });

  it('停用的員工即使 token 有效也拒絕', async () => {
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }), SECRET);
    await expect(
      requireStaff(token, async () => ({ staffId: 'staff-1', roles: ['owner'], active: false, sessionEpoch: 1 }), { env }),
    ).rejects.toThrow(/停用/);
  });

  it('sessionEpoch 不符時拒絕，讓角色變更立即生效', async () => {
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }), SECRET);
    await expect(
      requireStaff(token, async () => ({ staffId: 'staff-1', roles: ['owner'], active: true, sessionEpoch: 2 }), { env }),
    ).rejects.toThrow(/失效/);
  });

  it('有效 token 與有效員工時回傳權限集合', async () => {
    const token = signSession(createSessionPayload({ staffId: 'staff-1', roles: ['owner'], sessionEpoch: 1 }), SECRET);
    const context = await requireStaff(token, async () => ({ staffId: 'staff-1', roles: ['support'], active: true, sessionEpoch: 1 }), { env });
    expect(context.permissions.has('order.read.all')).toBe(true);
    expect(context.permissions.has('refund.approve')).toBe(false);
  });
});

describe('requirePermission', () => {
  it('缺少權限時丟出 FORBIDDEN', () => {
    const context = { principal: { staffId: 's', roles: ['support'] as const, active: true, sessionEpoch: 1 }, permissions: new Set(['order.read.own' as const]) };
    expect(() => requirePermission(context, 'refund.approve')).toThrow(/缺少權限/);
  });

  it('具備權限時通過', () => {
    const context = { principal: { staffId: 's', roles: ['owner'] as const, active: true, sessionEpoch: 1 }, permissions: new Set(['refund.approve' as const]) };
    expect(() => requirePermission(context, 'refund.approve')).not.toThrow();
  });
});

describe('dev-only auth', () => {
  it('正式模式不得取得 dev 帳號', () => {
    const prod = { ...readWebEnv({ APP_MODE: 'production' }), devAuthEnabled: true };
    expect(() => devAuthUsers(prod)).toThrow(/DEV_AUTH_FORBIDDEN_IN_PRODUCTION/);
  });

  it('未開啟時沒有 dev 帳號', () => {
    expect(devAuthUsers(readWebEnv({ APP_MODE: 'development' }))).toHaveLength(0);
  });

  it('開啟時提供六種角色', () => {
    expect(devAuthUsers(env)).toHaveLength(6);
  });

  it('未知的 dev 帳號回傳 null', () => {
    expect(devAuthPrincipal('nobody', env)).toBeNull();
  });
});
