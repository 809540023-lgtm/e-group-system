import { json } from '../../../lib/api.ts';

export const dynamic = 'force-dynamic';

export function GET() {
  return json({
    status: 'ok',
    service: 'egroup',
    version: process.env.npm_package_version ?? '0.1.0',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
