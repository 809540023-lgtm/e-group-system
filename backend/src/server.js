/**
 * E 組管理平台後端服務
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const logger = require('./utils/logger');

// 路由
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const platformRoutes = require('./routes/platform');
const salesRoutes = require('./routes/sales');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

// 中間件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日誌中間件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 錯誤處理
app.use((err, req, res, next) => {
  logger.error(`${err.message}`, err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 檢查必要的環境變數
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.warn(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
  logger.warn('The API will start in limited mode. Please configure these variables for full functionality.');
}

// 啟動服務器
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
