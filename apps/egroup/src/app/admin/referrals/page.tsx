import { Badge, Card, Notice, PageHeader, Stat, Table } from '../../../components/ui.tsx';
import { approveReferralAction, reverseReferralAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime, formatTwd } from '../../../lib/format.ts';
import { listReferrals } from '../../../lib/ops.ts';

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const referrals = await listReferrals();
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const pending = referrals.filter((referral) => referral.status === 'pending');
  const approved = referrals.filter((referral) => referral.status === 'approved');
  const reversed = referrals.filter((referral) => referral.status === 'reversed');

  return (
    <>
      <PageHeader
        title="推薦獎勵"
        subtitle="單層推薦、不得自薦；被推薦人完成取貨後才可核准。退款會自動扣回已核准獎勵。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-4">
        <Stat label="待核准" value={pending.length} hint="完成交付後" />
        <Stat label="已核准" value={approved.length} hint={formatTwd(approved.reduce((sum, item) => sum + item.reward_twd, 0))} />
        <Stat label="已扣回" value={reversed.length} hint={formatTwd(reversed.reduce((sum, item) => sum + item.reward_twd, 0))} />
        <Stat label="總筆數" value={referrals.length} hint="每筆訂單僅一次" />
      </div>

      <Card title="推薦紀錄" className="card">
        {referrals.length === 0 ? <p className="muted small">尚無推薦紀錄。</p> : (
          <Table head={['推薦人', '被推薦人', '訂單', '獎勵', '狀態', '原因', '時間', '操作']}>
            {referrals.map((referral) => (
              <tr key={referral.id}>
                <td>{referral.referrer_name}</td>
                <td>{referral.referee_name}</td>
                <td className="mono tiny">{referral.order_no}</td>
                <td className="num">{formatTwd(referral.reward_twd)}</td>
                <td><Badge tone={referral.status === 'approved' ? 'ok' : referral.status === 'reversed' ? 'danger' : 'warn'}>{referral.status}</Badge></td>
                <td className="muted small">{referral.reason ?? '—'}</td>
                <td className="muted small">{formatDateTime(referral.created_at)}</td>
                <td>
                  {referral.status === 'pending' ? (
                    <form action={approveReferralAction}>
                      <input type="hidden" name="referralId" value={referral.id} />
                      <input type="hidden" name="redirectTo" value="/admin/referrals" />
                      <button type="submit" className="btn btn-sm btn-primary">核准</button>
                    </form>
                  ) : referral.status === 'approved' ? (
                    <form action={reverseReferralAction} className="row">
                      <input type="hidden" name="referralId" value={referral.id} />
                      <input type="hidden" name="redirectTo" value="/admin/referrals" />
                      <input name="reason" required placeholder="扣回原因" style={{ width: 110 }} />
                      <button type="submit" className="btn btn-sm btn-danger">扣回</button>
                    </form>
                  ) : (
                    <span className="muted tiny">—</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="規則提醒">
        <ul className="list">
          <li>推薦人與被推薦人不得為同一人。</li>
          <li>被推薦人僅能歸因一次，且須完成取貨。</li>
          <li>退款時已核准獎勵自動扣回，避免重複獎勵。</li>
          <li>獎勵以點數入帳，不得兌換現金。</li>
        </ul>
      </Card>
    </>
  );
}
