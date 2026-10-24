import { fail, json, readJson, str } from '../../../../../lib/api.ts';
import { getSession } from '../../../../../lib/auth.ts';
import { one } from '../../../../../lib/db.ts';

export const dynamic = 'force-dynamic';

interface TransitionResult {
  ok: boolean;
  code: string;
  reason: string;
  from: string;
  to: string | null;
  requiresManualReview: boolean;
}

/**
 * 代幣法律狀態轉換。
 *
 * 狀態由接收地址性質自動決定，請求端只能指定「轉到哪個地址」，不能指定「轉成哪個狀態」。
 * 只有批次所有人本人或總部可發起。
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (session === null) return fail('UNAUTHENTICATED', 401);

  const body = await readJson(request);
  const lotId = str(body, 'lotId');
  const toAddress = str(body, 'toAddress');
  if (lotId === '' || toAddress === '') return fail('INVALID_INPUT', 400);

  const owner = await one<{ account_id: string }>(
    `SELECT h.account_id FROM token_lots l JOIN token_holders h ON h.id = l.holder_id WHERE l.id = $1`,
    [lotId],
  );
  if (owner === null) return fail('LOT_NOT_FOUND', 404);
  if (session.role !== 'admin' && owner.account_id !== session.accountId) return fail('FORBIDDEN', 403);

  const result = await one<{ result: TransitionResult }>(
    `SELECT eg_transition_token_state($1::uuid, $2, $3) AS result`,
    [lotId, toAddress, session.email],
  );
  if (result === null) return fail('TRANSITION_FAILED', 500);

  const payload = result.result;
  return json(payload, payload.ok ? 200 : 409);
}
