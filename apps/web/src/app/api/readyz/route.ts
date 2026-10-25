import { NextResponse } from 'next/server';
import { withClient } from '@/lib/db';
import { readWebEnv, validateProductionEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** readiness：檢查必要設定與資料庫連線；不洩漏秘密值。 */
export async function GET(): Promise<NextResponse> {
  const env = readWebEnv();
  const checks: Check[] = [];

  const problems = validateProductionEnv(env);
  checks.push({
    name: 'env',
    ok: problems.length === 0,
    detail: problems.length === 0 ? '設定檢查通過' : problems.map((p) => `${p.name}：${p.reason}`).join('；'),
  });

  if (env.databaseUrl === null) {
    checks.push({ name: 'database', ok: false, detail: '未設定 DATABASE_URL，無法確認交易資料庫。' });
  } else {
    try {
      await withClient(env.databaseUrl, async (client) => {
        await client.query('SELECT 1');
      });
      checks.push({ name: 'database', ok: true, detail: '資料庫連線正常' });
    } catch (cause) {
      checks.push({ name: 'database', ok: false, detail: `資料庫連線失敗：${cause instanceof Error ? cause.message : String(cause)}` });
    }
  }

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ status: ok ? 'ready' : 'not_ready', mode: env.mode, checks }, { status: ok ? 200 : 503 });
}
