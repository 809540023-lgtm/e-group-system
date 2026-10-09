# 17_staff_support 交接

完成員工管理與客服分派、時限與停用流程；員工通知不含個資。

```json
{
  "task_id": "17_staff_support",
  "task_key": "17_staff_support",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/staff.ts",
    "packages/domain/test/staff.test.ts",
    "apps/web/src/app/admin/staff/page.tsx",
    "apps/web/src/app/admin/refunds/page.tsx",
    "apps/web/src/app/admin/shipments/page.tsx",
    "apps/worker/src/handlers/index.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/domain apps/web apps/worker",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "TicketCategory 與 FIRST_RESPONSE_HOURS 定義客服時限。",
    "routeTicket 依類別分派給對應角色，避免重複分派。",
    "員工每日摘要只含待辦數量與角色，不含客戶個資。",
    "員工停用流程保留紀錄，不刪除歷史。",
    "員工與客服測試全部通過。"
  ],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {
    "staff_support": "completed"
  },
  "unresolved_items": [
    "正式告警管道需接上 LINE 憑證。"
  ],
  "next_task": "18_release_uat"
}
```
