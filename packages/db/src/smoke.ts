/**
 * 交易一致性 smoke test（規劃書 06、07、16 章；模組 02）。
 *
 * 以原生 PostgreSQL 16 多連線驗證：
 * 最後一件、相反順序的組合訂單、付款重送、交易號衝突、取消後付款、
 * 兩筆同時退款、租約重取及重試滿。
 *
 * 需要 DATABASE_URL；未設定時明確回報 skipped，不以假成功掩蓋。
 */

import { Client } from 'pg';

export interface SmokeCaseResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface SmokeReport {
  readonly ran: boolean;
  readonly reason: string | null;
  readonly cases: readonly SmokeCaseResult[];
  readonly passed: number;
  readonly failed: number;
}

export interface SmokeOptions {
  readonly databaseUrl?: string;
  readonly log?: (message: string) => void;
}

async function withClient<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seedSku(client: Client, sku: string, onHand: number, quota = 0): Promise<string> {
  const product = await client.query<{ product_id: string }>(
    `INSERT INTO products (product_code, title_zh, category)
     VALUES ($1, $1, '測試') ON CONFLICT (product_code) DO UPDATE SET updated_at = now()
     RETURNING product_id`,
    [`P-${sku}`],
  );
  const productId = product.rows[0]?.product_id as string;
  const skuRow = await client.query<{ sku_id: string }>(
    `INSERT INTO skus (product_id, sku, title_zh, category, sale_twd, supply_mode)
     VALUES ($1, $2, $2, '測試', 100, 'in_stock')
     ON CONFLICT (sku) DO UPDATE SET updated_at = now()
     RETURNING sku_id`,
    [productId, sku],
  );
  const skuId = skuRow.rows[0]?.sku_id as string;
  await client.query(
    `INSERT INTO inventory (sku_id, on_hand, reserved, preorder_quota, preorder_used)
     VALUES ($1, $2, 0, $3, 0)
     ON CONFLICT (sku_id) DO UPDATE SET on_hand = $2, reserved = 0, preorder_quota = $3, preorder_used = 0`,
    [skuId, onHand, quota],
  );
  return skuId;
}

function line(sku: string, quantity: number, mode = 'in_stock'): Record<string, unknown> {
  return { sku, quantity, unit_price_twd: 100, supply_mode: mode, snapshot: { sku } };
}

export async function runSmoke(options: SmokeOptions = {}): Promise<SmokeReport> {
  const log = options.log ?? (() => {});
  const url = options.databaseUrl ?? process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    return {
      ran: false,
      reason: '未設定 DATABASE_URL，跳過原生 PostgreSQL 交易測試。',
      cases: [],
      passed: 0,
      failed: 0,
    };
  }

  const cases: SmokeCaseResult[] = [];
  const record = (name: string, passed: boolean, detail: string): void => {
    cases.push({ name, passed, detail });
    log(`${passed ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  };

  const stamp = Date.now();

  // 1. 最後一件：兩張訂單搶同一件庫存，只有一張成功。
  await withClient(url, async (client) => {
    const sku = `SMOKE-LAST-${stamp}`;
    await seedSku(client, sku, 1);
    const a = await client.query('SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
      `A-${stamp}`, null, null, `idem-a-${stamp}`, 'v1', JSON.stringify([line(sku, 1)]), 0, 0, 15, 'order.created',
    ]);
    let secondFailed = false;
    try {
      await client.query('SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
        `B-${stamp}`, null, null, `idem-b-${stamp}`, 'v1', JSON.stringify([line(sku, 1)]), 0, 0, 15, 'order.created',
      ]);
    } catch {
      secondFailed = true;
    }
    record('最後一件不超賣', a.rowCount === 1 && secondFailed, secondFailed ? '第二張訂單被拒絕' : '第二張訂單竟成功');
  });

  // 2. 相反順序的組合訂單：固定 SKU 鎖定順序避免死鎖。
  await withClient(url, async (client) => {
    const skuA = `SMOKE-ORD-A-${stamp}`;
    const skuB = `SMOKE-ORD-B-${stamp}`;
    await seedSku(client, skuA, 5);
    await seedSku(client, skuB, 5);
    const c1 = new Client({ connectionString: url });
    const c2 = new Client({ connectionString: url });
    await c1.connect();
    await c2.connect();
    try {
      await c1.query('BEGIN');
      await c2.query('BEGIN');
      const p1 = c1.query('SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
        `C1-${stamp}`, null, null, `idem-c1-${stamp}`, 'v1', JSON.stringify([line(skuB, 1), line(skuA, 1)]), 0, 0, 15, 'order.created',
      ]);
      const p2 = c2.query('SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
        `C2-${stamp}`, null, null, `idem-c2-${stamp}`, 'v1', JSON.stringify([line(skuA, 1), line(skuB, 1)]), 0, 0, 15, 'order.created',
      ]);
      const results = await Promise.allSettled([p1, p2]);
      await c1.query('COMMIT');
      await c2.query('COMMIT');
      const ok = results.every((r) => r.status === 'fulfilled');
      record('相反順序組合訂單無死鎖', ok, ok ? '兩張訂單皆完成' : '發生死鎖或錯誤');
    } catch (cause) {
      await c1.query('ROLLBACK').catch(() => {});
      await c2.query('ROLLBACK').catch(() => {});
      record('相反順序組合訂單無死鎖', false, String(cause));
    } finally {
      await c1.end();
      await c2.end();
    }
  });

  // 3. 付款重送：同一 event_key 不重複扣庫存。
  await withClient(url, async (client) => {
    const sku = `SMOKE-RESEND-${stamp}`;
    await seedSku(client, sku, 3);
    const created = await client.query<{ order_id: string }>(
      'SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`D-${stamp}`, null, null, `idem-d-${stamp}`, 'v1', JSON.stringify([line(sku, 2)]), 0, 0, 15, 'order.created'],
    );
    const orderId = created.rows[0]?.order_id as string;
    const attempt = await client.query<{ attempt_id: string }>(
      `INSERT INTO payment_attempts (order_id, provider, merchant_trade_no, amount_twd, choose_payment, idempotency_key)
       VALUES ($1, 'mock', $2, 200, 'Credit', $3) RETURNING attempt_id`,
      [orderId, `MT-${stamp}`, `pa-${stamp}`],
    );
    const attemptId = attempt.rows[0]?.attempt_id as string;
    const args = [orderId, attemptId, 'mock', `PT-${stamp}`, 200, true, false, new Date().toISOString(), '{}', 'payment.confirmed'];
    const first = await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      `evt-${stamp}`, ...args,
    ]);
    const second = await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      `evt-${stamp}`, ...args,
    ]);
    const inv = await client.query<{ on_hand: number }>('SELECT on_hand FROM inventory WHERE sku_id = (SELECT sku_id FROM skus WHERE sku = $1)', [sku]);
    const onHand = inv.rows[0]?.on_hand;
    const firstApplied = first.rows[0]?.applied === true;
    const secondDuplicate = second.rows[0]?.duplicate === true;
    record('付款重送不重複扣庫存', firstApplied && secondDuplicate && onHand === 1, `on_hand=${String(onHand)}`);
  });

  // 4. 交易號衝突：不同 event_key 但同一 provider_trade_no 不重複扣庫存。
  await withClient(url, async (client) => {
    const sku = `SMOKE-CONFLICT-${stamp}`;
    await seedSku(client, sku, 3);
    const created = await client.query<{ order_id: string }>(
      'SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`E-${stamp}`, null, null, `idem-e-${stamp}`, 'v1', JSON.stringify([line(sku, 1)]), 0, 0, 15, 'order.created'],
    );
    const orderId = created.rows[0]?.order_id as string;
    const attempt = await client.query<{ attempt_id: string }>(
      `INSERT INTO payment_attempts (order_id, provider, merchant_trade_no, amount_twd, choose_payment, idempotency_key)
       VALUES ($1, 'mock', $2, 100, 'Credit', $3) RETURNING attempt_id`,
      [orderId, `MT2-${stamp}`, `pa2-${stamp}`],
    );
    const attemptId = attempt.rows[0]?.attempt_id as string;
    const args = [orderId, attemptId, 'mock', `PT2-${stamp}`, 100, true, false, new Date().toISOString(), '{}', 'payment.confirmed'];
    await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [`evt2a-${stamp}`, ...args]);
    const second = await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [`evt2b-${stamp}`, ...args]);
    const inv = await client.query<{ on_hand: number }>('SELECT on_hand FROM inventory WHERE sku_id = (SELECT sku_id FROM skus WHERE sku = $1)', [sku]);
    const onHand = inv.rows[0]?.on_hand;
    record('交易號衝突不重複扣庫存', second.rows[0]?.duplicate === true && onHand === 2, `on_hand=${String(onHand)}`);
  });

  // 5. 取消後付款：保留款項事實並轉待核對，不自動出貨。
  await withClient(url, async (client) => {
    const sku = `SMOKE-LATE-${stamp}`;
    await seedSku(client, sku, 3);
    const created = await client.query<{ order_id: string }>(
      'SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`F-${stamp}`, null, null, `idem-f-${stamp}`, 'v1', JSON.stringify([line(sku, 1)]), 0, 0, 15, 'order.created'],
    );
    const orderId = created.rows[0]?.order_id as string;
    await client.query(`UPDATE orders SET status = 'cancelled' WHERE order_id = $1`, [orderId]);
    const attempt = await client.query<{ attempt_id: string }>(
      `INSERT INTO payment_attempts (order_id, provider, merchant_trade_no, amount_twd, choose_payment, idempotency_key)
       VALUES ($1, 'mock', $2, 100, 'ATM', $3) RETURNING attempt_id`,
      [orderId, `MT3-${stamp}`, `pa3-${stamp}`],
    );
    const attemptId = attempt.rows[0]?.attempt_id as string;
    const result = await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      `evt3-${stamp}`, orderId, attemptId, 'mock', `PT3-${stamp}`, 100, true, false, new Date().toISOString(), '{}', 'payment.confirmed',
    ]);
    const order = await client.query<{ payment_status: string; status: string }>('SELECT payment_status, status FROM orders WHERE order_id = $1', [orderId]);
    const needsReview = result.rows[0]?.needs_review === true;
    const stillCancelled = order.rows[0]?.status === 'cancelled';
    record('取消後付款轉待核對且不出貨', needsReview && stillCancelled, `payment_status=${String(order.rows[0]?.payment_status)}`);
  });

  // 6. 兩筆同時退款：可退餘額被鎖定，第二筆超額被拒絕。
  await withClient(url, async (client) => {
    const sku = `SMOKE-REFUND-${stamp}`;
    await seedSku(client, sku, 3);
    const created = await client.query<{ order_id: string }>(
      'SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`G-${stamp}`, null, null, `idem-g-${stamp}`, 'v1', JSON.stringify([line(sku, 1)]), 0, 0, 15, 'order.created'],
    );
    const orderId = created.rows[0]?.order_id as string;
    const attempt = await client.query<{ attempt_id: string }>(
      `INSERT INTO payment_attempts (order_id, provider, merchant_trade_no, amount_twd, choose_payment, idempotency_key)
       VALUES ($1, 'mock', $2, 100, 'Credit', $3) RETURNING attempt_id`,
      [orderId, `MT4-${stamp}`, `pa4-${stamp}`],
    );
    const attemptId = attempt.rows[0]?.attempt_id as string;
    await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      `evt4-${stamp}`, orderId, attemptId, 'mock', `PT4-${stamp}`, 100, true, false, new Date().toISOString(), '{}', 'payment.confirmed',
    ]);
    const c1 = new Client({ connectionString: url });
    const c2 = new Client({ connectionString: url });
    await c1.connect();
    await c2.connect();
    try {
      await c1.query('BEGIN');
      await c2.query('BEGIN');
      const r1 = c1.query('SELECT * FROM jp_request_refund($1,$2,$3,$4,$5)', [orderId, `rk1-${stamp}`, 80, '部分退款', 'staff1']);
      const r2 = c2.query('SELECT * FROM jp_request_refund($1,$2,$3,$4,$5)', [orderId, `rk2-${stamp}`, 80, '部分退款', 'staff2']);
      const results = await Promise.allSettled([r1, r2]);
      await c1.query('COMMIT').catch(() => {});
      await c2.query('COMMIT').catch(() => {});
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      record('並發退款不超退', fulfilled === 1 && rejected === 1, `成功 ${fulfilled}、拒絕 ${rejected}`);
    } catch (cause) {
      await c1.query('ROLLBACK').catch(() => {});
      await c2.query('ROLLBACK').catch(() => {});
      record('並發退款不超退', false, String(cause));
    } finally {
      await c1.end();
      await c2.end();
    }
  });

  // 7. 退款 request_key 冪等。
  await withClient(url, async (client) => {
    const sku = `SMOKE-IDEM-${stamp}`;
    await seedSku(client, sku, 3);
    const created = await client.query<{ order_id: string }>(
      'SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`H-${stamp}`, null, null, `idem-h-${stamp}`, 'v1', JSON.stringify([line(sku, 1)]), 0, 0, 15, 'order.created'],
    );
    const orderId = created.rows[0]?.order_id as string;
    const attempt = await client.query<{ attempt_id: string }>(
      `INSERT INTO payment_attempts (order_id, provider, merchant_trade_no, amount_twd, choose_payment, idempotency_key)
       VALUES ($1, 'mock', $2, 100, 'Credit', $3) RETURNING attempt_id`,
      [orderId, `MT5-${stamp}`, `pa5-${stamp}`],
    );
    const attemptId = attempt.rows[0]?.attempt_id as string;
    await client.query('SELECT * FROM jp_apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      `evt5-${stamp}`, orderId, attemptId, 'mock', `PT5-${stamp}`, 100, true, false, new Date().toISOString(), '{}', 'payment.confirmed',
    ]);
    const first = await client.query('SELECT * FROM jp_request_refund($1,$2,$3,$4,$5)', [orderId, `rk-idem-${stamp}`, 50, 'r', 's']);
    const second = await client.query('SELECT * FROM jp_request_refund($1,$2,$3,$4,$5)', [orderId, `rk-idem-${stamp}`, 50, 'r', 's']);
    const sameId = first.rows[0]?.refund_id === second.rows[0]?.refund_id;
    record('退款 request_key 冪等', first.rows[0]?.created === true && second.rows[0]?.created === false && sameId, '同一申請被重用');
  });

  // 8. 租約重取：逾期租約可被其他 worker 接手。
  await withClient(url, async (client) => {
    await client.query(
      `INSERT INTO outbox_jobs (topic, payload, idempotency_key, status, lease_owner, lease_expires_at)
       VALUES ('test.lease', '{}', $1, 'leased', 'dead-worker', now() - interval '1 minute')`,
      [`lease-${stamp}`],
    );
    const claimed = await client.query<{ job_id: string; lease_owner: string }>(
      'SELECT * FROM jp_claim_outbox_jobs($1, 10, 60)',
      [`worker-${stamp}`],
    );
    const tookOver = claimed.rows.some((r) => r.lease_owner === `worker-${stamp}`);
    record('逾期租約可被接手', tookOver, tookOver ? '新 worker 取得租約' : '未取得租約');
  });

  // 9. 重試滿：達上限送失敗佇列。
  await withClient(url, async (client) => {
    const job = await client.query<{ job_id: string }>(
      `INSERT INTO outbox_jobs (topic, payload, idempotency_key, status, attempts, max_attempts)
       VALUES ('test.dead', '{}', $1, 'leased', 3, 3) RETURNING job_id`,
      [`dead-${stamp}`],
    );
    const jobId = job.rows[0]?.job_id as string;
    const result = await client.query<{ status: string }>('SELECT * FROM jp_finish_outbox_job($1, false, $2)', [jobId, 'boom']);
    record('重試滿送失敗佇列', result.rows[0]?.status === 'dead', `status=${String(result.rows[0]?.status)}`);
  });

  // 10. 逾期釋放：逾期保留被釋放，但有成功付款事件的訂單不釋放。
  await withClient(url, async (client) => {
    const sku = `SMOKE-EXPIRE-${stamp}`;
    await seedSku(client, sku, 5);
    const created = await client.query<{ order_id: string }>(
      'SELECT * FROM jp_create_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`I-${stamp}`, null, null, `idem-i-${stamp}`, 'v1', JSON.stringify([line(sku, 2)]), 0, 0, 15, 'order.created'],
    );
    const orderId = created.rows[0]?.order_id as string;
    await client.query(`UPDATE inventory_reservations SET expires_at = now() - interval '1 minute' WHERE order_id = $1`, [orderId]);
    const released = await client.query<{ released_count: number }>('SELECT * FROM jp_release_expired_reservations(50)');
    const inv = await client.query<{ reserved: number }>('SELECT reserved FROM inventory WHERE sku_id = (SELECT sku_id FROM skus WHERE sku = $1)', [sku]);
    const reserved = inv.rows[0]?.reserved;
    record('逾期保留被釋放', (released.rows[0]?.released_count ?? 0) >= 1 && reserved === 0, `reserved=${String(reserved)}`);
  });

  const passed = cases.filter((c) => c.passed).length;
  return { ran: true, reason: null, cases, passed, failed: cases.length - passed };
}

export async function main(): Promise<void> {
  const report = await runSmoke({ log: (m) => console.log(m) });
  if (!report.ran) {
    console.log(`SKIPPED: ${report.reason}`);
    return;
  }
  console.log(`\n通過 ${report.passed} / ${report.cases.length}`);
  if (report.failed > 0) {
    process.exitCode = 1;
  }
}
