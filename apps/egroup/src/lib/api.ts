import { NextResponse } from 'next/server';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export function fail(message: string, status = 400): NextResponse {
  return json({ error: message }, status);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function int(body: Record<string, unknown>, key: string, fallback = 0): number {
  const value = Number(body[key]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}
