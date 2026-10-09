# 05_catalog_pricing 交接

完成定價公式、商品模型與後臺商品工作臺；成本不對外輸出，已核准售價不再加價。

```json
{
  "task_id": "05_catalog_pricing",
  "task_key": "05_catalog_pricing",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/pricing.ts",
    "packages/domain/src/catalog.ts",
    "packages/domain/test/pricing.test.ts",
    "packages/domain/test/catalog.test.ts",
    "apps/web/src/lib/catalog.ts",
    "apps/web/src/app/admin/catalog/page.tsx"
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
    "最低售價公式：fixedVariableCost ÷ (1 − proportionalRate − targetContributionRate) 向上取整。",
    "已核准臺幣售價不再加價；來源表已含加成。",
    "toPublicJson 不輸出成本欄位。",
    "現貨、預購配額、詢價分開計算；預購不扣現貨庫存。",
    "定價與商品測試全部通過。"
  ],
  "migrations": [],
  "new_env_names": [],
  "integration_status": {
    "google": "integration_pending"
  },
  "unresolved_items": [
    "商品審核（合法銷售條件）需人工確認後才發布，尚未接上正式審核流程。"
  ],
  "next_task": "06_storefront"
}
```
