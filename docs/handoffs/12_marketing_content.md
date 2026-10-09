# 12_marketing_content 交接

完成行銷內容中心與預算政策；素材與活動共用商品紀錄。

```json
{
  "task_id": "12_marketing_content",
  "task_key": "12_marketing_content",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/marketing.ts",
    "packages/domain/test/marketing.test.ts",
    "apps/web/src/app/admin/reports/page.tsx"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/domain",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "共用內容中心：素材、文案與活動共用同一組商品與訂單紀錄。",
    "預算政策以整數最小單位計算，超過上限即擋下。",
    "行銷測試全部通過。"
  ],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {
    "marketing": "completed"
  },
  "unresolved_items": [
    "素材實際產出仍需人工或 AI 任務包執行。"
  ],
  "next_task": "13_meta_ads"
}
```
