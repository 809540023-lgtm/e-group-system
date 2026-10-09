# 10_shipping 日本集貨報關臺灣配送

任務目標：日本集貨報關臺灣配送

依賴：09_procurement

閱讀規劃書章節：08, 09, 15

可改檔案範圍：apps/web/src/app/admin/, packages/integrations/shipping/, packages/domain/shipping/, packages/db/, apps/worker/, test/shipping/, docs/handoffs/

建立 shipment、shipment_items、packing、tracking_events、customs_tasks 和配送費率版本。ShippingAdapter 支援臺灣現貨、日臺集貨預購、個人直寄及詢價。實重、材積係數、計價級距、包材、偏遠、附加及稅費負擔明確儲存；3kg/20天/NT380 只作有條件的方案，不能當通用價。

支援多訂單併包與一筆明細分批出貨，數量守恆，原始追蹤紀錄不覆蓋。限制品、效期、未知尺寸及報關資料未完成進 exception。EZ WAY 真實認證和委任以物流商實際結果為準；只取必要資料並分權加密。

驗收材積大於實重、包裹超尺寸、拆包、重複更新、清關延遲、退件與補寄。顧客看到每包清楚狀態和到貨區間，LINE 不出現完整身分資料。至少完成一個實際可用物流渠道或保留 integration_pending。
