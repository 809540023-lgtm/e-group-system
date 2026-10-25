/**
 * 啟動檢查（Next.js instrumentation hook）。
 *
 * 正式環境缺少密鑰時在啟動階段就失敗，而不是等到第一個請求才用開發預設值簽章。
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { assertEgroupEnv } = await import('./lib/env.ts');
  assertEgroupEnv();
}
