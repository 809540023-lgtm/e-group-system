# 部署與環境（規劃書 18、19 章；模組 18）

## 環境

| 環境 | 用途 | 資料庫 | 金鑰 |
| --- | --- | --- | --- |
| dev | 本機開發 | `jp_dev` | 開發用假值 |
| staging | 遷移與驗收測試 | 獨立資料庫 | 獨立金鑰 |
| production | 正式營運 | 獨立資料庫 | 獨立金鑰，只放 secret store |

staging 與 production **不得共用**資料庫或金鑰。

## 開發環境

```bash
docker compose -f infra/compose.dev.yml up -d
cp .env.example .env
npm run db:migrate
npm run dev
```

## 建置映像

```bash
docker build -f infra/docker/web.Dockerfile -t jp-web:local .
docker build -f infra/docker/worker.Dockerfile -t jp-worker:local .
```

兩個映像都以非 root 的 `node` 使用者執行。

## 正式部署流程

`infra/compose.production.template.yml` 是**範本**，不可直接啟用。正式流程：

1. 從**指定已測 commit** 建置映像，並以 digest 固定（不使用可變標籤）。
2. 備份資料庫，並確認備份可還原。
3. 執行 `npm run db:migrate`（使用管理連線，僅供 migration）。
4. 部署 web 與 worker。
5. 檢查 `GET /api/readyz` 通過。
6. 以小額真實交易核對金流與對帳。
7. 觀察錯誤率、worker 失敗佇列與付款差異。

## 回復

- **程式回復**：切回前一個已測映像 digest。
- **資料回復**：以備份還原，**不自動逆轉金融紀錄**。
- 兩者分開處理；資料回復需人工確認影響範圍。

## 備份與監控

- 每日備份；每月執行一次實際還原演練。
- RPO / RTO 以**真實還原結果**核對，未達標需列出限制。
- 告警項目：worker 失敗佇列成長、付款差異、readiness 失敗、備份失敗。

## 尚未完成

- 正式環境、網域、TLS 憑證與 secret store 尚未提供。
- 還原演練尚未執行，RPO / RTO 未經實測。
- 原生 PostgreSQL 16 併發驗收需在 CI 或具 PostgreSQL 16 的環境執行。
