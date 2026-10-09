# 11_line 交接

完成 LINE 簽章驗證、事件去重、員工與顧客通知，以及個資防護；未取得憑證前保持 integration_pending。

```json
{
  "task_id": "11_line",
  "task_key": "11_line",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/integrations/src/line/index.ts",
    "packages/integrations/test/line.test.ts",
    "apps/web/src/app/api/webhooks/line/route.ts",
    "apps/worker/src/handlers/index.ts",
    "apps/web/src/app/support/page.tsx",
    "apps/web/src/app/api/support/tickets/route.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/integrations apps/web",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "LINE webhook 以原始 body 做 HMAC-SHA256 簽章驗證，未通過即拒絕。",
    "dedupeEvents 以事件 ID 去重，重送不重複處理。",
    "assertNoPiiInStaffMessage 擋下含個資的員工訊息；員工通知只含訂單碼、待辦種類、角色與後臺連結。",
    "顧客通知只含訂單碼與狀態。",
    "reply token 有有效期限制，逾期改用 push。"
  ],
  "migrations": [],
  "new_env_names": [
    "LINE_CHANNEL_ID",
    "LINE_CHANNEL_SECRET",
    "LINE_CHANNEL_ACCESS_TOKEN",
    "LINE_STAFF_GROUP_ID"
  ],
  "integration_status": {
    "line": "integration_pending"
  },
  "unresolved_items": [
    "缺 LINE 官方帳號憑證，未對真實帳號送出通知。",
    "客服時限（首次回覆）規則已定義，尚未接上正式告警。"
  ],
  "next_task": "12_marketing_content"
}
```
