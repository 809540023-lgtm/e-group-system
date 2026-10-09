# 03_auth 交接

建立角色與權限模型、簽章工作階段與後臺權限閘門；所有權限判斷在伺服器端完成。

```json
{
  "task_id": "03_auth",
  "task_key": "03_auth",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/auth.ts",
    "packages/domain/test/auth.test.ts",
    "apps/web/src/lib/auth.ts",
    "apps/web/src/lib/admin.ts",
    "apps/web/src/app/admin/admin-guard.tsx",
    "apps/web/src/app/admin/**",
    "apps/web/test/auth.test.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- apps/web packages/domain",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "StaffRole 與 Permission 定義完成；ROLE_PERMISSIONS 依最小權限配置。",
    "工作階段 cookie 使用 HMAC 簽章，有效期 480 分鐘，由伺服器建立 payload 控制到期。",
    "requireStaff / requirePermission 於伺服器端檢查，前端角色不被信任。",
    "後臺各頁面經 admin-guard 伺服器端權限閘門。",
    "auth 相關測試全部通過。"
  ],
  "migrations": [],
  "new_env_names": [
    "SESSION_SECRET"
  ],
  "integration_status": {
    "auth": "completed"
  },
  "unresolved_items": [
    "正式環境需更換 SESSION_SECRET 為隨機長字串，並確認 cookie Secure 屬性。"
  ],
  "next_task": "04_google_sync"
}
```
