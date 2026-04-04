const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 確保日誌目錄存在
const logsDir = path.join(__dirname, '../../logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.error('Warning: Cannot create logs directory:', error.message);
}

// 構建 transports 數組
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// 嘗試添加文件 transports，但如果失敗則繼續
try {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  );
} catch (error) {
  console.warn('Warning: File logging disabled:', error.message);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
  exitOnError: false
});

module.exports = logger;
