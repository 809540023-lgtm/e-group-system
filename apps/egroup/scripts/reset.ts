import { Client } from 'pg';
import { databaseUrl } from '../src/lib/env.ts';

/**
 * 重建示範資料庫：刪除後重新建立，再交由 db:migrate 與 db:seed 套用。
 * 只允許在非 production 環境執行，避免誤刪正式資料。
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error('db:reset 不得在 production 執行。');
}

const url = new URL(databaseUrl());
const database = url.pathname.replace(/^\//, '');
if (!/^[a-z0-9_]+$/.test(database)) {
  throw new Error(`資料庫名稱不合法：${database}`);
}

const adminUrl = new URL(databaseUrl());
adminUrl.pathname = '/postgres';

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [database],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
  await admin.query(`CREATE DATABASE "${database}"`);
  console.log(`已重建資料庫 ${database}。請接著執行 db:migrate 與 db:seed。`);
} finally {
  await admin.end();
}
