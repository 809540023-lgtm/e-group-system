# 18_release_uat 交接

完成容器、CI、部署與備份設定；正式部署與驗收因缺環境與憑證維持 integration_pending。

```json
{
  "task_id": "18_release_uat",
  "task_key": "18_release_uat",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "infra/**",
    ".github/workflows/**",
    "README.md",
    "docs/系統規劃書.md",
    "docs/task_registry.json",
    "docs/handoffs/**",
    "prompts/**"
  ],
  "commands_run": [
    {
      "command": "npm run check",
      "exit_code": 0
    },
    {
      "command": "npm run build",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "CI 執行 typecheck、lint、test 與 build；PR 不取得正式秘密。",
    "容器以非 root 執行，映像固定 digest。",
    "staging 與 production 各自資料與金鑰。",
    "發布從指定已測 commit 產映像，備份、遷移、部署、readiness 依序執行。",
    "程式回復與資料回復分開，不自動逆轉金融紀錄。"
  ],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {
    "deploy": "integration_pending"
  },
  "unresolved_items": [
    "缺正式環境、網域、TLS 憑證與 secret store，未實際部署。",
    "RPO/RTO 需以真實還原結果核對，尚未執行還原演練。",
    "3 位長者實測 5 項任務尚未執行。",
    "原生 PostgreSQL 16 併發驗收尚未執行。"
  ],
  "next_task": null
}
```
