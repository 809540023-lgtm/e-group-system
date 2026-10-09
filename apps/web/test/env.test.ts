import { describe, expect, it } from 'vitest';
import { assertDevAuthAllowed, readWebEnv, validateProductionEnv } from '../src/lib/env.ts';

describe('readWebEnv', () => {
  it('未設定 APP_MODE 時預設為 development', () => {
    expect(readWebEnv({}).mode).toBe('development');
  });

  it('無法辨識的 APP_MODE 一律退回 development，不誤判為正式', () => {
    expect(readWebEnv({ APP_MODE: 'prod' }).mode).toBe('development');
  });

  it('空白字串視為未設定', () => {
    const env = readWebEnv({ SESSION_SECRET: '   ', DATABASE_URL: '' });
    expect(env.sessionSecret).toBeNull();
    expect(env.databaseUrl).toBeNull();
  });

  it('正式模式不得啟用 dev-only auth', () => {
    const env = readWebEnv({ APP_MODE: 'production', DEV_AUTH_ENABLED: 'true' });
    expect(env.devAuthEnabled).toBe(false);
  });

  it('非正式模式可啟用 dev-only auth', () => {
    const env = readWebEnv({ APP_MODE: 'development', DEV_AUTH_ENABLED: 'true' });
    expect(env.devAuthEnabled).toBe(true);
  });
});

describe('validateProductionEnv', () => {
  it('非正式模式不做檢查', () => {
    expect(validateProductionEnv(readWebEnv({ APP_MODE: 'development' }))).toHaveLength(0);
  });

  it('正式模式缺少必要設定時列出所有問題', () => {
    const problems = validateProductionEnv(readWebEnv({ APP_MODE: 'production' }));
    const names = problems.map((p) => p.name);
    expect(names).toContain('SESSION_SECRET');
    expect(names).toContain('QUOTE_SIGNING_SECRET');
    expect(names).toContain('DATABASE_URL');
    expect(names).toContain('PUBLIC_BASE_URL');
  });

  it('正式模式使用 http 時視為問題', () => {
    const problems = validateProductionEnv(
      readWebEnv({
        APP_MODE: 'production',
        SESSION_SECRET: 's',
        QUOTE_SIGNING_SECRET: 'q',
        DATABASE_URL: 'postgres://localhost/jp',
        PUBLIC_BASE_URL: 'http://example.com',
      }),
    );
    expect(problems.map((p) => p.name)).toEqual(['PUBLIC_BASE_URL']);
  });

  it('正式模式設定完整時沒有問題', () => {
    const problems = validateProductionEnv(
      readWebEnv({
        APP_MODE: 'production',
        SESSION_SECRET: 's',
        QUOTE_SIGNING_SECRET: 'q',
        DATABASE_URL: 'postgres://localhost/jp',
        PUBLIC_BASE_URL: 'https://example.com',
      }),
    );
    expect(problems).toHaveLength(0);
  });
});

describe('assertDevAuthAllowed', () => {
  it('正式模式且啟用 dev auth 時丟出錯誤', () => {
    const env = { ...readWebEnv({ APP_MODE: 'production' }), devAuthEnabled: true };
    expect(() => assertDevAuthAllowed(env)).toThrow(/DEV_AUTH_FORBIDDEN_IN_PRODUCTION/);
  });

  it('正式模式未啟用 dev auth 時通過', () => {
    expect(() => assertDevAuthAllowed(readWebEnv({ APP_MODE: 'production' }))).not.toThrow();
  });
});
