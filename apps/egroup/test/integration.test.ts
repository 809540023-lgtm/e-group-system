import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { hashPickupCode } from '@eg/meal';
import { upsertProduct, type ProductUpsert } from '../src/lib/products.ts';

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

  it('12 人同時搶 5 件庫存，恰好 5 張訂單成立且不超賣', async () => {
    const fixture = await createFixture(5);
    const buyers = 12;

    const results = await Promise.allSettled(
      Array.from({ length: buyers }, (_, index) => createOrder(fixture, 1, `it-oversell-${fixture.suffix}-${index}`)),
    );

    const fulfilled = results.filter((item) => item.status === 'fulfilled');
    const rejected = results.filter((item) => item.status === 'rejected');
    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(buyers - 5);
    for (const item of rejected) {
      expect((item as PromiseRejectedResult).reason.message).toMatch(/^OUT_OF_STOCK/);
    }

    const batch = await db().query<{ quantity_available: number; quantity_reserved: number }>(
      'SELECT quantity_available, quantity_reserved FROM batches WHERE id = $1',
      [fixture.batchId],
    );
    expect(batch.rows[0]!.quantity_reserved).toBe(5);
    expect(batch.rows[0]!.quantity_reserved).toBeLessThanOrEqual(batch.rows[0]!.quantity_available);

    const sold = await db().query<{ units: string }>(
      `SELECT COALESCE(SUM(oi.quantity), 0)::text AS units
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.customer_id = $1`,
      [fixture.customerId],
    );
    expect(sold.rows[0]!.units).toBe('5');
  });

  it('同一張訂單重複付款不會重複入帳', async () => {
    const fixture = await createFixture(3);
    const order = await createOrder(fixture, 1, `it-pay-${fixture.suffix}`);
    const key = `it-pay-key-${fixture.suffix}`;

    const first = await db().query<{ result: { status: string } }>(
      `SELECT eg_pay_order($1,'mock',$2,$3,'integration-test') AS result`,
      [order.order_id, `txn-${key}`, key],
    );
    expect(first.rows[0]!.result.status).toBe('paid');

    const second = await db().query<{ result: { status: string } }>(
      `SELECT eg_pay_order($1,'mock',$2,$3,'integration-test') AS result`,
      [order.order_id, `txn-${key}`, key],
    );
    expect(second.rows[0]!.result.status).toBe('duplicate');

    const payments = await db().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM payments WHERE order_id = $1',
      [order.order_id],
    );
    expect(payments.rows[0]!.count).toBe('1');
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

/* ------------------------------------------------------------------ */
/* 資本市場：RWA 分配、STO+ 狀態機、Social Mining                        */
/* ------------------------------------------------------------------ */

type CapitalFixture = {
  suffix: string;
  programId: string;
  ruleId: string;
  vehicleId: string;
  platformHolderId: string;
  marketHolderId: string;
  custodyHolderId: string;
  pendingHolderId: string;
  generalMarketHolderId: string;
};

async function createCapitalFixture(): Promise<CapitalFixture> {
  const suffix = Math.random().toString(36).slice(2, 10);

  const program = await db().query<{ id: string }>(
    `INSERT INTO sto_programs(code, name, stage, status, target_instrument, professional_investor_only)
     VALUES ($1, $2, 2, 'legal_review', 'equipment_right', true) RETURNING id`,
    [`IT-STO-${suffix}`, `整合測試 STO 計畫 ${suffix}`],
  );
  const programId = program.rows[0]!.id;

  const rule = await db().query<{ id: string }>(
    `INSERT INTO social_mining_rules(program_id, version, content_quality_weight,
       interaction_depth_weight, governance_weight, time_weight, per_account_cap, decay_pct,
       reset_period_days, effective_from)
     VALUES ($1, 1, 0.4, 0.25, 0.2, 0.15, 100, 0.05, 90, current_date) RETURNING id`,
    [programId],
  );
  const ruleId = rule.rows[0]!.id;

  const vehicle = await db().query<{ id: string }>(
    `INSERT INTO rwa_vehicles(code, name, kind, status, maintenance_reserve_pct, senior_debt_twd,
       distributable_basis, total_units)
     VALUES ($1, $2, 'equipment_lease', 'legal_review', 0.05, 0, 'equipment_rent', 1000) RETURNING id`,
    [`IT-RWA-${suffix}`, `整合測試 RWA 載體 ${suffix}`],
  );
  const vehicleId = vehicle.rows[0]!.id;

  const makeHolder = async (wallet: string, addressClass: string, kyc: string, category: string): Promise<string> => {
    const account = await db().query<{ id: string }>(
      `INSERT INTO accounts(email, password_hash, role, display_name)
       VALUES ($1, 'x', 'admin', $2) RETURNING id`,
      [`it-${wallet}-${suffix}@example.test`, `整合測試 ${wallet}`],
    );
    const holder = await db().query<{ id: string }>(
      `INSERT INTO token_holders(account_id, wallet_address, address_class, kyc_status,
         kyc_verified_on, investor_category, jurisdiction)
       VALUES ($1, $2, $3, $4, $5, $6, 'TW') RETURNING id`,
      [account.rows[0]!.id, `${wallet}-${suffix}`, addressClass, kyc,
        kyc === 'verified' ? '2026-01-01' : null, category],
    );
    return holder.rows[0]!.id;
  };

  return {
    suffix,
    programId,
    ruleId,
    vehicleId,
    platformHolderId: await makeHolder('platform', 'platform', 'verified', 'general'),
    marketHolderId: await makeHolder('market', 'secondary_market', 'verified', 'professional'),
    custodyHolderId: await makeHolder('custody', 'custody', 'verified', 'professional'),
    pendingHolderId: await makeHolder('pending', 'platform', 'pending', 'general'),
    generalMarketHolderId: await makeHolder('generalmarket', 'secondary_market', 'verified', 'general'),
  };
}

async function createLot(
  fixture: CapitalFixture,
  holderId: string,
  acquisition: 'purchased' | 'earned',
  quantity: number,
  lockupUntil: string | null,
): Promise<string> {
  const lot = await db().query<{ id: string }>(
    `INSERT INTO token_lots(holder_id, program_id, quantity, acquisition, consideration_twd,
       lockup_until, lockup_basis, state, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'ST+','active') RETURNING id`,
    [
      holderId,
      fixture.programId,
      quantity,
      acquisition,
      acquisition === 'purchased' ? quantity * 1000 : 0,
      lockupUntil,
      acquisition === 'earned' ? 'earned_exempt' : 'rule_144',
    ],
  );
  return lot.rows[0]!.id;
}

async function transition(lotId: string, toAddress: string): Promise<{
  ok: boolean;
  code: string;
  from: string;
  to: string | null;
  requiresManualReview: boolean;
}> {
  const result = await db().query<{ result: { ok: boolean; code: string; from: string; to: string | null; requiresManualReview: boolean } }>(
    `SELECT eg_transition_token_state($1,$2,'integration-test') AS result`,
    [lotId, toAddress],
  );
  return result.rows[0]!.result;
}

async function walletOf(holderId: string): Promise<string> {
  const row = await db().query<{ wallet_address: string }>('SELECT wallet_address FROM token_holders WHERE id = $1', [holderId]);
  return row.rows[0]!.wallet_address;
}

describe.skipIf(!available)('資本市場交易保證', () => {
  it('轉入合規二級市場觸發證券狀態，轉入託管地址則不變', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'purchased', 100, null);

    const toMarket = await transition(lotId, await walletOf(fixture.marketHolderId));
    expect(toMarket.ok).toBe(true);
    expect(toMarket.code).toBe('UTILITY_TO_SECURITY');
    expect(toMarket.to).toBe('ST');

    const toCustody = await transition(lotId, await walletOf(fixture.custodyHolderId));
    expect(toCustody.ok).toBe(true);
    expect(toCustody.code).toBe('CUSTODY_HOLD');
    expect(toCustody.to).toBe('ST');

    const state = await db().query<{ state: string }>('SELECT state FROM token_lots WHERE id = $1', [lotId]);
    expect(state.rows[0]!.state).toBe('ST');
  });

  it('鎖定期內不得把證券狀態轉回效用狀態', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'purchased', 100, '2099-12-31');

    await transition(lotId, await walletOf(fixture.marketHolderId));
    const back = await transition(lotId, await walletOf(fixture.platformHolderId));

    expect(back.ok).toBe(false);
    expect(back.code).toBe('LOCKUP_ACTIVE');
    expect(back.requiresManualReview).toBe(true);

    const state = await db().query<{ state: string }>('SELECT state FROM token_lots WHERE id = $1', [lotId]);
    expect(state.rows[0]!.state).toBe('ST');
  });

  it('賺取取得無鎖定期，可自由轉回效用狀態', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'earned', 40, null);

    await transition(lotId, await walletOf(fixture.marketHolderId));
    const back = await transition(lotId, await walletOf(fixture.platformHolderId));

    expect(back.ok).toBe(true);
    expect(back.code).toBe('SECURITY_TO_UTILITY');
    expect(back.to).toBe('ST+');
  });

  it('未完成 KYC 的地址不得收受代幣', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'earned', 10, null);

    const result = await transition(lotId, await walletOf(fixture.pendingHolderId));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('KYC_REQUIRED');
  });

  it('限專業投資人的計畫不得讓一般投資人進入證券狀態', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'earned', 10, null);

    const result = await transition(lotId, await walletOf(fixture.generalMarketHolderId));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVESTOR_NOT_ELIGIBLE');
  });

  it('安全模式啟動時一律阻擋並要求人工複核', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'earned', 10, null);

    await db().query(
      `INSERT INTO safe_mode_events(program_id, trigger, mode, authorized_by, multi_sig_count,
         expires_at, announced_at)
       VALUES ($1, 'oracle_error', 'pause_conversion', '["財務長","法務"]'::jsonb, 2,
         now() + interval '1 day', now())`,
      [fixture.programId],
    );

    const result = await transition(lotId, await walletOf(fixture.marketHolderId));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SAFE_MODE');
    expect(result.requiresManualReview).toBe(true);
  });

  it('每次狀態轉換都留下可稽核紀錄', async () => {
    const fixture = await createCapitalFixture();
    const lotId = await createLot(fixture, fixture.platformHolderId, 'earned', 10, null);
    await transition(lotId, await walletOf(fixture.marketHolderId));

    const rows = await db().query<{ decision_code: string; legal_basis: string }>(
      'SELECT decision_code, legal_basis FROM token_state_transitions WHERE lot_id = $1',
      [lotId],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]!.decision_code).toBe('UTILITY_TO_SECURITY');
    expect(rows.rows[0]!.legal_basis.length).toBeGreaterThan(0);

    const audit = await db().query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_events
        WHERE action = 'token.state_transition' AND entity_id = $1`,
      [lotId],
    );
    expect(audit.rows[0]!.count).toBe('1');
  });

  it('Social Mining 依權重計算加權分數並建立賺取批次', async () => {
    const fixture = await createCapitalFixture();

    const result = await db().query<{ result: { ok: boolean; awarded: number; weightedScore: string; lotId: string } }>(
      `SELECT eg_award_social_mining($1,$2,current_date - 30,current_date - 1,$3::jsonb,60,'integration-test') AS result`,
      [fixture.platformHolderId, fixture.ruleId, JSON.stringify({ contentQuality: 100, interactionDepth: 0, governance: 0, time: 0 })],
    );

    expect(result.rows[0]!.result.ok).toBe(true);
    expect(result.rows[0]!.result.awarded).toBe(60);
    expect(Number(result.rows[0]!.result.weightedScore)).toBeCloseTo(40, 4);

    const lot = await db().query<{ acquisition: string; lockup_basis: string; state: string }>(
      'SELECT acquisition, lockup_basis, state FROM token_lots WHERE id = $1',
      [result.rows[0]!.result.lotId],
    );
    expect(lot.rows[0]!.acquisition).toBe('earned');
    expect(lot.rows[0]!.lockup_basis).toBe('earned_exempt');
    expect(lot.rows[0]!.state).toBe('ST+');
  });

  it('單一帳戶獎勵上限會截斷超額申請', async () => {
    const fixture = await createCapitalFixture();
    const scores = JSON.stringify({ contentQuality: 80, interactionDepth: 80, governance: 80, time: 80 });

    const first = await db().query<{ result: { awarded: number; capped: boolean } }>(
      `SELECT eg_award_social_mining($1,$2,current_date - 60,current_date - 31,$3::jsonb,80,'integration-test') AS result`,
      [fixture.platformHolderId, fixture.ruleId, scores],
    );
    expect(first.rows[0]!.result.awarded).toBe(80);
    expect(first.rows[0]!.result.capped).toBe(false);

    const second = await db().query<{ result: { awarded: number; capped: boolean } }>(
      `SELECT eg_award_social_mining($1,$2,current_date - 30,current_date - 1,$3::jsonb,80,'integration-test') AS result`,
      [fixture.platformHolderId, fixture.ruleId, scores],
    );
    expect(second.rows[0]!.result.awarded).toBe(20);
    expect(second.rows[0]!.result.capped).toBe(true);

    const third = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_award_social_mining($1,$2,current_date - 90,current_date - 61,$3::jsonb,10,'integration-test') AS result`,
      [fixture.platformHolderId, fixture.ruleId, scores],
    );
    expect(third.rows[0]!.result.ok).toBe(false);
    expect(third.rows[0]!.result.code).toBe('CAP_REACHED');
  });

  it('未完成 KYC 不得取得 Social Mining 獎勵', async () => {
    const fixture = await createCapitalFixture();
    const result = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_award_social_mining($1,$2,current_date - 30,current_date - 1,$3::jsonb,10,'integration-test') AS result`,
      [fixture.pendingHolderId, fixture.ruleId, JSON.stringify({ contentQuality: 50, interactionDepth: 50, governance: 50, time: 50 })],
    );
    expect(result.rows[0]!.result.ok).toBe(false);
    expect(result.rows[0]!.result.code).toBe('KYC_REQUIRED');
  });

  it('分數超出範圍時拒絕發放', async () => {
    const fixture = await createCapitalFixture();
    const result = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_award_social_mining($1,$2,current_date - 30,current_date - 1,$3::jsonb,10,'integration-test') AS result`,
      [fixture.platformHolderId, fixture.ruleId, JSON.stringify({ contentQuality: 120, interactionDepth: 0, governance: 0, time: 0 })],
    );
    expect(result.rows[0]!.result.ok).toBe(false);
    expect(result.rows[0]!.result.code).toBe('SCORE_OUT_OF_RANGE');
  });

  it('RWA 分配只以設備租金為基礎，營運收入全數排除', async () => {
    const fixture = await createCapitalFixture();

    const result = await db().query<{ result: { ok: boolean; maintenanceReserve: number; distributable: number; perUnit: number; excludedOperatingRevenue: number } }>(
      `SELECT eg_compute_rwa_distribution($1, current_date - 30, current_date - 1, 12000, 480000, 600, 'integration-test') AS result`,
      [fixture.vehicleId],
    );

    const payload = result.rows[0]!.result;
    expect(payload.ok).toBe(true);
    expect(payload.maintenanceReserve).toBe(600);
    expect(payload.distributable).toBe(10_800);
    expect(payload.perUnit).toBe(10);
    expect(payload.excludedOperatingRevenue).toBe(480_000);

    const run = await db().query<{ operating_revenue_twd: number; distributable_twd: number }>(
      'SELECT operating_revenue_twd, distributable_twd FROM rwa_distribution_runs WHERE vehicle_id = $1',
      [fixture.vehicleId],
    );
    expect(run.rows[0]!.operating_revenue_twd).toBe(480_000);
    expect(run.rows[0]!.distributable_twd).toBe(10_800);
  });

  it('同一期間重複試算不會產生重複分配紀錄', async () => {
    const fixture = await createCapitalFixture();
    const compute = (rent: number): Promise<unknown> =>
      db().query(
        `SELECT eg_compute_rwa_distribution($1, current_date - 30, current_date - 1, $2, 0, 0, 'integration-test')`,
        [fixture.vehicleId, rent],
      );

    await compute(12_000);
    await compute(24_000);

    const runs = await db().query<{ count: string; distributable_twd: number }>(
      `SELECT count(*)::text AS count, max(distributable_twd) AS distributable_twd
         FROM rwa_distribution_runs WHERE vehicle_id = $1`,
      [fixture.vehicleId],
    );
    expect(runs.rows[0]!.count).toBe('1');
    expect(runs.rows[0]!.distributable_twd).toBe(22_800);
  });
});

/* ------------------------------------------------------------------ */
/* 監理環境：跨境要約守門                                              */
/* ------------------------------------------------------------------ */

type RegulatoryFixture = {
  suffix: string;
  liveProgramId: string;
  draftProgramId: string;
};

async function createRegulatoryFixture(): Promise<RegulatoryFixture> {
  const suffix = Math.random().toString(36).slice(2, 10);

  for (const regime of [
    { code: 'US', name: '美國', posture: 'innovation_oriented', retail: true, professional: false, equivalence: false },
    { code: 'EU', name: '歐盟', posture: 'equivalence_required', retail: true, professional: false, equivalence: true },
    { code: 'TW', name: '台灣', posture: 'restricted', retail: false, professional: true, equivalence: false },
  ]) {
    await db().query(
      `INSERT INTO regulatory_regimes(code, name, posture, framework, retail_allowed,
         professional_only, equivalence_required)
       VALUES ($1,$2,$3,'整合測試框架',$4,$5,$6)
       ON CONFLICT (code) DO NOTHING`,
      [regime.code, regime.name, regime.posture, regime.retail, regime.professional, regime.equivalence],
    );
  }

  const makeProgram = async (stage: number): Promise<string> => {
    const row = await db().query<{ id: string }>(
      `INSERT INTO sto_programs(code, name, stage, status, target_instrument, professional_investor_only)
       VALUES ($1, $2, $3, 'live', 'equipment_right', true) RETURNING id`,
      [`IT-REG-${stage}-${suffix}`, `整合測試監理計畫 ${stage} ${suffix}`, stage],
    );
    return row.rows[0]!.id;
  };

  return {
    suffix,
    liveProgramId: await makeProgram(3),
    draftProgramId: await makeProgram(2),
  };
}

describe.skipIf(!available)('監理環境交易保證', () => {
  it('未達第三階段的計畫不得跨境要約，且仍留下評估紀錄', async () => {
    const fixture = await createRegulatoryFixture();

    const result = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_assess_cross_border($1, 'US', 'professional', 'integration-test') AS result`,
      [fixture.draftProgramId],
    );
    expect(result.rows[0]!.result.ok).toBe(false);
    expect(result.rows[0]!.result.code).toBe('STAGE_NOT_REACHED');

    const rows = await db().query<{ decision_code: string; allowed: boolean }>(
      'SELECT decision_code, allowed FROM cross_border_assessments WHERE program_id = $1',
      [fixture.draftProgramId],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]!.decision_code).toBe('STAGE_NOT_REACHED');
    expect(rows.rows[0]!.allowed).toBe(false);
  });

  it('限制或禁止類的目的地一律阻擋', async () => {
    const fixture = await createRegulatoryFixture();
    const result = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_assess_cross_border($1, 'TW', 'professional', 'integration-test') AS result`,
      [fixture.liveProgramId],
    );
    expect(result.rows[0]!.result.ok).toBe(false);
    expect(result.rows[0]!.result.code).toBe('RESTRICTED_JURISDICTION');
  });

  it('須等同性認定而未取得時阻擋，取得後放行', async () => {
    const fixture = await createRegulatoryFixture();

    const blocked = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_assess_cross_border($1, 'EU', 'professional', 'integration-test') AS result`,
      [fixture.liveProgramId],
    );
    expect(blocked.rows[0]!.result.code).toBe('EQUIVALENCE_MISSING');

    await db().query(`UPDATE regulatory_regimes SET equivalence_determined = true WHERE code = 'EU'`);

    const allowed = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_assess_cross_border($1, 'EU', 'professional', 'integration-test') AS result`,
      [fixture.liveProgramId],
    );
    expect(allowed.rows[0]!.result.ok).toBe(true);
    expect(allowed.rows[0]!.result.code).toBe('ALLOWED');

    await db().query(`UPDATE regulatory_regimes SET equivalence_determined = false WHERE code = 'EU'`);
  });

  it('限專業投資人的計畫不得由一般投資人受讓證券狀態', async () => {
    const fixture = await createRegulatoryFixture();
    const result = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_assess_cross_border($1, 'US', 'general', 'integration-test') AS result`,
      [fixture.liveProgramId],
    );
    expect(result.rows[0]!.result.ok).toBe(false);
    expect(result.rows[0]!.result.code).toBe('PROFESSIONAL_ONLY');
  });

  it('未登錄的監理體制不得要約', async () => {
    const fixture = await createRegulatoryFixture();
    const result = await db().query<{ result: { ok: boolean; code: string } }>(
      `SELECT eg_assess_cross_border($1, 'ZZ', 'professional', 'integration-test') AS result`,
      [fixture.liveProgramId],
    );
    expect(result.rows[0]!.result.ok).toBe(false);
    expect(result.rows[0]!.result.code).toBe('REGIME_UNKNOWN');
  });

  it('每次跨境評估都寫入稽核軌跡', async () => {
    const fixture = await createRegulatoryFixture();
    await db().query(
      `SELECT eg_assess_cross_border($1, 'US', 'professional', 'integration-test')`,
      [fixture.liveProgramId],
    );

    const audit = await db().query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_events
        WHERE action = 'cross_border.assess' AND entity_id = $1`,
      [fixture.liveProgramId],
    );
    expect(audit.rows[0]!.count).toBe('1');
  });
});

function productInput(overrides: Partial<ProductUpsert> & Pick<ProductUpsert, 'sku' | 'supplierId'>): ProductUpsert {
  return {
    name: '整合測試商品',
    category: '舒肥主餐',
    description: '',
    price: 120,
    cost: 60,
    weight: 250,
    calories: 300,
    protein: 25,
    fat: 8,
    saturatedFat: null,
    carbs: 30,
    sugar: null,
    sodium: 400,
    allergens: [],
    storage: 'chilled',
    shelfLife: 5,
    heating: '微波 700W 90 秒',
    claims: [],
    status: null,
    reviewedBy: 'integration-test',
    ...overrides,
  };
}

const exec = (sql: string, params: readonly unknown[]): Promise<unknown> => db().query(sql, params as unknown[]);

async function productStatus(sku: string): Promise<string> {
  const row = await db().query<{ status: string }>('SELECT status FROM products WHERE sku = $1', [sku]);
  return row.rows[0]!.status;
}

describe.skipIf(!available)('商品上架狀態', () => {
  it('供應商建立新商品時一律為草稿', async () => {
    const fixture = await createFixture(1);
    const sku = `IT-STATUS-${fixture.suffix}`;
    await upsertProduct(exec, productInput({ sku, supplierId: fixture.supplierId, status: null }));
    expect(await productStatus(sku)).toBe('draft');
  });

  it('供應商更新既有上架商品時維持原狀態，不會被降級', async () => {
    const fixture = await createFixture(1);
    const sku = `IT-STATUS-${fixture.suffix}`;
    await upsertProduct(exec, productInput({ sku, supplierId: fixture.supplierId, status: 'active' }));
    await upsertProduct(exec, productInput({ sku, supplierId: fixture.supplierId, status: null, price: 150 }));
    expect(await productStatus(sku)).toBe('active');
  });

  it('只有 admin 能指定狀態', async () => {
    const fixture = await createFixture(1);
    const sku = `IT-STATUS-${fixture.suffix}`;
    await upsertProduct(exec, productInput({ sku, supplierId: fixture.supplierId, status: 'suspended' }));
    expect(await productStatus(sku)).toBe('suspended');
  });
});
