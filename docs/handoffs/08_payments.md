# 08_payments 交接

完成綠界金流與發票 adapter、付款通知驗證與退款介面；修正 SHA-256 填充錯誤，未取得憑證前保持 integration_pending。

```json
{
  "task_id": "08_payments",
  "task_key": "08_payments",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/domain/src/payment.ts",
    "packages/domain/test/payment.test.ts",
    "packages/integrations/src/payment/index.ts",
    "packages/integrations/src/invoice/index.ts",
    "packages/integrations/test/payment.test.ts",
    "apps/web/src/app/api/webhooks/ecpay/route.ts",
    "apps/worker/src/handlers/index.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/domain packages/integrations apps/web",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "ECPay CheckMacValue 依官方規則實作：排序、前後綴、URL encode、小寫、SHA256、大寫。",
    "純 JS SHA-256 的填充長度計算有誤（message.length ≡ 55 mod 64 時出錯），已修正並與 node:crypto 逐長度比對。",
    "verifyEcpayNotification 需比對 merchantTradeNo、金額與是否允許模擬，避免金額被改。",
    "付款成功頁不得改訂單；狀態由 jp_apply_payment_event 在同一交易套用。",
    "assertNotSimulatedInProduction 防止正式環境接受模擬通知。"
  ],
  "migrations": [],
  "new_env_names": [
    "ECPAY_MERCHANT_ID",
    "ECPAY_HASH_KEY",
    "ECPAY_HASH_IV",
    "ECPAY_ENV"
  ],
  "integration_status": {
    "ecpay": "integration_pending",
    "invoice": "integration_pending"
  },
  "unresolved_items": [
    "缺綠界商店憑證，未對測試環境送出真實交易。",
    "電子發票 adapter 介面完成，缺加值中心憑證。",
    "退款與對帳需人工核對，尚未接上銀行匯入檔。"
  ],
  "next_task": "09_procurement"
}
```
