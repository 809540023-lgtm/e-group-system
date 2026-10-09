# 16_ai_orchestration 交接

完成 AI 任務編排與提示注入防禦；預設桌面交接，不呼叫付費 API。

```json
{
  "task_id": "16_ai_orchestration",
  "task_key": "16_ai_orchestration",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/ai.ts",
    "packages/domain/test/ai.test.ts",
    "packages/integrations/src/ai/index.ts",
    "packages/integrations/test/shipping-ai.test.ts",
    "apps/worker/src/handlers/index.ts",
    "apps/worker/src/outbox.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/domain packages/integrations apps/worker",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "預設 AI_MODE=desktop_manual：只產生桌面任務包，不呼叫付費 API。",
    "renderTaskPacketForDesktop 產生含任務鍵、指令、輸入、輸出契約與驗收案例的任務包。",
    "scanForInjection 將外部 DM 與網站內容視為資料，偵測提示注入。",
    "assertAllowed 檢查每日預算、單次預算與模型允許清單。",
    "AI 任務在 desktop_manual 模式下測試確認未呼叫外部 API。"
  ],
  "migrations": [],
  "new_env_names": [
    "AI_MODE",
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_BASE_URL",
    "AI_DAILY_BUDGET_TWD"
  ],
  "integration_status": {
    "ai": "completed"
  },
  "unresolved_items": [
    "需要自動 API 時須先讀取設定與使用預算，並取得憑證。"
  ],
  "next_task": "17_staff_support"
}
```
