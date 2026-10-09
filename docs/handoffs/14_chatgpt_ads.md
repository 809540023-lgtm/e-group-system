# 14_chatgpt_ads 交接

完成 OpenAI Ads adapter、地區可用性判斷與預算換算；未取得資格前保持 integration_pending。

```json
{
  "task_id": "14_chatgpt_ads",
  "task_key": "14_chatgpt_ads",
  "status": "integration_pending",
  "commit_sha": null,
  "changed_files": [
    "packages/integrations/src/openai-ads/index.ts",
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
    "OpenAI Ads adapter 完成：getAdAccount、geoLookup、createPausedDraft、fetchInsights。",
    "evaluateRegionAvailability 判斷地區可用性，不可用時明確回報 region_unavailable。",
    "budgetToMicros / microsToBudget 以整數微單位換算，避免浮點誤差。",
    "OPENAI_ADS_DISCLAIMER 標示資格與地區限制。"
  ],
  "migrations": [],
  "new_env_names": [
    "OPENAI_ADS_API_KEY",
    "OPENAI_ADS_AD_ACCOUNT_ID"
  ],
  "integration_status": {
    "openai_ads": "integration_pending"
  },
  "unresolved_items": [
    "缺 OpenAI Ads 資格與憑證，未建立真實草稿或取得成效。"
  ],
  "next_task": "15_analytics"
}
```
