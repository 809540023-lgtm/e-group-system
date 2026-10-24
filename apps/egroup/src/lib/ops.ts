import { one, query } from './db.ts';

export interface SupplierOverview {
  products: string;
  active_products: string;
  batches: string;
  expiring: string;
  in_transit: string;
  open_exceptions: string;
  documents: string;
  revenue: string;
}

export async function getSupplierOverview(supplierId: string): Promise<SupplierOverview> {
  const row = await one<SupplierOverview>(
    `SELECT
       (SELECT count(*) FROM products WHERE supplier_id = $1)::text AS products,
       (SELECT count(*) FROM products WHERE supplier_id = $1 AND status = 'active')::text AS active_products,
       (SELECT count(*) FROM batches WHERE supplier_id = $1 AND status = 'available')::text AS batches,
       (SELECT count(*) FROM batches WHERE supplier_id = $1 AND status = 'available' AND expires_on <= current_date + 3)::text AS expiring,
       (SELECT count(*) FROM shipments WHERE supplier_id = $1 AND status = 'in_transit')::text AS in_transit,
       (SELECT count(*) FROM supplier_exceptions WHERE supplier_id = $1 AND status = 'open')::text AS open_exceptions,
       (SELECT count(*) FROM inspection_docs d JOIN batches b ON b.id = d.batch_id WHERE b.supplier_id = $1)::text AS documents,
       (SELECT COALESCE(SUM(oi.line_total_twd), 0) FROM order_items oi
          JOIN batches b ON b.id = oi.batch_id
          JOIN orders o ON o.id = oi.order_id
         WHERE b.supplier_id = $1 AND o.payment_status IN ('paid','partially_refunded'))::text AS revenue`,
    [supplierId],
  );
  return row ?? {
    products: '0', active_products: '0', batches: '0', expiring: '0',
    in_transit: '0', open_exceptions: '0', documents: '0', revenue: '0',
  };
}

export interface SupplierBatchRow {
  id: string;
  sku: string;
  product_name: string;
  lot_no: string;
  produced_on: string;
  expires_on: string;
  quantity_received: number;
  quantity_available: number;
  quantity_reserved: number;
  status: string;
  received_temp_c: string | null;
  station_name: string | null;
  documents: string;
}

export async function listSupplierBatches(supplierId: string): Promise<SupplierBatchRow[]> {
  return query<SupplierBatchRow>(
    `SELECT b.id, b.sku, p.name AS product_name, b.lot_no, b.produced_on, b.expires_on,
            b.quantity_received, b.quantity_available, b.quantity_reserved, b.status,
            b.received_temp_c, st.name AS station_name,
            (SELECT count(*) FROM inspection_docs d WHERE d.batch_id = b.id)::text AS documents
       FROM batches b
       JOIN products p ON p.sku = b.sku
       LEFT JOIN stations st ON st.id = b.station_id
      WHERE b.supplier_id = $1
      ORDER BY b.expires_on, b.lot_no`,
    [supplierId],
  );
}

export async function listSupplierDocuments(supplierId: string): Promise<
  { id: string; doc_type: string; file_name: string; issued_on: string; valid_until: string | null; scope: string; lot_no: string; sku: string; uploaded_by: string }[]
> {
  return query(
    `SELECT d.id, d.doc_type, d.file_name, d.issued_on, d.valid_until, d.scope, b.lot_no, b.sku, d.uploaded_by
       FROM inspection_docs d
       JOIN batches b ON b.id = d.batch_id
      WHERE b.supplier_id = $1
      ORDER BY d.issued_on DESC`,
    [supplierId],
  );
}

export async function listSupplierShipments(supplierId: string): Promise<
  { id: string; lot_no: string; sku: string; station_name: string; quantity: number; status: string; dispatched_at: string; received_at: string | null; received_temp_c: string | null; note: string | null }[]
> {
  return query(
    `SELECT s.id, b.lot_no, b.sku, st.name AS station_name, s.quantity, s.status,
            s.dispatched_at, s.received_at, s.received_temp_c, s.note
       FROM shipments s
       JOIN batches b ON b.id = s.batch_id
       JOIN stations st ON st.id = s.station_id
      WHERE s.supplier_id = $1
      ORDER BY s.dispatched_at DESC`,
    [supplierId],
  );
}

export async function listSupplierExceptions(supplierId: string): Promise<
  { id: string; type: string; description: string; status: string; response: string | null; created_at: string; lot_no: string | null }[]
> {
  return query(
    `SELECT e.id, e.type, e.description, e.status, e.response, e.created_at, b.lot_no
       FROM supplier_exceptions e
       LEFT JOIN batches b ON b.id = e.batch_id
      WHERE e.supplier_id = $1
      ORDER BY e.created_at DESC`,
    [supplierId],
  );
}

export interface StationOps {
  ready: string;
  preparing: string;
  delivered_today: string;
  inventory: string;
  expiring: string;
  quarantined: string;
  breaches: string;
  pending_shipments: string;
  settlement_net: string;
}

export async function getStationOps(stationId: string): Promise<StationOps> {
  const row = await one<StationOps>(
    `SELECT
       (SELECT count(*) FROM orders WHERE station_id = $1 AND status = 'ready')::text AS ready,
       (SELECT count(*) FROM orders WHERE station_id = $1 AND status IN ('paid','preparing'))::text AS preparing,
       (SELECT count(*) FROM orders WHERE station_id = $1 AND status = 'delivered' AND updated_at::date = current_date)::text AS delivered_today,
       (SELECT COALESCE(SUM(quantity_available - quantity_reserved), 0) FROM batches WHERE station_id = $1 AND status = 'available')::text AS inventory,
       (SELECT count(*) FROM batches WHERE station_id = $1 AND status = 'available' AND expires_on <= current_date + 2)::text AS expiring,
       (SELECT count(*) FROM batches WHERE station_id = $1 AND status = 'quarantined')::text AS quarantined,
       (SELECT count(*) FROM temperature_events WHERE station_id = $1 AND status = 'breach' AND recorded_at > now() - interval '7 days')::text AS breaches,
       (SELECT count(*) FROM shipments WHERE station_id = $1 AND status = 'in_transit')::text AS pending_shipments,
       (SELECT COALESCE(SUM(net_twd), 0) FROM service_settlements WHERE station_id = $1)::text AS settlement_net`,
    [stationId],
  );
  return row ?? {
    ready: '0', preparing: '0', delivered_today: '0', inventory: '0', expiring: '0',
    quarantined: '0', breaches: '0', pending_shipments: '0', settlement_net: '0',
  };
}

export async function listStationOrders(stationId: string, statuses: readonly string[]): Promise<
  { id: string; order_no: string; customer_name: string; customer_phone: string | null; status: string; total_twd: number; pickup_code_expires_at: string; created_at: string; items: string }[]
> {
  return query(
    `SELECT o.id, o.order_no, c.name AS customer_name, c.phone AS customer_phone, o.status,
            o.total_twd, o.pickup_code_expires_at, o.created_at,
            (SELECT string_agg(p.name || ' x' || oi.quantity, '、' ORDER BY p.name)
               FROM order_items oi JOIN products p ON p.sku = oi.sku WHERE oi.order_id = o.id) AS items
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
      WHERE o.station_id = $1 AND o.status = ANY($2::text[])
      ORDER BY o.created_at`,
    [stationId, statuses],
  );
}

export async function listStationBatches(stationId: string): Promise<
  { id: string; sku: string; product_name: string; lot_no: string; expires_on: string; quantity_available: number; quantity_reserved: number; status: string; storage: string }[]
> {
  return query(
    `SELECT b.id, b.sku, p.name AS product_name, b.lot_no, b.expires_on,
            b.quantity_available, b.quantity_reserved, b.status, p.storage
       FROM batches b
       JOIN products p ON p.sku = b.sku
      WHERE b.station_id = $1
      ORDER BY b.expires_on, b.lot_no`,
    [stationId],
  );
}

export async function listStationTemperatures(stationId: string): Promise<
  { id: string; temp_c: string; duration_minutes: number; status: string; action: string; actor: string; recorded_at: string; lot_no: string | null }[]
> {
  return query(
    `SELECT t.id, t.temp_c, t.duration_minutes, t.status, t.action, t.actor, t.recorded_at, b.lot_no
       FROM temperature_events t
       LEFT JOIN batches b ON b.id = t.batch_id
      WHERE t.station_id = $1
      ORDER BY t.recorded_at DESC
      LIMIT 100`,
    [stationId],
  );
}

export async function listStationHeating(stationId: string): Promise<
  { id: string; order_no: string | null; sku: string; duration_seconds: number; core_temp_c: string | null; operator: string; created_at: string }[]
> {
  return query(
    `SELECT h.id, o.order_no, h.sku, h.duration_seconds, h.core_temp_c, h.operator, h.created_at
       FROM heating_records h
       LEFT JOIN orders o ON o.id = h.order_id
      WHERE h.station_id = $1
      ORDER BY h.created_at DESC
      LIMIT 100`,
    [stationId],
  );
}

export async function listStationSettlements(stationId: string): Promise<
  { id: string; period_start: string; period_end: string; delivered_count: number; service_fee_twd: number; quality_bonus_twd: number; deductions_twd: number; net_twd: number; status: string }[]
> {
  return query(
    `SELECT id, period_start, period_end, delivered_count, service_fee_twd, quality_bonus_twd,
            deductions_twd, net_twd, status
       FROM service_settlements WHERE station_id = $1 ORDER BY period_start DESC`,
    [stationId],
  );
}

export async function listStationTraining(stationId: string): Promise<
  { id: string; staff_name: string; module: string; completed_at: string | null; score: number | null }[]
> {
  return query(
    'SELECT id, staff_name, module, completed_at, score FROM training_records WHERE station_id = $1 ORDER BY created_at DESC',
    [stationId],
  );
}

export async function listStationShipments(stationId: string): Promise<
  { id: string; lot_no: string; sku: string; product_name: string; supplier_name: string; quantity: number; status: string; dispatched_at: string; received_at: string | null; received_temp_c: string | null }[]
> {
  return query(
    `SELECT s.id, b.lot_no, b.sku, p.name AS product_name, sup.name AS supplier_name, s.quantity,
            s.status, s.dispatched_at, s.received_at, s.received_temp_c
       FROM shipments s
       JOIN batches b ON b.id = s.batch_id
       JOIN products p ON p.sku = b.sku
       JOIN suppliers sup ON sup.id = s.supplier_id
      WHERE s.station_id = $1
      ORDER BY s.dispatched_at DESC`,
    [stationId],
  );
}

export async function listPurchaseOrders(): Promise<
  { id: string; supplier_name: string; sku: string; product_name: string; quantity: number; unit_cost_twd: number; status: string; expected_on: string | null; created_at: string }[]
> {
  return query(
    `SELECT po.id, s.name AS supplier_name, po.sku, p.name AS product_name, po.quantity,
            po.unit_cost_twd, po.status, po.expected_on, po.created_at
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN products p ON p.sku = po.sku
      ORDER BY po.created_at DESC`,
  );
}

export async function listSuppliers(): Promise<{ id: string; name: string; haccp_status: string; status: string }[]> {
  return query('SELECT id, name, haccp_status, status FROM suppliers ORDER BY name');
}

export async function listReferrals(): Promise<
  { id: string; referrer_name: string; referee_name: string; order_no: string; reward_twd: number; status: string; reason: string | null; created_at: string }[]
> {
  return query(
    `SELECT r.id, a.name AS referrer_name, b.name AS referee_name, o.order_no, r.reward_twd,
            r.status, r.reason, r.created_at
       FROM referrals r
       JOIN customers a ON a.id = r.referrer_customer_id
       JOIN customers b ON b.id = r.referee_customer_id
       JOIN orders o ON o.id = r.order_id
      ORDER BY r.created_at DESC`,
  );
}

export async function listSettlements(): Promise<
  { id: string; station_name: string; station_code: string; period_start: string; period_end: string; delivered_count: number; service_fee_twd: number; quality_bonus_twd: number; deductions_twd: number; net_twd: number; status: string }[]
> {
  return query(
    `SELECT ss.id, st.name AS station_name, st.code AS station_code, ss.period_start, ss.period_end,
            ss.delivered_count, ss.service_fee_twd, ss.quality_bonus_twd, ss.deductions_twd, ss.net_twd, ss.status
       FROM service_settlements ss
       JOIN stations st ON st.id = ss.station_id
      ORDER BY ss.period_start DESC`,
  );
}

export async function listEquipment(): Promise<
  { id: string; asset_no: string; type: string; serial_no: string; owner: string; station_name: string | null; purchase_price_twd: number | null; insurance_expires_on: string | null; next_maintenance_on: string | null; status: string; maintenance_count: string }[]
> {
  return query(
    `SELECT e.id, e.asset_no, e.type, e.serial_no, e.owner, st.name AS station_name,
            e.purchase_price_twd, e.insurance_expires_on, e.next_maintenance_on, e.status,
            (SELECT count(*) FROM maintenance_records m WHERE m.equipment_id = e.id)::text AS maintenance_count
       FROM equipment e
       LEFT JOIN stations st ON st.id = e.station_id
      ORDER BY e.asset_no`,
  );
}

export async function getEquipment(assetNo: string): Promise<{
  equipment: {
    id: string; asset_no: string; type: string; serial_no: string; owner: string; station_name: string | null;
    purchase_date: string | null; purchase_price_twd: number | null; insurance_policy: string | null;
    insurance_expires_on: string | null; last_calibrated_at: string | null; next_maintenance_on: string | null; status: string;
  } | null;
  leases: { id: string; lessor: string; lessee: string; monthly_rent_twd: number; start_date: string; end_date: string | null; status: string }[];
  maintenance: { id: string; type: string; performed_on: string; cost_twd: number; notes: string | null }[];
}> {
  const equipment = await one<{
    id: string; asset_no: string; type: string; serial_no: string; owner: string; station_name: string | null;
    purchase_date: string | null; purchase_price_twd: number | null; insurance_policy: string | null;
    insurance_expires_on: string | null; last_calibrated_at: string | null; next_maintenance_on: string | null; status: string;
  }>(
    `SELECT e.id, e.asset_no, e.type, e.serial_no, e.owner, st.name AS station_name, e.purchase_date,
            e.purchase_price_twd, e.insurance_policy, e.insurance_expires_on, e.last_calibrated_at,
            e.next_maintenance_on, e.status
       FROM equipment e
       LEFT JOIN stations st ON st.id = e.station_id
      WHERE e.asset_no = $1`,
    [assetNo],
  );
  if (equipment === null) return { equipment: null, leases: [], maintenance: [] };

  const leases = await query<{ id: string; lessor: string; lessee: string; monthly_rent_twd: number; start_date: string; end_date: string | null; status: string }>(
    'SELECT id, lessor, lessee, monthly_rent_twd, start_date, end_date, status FROM leases WHERE equipment_id = $1 ORDER BY start_date DESC',
    [equipment.id],
  );
  const maintenance = await query<{ id: string; type: string; performed_on: string; cost_twd: number; notes: string | null }>(
    'SELECT id, type, performed_on, cost_twd, notes FROM maintenance_records WHERE equipment_id = $1 ORDER BY performed_on DESC',
    [equipment.id],
  );
  return { equipment, leases, maintenance };
}

export async function listSupportTickets(): Promise<
  { id: string; subject: string; body: string; status: string; draft_reply: string | null; created_at: string; customer_name: string | null; order_no: string | null }[]
> {
  return query(
    `SELECT t.id, t.subject, t.body, t.status, t.draft_reply, t.created_at, c.name AS customer_name, o.order_no
       FROM support_tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN orders o ON o.id = t.order_id
      ORDER BY t.created_at DESC`,
  );
}

export async function listAccounts(): Promise<
  { id: string; email: string; role: string; display_name: string; active: boolean; created_at: string; scope: string | null }[]
> {
  return query(
    `SELECT a.id, a.email, a.role, a.display_name, a.active, a.created_at,
            COALESCE(s.name, st.name, c.name) AS scope
       FROM accounts a
       LEFT JOIN suppliers s ON s.id = a.supplier_id
       LEFT JOIN stations st ON st.id = a.station_id
       LEFT JOIN customers c ON c.id = a.customer_id
      ORDER BY a.role, a.email`,
  );
}

export async function listReplenishment(): Promise<
  { sku: string; name: string; storage: string; shelf_life_days: number; available: string; sold_7d: string; sold_28d: string; suggested: string }[]
> {
  return query(
    `SELECT p.sku, p.name, p.storage, p.shelf_life_days,
            COALESCE(SUM(b.quantity_available - b.quantity_reserved) FILTER (WHERE b.status = 'available'), 0)::text AS available,
            COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                       WHERE oi.sku = p.sku AND o.created_at > now() - interval '7 days'), 0)::text AS sold_7d,
            COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                       WHERE oi.sku = p.sku AND o.created_at > now() - interval '28 days'), 0)::text AS sold_28d,
            GREATEST(0, CEIL(COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                       WHERE oi.sku = p.sku AND o.created_at > now() - interval '7 days'), 0) / 7.0 * 3)
                     - COALESCE(SUM(b.quantity_available - b.quantity_reserved) FILTER (WHERE b.status = 'available'), 0))::text AS suggested
       FROM products p
       LEFT JOIN batches b ON b.sku = p.sku
      WHERE p.status = 'active'
      GROUP BY p.sku
      ORDER BY p.sku`,
  );
}

export async function listQualityBatches(): Promise<
  { id: string; sku: string; product_name: string; lot_no: string; expires_on: string; status: string; supplier_name: string; station_name: string | null; breaches: string }[]
> {
  return query(
    `SELECT b.id, b.sku, p.name AS product_name, b.lot_no, b.expires_on, b.status,
            s.name AS supplier_name, st.name AS station_name,
            (SELECT count(*) FROM temperature_events t WHERE t.batch_id = b.id AND t.status = 'breach')::text AS breaches
       FROM batches b
       JOIN products p ON p.sku = b.sku
       JOIN suppliers s ON s.id = b.supplier_id
       LEFT JOIN stations st ON st.id = b.station_id
      ORDER BY b.expires_on DESC`,
  );
}

export async function listRecallNotifications(): Promise<
  { recall_id: string; total: string; sent: string; failed: string }[]
> {
  return query(
    `SELECT recall_id, count(*)::text AS total,
            count(*) FILTER (WHERE status = 'sent')::text AS sent,
            count(*) FILTER (WHERE status = 'failed')::text AS failed
       FROM recall_notifications GROUP BY recall_id`,
  );
}

export async function listOfflineEvents(): Promise<
  { id: string; client_event_id: string; type: string; station_name: string; received_at: string; processed_at: string | null; result: string | null }[]
> {
  return query(
    `SELECT e.id, e.client_event_id, e.type, st.name AS station_name, e.received_at, e.processed_at, e.result
       FROM offline_events e
       JOIN stations st ON st.id = e.station_id
      ORDER BY e.received_at DESC
      LIMIT 50`,
  );
}
