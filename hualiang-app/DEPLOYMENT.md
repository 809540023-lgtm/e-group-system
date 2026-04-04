# 華亮分會 App - 部署指南

## 📋 部署清單

### 開發環境
- [x] 本地開發完成
- [x] API 功能測試
- [x] 管理後台功能測試
- [x] 數據庫初始化

### 準備上線
1. 環境配置
2. 數據庫設置
3. 應用構建
4. 服務部署

## 🌍 部署選項

### 選項 1: 本地服務器

#### 後端部署
```bash
cd backend
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
gunicorn -w 4 -b 0.0.0.0:5000 app:create_app()
```

#### 前端部署 (使用 Nginx)
```bash
cd frontend
npm install
npm run build

# Nginx 配置
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/frontend/dist;

    location / {
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000/api;
    }
}
```

### 選項 2: Docker 容器化

#### Dockerfile (後端)
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]
```

#### Dockerfile (前端)
```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose
```yaml
version: '3'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=sqlite:///hualiang.db
      - FLASK_ENV=production
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  admin:
    build: ./admin
    ports:
      - "3000:80"
```

### 選項 3: 雲端部署

#### Heroku (後端)
```bash
# 安裝 Heroku CLI
heroku login

# 創建應用
heroku create your-app-name

# 添加 Procfile
echo "web: gunicorn -w 4 -b 0.0.0.0:\$PORT app:create_app()" > Procfile

# 部署
git push heroku main
```

#### Vercel/Netlify (前端)
```bash
npm install -g vercel
vercel
# 按照提示完成部署
```

## 🔧 環境配置

### 生產環境 .env
```env
FLASK_ENV=production
FLASK_DEBUG=False
DATABASE_URL=postgresql://user:password@localhost/hualiang
SECRET_KEY=your-very-secure-secret-key-change-this
CORS_ORIGINS=https://your-domain.com

# 郵件配置 (可選)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email
MAIL_PASSWORD=your-password
```

## 📊 數據庫遷移

### SQLite 到 PostgreSQL

```bash
# 1. 安裝 PostgreSQL 驅動
pip install psycopg2-binary

# 2. 更新 config.py 中的 DATABASE_URL
DATABASE_URL=postgresql://user:password@localhost/hualiang

# 3. 在 PostgreSQL 中創建數據庫
createdb hualiang

# 4. 運行應用，自動建表
python app.py
```

## 🔐 安全設置

### SSL/TLS 證書
```bash
# 使用 Let's Encrypt
certbot certonly --standalone -d your-domain.com
```

### 防火牆規則
```bash
# 只允許必要的端口
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 反向代理 (Nginx)
```nginx
upstream backend {
    server 127.0.0.1:5000;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 安全頭部
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        root /var/www/hualiang-app/dist;
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 📈 性能優化

### 前端優化
```bash
# 啟用 Gzip 壓縮
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;

# 緩存靜態資源
location ~* \.(js|css|png|jpg|gif)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 後端優化
- 啟用數據庫連接池
- 使用 Redis 緩存
- 啟用 GZIP 壓縮
- 使用 CDN 分發靜態資源

## 🔍 監控和日誌

### 日誌配置
```python
import logging
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler('app.log', maxBytes=10000000, backupCount=10)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
```

### 健康檢查
```bash
# 添加監控端點
curl http://your-api.com/api/health
```

## 🚨 故障排除

### 常見問題

1. **數據庫連接失敗**
   - 檢查 DATABASE_URL 是否正確
   - 確認數據庫服務正在運行

2. **CORS 錯誤**
   - 檢查 CORS_ORIGINS 配置
   - 確保前端和後端域名配置正確

3. **靜態文件無法加載**
   - 檢查 Nginx 根目錄設置
   - 確認前端已構建 (`npm run build`)

4. **高內存使用**
   - 增加 gunicorn worker 數量
   - 實施數據庫連接池

## 📊 備份策略

### 數據庫備份
```bash
# PostgreSQL 備份
pg_dump hualiang > hualiang_backup.sql

# 恢復
psql hualiang < hualiang_backup.sql

# 自動備份腳本
0 2 * * * /usr/local/bin/backup_db.sh
```

## ✅ 上線檢查清單

- [ ] 環境變量已設置
- [ ] SSL 證書已安裝
- [ ] 數據庫已初始化
- [ ] API 端點已測試
- [ ] 前端構建成功
- [ ] 管理後台可訪問
- [ ] 備份系統已配置
- [ ] 日誌系統已啟用
- [ ] 監控工具已就位
- [ ] 域名已配置

## 📞 支持聯繫

部署過程中遇到問題，請聯繫開發團隊。

---

**更新時間**: 2025年3月
