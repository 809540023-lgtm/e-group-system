# 07_checkout 報價訂單與庫存保留

任務目標：報價訂單與庫存保留

依賴：03_auth, 05_catalog_pricing, 06_storefront

閱讀規劃書章節：06, 08, 15

可改檔案範圍：apps/web/src/app/api/, apps/web/src/app/checkout/, packages/domain/checkout/, packages/db/, test/checkout/, docs/handoffs/

完成 POST quote、POST orders、GET own-order、取消未付款訂單與購物車三步結帳。只接 SKU、數量及必要配送條件，由後端定價，不相信前端價格、總額或運費。有效期、商品版本、條款版本與 quote_hash 儲存快照。

現貨、預購配額及詢價分開；跨配送包裹先算可選運費、承諾區間與費用負擔。未知限制不得直接收款。建單、明細、保留和冪等在同一 transaction；同報價重試最多一張有效訂單。信用卡與 ATM/超商保留期限配套，不能一律 15 分鐘到期。

驗收前端改價、負數數量、重複 SKU、來源過期、商品已下架、超庫存、重複點選、回上一步、網路中斷及預購截止。付款前顯示商品、配送、優惠、稅費條件與總額；客戶不需依聊天才知道實際應付金額。
