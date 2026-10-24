import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, KeyValue, PageHeader, Table } from '../../../components/ui.tsx';
import { requireRole } from '../../../lib/auth.ts';
import { formatDate, formatTwd } from '../../../lib/format.ts';
import { getEquipment } from '../../../lib/ops.ts';

export default async function AssetDetailPage({ params }: { params: Promise<{ assetNo: string }> }) {
  await requireRole(['admin']);
  const { assetNo } = await params;
  const { equipment, leases, maintenance } = await getEquipment(assetNo);
  if (equipment === null) notFound();

  const maintenanceCost = maintenance.reduce((sum, record) => sum + record.cost_twd, 0);
  const monthlyRent = leases.filter((lease) => lease.status === 'active').reduce((sum, lease) => sum + lease.monthly_rent_twd, 0);

  return (
    <>
      <PageHeader
        title={`資產 ${equipment.asset_no}`}
        subtitle={`${equipment.type} · ${equipment.serial_no}`}
        actions={<Link href="/assets" className="btn">回資產列表</Link>}
      />

      <div className="grid grid-2">
        <Card title="設備資訊">
          <KeyValue items={[
            { label: '資產編號', value: <span className="mono">{equipment.asset_no}</span> },
            { label: '類型', value: equipment.type },
            { label: '序號', value: <span className="mono">{equipment.serial_no}</span> },
            { label: '站點', value: equipment.station_name ?? '—' },
            { label: '所有權', value: equipment.owner },
            { label: '購入日', value: formatDate(equipment.purchase_date) },
            { label: '購入價', value: formatTwd(equipment.purchase_price_twd) },
            { label: '保險', value: `${equipment.insurance_policy ?? '—'}（至 ${formatDate(equipment.insurance_expires_on)}）` },
            { label: '上次校正', value: formatDate(equipment.last_calibrated_at) },
            { label: '下次保養', value: formatDate(equipment.next_maintenance_on) },
            { label: '狀態', value: <Badge tone={equipment.status === 'active' ? 'ok' : equipment.status === 'maintenance' ? 'warn' : 'danger'}>{equipment.status}</Badge> },
          ]} />
        </Card>

        <Card title="成本摘要">
          <KeyValue items={[
            { label: '累計保養費用', value: formatTwd(maintenanceCost) },
            { label: '保養次數', value: maintenance.length },
            { label: '月租金', value: formatTwd(monthlyRent) },
            { label: '租約數', value: leases.length },
          ]} />
          <p className="muted tiny" style={{ marginTop: 10 }}>
            租賃設備須確認使用權與保險；遺失或報廢須走資產處分流程並留存稽核。
          </p>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="租約">
          {leases.length === 0 ? <p className="muted small">尚無租約。</p> : (
            <Table head={['出租人', '承租人', '月租', '起日', '迄日', '狀態']}>
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td>{lease.lessor}</td>
                  <td>{lease.lessee}</td>
                  <td className="num">{formatTwd(lease.monthly_rent_twd)}</td>
                  <td>{formatDate(lease.start_date)}</td>
                  <td>{formatDate(lease.end_date)}</td>
                  <td><Badge tone={lease.status === 'active' ? 'ok' : 'muted'}>{lease.status}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="保養紀錄">
          {maintenance.length === 0 ? <p className="muted small">尚無保養紀錄。</p> : (
            <Table head={['類型', '執行日', '費用', '備註']}>
              {maintenance.map((record) => (
                <tr key={record.id}>
                  <td>{record.type}</td>
                  <td>{formatDate(record.performed_on)}</td>
                  <td className="num">{formatTwd(record.cost_twd)}</td>
                  <td className="muted small">{record.notes ?? '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
