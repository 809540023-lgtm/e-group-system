import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { hashPickupCode } from '@eg/meal';

/**
 * 資料庫整合測試：驗證計畫書第十五章要求的交易保證。
 * 使用獨立的 egroup_test 資料庫，每次執行前重建 schema，不影響開發資料。
 */
const TEST_URL = process.env.EGROUP_TEST_DATABASE_URL ?? 'postgres://localhost:5432/egroup_test';
const SECRET = 'integration-test-pickup-secret';
const migrationsDir = fileURLToPath(new URL('../db/migrations', import.meta.url));

let pool: Pool | null = null;

function db(): Pool {
  if (pool === null) throw new Error('DB_NOT_READY');
  return pool;
}

async function ensureDatabase(): Promise<void> {
  const url = new URL(TEST_URL);
  const database = url.pathname.replace(/^\//, '');
  const adminUrl = new URL(TEST_URL);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await admin.end();
  }
}

async function applyMigrations(): Promise<void> {
  const client = new Client({ connectionString: TEST_URL });
  await client.connect();
  try {
    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files) {
      await client.query(await readFile(join(migrationsDir, name), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

type Fixture = {
  suffix: string;
  supplierId: string;
  stationId: string;
  customerId: string;
  sku: string;
  batchId: string;
};

async function createFixture(quantity: number): Promise<Fixture> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const supplier = await db().query<{ id: string }>(
    `INSERT INTO suppliers(name, haccp_status, status) VALUES ($1, 'verified', 'active') RETURNING id`,
    [`整合測試供應商 ${suffix}`],
  );
  const supplierId = supplier.rows[0]!.id;

  const station = await db().query<{ id: string }>(
    `INSERT INTO stations(code, name, type, address, status, food_safety_pass, venue_pass)
     VALUES ($1, $2, 'A', '測試地址', 'active', true, true) RETURNING id`,
    [`T-${suffix}`, `整合測試站點 ${suffix}`],
  );
  const stationId = station.rows[0]!.id;

  const customer = await db().query<{ id: string }>(
    `INSERT INTO customers(name, email, referral_code) VALUES ($1, $2, $3) RETURNING id`,
    [`整合測試會員 ${suffix}`, `it-${suffix}@example.test`, `IT${suffix.toUpperCase()}`],
  );
  const customerId = customer.rows[0]!.id;

  const sku = `IT-${suffix.toUpperCase()}`;
  await db().query(
    `INSERT INTO products(sku, name, category, supplier_id, price_twd, cost_twd, weight_g, calories,
                          protein_g, fat_g, carbs_g, sodium_mg, storage, shelf_life_days,
                          heating_instructions, status)
     VALUES ($1, $2, '測試', $3, 100, 60, 300, 400, 20, 10, 40, 300, 'chilled', 5, '微波 2 分鐘', 'active')`,
    [sku, `整合測試商品 ${suffix}`, supplierId],
  );

  const batch = await db().query<{ id: string }>(
    `INSERT INTO batches(sku, supplier_id, lot_no, produced_on, expires_on,
                         quantity_received, quantity_available, status, station_id)
     VALUES ($1, $2, $3, current_date, current_date + 5, $4, $4, 'available', $5) RETURNING id`,
    [sku, supplierId, `LOT-${suffix}`, quantity, stationId],
  );

  return { suffix, supplierId, stationId, customerId, sku, batchId: batch.rows[0]!.id };
}

async function createOrder(fixture: Fixture, quantity: number, key: string): Promise<{ order_id: string; order_no: string; total_twd: number }> {
  const result = await db().query<{ result: { order_id: string; order_no: string; total_twd: number } }>(
    `SELECT eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULL,$6,'integration-test') AS result`,
    [
      fixture.customerId,
      fixture.stationId,
      JSON.stringify([{ sku: fixture.sku, quantity }]),
      hashPickupCode('123456', SECRET),
      new Date(Date.now() + 86_400_000).toISOString(),
      key,
    ],
  );
  return result.rows[0]!.result;
}

async function payOrder(orderId: string, key: string): Promise<void> {
  await db().query(`SELECT eg_pay_order($1,'mock',$2,$3,'integration-test')`, [orderId, `txn-${key}`, key]);
}

async function markReady(orderId: string): Promise<void> {
  await db().query(`SELECT eg_mark_order_ready($1,'integration-test')`, [orderId]);
}

async function deliver(orderId: string, code: string, clientEventId: string | null = null): Promise<string> {
  const result = await db().query<{ result: { status: string } }>(
    `SELECT eg_deliver_order($1,$2,$3,'integration-test',$4) AS result`,
    [orderId, code, SECRET, clientEventId],
  );
  return result.rows[0]!.result.status;
}

async function expectSqlError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toThrow(new RegExp(`^${code}`));
}

const available = await (async (): Promise<boolean> => {
  try {
    await ensureDatabase();
    await applyMigrations();
    pool = new Pool({ connectionString: TEST_URL, max: 8 });
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.warn(`[integration] 略過資料庫整合測試：${(error as Error).message}`);
    if (pool !== null) await pool.end();
    pool = null;
    return false;
  }
})();

afterAll(async () => {
  if (pool !== null) await pool.end();
});

describe.skipIf(!available)('資料庫交易保證', () => {
  it('最後一件庫存同時下單，只有一張訂單成立', async () => {
    const fixture = await createFixture(1);

    const results = await Promise.allSettled([
      createOrder(fixture, 1, `it-concurrent-a-${fixture.suffix}`),
      createOrder(fixture, 1, `it-concurrent-b-${fixture.suffix}`),
    ]);

    const fulfilled = results.filter((item) => item.status === 'fulfilled');
    const rejected = results.filter((item) => item.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/^OUT_OF_STOCK/);

    const batch = await db().query<{ quantity_reserved: number }>('SELECT quantity_reserved FROM batches WHERE id = $1', [fixture.batchId]);
    expect(batch.rows[0]!.quantity_reserved).toBe(1);
  });

  it('相同 idempotency key 重送不會重複建立訂單', async () => {
    const fixture = await createFixture(5);
    const key = `it-idem-${fixture.suffix}`;
    const first = await createOrder(fixture, 2, key);
    const second = await createOrder(fixture, 2, key);
    expect(second.order_no).toBe(first.order_no);

    const count = await db().query<{ count: string }>('SELECT count(*)::text AS count FROM orders WHERE customer_id = $1', [fixture.customerId]);
    expect(count.rows[0]!.count).toBe('1');
  });

  it('取貨碼一次性核銷，且錯誤碼不得通過', async () => {
    const fixture = await createFixture(3);
    const order = await createOrder(fixture, 1, `it-pickup-${fixture.suffix}`);
    await payOrder(order.order_id, `it-pickup-pay-${fixture.suffix}`);
    await markReady(order.order_id);

    await expectSqlError(deliver(order.order_id, '000000'), 'PICKUP_CODE_INVALID');
    expect(await deliver(order.order_id, '123456')).toBe('delivered');
    await expectSqlError(deliver(order.order_id, '123456'), 'PICKUP_CODE_USED');

    const batch = await db().query<{ quantity_available: number; quantity_reserved: number }>(
      'SELECT quantity_available, quantity_reserved FROM batches WHERE id = $1',
      [fixture.batchId],
    );
    expect(batch.rows[0]!.quantity_available).toBe(2);
    expect(batch.rows[0]!.quantity_reserved).toBe(0);
  });

  it('離線事件以 client_event_id 去重', async () => {
    const fixture = await createFixture(3);
    const order = await createOrder(fixture, 1, `it-offline-${fixture.suffix}`);
    await payOrder(order.order_id, `it-offline-pay-${fixture.suffix}`);
    await markReady(order.order_id);

    const eventId = `evt-${fixture.suffix}`;
    expect(await deliver(order.order_id, '123456', eventId)).toBe('delivered');
    expect(await deliver(order.order_id, '123456', eventId)).toBe('duplicate');
  });

  it('退款冪等且不得超過已付金額', async () => {
    const fixture = await createFixture(3);
    const order = await createOrder(fixture, 1, `it-refund-${fixture.suffix}`);
    await payOrder(order.order_id, `it-refund-pay-${fixture.suffix}`);

    const key = `it-refund-key-${fixture.suffix}`;
    const first = await db().query<{ result: { status: string } }>(
      `SELECT eg_refund_order($1, 50, '測試部分退款', $2, 'integration-test') AS result`,
      [order.order_id, key],
    );
    expect(first.rows[0]!.result.status).toBe('refunded');

    const second = await db().query<{ result: { status: string } }>(
      `SELECT eg_refund_order($1, 50, '測試部分退款', $2, 'integration-test') AS result`,
      [order.order_id, key],
    );
    expect(second.rows[0]!.result.status).toBe('duplicate');

    await expectSqlError(
      db().query(`SELECT eg_refund_order($1, 100, '超額退款', $2, 'integration-test')`, [order.order_id, `it-refund-over-${fixture.suffix}`]),
      'REFUND_EXCEEDS_PAID',
    );

    const batch = await db().query<{ quantity_reserved: number }>('SELECT quantity_reserved FROM batches WHERE id = $1', [fixture.batchId]);
    expect(batch.rows[0]!.quantity_reserved).toBe(0);
  });

  it('召回後停止銷售並阻擋交付', async () => {
    const fixture = await createFixture(5);
    const order = await createOrder(fixture, 1, `it-recall-${fixture.suffix}`);
    await payOrder(order.order_id, `it-recall-pay-${fixture.suffix}`);
    await markReady(order.order_id);

    const recall = await db().query<{ result: { recall_id: string } }>(
      `SELECT eg_recall_batch($1, '測試召回', 'integration-test') AS result`,
      [fixture.batchId],
    );
    const recallId = recall.rows[0]!.result.recall_id;

    await expectSqlError(deliver(order.order_id, '123456'), 'RECALL_BLOCKED');
    await expectSqlError(createOrder(fixture, 1, `it-recall-new-${fixture.suffix}`), 'RECALL_BLOCKED');

    const notifications = await db().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM recall_notifications WHERE recall_id = $1',
      [recallId],
    );
    expect(Number(notifications.rows[0]!.count)).toBeGreaterThan(0);

    await expectSqlError(
      db().query(`SELECT eg_close_recall($1, 'integration-test')`, [recallId]),
      'RECALL_NOTIFICATIONS_PENDING',
    );

    await db().query(`UPDATE recall_notifications SET status = 'sent', sent_at = now() WHERE recall_id = $1`, [recallId]);
    const closed = await db().query<{ result: { status: string } }>(`SELECT eg_close_recall($1, 'integration-test') AS result`, [recallId]);
    expect(closed.rows[0]!.result.status).toBe('closed');
  });

  it('站點結算不得重複計酬', async () => {
    const fixture = await createFixture(3);
    const order = await createOrder(fixture, 1, `it-settle-${fixture.suffix}`);
    await payOrder(order.order_id, `it-settle-pay-${fixture.suffix}`);
    await markReady(order.order_id);
    await deliver(order.order_id, '123456');

    const settle = (): Promise<{ rows: { result: { settlement_id: string; delivered_count: number; net_twd: number } }[] }> =>
      db().query(
        `SELECT eg_settle_station($1, current_date, current_date, 15, 0, '[]'::jsonb, 'integration-test') AS result`,
        [fixture.stationId],
      );

    const first = await settle();
    expect(first.rows[0]!.result.delivered_count).toBe(1);
    expect(first.rows[0]!.result.net_twd).toBe(15);

    await expectSqlError(settle(), 'SETTLEMENT_DUPLICATE');
  });

  it('準時備妥率有可稽核的資料來源', async () => {
    const fixture = await createFixture(3);
    const order = await createOrder(fixture, 1, `it-kpi-${fixture.suffix}`);

    const promised = await db().query<{ promised_ready_at: string; lead: string }>(
      `SELECT o.promised_ready_at,
              (o.promised_ready_at - o.created_at)::text AS lead
         FROM orders o WHERE o.id = $1`,
      [order.order_id],
    );
    // 測試站點為 A 型，前置時間 4 小時。
    expect(promised.rows[0]!.lead).toBe('04:00:00');

    await payOrder(order.order_id, `it-kpi-pay-${fixture.suffix}`);
    await markReady(order.order_id);

    const ready = await db().query<{ ready_at: string | null }>(
      `SELECT min(created_at)::text AS ready_at
         FROM audit_events
        WHERE action = 'order.ready' AND entity_id = $1`,
      [order.order_id],
    );
    expect(ready.rows[0]!.ready_at).not.toBeNull();
  });
});
