# 18_release_uat 官方協作部署與全面驗收

任務目標：官方協作部署與全面驗收

依賴：15_analytics, 16_ai_orchestration

閱讀規劃書章節：18, 19, 20, 22, 24

可改檔案範圍：infra/, .github/, apps/, packages/, test/, docs/, README.md

將已完成 web 和 worker 建為非 root、固定 digest 容器；完成受控正式設定、DB 最小權限、圖片及私密檔案儲存、TLS、migration、健康與 readiness。GitHub CI 實際執行型別、lint、domain、API、原生 PostgreSQL 多連線、adapter sandbox、UI及 build；PR 執行不能取得正式秘密。

staging 與 production 各自資料和金鑰，先遷移與驗收測試環境。發布從指定已測 commit 產映像，備份、遷移、部署、readiness、小額真實交易核對和觀察有記錄。程式回覆與資料回復分開，不自動逆轉金融紀錄。不要直接啟用 compose.production.template.yml 或把 demo 當商城。

完成規劃書驗收矩陣、長者測試、支付/退款/對帳、採購物流、各可用廣告草稿、source 同步、員工停用、告警、備份與實際還原。RPO/RTO 以真實結果核對，無法達標列出限制。交付 deploy/rollback/restore/runbook 的實際命令、環境清單、驗收證據及未完成介面；只對已透過專案宣稱可營運。


# 任務交接格式

task_id 與 task_key 必須與派工相同。completed 必須有實際程式、測試與必要的介面驗收。

```json
{
  "task_id": "實際任務 ID",
  "task_key": "01_foundation",
  "status": "integration_pending",
  "commit_sha": "實際 commit，尚未提交用 null",
  "changed_files": ["實際相對路徑"],
  "commands_run": [{"command": "實際指令", "exit_code": 0}],
  "actual_results": ["實際測試證據"],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {"google": "not_in_scope"},
  "unresolved_items": ["缺少的實際資格或介面驗收"],
  "next_task": "依 task_registry 決定"
}
```

交接摘要以已核實事實、檔案和未完成事項為主，不包含憑證、真實顧客資料或完整聊天歷史。
