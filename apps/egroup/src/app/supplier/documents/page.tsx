import { redirect } from 'next/navigation';
import { Card, Field, Notice, PageHeader, Table } from '../../../components/ui.tsx';
import { uploadDocumentAction } from '../../../lib/actions.ts';
import { requireRole } from '../../../lib/auth.ts';
import { formatDate } from '../../../lib/format.ts';
import { listSupplierBatches, listSupplierDocuments } from '../../../lib/ops.ts';

export default async function SupplierDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(['supplier', 'admin']);
  if (session.supplierId === null) redirect('/admin');
  const params = await searchParams;

  const [documents, batches] = await Promise.all([
    listSupplierDocuments(session.supplierId),
    listSupplierBatches(session.supplierId),
  ]);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <>
      <PageHeader
        title="檢驗文件"
        subtitle="逐批登錄檢驗報告、產地證明與屠宰證明；文件雜湊值會保存以供追溯。"
      />

      {error !== undefined ? <Notice tone="danger">{error}</Notice> : null}
      {ok !== undefined ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="已登錄文件">
        {documents.length === 0 ? <p className="muted small">尚未登錄文件。</p> : (
          <Table head={['類型', '檔名', '批號', 'SKU', '發行日', '有效至', '範圍', '登錄人']}>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.doc_type}</td>
                <td className="mono tiny">{doc.file_name}</td>
                <td className="mono">{doc.lot_no}</td>
                <td className="mono tiny">{doc.sku}</td>
                <td>{formatDate(doc.issued_on)}</td>
                <td>{formatDate(doc.valid_until)}</td>
                <td className="muted small">{doc.scope}</td>
                <td className="muted tiny">{doc.uploaded_by}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="登錄新文件">
        <form action={uploadDocumentAction} className="form">
          <input type="hidden" name="redirectTo" value="/supplier/documents" />
          <div className="grid grid-2">
            <Field label="批次">
              <select name="batchId" required>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.lot_no} · {batch.product_name}</option>
                ))}
              </select>
            </Field>
            <Field label="文件類型">
              <select name="docType" defaultValue="檢驗報告">
                <option value="檢驗報告">檢驗報告</option>
                <option value="產地證明">產地證明</option>
                <option value="屠宰證明">屠宰證明</option>
                <option value="HACCP 證明">HACCP 證明</option>
                <option value="產品責任險">產品責任險</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-3">
            <Field label="發行日"><input name="issuedOn" type="date" required /></Field>
            <Field label="有效至"><input name="validUntil" type="date" /></Field>
            <Field label="適用範圍"><input name="scope" placeholder="本批次 / 全品項" /></Field>
          </div>
          <Field label="檔案" hint="選填；未上傳時以類型與日期建立紀錄">
            <input name="file" type="file" accept="application/pdf,image/*" />
          </Field>
          <button type="submit" className="btn btn-primary">登錄文件</button>
        </form>
      </Card>
    </>
  );
}
