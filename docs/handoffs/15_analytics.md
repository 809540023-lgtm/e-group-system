# 15_analytics 交接

完成追蹤事件與經營分析；成交以後端為準，歸因與實際營收分開。

```json
{
  "task_id": "15_analytics",
  "task_key": "15_analytics",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/analytics.ts",
    "packages/domain/test/analytics.test.ts",
    "apps/web/src/app/admin/reports/page.tsx"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/domain apps/web",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "成交事件以後端為準，前端事件不作為營收依據。",
    "成效口徑分開：平臺歸因收入不得加總為實際營收。",
    "computeRoasAndCac 在 spendTwd 為 0 時回傳 cac 0，不產生除以零。",
    "toPlatformPurchaseEvent 對空平臺字串明確拒絕。",
    "分析測試全部通過。"
  ],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {
    "analytics": "completed"
  },
  "unresolved_items": [
    "正式事件送出需接上 Meta 與 OpenAI Ads 憑證。"
  ],
  "next_task": "16_ai_orchestration"
}
```
