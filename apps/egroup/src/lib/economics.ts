import { query } from './db.ts';

/**
 * 計畫書第十三章的實際單位經濟。
 * 示範模型是規劃假設，這裡算的是真實交付訂單的平均值，
 * 兩者必須並列，避免把假設當成結果對外說明。
 */
export type ActualUnitEconomics = {
  delivered_orders: number;
  avg_ticket_twd: number;
  avg_product_cost_twd: number;
  avg_refund_twd: number;
  avg_referral_twd: number;
  avg_scrap_twd: number;
  avg_contribution_twd: number;
};

export async function getActualUnitEconomics(days = 30): Promise<ActualUnitEconomics> {
  const rows = await query<ActualUnitEconomics>(
    `WITH delivered AS (
       SELECT o.id, o.total_twd
         FROM orders o
        WHERE o.status = 'delivered'
          AND o.created_at >= now() - ($1::int * interval '1 day')
     ),
     cogs AS (
       SELECT oi.order_id, SUM(oi.quantity * p.cost_twd)::int AS cogs
         FROM order_items oi
         JOIN products p ON p.sku = oi.sku
        GROUP BY oi.order_id
     ),
     refunded AS (
       SELECT order_id, SUM(amount_twd)::int AS refund
         FROM refunds WHERE status IN ('approved', 'completed') GROUP BY order_id
     ),
     referral_cost AS (
       SELECT order_id, SUM(reward_twd)::int AS referral
         FROM referrals WHERE status = 'approved' GROUP BY order_id
     ),
     scrap AS (
       SELECT SUM(m.quantity * p.cost_twd)::int AS scrap
         FROM inventory_movements m
         JOIN batches b ON b.id = m.batch_id
         JOIN products p ON p.sku = b.sku
        WHERE m.type = 'scrap'
          AND m.created_at >= now() - ($1::int * interval '1 day')
     ),
     totals AS (
       SELECT count(*)::int AS orders,
              COALESCE(SUM(d.total_twd), 0)::int AS revenue,
              COALESCE(SUM(c.cogs), 0)::int AS cogs,
              COALESCE(SUM(rf.refund), 0)::int AS refund,
              COALESCE(SUM(rc.referral), 0)::int AS referral
         FROM delivered d
         LEFT JOIN cogs c ON c.order_id = d.id
         LEFT JOIN refunded rf ON rf.order_id = d.id
         LEFT JOIN referral_cost rc ON rc.order_id = d.id
     )
     SELECT t.orders AS delivered_orders,
            CASE WHEN t.orders = 0 THEN 0 ELSE (t.revenue / t.orders)::int END AS avg_ticket_twd,
            CASE WHEN t.orders = 0 THEN 0 ELSE (t.cogs / t.orders)::int END AS avg_product_cost_twd,
            CASE WHEN t.orders = 0 THEN 0 ELSE (t.refund / t.orders)::int END AS avg_refund_twd,
            CASE WHEN t.orders = 0 THEN 0 ELSE (t.referral / t.orders)::int END AS avg_referral_twd,
            CASE WHEN t.orders = 0 THEN 0 ELSE (COALESCE(s.scrap, 0) / t.orders)::int END AS avg_scrap_twd,
            CASE WHEN t.orders = 0 THEN 0
                 ELSE ((t.revenue - t.cogs - t.refund - t.referral - COALESCE(s.scrap, 0)) / t.orders)::int
            END AS avg_contribution_twd
       FROM totals t CROSS JOIN scrap s`,
    [days],
  );
  return (
    rows[0] ?? {
      delivered_orders: 0,
      avg_ticket_twd: 0,
      avg_product_cost_twd: 0,
      avg_refund_twd: 0,
      avg_referral_twd: 0,
      avg_scrap_twd: 0,
      avg_contribution_twd: 0,
    }
  );
}

export type StationBreakEvenRow = {
  code: string;
  name: string;
  type: string;
  monthly_fixed_cost_twd: number;
  station_fee_twd: number;
  orders_per_month: number | null;
  orders_per_day: number | null;
  actual_orders_30d: number;
  actual_orders_per_day: number;
  reached: boolean;
};

/**
 * 站點損益兩平：月固定成本除以每筆站點服務收入。
 * 同時列出近 30 天實際日均，讓「需要多少」與「實際多少」直接對照。
 */
export async function listStationBreakEven(): Promise<StationBreakEvenRow[]> {
  return query<StationBreakEvenRow>(
    `WITH actual AS (
       SELECT o.station_id, count(*)::int AS orders
         FROM orders o
        WHERE o.status = 'delivered'
          AND o.created_at >= now() - interval '30 days'
        GROUP BY o.station_id
     ),
     fee AS (
       SELECT station_id, max(station_fee_twd)::int AS fee
         FROM orders
        WHERE created_at >= now() - interval '90 days'
        GROUP BY station_id
     )
     SELECT st.code,
            st.name,
            st.type,
            st.monthly_fixed_cost_twd,
            COALESCE(f.fee, 0)::int AS station_fee_twd,
            CASE WHEN COALESCE(f.fee, 0) <= 0 THEN NULL
                 ELSE ceil(st.monthly_fixed_cost_twd::numeric / f.fee)::int END AS orders_per_month,
            CASE WHEN COALESCE(f.fee, 0) <= 0 THEN NULL
                 ELSE ceil(ceil(st.monthly_fixed_cost_twd::numeric / f.fee) / 30)::int END AS orders_per_day,
            COALESCE(a.orders, 0)::int AS actual_orders_30d,
            ROUND(COALESCE(a.orders, 0)::numeric / 30, 1)::float8 AS actual_orders_per_day,
            CASE WHEN COALESCE(f.fee, 0) <= 0 THEN false
                 ELSE COALESCE(a.orders, 0) >= ceil(st.monthly_fixed_cost_twd::numeric / f.fee)
            END AS reached
       FROM stations st
       LEFT JOIN actual a ON a.station_id = st.id
       LEFT JOIN fee f ON f.station_id = st.id
      WHERE st.status = 'active'
      ORDER BY st.code`,
  );
}
