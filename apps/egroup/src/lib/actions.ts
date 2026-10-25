'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkLabel, draftCustomerReply, generatePickupCode, hashPickupCode, matchAllergens } from '@eg/meal';
import { authenticate, clearSessionCookie, hashPassword, requireRole, setSessionCookie } from './auth.ts';
import { cartLines, readCart, writeCart } from './cart.ts';
import { dbErrorMessage, one, query, tx } from './db.ts';
import { upsertProduct } from './products.ts';
import { pickupSecret } from './secrets.ts';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function int(formData: FormData, key: string, fallback = 0): number {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function num(formData: FormData, key: string, fallback = 0): number {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function list(formData: FormData, key: string): string[] {
  return text(formData, key)
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function backPath(formData: FormData, fallback: string): string {
  const value = text(formData, 'redirectTo');
  return value.startsWith('/') ? value : fallback;
}

function finish(path: string, message: string, tone: 'ok' | 'error'): never {
  const url = new URL(path, 'http://egroup.local');
  url.searchParams.set(tone, message);
  redirect(url.pathname + url.search);
}

async function run(path: string, fn: () => Promise<string>): Promise<never> {
  try {
    const message = await fn();
    return finish(path, message, 'ok');
  } catch (error) {
    return finish(path, dbErrorMessage(error), 'error');
  }
}

function roleHome(role: string): string {
  if (role === 'supplier') return '/supplier';
  if (role === 'station') return '/station';
  if (role === 'admin') return '/admin';
  return '/';
}

export async function loginAction(formData: FormData): Promise<never> {
  const email = text(formData, 'email');
  const password = text(formData, 'password');
  if (email === '' || password === '') return finish('/login', '請輸入電子郵件與密碼。', 'error');

  const account = await authenticate(email, password);
  if (account === null) return finish('/login', '電子郵件或密碼不正確。', 'error');

  await setSessionCookie(account.id, account.role, account.session_epoch);
  redirect(roleHome(account.role));
}

export async function logoutAction(): Promise<never> {
  await clearSessionCookie();
  redirect('/login');
}

export async function registerAction(formData: FormData): Promise<never> {
  const name = text(formData, 'name');
  const email = text(formData, 'email').toLowerCase();
  const phone = text(formData, 'phone');
  const password = text(formData, 'password');
  const allergens = list(formData, 'allergens');

  if (name === '' || email === '' || password.length < 8) {
    return finish('/login?mode=register', '請填寫姓名、電子郵件，密碼至少 8 碼。', 'error');
  }

  try {
    const account = await tx(async (client) => {
      const existing = await client.query('SELECT 1 FROM accounts WHERE lower(email) = $1', [email]);
      if (existing.rowCount !== 0) throw new Error('EMAIL_TAKEN');

      const code = `EG${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
      const customer = await client.query<{ id: string }>(
        `INSERT INTO customers(name, phone, email, referral_code, allergens)
         VALUES ($1, NULLIF($2, ''), $3, $4, $5) RETURNING id`,
        [name, phone, email, code, allergens],
      );
      const customerId = customer.rows[0]?.id;
      if (customerId === undefined) throw new Error('CUSTOMER_CREATE_FAILED');

      const created = await client.query<{ id: string; role: string; session_epoch: number }>(
        `INSERT INTO accounts(email, password_hash, role, display_name, customer_id)
         VALUES ($1, $2, 'customer', $3, $4) RETURNING id, role, session_epoch`,
        [email, hashPassword(password), name, customerId],
      );
      const row = created.rows[0];
      if (row === undefined) throw new Error('ACCOUNT_CREATE_FAILED');
      return row;
    });

    await setSessionCookie(account.id, 'customer', account.session_epoch);
    redirect('/');
  } catch (error) {
    return finish('/login?mode=register', dbErrorMessage(error), 'error');
  }
}

export async function addToCartAction(formData: FormData): Promise<never> {
  const sku = text(formData, 'sku');
  const quantity = Math.max(1, Math.min(99, int(formData, 'quantity', 1)));
  const path = backPath(formData, '/products');
  const cart = await readCart();
  cart[sku] = Math.min(99, (cart[sku] ?? 0) + quantity);
  await writeCart(cart);
  revalidatePath('/cart');
  return finish(path, `已加入購物車：${sku} × ${quantity}`, 'ok');
}

export async function updateCartAction(formData: FormData): Promise<never> {
  const sku = text(formData, 'sku');
  const quantity = Math.max(0, Math.min(99, int(formData, 'quantity', 0)));
  const cart = await readCart();
  if (quantity === 0) delete cart[sku];
  else cart[sku] = quantity;
  await writeCart(cart);
  revalidatePath('/cart');
  return finish('/cart', '購物車已更新。', 'ok');
}

export async function removeFromCartAction(formData: FormData): Promise<never> {
  const sku = text(formData, 'sku');
  const cart = await readCart();
  delete cart[sku];
  await writeCart(cart);
  revalidatePath('/cart');
  return finish('/cart', '已移除商品。', 'ok');
}

export async function clearCartAction(): Promise<never> {
  await writeCart({});
  revalidatePath('/cart');
  return finish('/cart', '購物車已清空。', 'ok');
}

export async function placeOrderAction(formData: FormData): Promise<never> {
  const session = await requireRole(['customer']);
  const stationId = text(formData, 'stationId');
  const referralCode = text(formData, 'referralCode');
  const customerId = session.customerId;
  if (customerId === null) return finish('/checkout', '找不到會員資料。', 'error');

  const { lines } = await cartLines();
  if (lines.length === 0) return finish('/cart', '購物車為空。', 'error');

  const customer = await one<{ allergens: string[] }>('SELECT allergens FROM customers WHERE id = $1', [customerId]);
  const conflicts = lines.flatMap((line) => matchAllergens(line.product.allergens, customer?.allergens ?? []));
  if (conflicts.length > 0) {
    return finish('/checkout', `購物車含您的過敏原：${[...new Set(conflicts)].join('、')}。請先移除。`, 'error');
  }

  const code = generatePickupCode();
  const pickupHash = hashPickupCode(code, pickupSecret());
  const expires = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const idempotencyKey = `order:${customerId}:${randomUUID()}`;

  try {
    const result = await one<{ result: { order_id: string; order_no: string } }>(
      `SELECT eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULLIF($6,''),$7,$8) AS result`,
      [
        customerId,
        stationId,
        JSON.stringify(lines.map((line) => ({ sku: line.product.sku, quantity: line.quantity }))),
        pickupHash,
        expires,
        referralCode,
        idempotencyKey,
        session.email,
      ],
    );
    if (result === null) throw new Error('ORDER_CREATE_FAILED');
    await writeCart({});
    revalidatePath('/orders');
    redirect(`/orders/${result.result.order_no}?code=${code}`);
  } catch (error) {
    return finish('/checkout', dbErrorMessage(error), 'error');
  }
}

export async function payOrderAction(formData: FormData): Promise<never> {
  const session = await requireRole(['customer']);
  const orderNo = text(formData, 'orderNo');
  const path = `/orders/${orderNo}`;

  return run(path, async () => {
    const order = await one<{ id: string; customer_id: string; total_twd: number }>(
      'SELECT id, customer_id, total_twd FROM orders WHERE order_no = $1',
      [orderNo],
    );
    if (order === null) throw new Error('ORDER_NOT_FOUND');
    if (order.customer_id !== session.customerId) throw new Error('ORDER_NOT_FOUND');

    await one(
      `SELECT eg_pay_order($1,'demo_pay',$2,$3,$4)`,
      [order.id, `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`, `pay:${order.id}`, session.email],
    );
    revalidatePath(path);
    revalidatePath('/orders');
    return '付款完成（示範金流）。';
  });
}

export async function refundOrderAction(formData: FormData): Promise<never> {
  const session = await requireRole(['customer']);
  const orderNo = text(formData, 'orderNo');
  const amount = int(formData, 'amount');
  const reason = text(formData, 'reason');
  const path = `/orders/${orderNo}`;

  return run(path, async () => {
    const order = await one<{ id: string; customer_id: string }>('SELECT id, customer_id FROM orders WHERE order_no = $1', [orderNo]);
    if (order === null || order.customer_id !== session.customerId) throw new Error('ORDER_NOT_FOUND');
    if (amount <= 0) throw new Error('REFUND_AMOUNT_INVALID');
    if (reason === '') throw new Error('REFUND_REASON_REQUIRED');

    await one(`SELECT eg_refund_order($1,$2,$3,$4,$5)`, [
      order.id,
      amount,
      reason,
      `refund:${order.id}:${amount}:${randomUUID()}`,
      session.email,
    ]);
    revalidatePath(path);
    revalidatePath('/orders');
    return '退款已完成（示範金流）。';
  });
}

export async function updateProfileAction(formData: FormData): Promise<never> {
  const session = await requireRole(['customer']);
  const name = text(formData, 'name');
  const phone = text(formData, 'phone');
  const allergens = list(formData, 'allergens');

  return run('/account', async () => {
    if (name === '') throw new Error('NAME_REQUIRED');
    await query(
      'UPDATE customers SET name = $1, phone = NULLIF($2, \'\'), allergens = $3 WHERE id = $4',
      [name, phone, allergens, session.customerId],
    );
    revalidatePath('/account');
    return '會員資料已更新。';
  });
}

export async function markReadyAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const orderNo = text(formData, 'orderNo');
  const path = backPath(formData, '/station');

  return run(path, async () => {
    const order = await one<{ id: string; station_id: string }>('SELECT id, station_id FROM orders WHERE order_no = $1', [orderNo]);
    if (order === null) throw new Error('ORDER_NOT_FOUND');
    if (session.role === 'station' && order.station_id !== session.stationId) throw new Error('ORDER_NOT_FOUND');
    await one('SELECT eg_mark_order_ready($1,$2)', [order.id, session.email]);
    revalidatePath(path);
    return `訂單 ${orderNo} 已標記為可取貨。`;
  });
}

export async function deliverOrderAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const orderNo = text(formData, 'orderNo');
  const code = text(formData, 'code');
  const clientEventId = text(formData, 'clientEventId');
  const path = backPath(formData, '/station/deliver');

  return run(path, async () => {
    const order = await one<{ id: string; station_id: string }>('SELECT id, station_id FROM orders WHERE order_no = $1', [orderNo]);
    if (order === null) throw new Error('ORDER_NOT_FOUND');
    if (session.role === 'station' && order.station_id !== session.stationId) throw new Error('ORDER_NOT_FOUND');

    const result = await one<{ result: { status: string } }>(
      'SELECT eg_deliver_order($1,$2,$3,$4,NULLIF($5,\'\')) AS result',
      [order.id, code, pickupSecret(), session.email, clientEventId],
    );
    revalidatePath(path);
    revalidatePath('/station');
    return result?.result.status === 'duplicate' ? '此離線事件已補送過，未重複扣庫存。' : `訂單 ${orderNo} 已完成取貨核銷。`;
  });
}

export async function saveProductAction(formData: FormData): Promise<never> {
  const session = await requireRole(['supplier', 'admin']);
  const sku = text(formData, 'sku').toUpperCase();
  const name = text(formData, 'name');
  const category = text(formData, 'category');
  const description = text(formData, 'description');
  const price = int(formData, 'price');
  const cost = int(formData, 'cost');
  const weight = int(formData, 'weight');
  const calories = int(formData, 'calories');
  const protein = num(formData, 'protein');
  const fat = num(formData, 'fat');
  const satFat = text(formData, 'satFat') === '' ? null : num(formData, 'satFat');
  const carbs = num(formData, 'carbs');
  const sugar = text(formData, 'sugar') === '' ? null : num(formData, 'sugar');
  const sodium = int(formData, 'sodium');
  const allergens = list(formData, 'allergens');
  const storage = text(formData, 'storage') as 'frozen' | 'chilled' | 'ambient';
  const shelfLife = int(formData, 'shelfLife');
  const heating = text(formData, 'heating');
  const claims = list(formData, 'claims');
  const requestedStatus = text(formData, 'status');
  const path = backPath(formData, '/supplier/products');

  return run(path, async () => {
    if (sku === '' || name === '' || category === '') throw new Error('PRODUCT_FIELDS_REQUIRED');
    if (weight <= 0 || shelfLife <= 0) throw new Error('PRODUCT_WEIGHT_SHELF_LIFE_REQUIRED');
    if (!['frozen', 'chilled', 'ambient'].includes(storage)) throw new Error('PRODUCT_STORAGE_INVALID');
    if (price <= 0) throw new Error('PRODUCT_PRICE_INVALID');
    if (cost < 0) throw new Error('PRODUCT_COST_INVALID');
    if (cost > price) throw new Error('PRODUCT_COST_EXCEEDS_PRICE');
    if (requestedStatus !== '' && !['draft', 'active', 'suspended', 'recalled'].includes(requestedStatus)) {
      throw new Error('PRODUCT_STATUS_INVALID');
    }
    // 供應商不得自行上架：狀態維持原值（新商品為 draft），只有 admin 能指定。
    const status = session.role === 'admin' && requestedStatus !== '' ? requestedStatus : null;

    const label = checkLabel({
      sku,
      name,
      nutrition: {
        servingG: weight,
        calories,
        proteinG: protein,
        fatG: fat,
        carbsG: carbs,
        sodiumMg: sodium,
        ...(satFat === null ? {} : { saturatedFatG: satFat }),
        ...(sugar === null ? {} : { sugarG: sugar }),
      },
      allergens,
      storage,
      shelfLifeDays: shelfLife,
      heatingInstructions: heating,
      claims,
    });
    const blockers = label.issues.filter((issue) => issue.severity === 'blocker');
    if (blockers.length > 0) throw new Error(`LABEL_BLOCKED:${blockers.map((issue) => issue.message).join('；')}`);

    const supplierId = session.role === 'supplier' ? session.supplierId : text(formData, 'supplierId');
    if (supplierId === null || supplierId === '') throw new Error('SUPPLIER_REQUIRED');

    const applied = await upsertProduct(query, {
      sku,
      name,
      category,
      description,
      supplierId,
      price,
      cost,
      weight,
      calories,
      protein,
      fat,
      saturatedFat: satFat,
      carbs,
      sugar,
      sodium,
      allergens,
      storage,
      shelfLife,
      heating,
      claims,
      status,
      reviewedBy: session.displayName,
      guardSupplierId: session.role === 'supplier' ? session.supplierId : null,
    });
    // SKU 已存在但屬於其他供應商：不覆寫、也不透露該 SKU 的存在。
    if (!applied) throw new Error('PRODUCT_NOT_FOUND');
    revalidatePath(path);
    revalidatePath('/products');
    return `商品 ${sku} 已儲存。`;
  });
}

export async function createBatchAction(formData: FormData): Promise<never> {
  const session = await requireRole(['supplier', 'admin']);
  const sku = text(formData, 'sku');
  const lotNo = text(formData, 'lotNo');
  const producedOn = text(formData, 'producedOn');
  const expiresOn = text(formData, 'expiresOn');
  const quantity = int(formData, 'quantity');
  const stationId = text(formData, 'stationId');
  const temp = num(formData, 'temp');
  const path = backPath(formData, '/supplier/batches');

  return run(path, async () => {
    if (sku === '' || lotNo === '' || producedOn === '' || expiresOn === '') throw new Error('BATCH_FIELDS_REQUIRED');
    if (quantity <= 0) throw new Error('BATCH_QUANTITY_INVALID');
    if (expiresOn < producedOn) throw new Error('BATCH_EXPIRY_BEFORE_PRODUCTION');

    const supplierId = session.role === 'supplier' ? session.supplierId : text(formData, 'supplierId');
    if (supplierId === null || supplierId === '') throw new Error('SUPPLIER_REQUIRED');

    await tx(async (client) => {
      const batch = await client.query<{ id: string }>(
        `INSERT INTO batches(sku, supplier_id, lot_no, produced_on, expires_on, quantity_received,
           quantity_available, status, received_temp_c, station_id)
         VALUES ($1,$2,$3,$4,$5,$6,$6,'available',$7,NULLIF($8,'')::uuid)
         RETURNING id`,
        [sku, supplierId, lotNo, producedOn, expiresOn, quantity, temp, stationId],
      );
      const batchId = batch.rows[0]?.id;
      if (batchId === undefined) throw new Error('BATCH_CREATE_FAILED');
      await client.query(
        `INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor, note)
         VALUES ($1, NULLIF($2,'')::uuid, 'receive', $3, 'batch', $4, $5, '供應商建立批次')`,
        [batchId, stationId, quantity, lotNo, session.email],
      );
      await client.query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
        'supplier', session.email, 'batch.create', 'batch', batchId, null,
        JSON.stringify({ sku, lot_no: lotNo, quantity }), null,
      ]);
    });
    revalidatePath(path);
    return `批次 ${lotNo} 已建立。`;
  });
}

export async function uploadDocumentAction(formData: FormData): Promise<never> {
  const session = await requireRole(['supplier', 'admin']);
  const batchId = text(formData, 'batchId');
  const docType = text(formData, 'docType');
  const issuedOn = text(formData, 'issuedOn');
  const validUntil = text(formData, 'validUntil');
  const scope = text(formData, 'scope');
  const file = formData.get('file');
  const path = backPath(formData, '/supplier/documents');

  return run(path, async () => {
    if (batchId === '' || docType === '' || issuedOn === '') throw new Error('DOCUMENT_FIELDS_REQUIRED');
    const fileName = file instanceof File && file.size > 0 ? file.name : `${docType}-${issuedOn}.pdf`;
    const hash = file instanceof File && file.size > 0
      ? createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex')
      : createHash('sha256').update(`${batchId}:${docType}:${issuedOn}:${Date.now()}`).digest('hex');

    await query(
      `INSERT INTO inspection_docs(batch_id, doc_type, file_name, file_hash, issued_on, valid_until, scope, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::date,$7,$8)`,
      [batchId, docType, fileName, hash, issuedOn, validUntil, scope, session.email],
    );
    revalidatePath(path);
    return `檢驗文件 ${fileName} 已登錄。`;
  });
}

export async function createShipmentAction(formData: FormData): Promise<never> {
  const session = await requireRole(['supplier', 'admin']);
  const batchId = text(formData, 'batchId');
  const stationId = text(formData, 'stationId');
  const quantity = int(formData, 'quantity');
  const note = text(formData, 'note');
  const path = backPath(formData, '/supplier/shipments');

  return run(path, async () => {
    const supplierId = session.role === 'supplier' ? session.supplierId : text(formData, 'supplierId');
    if (supplierId === null || supplierId === '') throw new Error('SUPPLIER_REQUIRED');
    await one('SELECT eg_create_shipment($1,$2,$3,$4,$5,$6)', [supplierId, stationId, batchId, quantity, note, session.email]);
    revalidatePath(path);
    return '出貨單已建立，等待站點收貨。';
  });
}

export async function respondExceptionAction(formData: FormData): Promise<never> {
  const session = await requireRole(['supplier', 'admin']);
  const exceptionId = text(formData, 'exceptionId');
  const response = text(formData, 'response');
  const path = backPath(formData, '/supplier/exceptions');

  return run(path, async () => {
    if (response === '') throw new Error('EXCEPTION_RESPONSE_REQUIRED');
    await one('SELECT eg_respond_exception($1,$2,$3)', [exceptionId, response, session.email]);
    revalidatePath(path);
    return '異常回覆已送出。';
  });
}

export async function receiveShipmentAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const shipmentId = text(formData, 'shipmentId');
  const temp = num(formData, 'temp');
  const path = backPath(formData, '/station/receive');

  return run(path, async () => {
    await one('SELECT eg_receive_shipment($1,$2,$3)', [shipmentId, temp, session.email]);
    revalidatePath(path);
    revalidatePath('/station');
    return '收貨完成，批次已入庫。';
  });
}

export async function logTemperatureAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const stationId = session.role === 'station' ? session.stationId : text(formData, 'stationId');
  const batchId = text(formData, 'batchId');
  const temp = num(formData, 'temp');
  const duration = int(formData, 'duration');
  const status = text(formData, 'status');
  const action = text(formData, 'action');
  const path = backPath(formData, '/station/temperature');

  return run(path, async () => {
    if (stationId === null || stationId === '') throw new Error('STATION_REQUIRED');
    if (!['ok', 'warning', 'breach'].includes(status)) throw new Error('TEMPERATURE_STATUS_INVALID');
    if (action === '') throw new Error('TEMPERATURE_ACTION_REQUIRED');
    await one('SELECT eg_log_temperature($1,NULLIF($2,\'\')::uuid,$3,$4,$5,$6,$7)', [
      stationId, batchId, temp, duration, status, action, session.email,
    ]);
    revalidatePath(path);
    return '溫度紀錄已建立。';
  });
}

export async function quarantineBatchAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const batchId = text(formData, 'batchId');
  const reason = text(formData, 'reason');
  const path = backPath(formData, '/station/quarantine');

  return run(path, async () => {
    if (reason === '') throw new Error('QUARANTINE_REASON_REQUIRED');
    await one('SELECT eg_quarantine_batch($1,$2,$3)', [batchId, reason, session.email]);
    revalidatePath(path);
    revalidatePath('/station/inventory');
    return '批次已隔離，停止銷售與交付。';
  });
}

export async function releaseQuarantineAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const batchId = text(formData, 'batchId');
  const path = backPath(formData, '/station/quarantine');

  return run(path, async () => {
    await one('SELECT eg_release_quarantine($1,$2)', [batchId, session.email]);
    revalidatePath(path);
    revalidatePath('/station/inventory');
    return '批次已解除隔離。';
  });
}

export async function recordHeatingAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const orderNo = text(formData, 'orderNo');
  const sku = text(formData, 'sku');
  const equipmentId = text(formData, 'equipmentId');
  const duration = int(formData, 'duration');
  const coreTemp = num(formData, 'coreTemp');
  const path = backPath(formData, '/station/heating');

  return run(path, async () => {
    const stationId = session.role === 'station' ? session.stationId : text(formData, 'stationId');
    if (stationId === null || stationId === '') throw new Error('STATION_REQUIRED');
    const order = await one<{ id: string }>('SELECT id FROM orders WHERE order_no = $1', [orderNo]);
    if (order === null) throw new Error('ORDER_NOT_FOUND');
    await one('SELECT eg_record_heating($1,$2,$3,NULLIF($4,\'\')::uuid,$5,$6,$7)', [
      order.id, stationId, sku, equipmentId, duration, coreTemp, session.email,
    ]);
    revalidatePath(path);
    return '加熱紀錄已建立。';
  });
}

export async function addTrainingAction(formData: FormData): Promise<never> {
  const session = await requireRole(['station', 'admin']);
  const stationId = session.role === 'station' ? session.stationId : text(formData, 'stationId');
  const staffName = text(formData, 'staffName');
  const module = text(formData, 'module');
  const score = int(formData, 'score');
  const path = backPath(formData, '/station/training');

  return run(path, async () => {
    if (stationId === null || stationId === '') throw new Error('STATION_REQUIRED');
    if (staffName === '' || module === '') throw new Error('TRAINING_FIELDS_REQUIRED');
    await query(
      `INSERT INTO training_records(station_id, staff_name, module, completed_at, score)
       VALUES ($1,$2,$3,now(),$4)`,
      [stationId, staffName, module, score],
    );
    revalidatePath(path);
    return '訓練紀錄已建立。';
  });
}

export async function createPurchaseOrderAction(formData: FormData): Promise<never> {
  await requireRole(['admin']);
  const supplierId = text(formData, 'supplierId');
  const sku = text(formData, 'sku');
  const quantity = int(formData, 'quantity');
  const unitCost = int(formData, 'unitCost');
  const expectedOn = text(formData, 'expectedOn');
  const path = backPath(formData, '/admin/procurement');

  return run(path, async () => {
    if (supplierId === '' || sku === '' || quantity <= 0) throw new Error('PURCHASE_ORDER_FIELDS_REQUIRED');
    await query(
      `INSERT INTO purchase_orders(supplier_id, sku, quantity, unit_cost_twd, status, expected_on)
       VALUES ($1,$2,$3,$4,'ordered',NULLIF($5,'')::date)`,
      [supplierId, sku, quantity, unitCost, expectedOn],
    );
    revalidatePath(path);
    return '採購單已建立。';
  });
}

export async function createRecallAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const batchId = text(formData, 'batchId');
  const reason = text(formData, 'reason');
  const path = backPath(formData, '/admin/quality');

  return run(path, async () => {
    if (reason === '') throw new Error('RECALL_REASON_REQUIRED');
    await one('SELECT eg_recall_batch($1,$2,$3)', [batchId, reason, session.email]);
    revalidatePath(path);
    revalidatePath('/products');
    revalidatePath('/recalls');
    return '召回已啟動，所有銷售與交付管道已封鎖。';
  });
}

export async function closeRecallAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const recallId = text(formData, 'recallId');
  const path = backPath(formData, '/admin/quality');

  return run(path, async () => {
    await one('SELECT eg_close_recall($1,$2)', [recallId, session.email]);
    revalidatePath(path);
    revalidatePath('/recalls');
    return '召回已結案。';
  });
}

export async function approveReferralAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const referralId = text(formData, 'referralId');
  const path = backPath(formData, '/admin/referrals');

  return run(path, async () => {
    await one('SELECT eg_approve_referral($1,$2)', [referralId, session.email]);
    revalidatePath(path);
    return '推薦獎勵已核准並入點。';
  });
}

export async function reverseReferralAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const referralId = text(formData, 'referralId');
  const reason = text(formData, 'reason');
  const path = backPath(formData, '/admin/referrals');

  return run(path, async () => {
    if (reason === '') throw new Error('REFERRAL_REASON_REQUIRED');
    await one('SELECT eg_reverse_referral($1,$2,$3)', [referralId, session.email, reason]);
    revalidatePath(path);
    return '推薦獎勵已扣回。';
  });
}

export async function updateProductStatusAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const sku = text(formData, 'sku');
  const status = text(formData, 'status');
  const path = backPath(formData, '/admin/pricing');

  return run(path, async () => {
    if (!['draft', 'active', 'suspended', 'recalled'].includes(status)) throw new Error('PRODUCT_STATUS_INVALID');
    await query('UPDATE products SET status = $1, updated_at = now() WHERE sku = $2', [status, sku]);
    await query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
      'admin', session.email, 'product.status', 'product', sku, null, JSON.stringify({ status }), null,
    ]);
    revalidatePath(path);
    revalidatePath('/products');
    return `商品 ${sku} 狀態已更新為 ${status}。`;
  });
}

export async function settleStationAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const stationId = text(formData, 'stationId');
  const start = text(formData, 'start');
  const end = text(formData, 'end');
  const fee = int(formData, 'fee');
  const bonus = int(formData, 'bonus');
  const deduction = int(formData, 'deduction');
  const deductionReason = text(formData, 'deductionReason');
  const path = backPath(formData, '/admin/reconciliation');

  return run(path, async () => {
    if (stationId === '' || start === '' || end === '') throw new Error('SETTLEMENT_FIELDS_REQUIRED');
    const deductions = deduction > 0 ? [{ amount_twd: deduction, reason: deductionReason || '品質扣款' }] : [];
    await one('SELECT eg_settle_station($1,$2,$3,$4,$5,$6::jsonb,$7)', [
      stationId, start, end, fee, bonus, JSON.stringify(deductions), session.email,
    ]);
    revalidatePath(path);
    return '站點服務結算已建立。';
  });
}

export async function createStationAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const code = text(formData, 'code').toUpperCase();
  const name = text(formData, 'name');
  const type = text(formData, 'type');
  const address = text(formData, 'address');
  const line = text(formData, 'line');
  const mrt = text(formData, 'mrt');
  const walk = int(formData, 'walk');
  const corridor = text(formData, 'corridor');
  const capacity = int(formData, 'capacity', 100);
  const hours = text(formData, 'hours');
  const contact = text(formData, 'contact');
  const path = backPath(formData, '/admin/stations');

  return run(path, async () => {
    if (code === '' || name === '' || address === '') throw new Error('STATION_FIELDS_REQUIRED');
    if (!['A', 'B', 'C', 'D'].includes(type)) throw new Error('STATION_TYPE_INVALID');
    await query(
      `INSERT INTO stations(code, name, type, address, mrt_line, mrt_station, walk_minutes, corridor,
         capacity, opening_hours, contact, demand_score, cost_score, cold_chain_score,
         replenishment_score, competition_score, food_safety_pass, venue_pass)
       VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),$7,NULLIF($8,''),$9,NULLIF($10,''),NULLIF($11,''),
         $12,$13,$14,$15,$16,true,true)`,
      [code, name, type, address, line, mrt, walk, corridor, capacity, hours, contact,
        int(formData, 'demand'), int(formData, 'cost'), int(formData, 'cold'), int(formData, 'replenishment'), int(formData, 'competition')],
    );
    await query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
      'admin', session.email, 'station.create', 'station', code, null, JSON.stringify({ code, name, type }), null,
    ]);
    revalidatePath(path);
    return `站點 ${code} 已建立。`;
  });
}

export async function createAccountAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const email = text(formData, 'email').toLowerCase();
  const password = text(formData, 'password');
  const role = text(formData, 'role');
  const displayName = text(formData, 'displayName');
  const customerId = text(formData, 'customerId');
  const supplierId = text(formData, 'supplierId');
  const stationId = text(formData, 'stationId');
  const path = backPath(formData, '/admin/staff');

  return run(path, async () => {
    if (email === '' || password.length < 8 || displayName === '') throw new Error('ACCOUNT_FIELDS_REQUIRED');
    if (!['customer', 'supplier', 'station', 'admin'].includes(role)) throw new Error('ACCOUNT_ROLE_INVALID');
    await query(
      `INSERT INTO accounts(email, password_hash, role, display_name, customer_id, supplier_id, station_id)
       VALUES ($1,$2,$3,$4,NULLIF($5,'')::uuid,NULLIF($6,'')::uuid,NULLIF($7,'')::uuid)`,
      [email, hashPassword(password), role, displayName, customerId, supplierId, stationId],
    );
    await query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
      'admin', session.email, 'account.create', 'account', email, null, JSON.stringify({ role }), null,
    ]);
    revalidatePath(path);
    return `帳號 ${email} 已建立。`;
  });
}

export async function aiDraftAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const ticketId = text(formData, 'ticketId');
  const path = backPath(formData, '/admin/ai');

  return run(path, async () => {
    const ticket = await one<{
      id: string;
      subject: string;
      body: string;
      customer_name: string | null;
      order_no: string | null;
      order_status: string | null;
      station_name: string | null;
    }>(
      `SELECT t.id, t.subject, t.body, c.name AS customer_name, o.order_no, o.status AS order_status, st.name AS station_name
         FROM support_tickets t
         LEFT JOIN customers c ON c.id = t.customer_id
         LEFT JOIN orders o ON o.id = t.order_id
         LEFT JOIN stations st ON st.id = o.station_id
        WHERE t.id = $1`,
      [ticketId],
    );
    if (ticket === null) throw new Error('TICKET_NOT_FOUND');

    const draft = draftCustomerReply({
      orderNo: ticket.order_no ?? '（無訂單）',
      customerName: ticket.customer_name ?? '顧客',
      issue: `${ticket.subject}：${ticket.body}`,
      orderStatus: ticket.order_status ?? '未關聯訂單',
      stationName: ticket.station_name ?? '未指定站點',
    });

    await query('UPDATE support_tickets SET draft_reply = $1, status = \'in_progress\' WHERE id = $2', [draft, ticketId]);
    await query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
      'admin', session.email, 'ai.draft_reply', 'support_ticket', ticketId, null, JSON.stringify({ draft }), 'AI 僅產生草稿，須人工送出',
    ]);
    revalidatePath(path);
    return 'AI 草稿已產生，請人工覆核後送出。';
  });
}

export async function addMaintenanceAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const equipmentId = text(formData, 'equipmentId');
  const type = text(formData, 'type');
  const performedOn = text(formData, 'performedOn');
  const cost = int(formData, 'cost');
  const notes = text(formData, 'notes');
  const path = backPath(formData, '/assets');

  return run(path, async () => {
    if (equipmentId === '' || type === '' || performedOn === '') throw new Error('MAINTENANCE_FIELDS_REQUIRED');
    await query(
      `INSERT INTO maintenance_records(equipment_id, type, performed_on, cost_twd, notes)
       VALUES ($1,$2,$3,$4,NULLIF($5,''))`,
      [equipmentId, type, performedOn, cost, notes],
    );
    await query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
      'admin', session.email, 'equipment.maintenance', 'equipment', equipmentId, null,
      JSON.stringify({ type, performed_on: performedOn, cost_twd: cost }), null,
    ]);
    revalidatePath(path);
    return '保養紀錄已建立。';
  });
}

export async function updateEquipmentStatusAction(formData: FormData): Promise<never> {
  const session = await requireRole(['admin']);
  const equipmentId = text(formData, 'equipmentId');
  const status = text(formData, 'status');
  const path = backPath(formData, '/assets');

  return run(path, async () => {
    if (!['active', 'maintenance', 'retired', 'lost'].includes(status)) throw new Error('EQUIPMENT_STATUS_INVALID');
    await query('UPDATE equipment SET status = $1 WHERE id = $2', [status, equipmentId]);
    await query('SELECT eg_audit($1,$2,$3,$4,$5,$6,$7,$8)', [
      'admin', session.email, 'equipment.status', 'equipment', equipmentId, null, JSON.stringify({ status }), null,
    ]);
    revalidatePath(path);
    return '設備狀態已更新。';
  });
}
