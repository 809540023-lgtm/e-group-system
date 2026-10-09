# 02_database 交接

建立完整核心 schema 與交易函式，訂單、明細、庫存保留、付款與 outbox 在同一交易完成；migration 具版本與 checksum 驗證。

```json
{
  "task_id": "02_database",
  "task_key": "02_database",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/db/migrations/001_core.sql",
    "packages/db/migrations/002_jobs.sql",
    "packages/db/migrations/003_roles.sql",
    "packages/db/src/migrate.ts",
    "packages/db/src/smoke.ts",
    "packages/db/src/index.ts",
    "packages/db/src/cli/migrate.ts",
    "packages/db/src/cli/smoke.ts",
    "packages/db/test/db.test.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/db",
      "exit_code": 0
    },
    {
      "command": "npm run db:migrate -- --dry-run",
      "exit_code": 0
    },
    {
      "command": "npm run db:smoke",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "001_core.sql 建立商品、庫存、訂單、明細、付款、退款、採購、出貨、客服、outbox 等核心表。",
    "002_jobs.sql 提供 jp_create_order、jp_apply_payment_event、jp_claim_outbox_jobs、jp_finish_outbox_job 等交易函式。",
    "003_roles.sql 建立最小權限角色（web / worker / reporter），公開 API 不得使用管理帳號。",
    "packages/db 測試 16 個全部通過。",
    "db:smoke 在無 PostgreSQL 16 時回報 ran=false 與明確原因，不以假成功掩蓋。"
  ],
  "migrations": [
    "001_core.sql",
    "002_jobs.sql",
    "003_roles.sql"
  ],
  "new_env_names": [
    "DATABASE_URL",
    "DATABASE_URL_WORKER",
    "DATABASE_URL_REPORTER"
  ],
  "integration_status": {
    "postgres": "integration_pending"
  },
  "unresolved_items": [
    "本機只有 PostgreSQL 14.18，且無 Docker；原生 PostgreSQL 16 多連線併發驗收尚未實際執行。",
    "brew install postgresql@16 因 cmake 建置鎖失敗，需在可用環境重跑 npm run db:smoke。"
  ],
  "next_task": "03_auth"
}
```
