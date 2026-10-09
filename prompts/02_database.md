# 02_database 資料庫模型與交易一致性

任務目標：資料庫模型與交易一致性

依賴：01_foundation

閱讀規劃書章節：06, 07, 14, 16

可改檔案範圍：packages/db/, packages/domain/, db/, test/, docs/handoffs/

移植 db/001_core.sql 和 002_jobs.sql 到版本化 migration，建立 migration、web、worker、reporter 最小權限角色。避免用管理帳號供公開 API 存取。依規劃補 quotes、payment_attempts、庫存移動及必要索引；依業務模式儲存現貨、預購配額與詢價，不把預購當現貨扣庫存。

完成報價、訂單明細、庫存保留、付款、退款餘額及 outbox 的交易。SKU 鎖定順序固定，外部平臺交易唯一，同一訂單的不同重送通知不得重複出貨。退款 request_key 冪等，並發退款鎖定可退額。過期釋放與遲付保留資金事實；已出貨訂單的財務異常不能抹掉實際物流進度。

用原生 PostgreSQL 16 多連線測最後一件、相反順序的組合訂單、付款重送、交易號衝突、取消後付款、兩筆同時退款、租約重取及重試滿。提供初始化、逐版 migration、無破壞回復及 smoke test 指令。驗收：不超賣、不超退、付款事件與 outbox 同一交易，沒有 schema 空架子或純記憶體替代正式一致性。
