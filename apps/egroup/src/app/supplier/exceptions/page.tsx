import { redirect } from 'next/navigation';
import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { respondExceptionAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listSupplierExceptions } from '../../../lib/ops.ts';

export default async function SupplierExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['supplier', 'admin']);
  if (session.supplierId === null) redirect('/admin');
  const params = await searchParams;

  const exceptions = await listSupplierExceptions(session.supplierId);
  const open = exceptions.filter((item) => item.status === 'open');
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader title="異常處理" subtitle="收貨溫度不符、文件缺漏或品質客訴會建立異常；供應商須回覆處理方式。" />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}
      {open.length > 0 ? <Notice tone="warn">有 {open.length} 件異常待回覆。</Notice> : null}

      <Card title="異常清單">
        {exceptions.length === 0 ? <p className="muted small">目前沒有異常。</p> : (
          <Table head={['類型', '批號', '說明', '狀態', '回覆', '時間']}>
            {exceptions.map((item) => (
              <tr key={item.id}>
                <td>{item.type}</td>
                <td className="mono tiny">{item.lot_no ?? '—'}</td>
                <td className="muted small">{item.description}</td>
                <td><Badge tone={item.status === 'closed' ? 'ok' : item.status === 'responded' ? 'info' : 'warn'}>{item.status}</Badge></td>
                <td className="muted small">{item.response ?? '—'}</td>
                <td className="muted small">{formatDateTime(item.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="回覆異常">
        <form action={respondExceptionAction} className="form">
          <input type="hidden" name="redirectTo" value="/supplier/exceptions" />
          <Field label="異常案件">
            <select name="exceptionId" required>
              {open.map((item) => (
                <option key={item.id} value={item.id}>{item.type} · {item.description.slice(0, 40)}</option>
              ))}
            </select>
          </Field>
          <Field label="回覆內容" hint="說明原因、矯正措施與預防措施">
            <textarea name="response" rows={3} required />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={open.length === 0}>送出回覆</button>
        </form>
      </Card>
    </>
  );
}
