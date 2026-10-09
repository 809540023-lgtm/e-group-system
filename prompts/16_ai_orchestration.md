# 16_ai_orchestration Grok DeepSeek 省 Token 工作流程

任務目標：Grok DeepSeek 省 Token 工作流程

依賴：04_google_sync, 12_marketing_content, 17_staff_support

閱讀規劃書章節：11, 16, 17

可改檔案範圍：apps/web/src/app/admin/, apps/worker/, packages/domain/ai/, packages/integrations/ai/, packages/db/, prompts/, test/ai/, docs/handoffs/

建 ai_tasks、ai_runs、ai_usage、review_decisions、輸入/結果 schema 及桌面交接工作臺。預設 desktop_manual：產生最小 task packet，提供複製或檔案給 DeepSeek，結果回貼後驗證；不假定桌面無限量可被伺服器合法無限呼叫。

Grok Bot 負責任務分派、驗收與回寫，依官方 connector 和 Team Bot 實際功能配置；共享任務不能只存在個人聊天。API 模式另設模型清單、base URL、input/output cap、budget reservation、usage、超時和限額；配置缺失時拒絕付費請求。來源 hash 相同重用核准結果，不重複OCR。

把數學、格式及交易交給程式，把語意整理交給模型。AI 輸出經過 schema、來源證據與發布條件；提議不能直接調權限或退款。驗收重送結果、錯 task_id、prompt injection、超預算、token統計缺失、模型別名無效、桌面中斷與檔案不同版。提供一個桌面任務從派工到 handoff 的完整紀錄。
