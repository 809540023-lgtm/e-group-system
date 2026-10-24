import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, query } from './db.ts';
import { sessionSecret } from './env.ts';
import { verifyPassword } from './password.ts';

export { hashPassword, verifyPassword } from './password.ts';

export type Role = 'customer' | 'supplier' | 'station' | 'admin';

export interface Session {
  readonly accountId: string;
  readonly role: Role;
  readonly displayName: string;
  readonly email: string;
  readonly customerId: string | null;
  readonly supplierId: string | null;
  readonly stationId: string | null;
}

interface SessionPayload {
  readonly sub: string;
  readonly role: Role;
  readonly epoch: number;
  readonly iat: number;
}

interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly display_name: string;
  readonly customer_id: string | null;
  readonly supplier_id: string | null;
  readonly station_id: string | null;
  readonly active: boolean;
  readonly session_epoch: number;
  readonly password_hash: string;
}

const COOKIE_NAME = 'eg_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secret(): string {
  return sessionSecret();
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value, 'utf8').digest('base64url');
}

export function createSessionToken(accountId: string, role: Role, epoch: number): string {
  const payload: SessionPayload = { sub: accountId, role, epoch, iat: Math.floor(Date.now() / 1000) };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (body === undefined || signature === undefined) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.epoch !== 'number') return null;
    if (Date.now() / 1000 - payload.iat > SESSION_TTL_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token === undefined) return null;
  const payload = verifySessionToken(token);
  if (payload === null) return null;

  const account = await one<AccountRow>(
    `SELECT id, email, role, display_name, customer_id, supplier_id, station_id, active, session_epoch, password_hash
       FROM accounts WHERE id = $1`,
    [payload.sub],
  );
  if (account === null || !account.active || account.session_epoch !== payload.epoch) return null;

  return {
    accountId: account.id,
    role: account.role,
    displayName: account.display_name,
    email: account.email,
    customerId: account.customer_id,
    supplierId: account.supplier_id,
    stationId: account.station_id,
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session === null) redirect('/login');
  return session;
}

export async function requireRole(roles: readonly Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect('/');
  return session;
}

export async function setSessionCookie(accountId: string, role: Role, epoch: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(accountId, role, epoch), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function authenticate(email: string, password: string): Promise<AccountRow | null> {
  const account = await one<AccountRow>(
    `SELECT id, email, role, display_name, customer_id, supplier_id, station_id, active, session_epoch, password_hash
       FROM accounts WHERE lower(email) = lower($1)`,
    [email.trim()],
  );
  if (account === null || !account.active) return null;
  if (!verifyPassword(password, account.password_hash)) return null;
  return account;
}

export async function bumpSessionEpoch(accountId: string): Promise<void> {
  await query('UPDATE accounts SET session_epoch = session_epoch + 1 WHERE id = $1', [accountId]);
}
