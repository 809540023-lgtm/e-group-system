import Link from 'next/link';
import { Badge, Card, Field, Notice, PageHeader, Stat, Table } from '../../components/ui.tsx';
import { addMaintenanceAction, updateEquipmentStatusAction } from '../../lib/actions.ts';
import { requireRole } from '../../lib/auth.ts';
import { formatDate, formatTwd } from '../../lib/format.ts';
import { listEquipment } from '../../lib/ops.ts';

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;

  const equipment = await listEquipment();
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const value = equipment.reduce((sum, item) => sum + (item.purchase_price_twd ?? 0), 0);
  const due = equipment.filter((item) => item.next_maintenance_on !== null && new Date(item.next_maintenance_on) <= new Date(Date.now() + 30 * 86_400_000));

  return (
    <>
      <PageHeader
        title="資產管理"
        subtitle="設備、租賃與保養紀錄；保險到期與保養逾期會影響站點營運資格。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <div className="grid grid-4">
        <Stat label="設備總數" value={equipment.length} hint="含租賃" />
        <Stat label="帳面原值" value={formatTwd(value)} hint="購入價合計" />
        <Stat label="30 日內保養" value={due.length} hint="需排程" />
        <Stat label="停用 / 遺失" value={equipment.filter((item) => item.status === 'retired' || item.status === 'lost').length} hint="需報廢處理" />
      </div>

      <Card title="設備清單" className="card">
        <Table head={['資產編號', '類型', '站點', '序號', '所有權', '購入價', '保險到期', '下次保養', '狀態', '操作']}>
          {equipment.map((item) => (
            <tr key={item.id}>
              <td className="mono"><Link href={`/assets/${item.asset_no}`}>{item.asset_no}</Link></td>
              <td>{item.type}</td>
              <td className="muted small">{item.station_name ?? '—'}</td>
              <td className="mono tiny">{item.serial_no}</td>
              <td className="muted small">{item.owner}</td>
              <td className="num">{formatTwd(item.purchase_price_twd)}</td>
              <td className="muted small">{formatDate(item.insurance_expires_on)}</td>
              <td className="muted small">{formatDate(item.next_maintenance_on)}</td>
              <td><Badge tone={item.status === 'active' ? 'ok' : item.status === 'maintenance' ? 'warn' : 'danger'}>{item.status}</Badge></td>
              <td>
                <form action={updateEquipmentStatusAction} className="row">
                  <input type="hidden" name="equipmentId" value={item.id} />
                  <input type="hidden" name="redirectTo" value="/assets" />
                  <select name="status" defaultValue={item.status}>
                    <option value="active">啟用</option>
                    <option value="maintenance">保養</option>
                    <option value="retired">報廢</option>
                    <option value="lost">遺失</option>
                  </select>
                  <button type="submit" className="btn btn-sm">更新</button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="登錄保養">
        <form action={addMaintenanceAction} className="form">
          <input type="hidden" name="redirectTo" value="/assets" />
          <div className="grid grid-4">
            <Field label="設備">
              <select name="equipmentId" required>
                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>{item.asset_no} · {item.type}</option>
                ))}
              </select>
            </Field>
            <Field label="保養類型">
              <select name="type" defaultValue="定期保養">
                <option value="定期保養">定期保養</option>
                <option value="校正">校正</option>
                <option value="維修">維修</option>
                <option value="檢查">檢查</option>
              </select>
            </Field>
            <Field label="執行日"><input name="performedOn" type="date" required /></Field>
            <Field label="費用 (TWD)"><input name="cost" type="number" min="0" defaultValue={0} /></Field>
          </div>
          <Field label="備註"><input name="notes" /></Field>
          <button type="submit" className="btn btn-primary">登錄保養</button>
        </form>
      </Card>
    </>
  );
}
