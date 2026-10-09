# 04_google_sync 交接

完成 Google 商品來源 adapter、表頭對映、整批阻擋規則與同步預覽 CLI；未取得憑證前保持 integration_pending。

```json
{
  "task_id": "04_google_sync",
  "task_key": "04_google_sync",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/integrations/src/google/index.ts",
    "packages/integrations/test/google.test.ts",
    "packages/domain/src/catalog.ts",
    "apps/worker/src/handlers/index.ts",
    "apps/worker/src/cli/sync-preview.ts",
    "apps/web/src/app/admin/catalog/page.tsx"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/integrations apps/worker",
      "exit_code": 0
    },
    {
      "command": "npm run sync:preview",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "Google Sheets / Drive adapter 完成：中文表頭對映、sheetValuesToSourceRows、driveAssetProxyPath。",
    "normalizeSourceRows 對空表、截斷、錯列整批阻擋，保留上一次發布版本。",
    "diffCatalog 產生新增／變更／未變／缺少／要求下架差異，缺少不等於下架。",
    "sync:preview 只讀來源並輸出差異，不寫入資料庫、不發布商品。",
    "未設定憑證時明確回報 integration_pending。"
  ],
  "migrations": [],
  "new_env_names": [
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "GOOGLE_APPROVED_CATALOG_SHEET_ID",
    "GOOGLE_DRIVE_SOURCE_FOLDER_ID"
  ],
  "integration_status": {
    "google": "integration_pending"
  },
  "unresolved_items": [
    "缺 Google 服務帳號憑證，未對真實 ApprovedCatalog 執行同步。",
    "每日台北 06:00 排程已定義，尚未在正式環境啟用。"
  ],
  "next_task": "05_catalog_pricing"
}
```
