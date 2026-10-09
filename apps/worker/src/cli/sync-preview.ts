/**
 * 商品同步預覽 CLI（規劃書 04 章；模組 04）。
 *
 * 只讀取來源並輸出差異，不寫入資料庫、不發布商品。
 * 未設定 Google 憑證時明確回報 integration_pending。
 */

import { createGoogleSourceAdapter, sheetValuesToSourceRows } from '@jp/integrations/google';
import { diffCatalog, normalizeSourceRows } from '@jp/domain';

const spreadsheetId = process.env.APPROVED_CATALOG_SPREADSHEET_ID ?? '';
const range = process.env.APPROVED_CATALOG_RANGE ?? 'ApprovedCatalog!A1:Z1000';

if (spreadsheetId === '') {
  process.stdout.write('integration_pending：未設定 APPROVED_CATALOG_SPREADSHEET_ID，無法預覽同步。\n');
  process.exitCode = 0;
} else {
  const adapter = createGoogleSourceAdapter();
  const capability = adapter.capability();
  if (capability.status !== 'ready') {
    process.stdout.write(`integration_pending：缺少 ${capability.missingEnv.join('、')}，無法預覽同步。\n`);
    process.exitCode = 0;
  } else {
    const values = await adapter.readApprovedCatalog({ spreadsheetId, range });
    if (!values.ok) {
      process.stderr.write(`讀取來源失敗：${values.message}\n`);
      process.exitCode = 1;
    } else {
      const mapped = sheetValuesToSourceRows(values.value);
      if (mapped.missingRequired.length > 0) {
        process.stderr.write(`來源缺少必要欄位：${mapped.missingRequired.join('、')}\n`);
        process.exitCode = 1;
      } else {
        const normalized = normalizeSourceRows(mapped.rows);
        if (normalized.blocked) {
          process.stderr.write(`來源整批阻擋：${normalized.blockReason ?? '未知原因'}\n`);
          process.exitCode = 1;
        } else {
          const diff = diffCatalog(new Map(), normalized.products);
          process.stdout.write(`來源列數：${mapped.rows.length}\n`);
          process.stdout.write(`可發布商品：${normalized.products.length}\n`);
          process.stdout.write(`新增：${diff.added.length}，變更：${diff.changed.length}，未變：${diff.unchanged.length}\n`);
          if (normalized.issues.length > 0) {
            process.stdout.write(`需人工檢視的列：${normalized.issues.length}\n`);
          }
          process.stdout.write('此為預覽，未寫入資料庫、未發布商品。\n');
        }
      }
    }
  }
}
