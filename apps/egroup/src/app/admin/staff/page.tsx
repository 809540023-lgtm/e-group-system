import { Badge, Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { createAccountAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime, ROLE_LABELS } from '../../../lib/format.ts';
import { listStations } from '../../../lib/queries.ts';
import { listAccounts, listSuppliers } from '../../../lib/ops.ts';

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const [accounts, suppliers, stations] = await Promise.all([listAccounts(), listSuppliers(), listStations()]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="人員帳號"
        subtitle="帳號採角色權限；停用帳號會立即失效（session epoch 遞增）。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="帳號清單">
        <Table head={['電子郵件', '名稱', '角色', '歸屬', '狀態', '建立時間']}>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td className="mono tiny">{account.email}</td>
              <td>{account.display_name}</td>
              <td><Badge tone={account.role === 'admin' ? 'danger' : account.role === 'supplier' ? 'info' : 'muted'}>{ROLE_LABELS[account.role] ?? account.role}</Badge></td>
              <td className="muted small">{account.scope ?? '—'}</td>
              <td><Badge tone={account.active ? 'ok' : 'muted'}>{account.active ? '啟用' : '停用'}</Badge></td>
              <td className="muted small">{formatDateTime(account.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="建立帳號">
        <form action={createAccountAction} className="form">
          <input type="hidden" name="redirectTo" value="/admin/staff" />
          <div className="grid grid-3">
            <Field label="電子郵件"><input name="email" type="email" required /></Field>
            <Field label="顯示名稱"><input name="displayName" required /></Field>
            <Field label="密碼" hint="至少 8 碼"><input name="password" type="password" minLength={8} required /></Field>
          </div>
          <div className="grid grid-3">
            <Field label="角色">
              <select name="role" defaultValue="station">
                <option value="customer">顧客</option>
                <option value="supplier">供應商</option>
                <option value="station">站點</option>
                <option value="admin">總部</option>
              </select>
            </Field>
            <Field label="供應商" hint="供應商角色必填">
              <select name="supplierId" defaultValue="">
                <option value="">—</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </Field>
            <Field label="站點" hint="站點角色必填">
              <select name="stationId" defaultValue="">
                <option value="">—</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>{station.code} · {station.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <button type="submit" className="btn btn-primary">建立帳號</button>
        </form>
      </Card>
    </>
  );
}
