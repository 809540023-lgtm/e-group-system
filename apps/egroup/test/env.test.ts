import { describe, expect, it } from 'vitest';
import { assertEgroupEnv, databaseUrl, isProduction, pickupSecret, sessionSecret, validateEgroupEnv } from '../src/lib/env.ts';

const DEV_SESSION = 'dev-only-egroup-session-secret-change-me';
const DEV_PICKUP = 'dev-only-egroup-pickup-secret-change-me';

describe('isProduction', () => {
  it('NODE_ENV=production 視為正式環境', () => {
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
  });

  it('EGROUP_ENV=production 視為正式環境', () => {
    expect(isProduction({ EGROUP_ENV: 'production' })).toBe(true);
  });

  it('未設定時不是正式環境', () => {
    expect(isProduction({})).toBe(false);
  });
});

describe('開發環境', () => {
  it('缺少密鑰時回退到開發預設值', () => {
    expect(sessionSecret({})).toBe(DEV_SESSION);
    expect(pickupSecret({})).toBe(DEV_PICKUP);
    expect(databaseUrl({})).toBe('postgres://localhost:5432/egroup_dev');
  });

  it('優先使用 EGROUP_ 前綴', () => {
    const env = { EGROUP_SESSION_SECRET: 'eg', SESSION_SECRET: 'generic' };
    expect(sessionSecret(env)).toBe('eg');
  });

  it('空白字串視為未設定', () => {
    expect(sessionSecret({ EGROUP_SESSION_SECRET: '   ' })).toBe(DEV_SESSION);
  });

  it('非正式環境不做啟動檢查', () => {
    expect(validateEgroupEnv({})).toHaveLength(0);
    expect(() => assertEgroupEnv({})).not.toThrow();
  });
});

describe('正式環境', () => {
  it('缺少密鑰時直接拋錯，不回退到開發預設值', () => {
    expect(() => sessionSecret({ NODE_ENV: 'production' })).toThrow(/EGROUP_ENV_MISSING/);
    expect(() => pickupSecret({ NODE_ENV: 'production' })).toThrow(/EGROUP_ENV_MISSING/);
    expect(() => databaseUrl({ NODE_ENV: 'production' })).toThrow(/EGROUP_ENV_MISSING/);
  });

  it('使用開發預設值簽章時拒絕啟動', () => {
    const env = {
      NODE_ENV: 'production',
      EGROUP_DATABASE_URL: 'postgres://db/egroup',
      EGROUP_SESSION_SECRET: DEV_SESSION,
      EGROUP_PICKUP_SECRET: DEV_PICKUP,
    };
    expect(() => sessionSecret(env)).toThrow(/EGROUP_ENV_INSECURE/);
    expect(() => pickupSecret(env)).toThrow(/EGROUP_ENV_INSECURE/);
  });

  it('設定完整時列出零個問題', () => {
    const env = {
      NODE_ENV: 'production',
      EGROUP_DATABASE_URL: 'postgres://db/egroup',
      EGROUP_SESSION_SECRET: 'a-strong-session-secret',
      EGROUP_PICKUP_SECRET: 'a-strong-pickup-secret',
    };
    expect(validateEgroupEnv(env)).toHaveLength(0);
    expect(() => assertEgroupEnv(env)).not.toThrow();
  });

  it('設定不完整時一次列出所有問題', () => {
    const problems = validateEgroupEnv({ NODE_ENV: 'production' });
    const names = problems.map((problem) => problem.name);
    expect(names).toContain('EGROUP_DATABASE_URL');
    expect(names).toContain('EGROUP_SESSION_SECRET');
    expect(names).toContain('EGROUP_PICKUP_SECRET');
    expect(() => assertEgroupEnv({ NODE_ENV: 'production' })).toThrow(/EGROUP_ENV_INVALID/);
  });
});
