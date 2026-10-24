import { query } from './db.ts';

/**
 * 計畫書第十七章的驗收指標。
 * 每個指標都附上目標值與是否達標，避免只看單一數字而失去判讀基準。
 */
export type Kpi = {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: 'percent' | 'count' | 'twd';
  readonly target: number;
  readonly comparator: 'gte' | 'lt';
  readonly passed: boolean;
  readonly detail: string;
};

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export async function getOnTimeReadyRate(): Promise<Kpi> {
  const row = await query<{ total: number; on_time: number }>(
    `WITH ready AS (
       SELECT o.id,
              o.promised_ready_at,
              (SELECT min(a.created_at) FROM audit_events a
                WHERE a.action = 'order.ready' AND a.entity_id = o.id::text) AS ready_at
         FROM orders o
        WHERE o.status IN ('ready', 'delivered')
     )
     SELECT count(*)::int AS total,
            count(*) FILTER (WHERE ready_at IS NOT NULL AND ready_at <= promised_ready_at)::int AS on_time
       FROM ready`,
  );
  const total = row[0]?.total ?? 0;
  const onTime = row[0]?.on_time ?? 0;
  const value = percent(onTime, total);
  return {
    key: 'on_time_ready',
    label: '訂單準時備妥率',
    value,
    unit: 'percent',
    target: 98,
    comparator: 'gte',
    passed: total > 0 && value >= 98,
    detail: `${onTime} / ${total} 筆在承諾時間前備妥`,
  };
}

export async function getInventoryDiscrepancyRate(): Promise<Kpi> {
  const row = await query<{ received_units: number; diff_units: number }>(
    `WITH ledger AS (
       SELECT b.id,
              b.quantity_received,
              b.quantity_reserved,
              COALESCE(SUM(CASE m.type
                             WHEN 'reserve' THEN m.quantity
                             WHEN 'release' THEN -m.quantity
                             WHEN 'deliver' THEN -m.quantity
                             ELSE 0
                           END), 0)::int AS ledger_reserved
         FROM batches b
         LEFT JOIN inventory_movements m ON m.batch_id = b.id
        GROUP BY b.id
     )
     SELECT COALESCE(SUM(quantity_received), 0)::int AS received_units,
            COALESCE(SUM(ABS(ledger_reserved - quantity_reserved)), 0)::int AS diff_units
       FROM ledger`,
  );
  const received = row[0]?.received_units ?? 0;
  const diff = row[0]?.diff_units ?? 0;
  const value = percent(diff, received);
  return {
    key: 'inventory_discrepancy',
    label: '帳物差異率',
    value,
    unit: 'percent',
    target: 0.5,
    comparator: 'lt',
    passed: received > 0 && value < 0.5,
    detail: `庫存異動帳與批次保留量相差 ${diff} 件 / 進貨 ${received} 件`,
  };
}

export async function getScrapRate(): Promise<Kpi> {
  const row = await query<{ scrap_value_twd: number; received_value_twd: number }>(
    `SELECT
       (SELECT COALESCE(SUM(m.quantity * p.cost_twd), 0)::int
          FROM inventory_movements m
          JOIN batches b ON b.id = m.batch_id
          JOIN products p ON p.sku = b.sku
         WHERE m.type = 'scrap') AS scrap_value_twd,
       (SELECT COALESCE(SUM(b.quantity_received * p.cost_twd), 0)::int
          FROM batches b
          JOIN products p ON p.sku = b.sku) AS received_value_twd`,
  );
  const scrap = row[0]?.scrap_value_twd ?? 0;
  const received = row[0]?.received_value_twd ?? 0;
  const value = percent(scrap, received);
  return {
    key: 'scrap_rate',
    label: '報廢金額占進貨金額',
    value,
    unit: 'percent',
    target: 3,
    comparator: 'lt',
    passed: received > 0 && value < 3,
    detail: `報廢 NT$${scrap.toLocaleString('zh-TW')} / 進貨 NT$${received.toLocaleString('zh-TW')}`,
  };
}

export async function getRepeatPurchaseRate(): Promise<Kpi> {
  const row = await query<{ customers: number; repeaters: number }>(
    `WITH windowed AS (
       SELECT customer_id, count(*)::int AS orders
         FROM orders
        WHERE status <> 'cancelled'
          AND created_at >= now() - interval '30 days'
        GROUP BY customer_id
     )
     SELECT count(*)::int AS customers,
            count(*) FILTER (WHERE orders >= 2)::int AS repeaters
       FROM windowed`,
  );
  const customers = row[0]?.customers ?? 0;
  const repeaters = row[0]?.repeaters ?? 0;
  const value = percent(repeaters, customers);
  return {
    key: 'repeat_purchase',
    label: '30 天回購率',
    value,
    unit: 'percent',
    target: 30,
    comparator: 'gte',
    passed: customers > 0 && value >= 30,
    detail: `近 30 天 ${repeaters} / ${customers} 位顧客下單 2 次以上`,
  };
}

export async function getTraceabilityCoverage(): Promise<Kpi> {
  const row = await query<{ total: number; traced: number }>(
    `WITH order_trace AS (
       SELECT o.id,
              bool_and(EXISTS (SELECT 1 FROM inspection_docs d WHERE d.batch_id = oi.batch_id)) AS traced
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status <> 'cancelled'
        GROUP BY o.id
     )
     SELECT count(*)::int AS total,
            count(*) FILTER (WHERE traced)::int AS traced
       FROM order_trace`,
  );
  const total = row[0]?.total ?? 0;
  const traced = row[0]?.traced ?? 0;
  const value = percent(traced, total);
  return {
    key: 'traceability',
    label: '有效訂單追溯覆蓋率',
    value,
    unit: 'percent',
    target: 100,
    comparator: 'gte',
    passed: total > 0 && value >= 100,
    detail: `${traced} / ${total} 筆訂單的所有批次都有檢驗文件`,
  };
}

export async function listKpis(): Promise<Kpi[]> {
  return Promise.all([
    getOnTimeReadyRate(),
    getInventoryDiscrepancyRate(),
    getScrapRate(),
    getRepeatPurchaseRate(),
    getTraceabilityCoverage(),
  ]);
}

export type StationEconomics = {
  station_id: string;
  code: string;
  name: string;
  type: string;
  delivered_orders: number;
  revenue_twd: number;
  avg_ticket_twd: number;
  cogs_twd: number;
  gross_margin_twd: number;
  refund_twd: number;
  referral_twd: number;
  scrap_twd: number;
  contribution_twd: number;
  contribution_per_order_twd: number;
};

/** 計畫書第十三章：按站型建立獨立損益，追蹤客單、毛利、退款、推薦成本與報廢。 */
export async function listStationEconomics(): Promise<StationEconomics[]> {
  return query<StationEconomics>(
    `WITH delivered AS (
       SELECT o.station_id,
              count(*)::int AS orders,
              COALESCE(SUM(o.total_twd), 0)::int AS revenue
         FROM orders o
        WHERE o.status = 'delivered'
        GROUP BY o.station_id
     ),
     cogs AS (
       SELECT o.station_id, COALESCE(SUM(oi.quantity * p.cost_twd), 0)::int AS cogs
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.sku = oi.sku
        WHERE o.status = 'delivered'
        GROUP BY o.station_id
     ),
     refunded AS (
       SELECT o.station_id, COALESCE(SUM(r.amount_twd), 0)::int AS refund
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
        WHERE r.status IN ('approved', 'completed')
        GROUP BY o.station_id
     ),
     referral_cost AS (
       SELECT o.station_id, COALESCE(SUM(rf.reward_twd), 0)::int AS referral
         FROM referrals rf
         JOIN orders o ON o.id = rf.order_id
        WHERE rf.status = 'approved'
        GROUP BY o.station_id
     ),
     scrap AS (
       SELECT m.station_id, COALESCE(SUM(m.quantity * p.cost_twd), 0)::int AS scrap
         FROM inventory_movements m
         JOIN batches b ON b.id = m.batch_id
         JOIN products p ON p.sku = b.sku
        WHERE m.type = 'scrap' AND m.station_id IS NOT NULL
        GROUP BY m.station_id
     )
     SELECT st.id AS station_id,
            st.code,
            st.name,
            st.type,
            COALESCE(d.orders, 0)::int AS delivered_orders,
            COALESCE(d.revenue, 0)::int AS revenue_twd,
            CASE WHEN COALESCE(d.orders, 0) = 0 THEN 0
                 ELSE (COALESCE(d.revenue, 0) / d.orders)::int END AS avg_ticket_twd,
            COALESCE(c.cogs, 0)::int AS cogs_twd,
            (COALESCE(d.revenue, 0) - COALESCE(c.cogs, 0))::int AS gross_margin_twd,
            COALESCE(rf.refund, 0)::int AS refund_twd,
            COALESCE(rc.referral, 0)::int AS referral_twd,
            COALESCE(sc.scrap, 0)::int AS scrap_twd,
            (COALESCE(d.revenue, 0) - COALESCE(c.cogs, 0) - COALESCE(rf.refund, 0)
              - COALESCE(rc.referral, 0) - COALESCE(sc.scrap, 0))::int AS contribution_twd,
            CASE WHEN COALESCE(d.orders, 0) = 0 THEN 0
                 ELSE ((COALESCE(d.revenue, 0) - COALESCE(c.cogs, 0) - COALESCE(rf.refund, 0)
                        - COALESCE(rc.referral, 0) - COALESCE(sc.scrap, 0)) / d.orders)::int
            END AS contribution_per_order_twd
       FROM stations st
       LEFT JOIN delivered d ON d.station_id = st.id
       LEFT JOIN cogs c ON c.station_id = st.id
       LEFT JOIN refunded rf ON rf.station_id = st.id
       LEFT JOIN referral_cost rc ON rc.station_id = st.id
       LEFT JOIN scrap sc ON sc.station_id = st.id
      ORDER BY st.code`,
  );
}

export type AuditExportRow = {
  id: string;
  created_at: string;
  actor_type: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
};

export async function listAuditEventsForExport(limit = 5000): Promise<AuditExportRow[]> {
  return query<AuditExportRow>(
    `SELECT id::text,
            to_char(created_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS') AS created_at,
            actor_type, actor_id, action, entity_type, entity_id, reason
       FROM audit_events
      ORDER BY id DESC
      LIMIT $1`,
    [limit],
  );
}
