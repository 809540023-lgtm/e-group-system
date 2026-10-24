import { json } from '../../../lib/api.ts';
import { one } from '../../../lib/db.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    const row = await one<{ ok: number; migrations: string }>(
      `SELECT 1 AS ok, (SELECT count(*)::text FROM schema_migrations) AS migrations`,
    );
    return json({
      status: 'ready',
      database: 'up',
      migrations: Number(row?.migrations ?? 0),
      latency_ms: Date.now() - started,
    });
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
