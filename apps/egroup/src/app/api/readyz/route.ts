import { json } from '../../../lib/api.ts';
import { one } from '../../../lib/db.ts';
import { validateEgroupEnv } from '../../../lib/env.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const envProblems = validateEgroupEnv();
  try {
    const row = await one<{ ok: number; migrations: string }>(
      `SELECT 1 AS ok, (SELECT count(*)::text FROM schema_migrations) AS migrations`,
    );
    return json({
      status: envProblems.length === 0 ? 'ready' : 'not_ready',
      database: 'up',
      migrations: Number(row?.migrations ?? 0),
      env: envProblems.length === 0 ? 'ok' : envProblems.map((p) => `${p.name}：${p.reason}`).join('；'),
      latency_ms: Date.now() - started,
    }, envProblems.length === 0 ? 200 : 503);
  } catch (error) {
    return json(
      {
        status: 'not_ready',
        database: 'down',
        error: error instanceof Error ? error.message : 'unknown',
        latency_ms: Date.now() - started,
      },
      503,
    );
  }
}
