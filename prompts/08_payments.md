# 08_payments 綠界收款退款發票與對帳

任務目標：綠界收款退款發票與對帳

依賴：07_checkout

閱讀規劃書章節：07, 09, 15

可改檔案範圍：packages/integrations/payment/, packages/integrations/invoice/, apps/web/src/app/api/webhooks/, apps/worker/, packages/db/, test/payments/, docs/handoffs/

以綠界導轉式金流作第一個 PaymentAdapter，核對當日官方 API、測試資料及商店合約。保留既有 CheckMacValue 官方向量測試，補 createPayment、queryPayment、verifyNotification、requestRefund、reconcile。回呼 parse 拒絕重複欄位，核對簽章、MerchantID、訂單、金額、成功碼與模擬交易 flag。服務端保管 HashKey/IV。

把已驗證事件對映到內部訂單 UUID，經正式交易記錄金流、庫存及 outbox。返回頁只查狀態，不寫 paid。未知結果先查平臺；同交易重送不重扣，新的重複付款轉財務。退款鎖定可退餘額，依規則核准後送出，確認才更新帳務。

完成每日交易/撥款/手續費/銀行對帳與差異工作臺，發票以 adapter 按實際銷售主體處理載具、統編、作廢與折讓。驗收 sandbox 收款、錯簽章、錯額、遲付、重送、通知遺失、部分退款、超額退款及撥款。未取得正式特店不得宣稱可以收款。
