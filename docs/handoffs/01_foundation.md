# 01_foundation 交接

把起始規則整理為 npm workspace，建立 Next.js App Router 前臺與受保護後臺骨架、Node worker 啟動與關閉、共用 domain 規則。web 與 worker 共用 packages/domain，未複製規則。

```json
{
  "task_id": "01_foundation",
  "task_key": "01_foundation",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "package.json",
    "package-lock.json",
    "tsconfig.base.json",
    "eslint.config.js",
    "vitest.config.ts",
    ".gitignore",
    ".env.example",
    "packages/domain/src/*.ts",
    "packages/integrations/src/**",
    "packages/db/**",
    "packages/ui/**",
    "apps/web/**",
    "apps/worker/**"
  ],
  "commands_run": [
    {
      "command": "npm install",
      "exit_code": 0
    },
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm run lint",
      "exit_code": 0
    },
    {
      "command": "npm test",
      "exit_code": 0
    },
    {
      "command": "npm run build",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "npm workspace 建立完成：apps/web、apps/worker、packages/domain、integrations、db、ui。",
    "npm test：26 個測試檔、490 個測試全部通過。",
    "npm run typecheck：全部 workspace 通過。",
    "npm run lint：ESLint 無錯誤。",
    "npm run build：Next.js 建置成功，25 條路由。"
  ],
  "migrations": [],
  "new_env_names": [
    "NODE_ENV",
    "APP_ENV",
    "DATABASE_URL",
    "PUBLIC_BASE_URL",
    "SESSION_SECRET",
    "QUOTE_SIGNING_SECRET"
  ],
  "integration_status": {
    "google": "not_in_scope",
    "ecpay": "not_in_scope",
    "line": "not_in_scope",
    "meta": "not_in_scope",
    "openai_ads": "not_in_scope",
    "shipping": "not_in_scope",
    "ai": "not_in_scope"
  },
  "unresolved_items": [
    "Node 24 LTS 尚未安裝於本機（目前 v22.22.3）；engines 已宣告 >=24.0.0，需在 24 LTS 下重跑 build 驗收。"
  ],
  "next_task": "02_database"
}
```
