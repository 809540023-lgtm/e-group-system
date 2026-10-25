/**
 * 資料庫連線池（規劃書 13、16 章）。
 *
 * 每個請求各自 `new Client()` 會付出 TCP + 認證交握成本，並在流量尖峰時
 * 耗盡 PostgreSQL 的 max_connections。這裡以連線字串為鍵共用一個 Pool，
 * 並掛在 globalThis 上，避免 Next.js 開發模式熱重載時不斷累積連線。
 */

import { Pool, type PoolClient } from 'pg';

const globalForDb = globalThis as unknown as { jpPools?: Map<string, Pool> };

function pools(): Map<string, Pool> {
  globalForDb.jpPools ??= new Map<string, Pool>();
  return globalForDb.jpPools;
}

export function getPool(connectionString: string): Pool {
  const existing = pools().get(connectionString);
  if (existing !== undefined) return existing;
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pools().set(connectionString, pool);
  return pool;
}

/** 取得連線執行單一查詢；結束後歸還連線池。 */
export async function withClient<T>(connectionString: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool(connectionString).connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** 交易：失敗時保留原始錯誤，ROLLBACK 失敗則銷毀連線。 */
export async function withTransaction<T>(
  connectionString: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool(connectionString).connect();
  let broken: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      broken = rollbackError instanceof Error ? rollbackError : new Error('ROLLBACK_FAILED');
    }
    throw error;
  } finally {
    client.release(broken);
  }
}
