# 17_staff_support 員工待辦客服與交接

任務目標：員工待辦客服與交接

依賴：03_auth, 07_checkout, 11_line

閱讀規劃書章節：09, 10, 16, 23

可改檔案範圍：apps/web/src/app/admin/, packages/domain/staff/, packages/domain/support/, packages/db/, apps/worker/, test/staff-support/, docs/handoffs/

建立工作角色、任務、班表、客服輪值、時數、交接和案件。兩人按商品採購/行銷客服分工，三人再分財務物流；owner 可調整。任務包含負責人、截止時間、狀態、訂單/商品連結及完成證據，支援代理與離職停用。

客服結合 support_ticket、訊息、訂單事實與 RMA。AI 草稿只能引用已驗證狀態與合法商品資訊，缺貨、改品、遲付及退款轉所屬角色；需要人工處理的情況提供明確交接而非無限聊天。服務與行銷同意分開。

驗收跨角色私密資料、未指派任務、停用員工、重複客服通知、錯單回覆、退貨與部分退款案件。每日看板與 LINE 摘要由共享任務生成，不以群組對話取代正式工作紀錄。薪資及完整人資作獨立後續範圍，不混進客服表。
