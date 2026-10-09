# 07_checkout 交接

完成購物車、伺服器端報價與訂單查詢；金額一律整數最小單位，前端輸入不被信任。

```json
{
  "task_id": "07_checkout",
  "task_key": "07_checkout",
  "status": "completed",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/checkout.ts",
    "packages/domain/src/money.ts",
    "packages/domain/test/checkout.test.ts",
    "apps/web/src/lib/cart.ts",
    "apps/web/src/lib/quote.ts",
    "apps/web/src/app/cart/**",
    "apps/web/src/app/checkout/page.tsx",
    "apps/web/src/app/api/quote/route.ts",
    "apps/web/src/app/api/orders/route.ts",
    "apps/web/test/cart.test.ts",
    "apps/web/test/quote.test.ts"
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
    "報價 15 分鐘有效，逾期需重新計算。",
    "組合商品依固定 SKU 鎖定順序，避免死鎖。",
    "購物車上限 30 行，超過即擋下（測試發現原本未強制，已修正）。",
    "前端送來的價格與運費不被信任，伺服器以 buildServerQuote 重算。",
    "訂單查詢需訂單碼加手機末三碼。"
  ],
  "migrations": [],
  "new_env_names": [
    "QUOTE_SIGNING_SECRET"
  ],
  "integration_status": {
    "checkout": "completed"
  },
  "unresolved_items": [
    "正式下單需接上 jp_create_order 交易函式與真實資料庫連線。"
  ],
  "next_task": "08_payments"
}
```
