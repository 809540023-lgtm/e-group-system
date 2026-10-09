# 03_auth 顧客登入與員工權限

任務目標：顧客登入與員工權限

依賴：02_database

閱讀規劃書章節：10, 15, 17

可改檔案範圍：apps/web/, packages/domain/auth/, packages/db/, test/auth/, docs/handoffs/

匯入官方支援且有持續維護的登入方案，先核對所選方案檔案。員工使用獨立帳號、MFA、邀請、停用及 session 撤銷；顧客可採已驗證 LINE 登入或其他設定方案。驗證 token issuer、audience、期限、state、nonce 及回呼，安全 cookie 與 CSRF 處理完整。

定義商品、行銷、客服、財務及 owner 權限，可組合，但每次 API 寫入查服務端角色。顧客查單必查所有權；電話查單需驗證及限流，不裸用訂單號加電話當授權。敏感資料視角色遮罩；匯出與改角色有稽核。

驗收：未登入、已停用員工、前端偽造 role、其他顧客訂單 ID、過期 LINE token、角色更改後舊 session 都被拒絕。管理頁隱藏按鈕不能替代後端檢查。缺真實登入憑證時提供明確 dev-only auth，正式模式拒絕啟動該替代機制。
