import { Badge, Card, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { aiDraftAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listSupportTickets } from '../../../lib/ops.ts';

const GUARDRAILS = [
  '不得解除召回或放寬隔離',
  '不得修改保存期限或效期標示',
  '不得核准投資、採購或結算',
  '不得診斷疾病或提供醫療建議',
  '不得承諾賠償金額，須轉人工',
];

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const tickets = await listSupportTickets();
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="AI 客服"
        subtitle="AI 僅產生回覆草稿，須人工覆核後送出；涉及召回、效期、投資與醫療問題一律轉人工。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="AI 護欄">
        <ul className="list">
          {GUARDRAILS.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </Card>

      <Card title="客服工單" className="card">
        {tickets.length === 0 ? <p className="muted small">目前沒有工單。</p> : (
          <Table head={['主旨', '顧客', '訂單', '狀態', '草稿', '時間', '操作']}>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.subject}<div className="muted tiny">{ticket.body.slice(0, 60)}</div></td>
                <td className="muted small">{ticket.customer_name ?? '—'}</td>
                <td className="mono tiny">{ticket.order_no ?? '—'}</td>
                <td><Badge tone={ticket.status === 'resolved' ? 'ok' : ticket.status === 'in_progress' ? 'info' : 'warn'}>{ticket.status}</Badge></td>
                <td className="muted small">{ticket.draft_reply === null ? '—' : `${ticket.draft_reply.slice(0, 50)}…`}</td>
                <td className="muted small">{formatDateTime(ticket.created_at)}</td>
                <td>
                  <form action={aiDraftAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <input type="hidden" name="redirectTo" value="/admin/ai" />
                    <button type="submit" className="btn btn-sm">產生草稿</button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {tickets.filter((ticket) => ticket.draft_reply !== null).map((ticket) => (
        <Card key={ticket.id} title={`草稿 · ${ticket.subject}`} subtitle="須人工覆核後送出">
          <pre className="draft">{ticket.draft_reply}</pre>
        </Card>
      ))}
    </>
  );
}
