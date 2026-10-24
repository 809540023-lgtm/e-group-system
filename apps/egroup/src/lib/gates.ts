import { query } from './db.ts';

/**
 * 計畫書第十七章的擴點關卡與停止或縮減條件。
 * 關卡是「能不能開下一站」的門檻，停止條件是「要不要縮減或停賣」的門檻，
 * 兩者方向相反，必須分開呈現，避免用同一組數字互相抵銷。
 */
export type GateStatus = 'pass' | 'fail' | 'unknown';

export type Gate = {
  readonly key: string;
  readonly label: string;
  readonly status: GateStatus;
  readonly detail: string;
  readonly evidence: string;
};

export type StopCondition = {
  readonly key: string;
  readonly label: string;
  readonly triggered: boolean;
  readonly detail: string;
  readonly action: string;
};

const WEEKS = 8;

type WeeklyRow = {
  week_start: string;
  orders: number;
  contribution_twd: number;
  contribution_per_order_twd: number;
};

/**
 * 關卡一：連續 8 週單筆貢獻為正。
 * 以交付訂單為分母，扣除商品成本、退款、推薦獎勵與報廢。
 * 沒有交付訂單的週次視為未達標，不能用其他週的高貢獻補平。
 */
export async function getWeeklyContribution(): Promise<WeeklyRow[]> {
  return query<WeeklyRow>(
    `WITH weeks AS (
       SELECT generate_series(0, $1::int - 1) AS back
     ),
     bounds AS (
       SELECT (date_trunc('week', now())::date - (back * 7)) AS week_start FROM weeks
     ),
     delivered AS (
       SELECT o.id,
              o.station_id,
              o.total_twd,
              date_trunc('week', o.created_at)::date AS week_start
         FROM orders o
        WHERE o.status = 'delivered'
     ),
     cogs AS (
       SELECT oi.order_id, SUM(oi.quantity * p.cost_twd)::int AS cogs
         FROM order_items oi
         JOIN products p ON p.sku = oi.sku
        GROUP BY oi.order_id
     ),
     refunded AS (
       SELECT order_id, SUM(amount_twd)::int AS refund
         FROM refunds
        WHERE status IN ('approved', 'completed')
        GROUP BY order_id
     ),
     referral_cost AS (
       SELECT order_id, SUM(reward_twd)::int AS referral
         FROM referrals
        WHERE status = 'approved'
        GROUP BY order_id
     ),
     scrap AS (
       SELECT m.station_id,
              date_trunc('week', m.created_at)::date AS week_start,
              SUM(m.quantity * p.cost_twd)::int AS scrap
         FROM inventory_movements m
         JOIN batches b ON b.id = m.batch_id
         JOIN products p ON p.sku = b.sku
        WHERE m.type = 'scrap' AND m.station_id IS NOT NULL
        GROUP BY 1, 2
     ),
     per_week AS (
       SELECT d.week_start,
              count(*)::int AS orders,
              (COALESCE(SUM(d.total_twd), 0)
                - COALESCE(SUM(c.cogs), 0)
                - COALESCE(SUM(rf.refund), 0)
                - COALESCE(SUM(rc.referral), 0))::int AS contribution_twd
         FROM delivered d
         LEFT JOIN cogs c ON c.order_id = d.id
         LEFT JOIN refunded rf ON rf.order_id = d.id
         LEFT JOIN referral_cost rc ON rc.order_id = d.id
        GROUP BY d.week_start
     ),
     scrap_week AS (
       SELECT week_start, SUM(scrap)::int AS scrap FROM scrap GROUP BY week_start
     )
     SELECT to_char(b.week_start, 'YYYY-MM-DD') AS week_start,
            COALESCE(pw.orders, 0)::int AS orders,
            (COALESCE(pw.contribution_twd, 0) - COALESCE(sw.scrap, 0))::int AS contribution_twd,
            CASE WHEN COALESCE(pw.orders, 0) = 0 THEN 0
                 ELSE ((COALESCE(pw.contribution_twd, 0) - COALESCE(sw.scrap, 0)) / pw.orders)::int
            END AS contribution_per_order_twd
       FROM bounds b
       LEFT JOIN per_week pw ON pw.week_start = b.week_start
       LEFT JOIN scrap_week sw ON sw.week_start = b.week_start
      ORDER BY b.week_start`,
    [WEEKS],
  );
}

export async function getContributionGate(): Promise<Gate> {
  const weeks = await getWeeklyContribution();
  const positive = weeks.filter((week) => week.orders > 0 && week.contribution_per_order_twd > 0);
  const empty = weeks.filter((week) => week.orders === 0);
  const passed = weeks.length === WEEKS && positive.length === WEEKS;
  return {
    key: 'contribution_8w',
    label: `連續 ${WEEKS} 週單筆貢獻為正`,
    status: weeks.length === 0 ? 'unknown' : passed ? 'pass' : 'fail',
    detail: `${positive.length} / ${WEEKS} 週為正${empty.length > 0 ? `，${empty.length} 週無交付訂單` : ''}`,
    evidence: weeks
      .map((week) => `${week.week_start.slice(5)} ${week.contribution_per_order_twd >= 0 ? '+' : ''}${week.contribution_per_order_twd}`)
      .join(' · '),
  };
}

type StationSustainabilityRow = {
  code: string;
  name: string;
  type: string;
  monthly_contribution_twd: number;
  monthly_fixed_cost_twd: number;
  net_twd: number;
  delivered_orders: number;
};

/**
 * 關卡二：加盟站扣除實際工時及成本後具可持續性。
 * 以近 30 天交付訂單的貢獻金額對比站點每月固定增量成本。
 */
export async function listStationSustainability(): Promise<StationSustainabilityRow[]> {
  return query<StationSustainabilityRow>(
    `WITH delivered AS (
       SELECT o.id, o.station_id, o.total_twd
         FROM orders o
        WHERE o.status = 'delivered'
          AND o.created_at >= now() - interval '30 days'
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
       SELECT m.station_id, SUM(m.quantity * p.cost_twd)::int AS scrap
         FROM inventory_movements m
         JOIN batches b ON b.id = m.batch_id
         JOIN products p ON p.sku = b.sku
        WHERE m.type = 'scrap' AND m.station_id IS NOT NULL
          AND m.created_at >= now() - interval '30 days'
        GROUP BY m.station_id
     ),
     per_station AS (
       SELECT d.station_id,
              count(*)::int AS orders,
              (COALESCE(SUM(d.total_twd), 0)
                - COALESCE(SUM(c.cogs), 0)
                - COALESCE(SUM(rf.refund), 0)
                - COALESCE(SUM(rc.referral), 0))::int AS contribution
         FROM delivered d
         LEFT JOIN cogs c ON c.order_id = d.id
         LEFT JOIN refunded rf ON rf.order_id = d.id
         LEFT JOIN referral_cost rc ON rc.order_id = d.id
        GROUP BY d.station_id
     )
     SELECT st.code,
            st.name,
            st.type,
            (COALESCE(ps.contribution, 0) - COALESCE(sc.scrap, 0))::int AS monthly_contribution_twd,
            st.monthly_fixed_cost_twd,
            (COALESCE(ps.contribution, 0) - COALESCE(sc.scrap, 0) - st.monthly_fixed_cost_twd)::int AS net_twd,
            COALESCE(ps.orders, 0)::int AS delivered_orders
       FROM stations st
       LEFT JOIN per_station ps ON ps.station_id = st.id
       LEFT JOIN scrap sc ON sc.station_id = st.id
      WHERE st.status = 'active'
      ORDER BY st.code`,
  );
}

export async function getSustainabilityGate(): Promise<Gate> {
  const rows = await listStationSustainability();
  const sustainable = rows.filter((row) => row.net_twd > 0);
  const noCost = rows.filter((row) => row.monthly_fixed_cost_twd === 0);
  if (rows.length === 0) {
    return {
      key: 'station_sustainability',
      label: '加盟站扣除工時與成本後可持續',
      status: 'unknown',
      detail: '尚無營運中站點',
      evidence: '—',
    };
  }
  return {
    key: 'station_sustainability',
    label: '加盟站扣除工時與成本後可持續',
    status: sustainable.length === rows.length ? 'pass' : 'fail',
    detail: `${sustainable.length} / ${rows.length} 站近 30 天淨額為正${noCost.length > 0 ? `，${noCost.length} 站未填固定成本` : ''}`,
    evidence: rows.map((row) => `${row.code} ${row.net_twd >= 0 ? '+' : ''}${row.net_twd}`).join(' · '),
  };
}

/** 關卡三：新站資金到位。已收到的承諾金額須覆蓋已承諾但未收到的金額。 */
export async function getFundingGate(): Promise<Gate> {
  const rows = await query<{ status: string; total: number }>(
    `SELECT status, COALESCE(SUM(amount_twd), 0)::int AS total
       FROM funding_commitments GROUP BY status`,
  );
  const byStatus = new Map(rows.map((row) => [row.status, row.total]));
  const committed = byStatus.get('committed') ?? 0;
  const received = byStatus.get('received') ?? 0;
  const pending = byStatus.get('pending') ?? 0;
  if (committed + received + pending === 0) {
    return {
      key: 'funding',
      label: '新站資金到位',
      status: 'unknown',
      detail: '尚未登錄任何資金承諾',
      evidence: '—',
    };
  }
  return {
    key: 'funding',
    label: '新站資金到位',
    status: committed === 0 ? 'pass' : 'fail',
    detail: committed === 0 ? '已承諾資金全部到位' : `尚有 ${committed} 元已承諾未收到`,
    evidence: `已到位 ${received} · 已承諾未到 ${committed} · 待確認 ${pending}`,
  };
}

/** 關卡四：配送能力足夠。近 7 天每日平均訂單不得超過站點容量合計的 80%。 */
export async function getDeliveryCapacityGate(): Promise<Gate> {
  const row = await query<{ daily_orders: number; capacity: number }>(
    `WITH recent AS (
       SELECT count(*)::numeric / 7 AS daily_orders
         FROM orders
        WHERE created_at >= now() - interval '7 days'
          AND status <> 'cancelled'
     ),
     cap AS (
       SELECT COALESCE(SUM(capacity), 0)::numeric AS capacity
         FROM stations WHERE status = 'active'
     )
     SELECT COALESCE(r.daily_orders, 0)::int AS daily_orders,
            COALESCE(c.capacity, 0)::int AS capacity
       FROM recent r CROSS JOIN cap c`,
  );
  const daily = row[0]?.daily_orders ?? 0;
  const capacity = row[0]?.capacity ?? 0;
  const limit = Math.floor(capacity * 0.8);
  if (capacity === 0) {
    return {
      key: 'delivery_capacity',
      label: '配送能力足夠',
      status: 'unknown',
      detail: '尚無營運中站點容量',
      evidence: '—',
    };
  }
  return {
    key: 'delivery_capacity',
    label: '配送能力足夠',
    status: daily <= limit ? 'pass' : 'fail',
    detail: `近 7 天每日平均 ${daily} 筆，容量上限 ${limit} 筆（80%）`,
    evidence: `站點容量合計 ${capacity} 份／日`,
  };
}

/** 關卡五：無未結重大食品安全事件。 */
export async function getFoodSafetyGate(): Promise<Gate> {
  const row = await query<{ open_recalls: number; open_exceptions: number; breaches: number }>(
    `SELECT (SELECT count(*)::int FROM recalls WHERE status = 'open') AS open_recalls,
            (SELECT count(*)::int FROM supplier_exceptions WHERE status <> 'closed') AS open_exceptions,
            (SELECT count(*)::int FROM temperature_events
              WHERE status = 'breach' AND recorded_at >= now() - interval '7 days') AS breaches`,
  );
  const openRecalls = row[0]?.open_recalls ?? 0;
  const openExceptions = row[0]?.open_exceptions ?? 0;
  const breaches = row[0]?.breaches ?? 0;
  const clean = openRecalls === 0 && openExceptions === 0 && breaches === 0;
  return {
    key: 'food_safety',
    label: '無未結重大食品安全事件',
    status: clean ? 'pass' : 'fail',
    detail: clean
      ? '無未結召回、供應商異常或近 7 天溫控超標'
      : `未結召回 ${openRecalls}、未結供應商異常 ${openExceptions}、近 7 天溫控超標 ${breaches}`,
    evidence: '召回、供應商異常與溫控事件皆為 0 才視為通過',
  };
}

export async function listGates(): Promise<Gate[]> {
  return Promise.all([
    getContributionGate(),
    getSustainabilityGate(),
    getFundingGate(),
    getDeliveryCapacityGate(),
    getFoodSafetyGate(),
  ]);
}

/** 停止條件一：重大食安事件（未結召回）。 */
export async function getRecallStopCondition(): Promise<StopCondition> {
  const rows = await query<{ code: string; reason: string }>(
    `SELECT p.sku AS code, r.reason
       FROM recalls r JOIN products p ON p.sku = r.sku
      WHERE r.status = 'open'
      ORDER BY r.started_at DESC
      LIMIT 5`,
  );
  return {
    key: 'food_safety_incident',
    label: '重大食安事件',
    triggered: rows.length > 0,
    detail: rows.length === 0 ? '無未結召回' : `${rows.length} 件未結召回：${rows.map((row) => row.code).join('、')}`,
    action: '保護顧客、隔離資產與商品、履行退款，再檢討復業條件',
  };
}

/** 停止條件二：持續冷鏈失效。近 7 天同一站點 3 次以上溫控超標即視為持續。 */
export async function getColdChainStopCondition(): Promise<StopCondition> {
  const rows = await query<{ code: string; breaches: number }>(
    `SELECT st.code, count(*)::int AS breaches
       FROM temperature_events t
       JOIN stations st ON st.id = t.station_id
      WHERE t.status = 'breach' AND t.recorded_at >= now() - interval '7 days'
      GROUP BY st.code
     HAVING count(*) >= 3
      ORDER BY count(*) DESC`,
  );
  return {
    key: 'cold_chain_failure',
    label: '持續冷鏈失效',
    triggered: rows.length > 0,
    detail: rows.length === 0 ? '近 7 天無站點達 3 次溫控超標' : rows.map((row) => `${row.code} ${row.breaches} 次`).join('、'),
    action: '暫停該站交付、隔離受影響批次、完成設備檢修後才恢復',
  };
}

/** 停止條件三：供應商拒絕追溯。未結異常或批次缺檢驗文件。 */
export async function getTraceabilityStopCondition(): Promise<StopCondition> {
  const row = await query<{ open_exceptions: number; untraced_batches: number }>(
    `SELECT (SELECT count(*)::int FROM supplier_exceptions WHERE status <> 'closed') AS open_exceptions,
            (SELECT count(*)::int FROM batches b
              WHERE b.status = 'available'
                AND NOT EXISTS (SELECT 1 FROM inspection_docs d WHERE d.batch_id = b.id)) AS untraced_batches`,
  );
  const openExceptions = row[0]?.open_exceptions ?? 0;
  const untraced = row[0]?.untraced_batches ?? 0;
  return {
    key: 'traceability_refusal',
    label: '供應商拒絕追溯',
    triggered: openExceptions > 0 || untraced > 0,
    detail:
      openExceptions === 0 && untraced === 0
        ? '所有可售批次皆有檢驗文件，無未結供應商異常'
        : `未結供應商異常 ${openExceptions}、缺檢驗文件的可售批次 ${untraced}`,
    action: '暫停該供應商進貨與該批次銷售，要求補件或終止合作',
  };
}

/** 停止條件四：真實成本下無改善空間。近 4 週單筆貢獻皆為負且未見改善。 */
export async function getNoImprovementStopCondition(): Promise<StopCondition> {
  const weeks = (await getWeeklyContribution()).slice(-4);
  const withOrders = weeks.filter((week) => week.orders > 0);
  if (withOrders.length < 4) {
    return {
      key: 'no_improvement',
      label: '真實成本下無改善空間',
      triggered: false,
      detail: `近 4 週僅 ${withOrders.length} 週有交付訂單，資料不足以判斷`,
      action: '持續觀察，不以單週數字下結論',
    };
  }
  const allNegative = withOrders.every((week) => week.contribution_per_order_twd < 0);
  const improving = withOrders[3]!.contribution_per_order_twd > withOrders[0]!.contribution_per_order_twd;
  return {
    key: 'no_improvement',
    label: '真實成本下無改善空間',
    triggered: allNegative && !improving,
    detail: allNegative
      ? `近 4 週單筆貢獻皆為負（${withOrders.map((week) => week.contribution_per_order_twd).join(' → ')}）${improving ? '，但趨勢改善中' : '，且未見改善'}`
      : '近 4 週至少一週單筆貢獻為正',
    action: '檢討定價、商品組合與站點成本結構，未改善前不擴點',
  };
}

/** 停止條件五：現金不足以履行已承諾訂單及退款。 */
export async function getCashStopCondition(): Promise<StopCondition> {
  const rows = await query<{ as_of: string; available_twd: number; committed_obligations_twd: number; worst_case_twd: number }>(
    `SELECT to_char(as_of, 'YYYY-MM-DD') AS as_of, available_twd, committed_obligations_twd, worst_case_twd
       FROM cash_positions ORDER BY as_of DESC LIMIT 1`,
  );
  const latest = rows[0];
  if (latest === undefined) {
    return {
      key: 'cash_shortfall',
      label: '現金不足以履行已承諾訂單及退款',
      triggered: false,
      detail: '尚未登錄現金部位',
      action: '每月更新現金流、可動用餘額及最差情境',
    };
  }
  const shortfall = latest.available_twd < latest.committed_obligations_twd;
  return {
    key: 'cash_shortfall',
    label: '現金不足以履行已承諾訂單及退款',
    triggered: shortfall,
    detail: `${latest.as_of} 可動用 ${latest.available_twd} 元，已承諾義務 ${latest.committed_obligations_twd} 元${shortfall ? '，不足' : '，足夠'}`,
    action: '停止接單與擴點，優先履行退款與已承諾訂單',
  };
}

export async function listStopConditions(): Promise<StopCondition[]> {
  return Promise.all([
    getRecallStopCondition(),
    getColdChainStopCondition(),
    getTraceabilityStopCondition(),
    getNoImprovementStopCondition(),
    getCashStopCondition(),
  ]);
}
