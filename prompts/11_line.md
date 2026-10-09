# 11_line LINE 官方帳號與客服通知

任務目標：LINE 官方帳號與客服通知

依賴：03_auth, 08_payments, 10_shipping

閱讀規劃書章節：10, 15, 16, 17

可改檔案範圍：packages/integrations/line/, apps/web/src/app/api/webhooks/, apps/worker/, apps/web/src/app/admin/, test/line/, docs/handoffs/

完成 LINE 官方帳號 Messaging API adapter、webhook、員工群組通知、訂單服務通知、客服案件與可登入工作臺連結。驗章先用原始 Buffer，透過後才 JSON parse；事件重送使用 webhookEventId 或官方支援鍵去重，處理 replyToken 期限及訊息額度。

LINE user ID 和 customer/staff 繫結需已驗證流程。群組成員列表或聊天文字不等於後臺權限。員工通知只含訂單碼、待辦角色和連結，點選後再驗證角色與資源。退款、上架、改權限及預算依後臺 policy，不能由群組訊息直接執行。

驗收原始位元組變化、錯簽章、重送、額度不足、權杖失效、退群、錯顧客繫結及查別人訂單。訊息失敗保留 outbox 與客服入口，不回滾已付款狀態。提供官方後臺要填的 webhook URL、驗證方法與測試訊息步驟。
