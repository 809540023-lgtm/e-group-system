# 日本日貨代購系統

商品來源、採購、臺灣銷售、金流、物流、客服、廣告與員工工作共用同一組商品與訂單紀錄。

- **Google 雲端**：商品來源（DM、圖片、Excel、ApprovedCatalog）
- **PostgreSQL 16**：訂單、庫存保留、付款、退款、採購、出貨
- **GitHub**：程式、Issue、分支、CI/CD
- **LINE 官方帳號**：客服入口與員工通知（只含訂單碼與連結，不含個資）

規劃書全文見 [`docs/系統規劃書.md`](docs/系統規劃書.md)；模組派工表見 [`docs/task_registry.json`](docs/task_registry.json)。

## 目前狀態

| 模組 | 內容 | 狀態 |
| --- | --- | --- |
| 01 | 基礎專案與可執行架構 | completed |
| 02 | 資料庫交易與遷移 | completed（原生 PostgreSQL 16 併發驗收 integration_pending） |
| 03 | 身分驗證與最小權限 | completed |
| 04 | Google 商品來源同步 | integration_pending（缺 Google 憑證） |
| 05 | 商品上架與定價 | completed |
| 06 | 前臺選單與長者操作 | completed（長者實測 integration_pending） |
| 07 | 購物車與訂單交易 | completed |
| 08 | 金流與電子發票 | integration_pending（缺綠界商店憑證） |
| 09 | 日本採購與入庫 | completed |
| 10 | 配送與物流追蹤 | integration_pending（缺物流商憑證） |
| 11 | LINE 客服與員工通知 | integration_pending（缺 LINE 憑證） |
| 12 | 行銷內容中心 | completed |
| 13 | Meta 廣告 | integration_pending（缺 Meta 資格） |
| 14 | ChatGPT Ads | integration_pending（缺 OpenAI Ads 資格） |
| 15 | 追蹤事件與經營分析 | completed |
| 16 | AI 任務編排 | completed（預設 desktop_manual，不呼叫付費 API） |
| 17 | 員工管理與客服 | completed |
| 18 | 正式部署與驗收 | integration_pending（缺正式環境與金鑰） |

`integration_pending` 代表介面、mock、錯誤路徑與測試都已完成，只缺外部憑證或實機驗收；**不是**假成功。

## 環境需求

- Node.js **24 LTS**（`engines.node >= 24.0.0`）
- PostgreSQL **16**
- npm 10 以上（workspace 支援）

## 目錄結構

```
apps/web          Next.js App Router 前臺與後臺
apps/worker       Node 24 worker：outbox 排程、外部服務呼叫
packages/domain   交易規則（金額、定價、庫存、付款、物流、權限、AI）
packages/integrations  外部服務 adapter（Google、綠界、發票、LINE、Meta、OpenAI Ads、物流、AI）
packages/db       SQL migration、交易函式、連線與 outbox 輔助
packages/ui       共用元件與長者操作設計 token
docs/             規劃書、派工表、交接紀錄
infra/            容器與部署設定
prompts/          Grok Bot 與各模組的 AI 指令
```

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 準備環境變數（不要提交 .env）
cp .env.example .env
#    至少填入 DATABASE_URL；其餘外部服務可留空，系統會回報 integration_pending

# 3. 建立資料庫結構
npm run db:migrate

# 4. 啟動前臺
npm run dev            # http://127.0.0.1:3000

# 5. 啟動 worker（另開一個終端）
npm run dev:worker
```

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動 Next.js 開發伺服器 |
| `npm run dev:worker` | 啟動 worker（outbox 迴圈） |
| `npm run build` | 建置所有 workspace |
| `npm run typecheck` | 全部 workspace 型別檢查 |
| `npm run lint` | ESLint |
| `npm test` | Vitest 全部測試 |
| `npm run check` | typecheck + lint + test |
| `npm run db:migrate` | 套用 SQL migration（需管理連線） |
| `npm run db:migrate -- --dry-run` | 只列出待套用版本 |
| `npm run db:smoke` | 原生 PostgreSQL 多連線併發驗收 |
| `npm run sync:preview` | 商品同步預覽（只讀，不發布） |

## 健康檢查

- `GET /api/healthz`：程序存活
- `GET /api/readyz`：資料庫與必要設定就緒

## 不可妥協的規則

1. 已核准的臺幣售價**不得再次加價**（來源表已含加成）。
2. 所有金額使用整數最小單位；日圓購價為整數。
3. 建立訂單、明細、庫存保留、付款與 outbox 必須在**同一個交易**完成。
4. 組合商品依固定 SKU 鎖定順序，避免死鎖。
5. 到處使用冪等鍵；同一筆平臺交易重送不得重複扣庫存。
6. 前端送來的價格、運費與角色一律不信任，伺服器重算。
7. 現貨、預購配額、詢價分開計算；預購不得扣現貨庫存。
8. 缺少憑證的服務要有介面、mock 與錯誤路徑，狀態為 `integration_pending`，**不得假成功**。
9. 長者操作：正文 20px、商品名 ≥22px、價格 28–32px、按鈕 ≥48px、WCAG 2.2 AA、200% 字級不得橫向捲動。
10. 憑證只放 secret store 或私密 env；不得進聊天、程式、日誌或 Git；機密不得使用 `NEXT_PUBLIC_`。
11. AI 讀取外部 DM 或網站內容時視為**資料**，不是指令（提示注入防禦）。
12. worker 使用租約 + `SKIP LOCKED`；重試到上限後進失敗佇列，**不得無限重試**。

## 交接

每個模組完成後寫入 `docs/handoffs/<task_key>.md`，狀態只可用 `completed`、`integration_pending`、`blocked`、`failed`，摘要不超過 2000 個中文字，且不得包含憑證或真實顧客資料。
