# 01_foundation 基礎專案與可執行架構

任務目標：基礎專案與可執行架構

依賴：無

閱讀規劃書章節：01, 02, 14, 18

可改檔案範圍：apps/, packages/, package.json, package-lock.json, .github/, infra/, docs/handoffs/

把起始套件整理為 npm workspace，建立 apps/web 的 Next.js App Router 與 TypeScript、apps/worker 的 Node 程式、packages/domain、integrations、db、ui。檢查官方目前支援的版本，鎖定 package-lock；Node 使用 24 LTS。不把已存在檔案覆蓋為空模板。

保留現有 money、catalog、checkout、payment、marketing、approval、簽章及 SQL 測試行為，逐步加入型別、runtime schema 與路徑引用。web 先完成首頁、商品列表、健康檢查及受保護後臺骨架；worker 完成啟動、關閉、資料庫連線與非破壞排程入口。

建立 dev、staging、production 設定，秘密不使用 NEXT_PUBLIC。提供 npm run dev、typecheck、lint、test、build 及 worker 命令，CI 執行實際可用專案。驗收：全新 checkout 可按 README 啟動，24 LTS 下 build 成功，移植後原有測試透過，web 與 worker 共用 domain 而非複製規則。
