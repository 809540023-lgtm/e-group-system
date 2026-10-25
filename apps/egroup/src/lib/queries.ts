import { one, query } from './db.ts';

export interface ProductRow {
  sku: string;
  name: string;
  category: string;
  description: string;
  supplier_id: string;
  supplier_name: string;
  price_twd: number;
  cost_twd: number;
  weight_g: number;
  calories: number;
  protein_g: string;
  fat_g: string;
  saturated_fat_g: string | null;
  carbs_g: string;
  sugar_g: string | null;
  sodium_mg: number;
  allergens: string[];
  storage: 'frozen' | 'chilled' | 'ambient';
  shelf_life_days: number;
  heating_instructions: string;
  claims: string[];
  status: string;
  available: string;
}

export interface StationRow {
  id: string;
  code: string;
  name: string;
  type: 'A' | 'B' | 'C' | 'D';
  address: string;
  mrt_line: string | null;
  mrt_station: string | null;
  walk_minutes: number | null;
  corridor: string | null;
  status: string;
  capacity: number;
  opening_hours: string | null;
  contact: string | null;
  demand_score: number;
  cost_score: number;
  cold_chain_score: number;
  replenishment_score: number;
  competition_score: number;
  food_safety_pass: boolean;
  venue_pass: boolean;
  lat: string | null;
  lng: string | null;
}

export interface OrderRow {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  station_id: string;
  station_name: string;
  station_code: string;
  status: string;
  subtotal_twd: number;
  delivery_fee_twd: number;
  station_fee_twd: number;
  total_twd: number;
  payment_status: string;
  pickup_code_used_at: string | null;
  pickup_code_expires_at: string;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  sku: string;
  name: string;
  batch_id: string;
  lot_no: string;
  quantity: number;
  unit_price_twd: number;
  line_total_twd: number;
}

export async function listProducts(filters: {
  search?: string;
  category?: string;
  storage?: string;
  excludeAllergens?: readonly string[];
  includeInactive?: boolean;
  supplierId?: string;
} = {}): Promise<ProductRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.includeInactive !== true) conditions.push("p.status = 'active'");
  if (filters.supplierId !== undefined && filters.supplierId !== '') {
    params.push(filters.supplierId);
    conditions.push(`p.supplier_id = $${params.length}::uuid`);
  }
  if (filters.search !== undefined && filters.search.trim() !== '') {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }
  if (filters.category !== undefined && filters.category !== '') {
    params.push(filters.category);
    conditions.push(`p.category = $${params.length}`);
  }
  if (filters.storage !== undefined && filters.storage !== '') {
    params.push(filters.storage);
    conditions.push(`p.storage = $${params.length}`);
  }
  if (filters.excludeAllergens !== undefined && filters.excludeAllergens.length > 0) {
    params.push(filters.excludeAllergens);
    conditions.push(`NOT (p.allergens && $${params.length}::text[])`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return query<ProductRow>(
    `SELECT p.sku, p.name, p.category, p.description, p.supplier_id, s.name AS supplier_name,
            p.price_twd, p.cost_twd, p.weight_g, p.calories, p.protein_g, p.fat_g, p.saturated_fat_g,
            p.carbs_g, p.sugar_g, p.sodium_mg, p.allergens, p.storage, p.shelf_life_days,
            p.heating_instructions, p.claims, p.status,
            COALESCE(SUM(b.quantity_available - b.quantity_reserved) FILTER (
              WHERE b.status = 'available' AND b.expires_on >= current_date
            ), 0)::text AS available
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN batches b ON b.sku = p.sku
       ${where}
      GROUP BY p.sku, s.name
      ORDER BY p.category, p.sku`,
    params,
  );
}

export async function getProduct(sku: string): Promise<ProductRow | null> {
  return one<ProductRow>(
    `SELECT p.sku, p.name, p.category, p.description, p.supplier_id, s.name AS supplier_name,
            p.price_twd, p.cost_twd, p.weight_g, p.calories, p.protein_g, p.fat_g, p.saturated_fat_g,
            p.carbs_g, p.sugar_g, p.sodium_mg, p.allergens, p.storage, p.shelf_life_days,
            p.heating_instructions, p.claims, p.status,
            COALESCE(SUM(b.quantity_available - b.quantity_reserved) FILTER (
              WHERE b.status = 'available' AND b.expires_on >= current_date
            ), 0)::text AS available
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN batches b ON b.sku = p.sku
      WHERE p.sku = $1
      GROUP BY p.sku, s.name`,
    [sku],
  );
}

export async function listStations(): Promise<StationRow[]> {
  return query<StationRow>('SELECT * FROM stations ORDER BY code');
}

export async function getStation(id: string): Promise<StationRow | null> {
  return one<StationRow>('SELECT * FROM stations WHERE id = $1', [id]);
}

export async function listOrdersForCustomer(customerId: string): Promise<OrderRow[]> {
  return query<OrderRow>(
    `SELECT o.id, o.order_no, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
            o.station_id, st.name AS station_name, st.code AS station_code, o.status,
            o.subtotal_twd, o.delivery_fee_twd, o.station_fee_twd, o.total_twd, o.payment_status,
            o.pickup_code_used_at, o.pickup_code_expires_at, o.referral_code, o.created_at, o.updated_at
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN stations st ON st.id = o.station_id
      WHERE o.customer_id = $1
      ORDER BY o.created_at DESC`,
    [customerId],
  );
}

export async function getOrderByNo(orderNo: string): Promise<OrderRow | null> {
  return one<OrderRow>(
    `SELECT o.id, o.order_no, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
            o.station_id, st.name AS station_name, st.code AS station_code, o.status,
            o.subtotal_twd, o.delivery_fee_twd, o.station_fee_twd, o.total_twd, o.payment_status,
            o.pickup_code_used_at, o.pickup_code_expires_at, o.referral_code, o.created_at, o.updated_at
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN stations st ON st.id = o.station_id
      WHERE o.order_no = $1`,
    [orderNo],
  );
}

export async function getOrderItems(orderId: string): Promise<OrderItemRow[]> {
  return query<OrderItemRow>(
    `SELECT oi.id, oi.sku, p.name, oi.batch_id, b.lot_no, oi.quantity, oi.unit_price_twd, oi.line_total_twd
       FROM order_items oi
       JOIN products p ON p.sku = oi.sku
       JOIN batches b ON b.id = oi.batch_id
      WHERE oi.order_id = $1
      ORDER BY oi.sku`,
    [orderId],
  );
}

export async function listRecalls(): Promise<
  { id: string; sku: string; product_name: string; lot_no: string | null; reason: string; status: string; started_at: string; closed_at: string | null; created_by: string }[]
> {
  return query(
    `SELECT r.id, r.sku, p.name AS product_name, b.lot_no, r.reason, r.status, r.started_at, r.closed_at, r.created_by
       FROM recalls r
       JOIN products p ON p.sku = r.sku
       LEFT JOIN batches b ON b.id = r.batch_id
      ORDER BY r.started_at DESC`,
  );
}

export async function getTrace(batchId: string): Promise<{
  batch: {
    id: string;
    sku: string;
    product_name: string;
    supplier_name: string;
    lot_no: string;
    produced_on: string;
    expires_on: string;
    status: string;
    received_temp_c: string | null;
    station_name: string | null;
  } | null;
  documents: { id: string; doc_type: string; file_name: string; issued_on: string; valid_until: string | null; scope: string }[];
  movements: { id: string; type: string; quantity: number; actor: string; note: string | null; created_at: string }[];
  temperatures: { id: string; temp_c: string; status: string; action: string; recorded_at: string }[];
}> {
  const batch = await one<{
    id: string;
    sku: string;
    product_name: string;
    supplier_name: string;
    lot_no: string;
    produced_on: string;
    expires_on: string;
    status: string;
    received_temp_c: string | null;
    station_name: string | null;
  }>(
    `SELECT b.id, b.sku, p.name AS product_name, s.name AS supplier_name, b.lot_no, b.produced_on,
            b.expires_on, b.status, b.received_temp_c, st.name AS station_name
       FROM batches b
       JOIN products p ON p.sku = b.sku
       JOIN suppliers s ON s.id = b.supplier_id
       LEFT JOIN stations st ON st.id = b.station_id
      WHERE b.id = $1`,
    [batchId],
  );

  const documents = await query<{ id: string; doc_type: string; file_name: string; issued_on: string; valid_until: string | null; scope: string }>(
    'SELECT id, doc_type, file_name, issued_on, valid_until, scope FROM inspection_docs WHERE batch_id = $1 ORDER BY issued_on DESC',
    [batchId],
  );
  const movements = await query<{ id: string; type: string; quantity: number; actor: string; note: string | null; created_at: string }>(
    'SELECT id, type, quantity, actor, note, created_at FROM inventory_movements WHERE batch_id = $1 ORDER BY created_at DESC',
    [batchId],
  );
  const temperatures = await query<{ id: string; temp_c: string; status: string; action: string; recorded_at: string }>(
    'SELECT id, temp_c, status, action, recorded_at FROM temperature_events WHERE batch_id = $1 ORDER BY recorded_at DESC',
    [batchId],
  );

  return { batch, documents, movements, temperatures };
}

export async function listAuditEvents(limit = 100): Promise<
  { id: string; actor_type: string; actor_id: string; action: string; entity_type: string; entity_id: string; reason: string | null; created_at: string }[]
> {
  return query(
    `SELECT id::text, actor_type, actor_id, action, entity_type, entity_id, reason, created_at
       FROM audit_events ORDER BY id DESC LIMIT $1`,
    [limit],
  );
}

export async function getCustomer(customerId: string): Promise<{
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  referral_code: string;
  points: number;
  allergens: string[];
  referred_by_name: string | null;
} | null> {
  return one(
    `SELECT c.id, c.name, c.phone, c.email, c.referral_code, c.points, c.allergens,
            r.name AS referred_by_name
       FROM customers c
       LEFT JOIN customers r ON r.id = c.referred_by
      WHERE c.id = $1`,
    [customerId],
  );
}

export async function getSupplier(supplierId: string): Promise<{
  id: string;
  name: string;
  food_business_reg_no: string | null;
  haccp_status: string;
  insurance_expires_on: string | null;
  recall_contact: string | null;
  status: string;
} | null> {
  return one('SELECT * FROM suppliers WHERE id = $1', [supplierId]);
}

export async function getStationSummary(stationId: string): Promise<{
  ready: string;
  delivered_today: string;
  inventory: string;
  open_recalls: string;
  breaches: string;
}> {
  const row = await one<{ ready: string; delivered_today: string; inventory: string; open_recalls: string; breaches: string }>(
    `SELECT
       (SELECT count(*) FROM orders WHERE station_id = $1 AND status IN ('paid','preparing','ready'))::text AS ready,
       (SELECT count(*) FROM orders WHERE station_id = $1 AND status = 'delivered' AND created_at::date = current_date)::text AS delivered_today,
       (SELECT COALESCE(SUM(quantity_available - quantity_reserved), 0) FROM batches WHERE station_id = $1 AND status = 'available')::text AS inventory,
       (SELECT count(*) FROM recalls WHERE status = 'open')::text AS open_recalls,
       (SELECT count(*) FROM temperature_events WHERE station_id = $1 AND status = 'breach' AND recorded_at > now() - interval '7 days')::text AS breaches`,
    [stationId],
  );
  return row ?? { ready: '0', delivered_today: '0', inventory: '0', open_recalls: '0', breaches: '0' };
}

export async function getAdminSummary(): Promise<{
  revenue: string;
  orders: string;
  customers: string;
  active_products: string;
  open_recalls: string;
  pending_referrals: string;
  low_stock: string;
  breaches: string;
}> {
  const row = await one<{
    revenue: string;
    orders: string;
    customers: string;
    active_products: string;
    open_recalls: string;
    pending_referrals: string;
    low_stock: string;
    breaches: string;
  }>(
    `SELECT
       (SELECT COALESCE(SUM(total_twd), 0) FROM orders WHERE payment_status IN ('paid','partially_refunded'))::text AS revenue,
       (SELECT count(*) FROM orders)::text AS orders,
       (SELECT count(*) FROM customers)::text AS customers,
       (SELECT count(*) FROM products WHERE status = 'active')::text AS active_products,
       (SELECT count(*) FROM recalls WHERE status = 'open')::text AS open_recalls,
       (SELECT count(*) FROM referrals WHERE status = 'pending')::text AS pending_referrals,
       (SELECT count(*) FROM batches WHERE status = 'available' AND quantity_available - quantity_reserved < 10)::text AS low_stock,
       (SELECT count(*) FROM temperature_events WHERE status = 'breach' AND recorded_at > now() - interval '7 days')::text AS breaches`,
  );
  return row ?? {
    revenue: '0',
    orders: '0',
    customers: '0',
    active_products: '0',
    open_recalls: '0',
    pending_referrals: '0',
    low_stock: '0',
    breaches: '0',
  };
}
