import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** 健康檢查：只回報程序是否活著，不洩漏設定內容。 */
export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok', service: 'jp-web', time: new Date().toISOString() });
}
