import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, KeyValue, PageHeader, Table } from '../../../components/ui.tsx';
import { formatDate, formatDateTime, TEMPERATURE_STATUS_LABELS } from '../../../lib/format.ts';
import { getTrace } from '../../../lib/queries.ts';

export default async function TracePage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const trace = await getTrace(batchId);
  if (trace.batch === null) notFound();

  const batch = trace.batch;

  return (
    <>
      <PageHeader
        title={`批次追溯 ${batch.lot_no}`}
        subtitle={`${batch.product_name}（${batch.sku}）· ${batch.supplier_name}`}
        actions={<Link href={`/products/${batch.sku}`} className="btn">回商品</Link>}
      />

      <div className="grid grid-2">
        <Card title="批次資訊">
          <KeyValue items={[
            { label: '批號', value: <span className="mono">{batch.lot_no}</span> },
            { label: '商品', value: batch.product_name },
            { label: '供應商', value: batch.supplier_name },
            { label: '生產日', value: formatDate(batch.produced_on) },
            { label: '到期日', value: formatDate(batch.expires_on) },
            { label: '收貨溫度', value: batch.received_temp_c === null ? '—' : `${batch.received_temp_c} °C` },
            { label: '所在站點', value: batch.station_name ?? '—' },
            { label: '狀態', value: <Badge tone={batch.status === 'available' ? 'ok' : batch.status === 'recalled' ? 'danger' : 'warn'}>{batch.status}</Badge> },
          ]} />
        </Card>

        <Card title="檢驗文件">
          {trace.documents.length === 0 ? <p className="muted small">尚無檢驗文件。</p> : (
            <Table head={['類型', '檔名', '發行日', '有效至', '範圍']}>
              {trace.documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.doc_type}</td>
                  <td className="mono tiny">{doc.file_name}</td>
                  <td>{formatDate(doc.issued_on)}</td>
                  <td>{formatDate(doc.valid_until)}</td>
                  <td className="muted small">{doc.scope}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="庫存異動">
          {trace.movements.length === 0 ? <p className="muted small">尚無異動。</p> : (
            <Table head={['類型', '數量', '人員', '備註', '時間']}>
              {trace.movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.type}</td>
                  <td className="num">{movement.quantity}</td>
                  <td className="muted small">{movement.actor}</td>
                  <td className="muted small">{movement.note ?? '—'}</td>
                  <td className="muted small">{formatDateTime(movement.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="冷鏈溫度">
          {trace.temperatures.length === 0 ? <p className="muted small">尚無溫度紀錄。</p> : (
            <Table head={['溫度', '狀態', '處理', '時間']}>
              {trace.temperatures.map((event) => (
                <tr key={event.id}>
                  <td className="num">{event.temp_c} °C</td>
                  <td><Badge tone={event.status === 'ok' ? 'ok' : event.status === 'warning' ? 'warn' : 'danger'}>{TEMPERATURE_STATUS_LABELS[event.status] ?? event.status}</Badge></td>
                  <td className="muted small">{event.action}</td>
                  <td className="muted small">{formatDateTime(event.recorded_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
