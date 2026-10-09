# 06_storefront 交接

完成長者操作設計 token、共用元件與前臺選單；對比與 200% 字級檢查以程式驗證。

```json
{
  "task_id": "06_storefront",
  "task_key": "06_storefront",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/ui/src/tokens.ts",
    "packages/ui/src/a11y.ts",
    "packages/ui/src/components.ts",
    "packages/ui/test/ui.test.ts",
    "apps/web/src/app/page.tsx",
    "apps/web/src/app/categories/**",
    "apps/web/src/app/zones/**",
    "apps/web/src/app/products/**",
    "apps/web/src/app/site-nav.tsx"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/ui apps/web",
      "exit_code": 0
    },
    {
      "command": "npm run build",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "設計 token：正文 20px、商品名 24px、價格 30px、按鈕最小 48px。",
    "contrastRatio 與 auditContrast 檢查 WCAG 2.2 AA 對比。",
    "auditZoom200 檢查 200% 字級不得橫向捲動。",
    "ELDER_TASKS 定義 5 項長者任務：找商品、選規格、加入購物車、確認總額、查訂單。",
    "UI 測試 36 個全部通過；Next.js 建置成功。"
  ],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {
    "ui": "completed"
  },
  "unresolved_items": [
    "尚未由 3 位真實長者實際測試 5 項任務，長者驗收維持 integration_pending。"
  ],
  "next_task": "07_checkout"
}
```
