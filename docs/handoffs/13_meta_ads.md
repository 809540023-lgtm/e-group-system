# 13_meta_ads 交接

完成 Meta 廣告 adapter、暫停草稿、同意過濾與歸因分離；未取得資格前保持 integration_pending。

```json
{
  "task_id": "13_meta_ads",
  "task_key": "13_meta_ads",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/integrations/src/meta/index.ts",
    "packages/integrations/test/ads.test.ts",
    "apps/worker/src/handlers/index.ts"
  ],
  "commands_run": [
    {
      "command": "npm run typecheck",
      "exit_code": 0
    },
    {
      "command": "npm test -- packages/integrations apps/worker",
      "exit_code": 0
    }
  ],
  "actual_results": [
    "Meta adapter 完成：fetchInsights、sendConversions、createPausedDraft。",
    "廣告草稿一律建立為 PAUSED，需人工核准才啟用。",
    "filterConsentedEvents 只送出取得同意的轉換事件。",
    "separateAttributionFromActual 將平臺歸因與實際營收分開，不混用。",
    "assertCurrencyMatches 防止幣別不一致。"
  ],
  "migrations": [],
  "new_env_names": [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_ACCESS_TOKEN",
    "META_AD_ACCOUNT_ID"
  ],
  "integration_status": {
    "meta": "integration_pending"
  },
  "unresolved_items": [
    "缺 Meta 廣告帳號資格與憑證，未建立真實草稿或取得成效。"
  ],
  "next_task": "14_chatgpt_ads"
}
```
