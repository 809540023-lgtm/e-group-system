# 15_analytics 成交貢獻廣告與管理報表

任務目標：成交貢獻廣告與管理報表

依賴：08_payments, 10_shipping, 13_meta_ads, 14_chatgpt_ads

閱讀規劃書章節：13, 16, 21

可改檔案範圍：apps/web/src/app/admin/, packages/domain/analytics/, packages/db/, apps/worker/, test/analytics/, docs/handoffs/

建立實收營收、退款、落地成本、金流、配送補貼、廣告支出與淨貢獻報表。儲存對應訂單和來源版本，平臺花費換算儲存匯率。平臺的 attribution window 和 time basis 與網站實際成交分開顯示，不能把多平臺歸因收入直接加總。

儀錶板呈現瀏覽、加購、結帳、付款成功、客單、CAC、ROAS、貢獻、採購、缺貨、效期、客服時限及同步成功。摘要分角色，不給行銷人員顧客私密資料。UTC 儲存時間，臺北營運報表與日本作業時區明示。

驗收重複 purchase、跨平臺歸因、部分退款、跨月退款、錯匯率、零分母、逾期對帳及晚到資料。報表可點回明細證據，匯出範圍與操作有紀錄，敏感欄位遮罩。
