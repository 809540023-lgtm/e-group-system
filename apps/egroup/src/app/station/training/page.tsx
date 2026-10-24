import { redirect } from 'next/navigation';
import { Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { addTrainingAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDateTime } from '../../../lib/format.ts';
import { listStationTraining } from '../../../lib/ops.ts';

const MODULES = ['食品安全與 HACCP', '冷鏈管理', '取貨核銷作業', '過敏原與標示', '客訴處理', '緊急應變與召回'];

export default async function StationTrainingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['station', 'admin']);
  if (session.stationId === null) redirect('/admin');
  const params = await searchParams;

  const records = await listStationTraining(session.stationId);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  const staff = new Set(records.map((record) => record.staff_name));

  return (
    <>
      <PageHeader
        title="人員訓練"
        subtitle="站點人員每年至少完成食品安全與冷鏈訓練；紀錄供總部稽核。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="新增訓練紀錄">
        <form action={addTrainingAction} className="form">
          <input type="hidden" name="redirectTo" value="/station/training" />
          <div className="grid grid-3">
            <Field label="人員姓名"><input name="staffName" required /></Field>
            <Field label="訓練模組">
              <select name="module" defaultValue={MODULES[0]}>
                {MODULES.map((module) => (
                  <option key={module} value={module}>{module}</option>
                ))}
              </select>
            </Field>
            <Field label="測驗分數"><input name="score" type="number" min="0" max="100" defaultValue={100} /></Field>
          </div>
          <button type="submit" className="btn btn-primary">建立紀錄</button>
        </form>
      </Card>

      <Card title={`訓練紀錄（${staff.size} 位人員）`}>
        {records.length === 0 ? <p className="muted small">尚無訓練紀錄。</p> : (
          <Table head={['人員', '模組', '分數', '完成時間']}>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.staff_name}</td>
                <td>{record.module}</td>
                <td className="num">{record.score ?? '—'}</td>
                <td className="muted small">{formatDateTime(record.completed_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
