/**
 * 召回流程（計畫書第七章、第十五章）。
 *
 * 接獲異常 → 立即停賣鎖批 → 盤點庫存及已交付訂單 → 通知站點與顧客
 * → 依法通報、退回及處理 → 原因調查與改善。
 * 召回必須阻擋所有銷售管道，不能只擋單一前臺。
 */

export type RecallStatus = 'open' | 'closed';

export interface RecallRecord {
  readonly id: string;
  readonly sku: string;
  readonly batchId: string;
  readonly status: RecallStatus;
  readonly reason: string;
  readonly startedAt: string;
}

export interface RecallOrder {
  readonly orderId: string;
  readonly customerId: string;
  readonly stationId: string;
  readonly status: string;
  readonly quantity: number;
}

export interface RecallStation {
  readonly stationId: string;
  readonly name: string;
  readonly onHand: number;
}

export interface RecallPlan {
  readonly blockedSkus: readonly string[];
  readonly blockedBatches: readonly string[];
  readonly affectedOrders: readonly RecallOrder[];
  readonly affectedStations: readonly RecallStation[];
  readonly notifications: readonly { readonly orderId: string; readonly customerId: string; readonly channel: 'line' | 'sms' | 'email' }[];
  readonly steps: readonly string[];
  readonly internalTargetHours: number;
}

export function buildRecallPlan(input: {
  readonly recall: RecallRecord;
  readonly orders: readonly RecallOrder[];
  readonly stations: readonly RecallStation[];
}): RecallPlan {
  const affectedOrders = input.orders.filter(
    (order) => order.status !== 'cancelled' && order.status !== 'refunded',
  );
  const affectedStations = input.stations.filter((station) => station.onHand > 0);

  return {
    blockedSkus: [input.recall.sku],
    blockedBatches: [input.recall.batchId],
    affectedOrders,
    affectedStations,
    notifications: affectedOrders.map((order) => ({
      orderId: order.orderId,
      customerId: order.customerId,
      channel: 'line' as const,
    })),
    steps: [
      '立即停賣並鎖定受影響 SKU 與批號（所有銷售管道）。',
      '盤點站點庫存、在途與已交付訂單。',
      '通知受影響站點隔離商品，禁止交付。',
      '通知顧客停止食用並提供退款或換貨。',
      '依主管機關要求通報、回收與處理。',
      '完成原因調查、矯正措施與結案紀錄。',
    ],
    internalTargetHours: 2,
  };
}

/** 任一銷售管道都必須先問這個函式。 */
export function isSaleBlocked(input: {
  readonly sku: string;
  readonly batchId: string;
  readonly recalls: readonly RecallRecord[];
  readonly productStatus: string;
  readonly batchStatus: string;
}): { readonly blocked: boolean; readonly reason: string | null } {
  if (input.productStatus === 'recalled') return { blocked: true, reason: '商品已召回。' };
  if (input.productStatus === 'suspended') return { blocked: true, reason: '商品已停賣。' };
  if (input.batchStatus === 'recalled') return { blocked: true, reason: '批次已召回。' };
  if (input.batchStatus === 'quarantined') return { blocked: true, reason: '批次隔離中。' };
  const recall = input.recalls.find(
    (r) => r.status === 'open' && (r.sku === input.sku || r.batchId === input.batchId),
  );
  if (recall) return { blocked: true, reason: `召回進行中：${recall.reason}` };
  return { blocked: false, reason: null };
}

/** 召回結案前必須確認所有受影響訂單已處理。 */
export function canCloseRecall(plan: RecallPlan, handledOrderIds: readonly string[]): { readonly ok: boolean; readonly pending: readonly string[] } {
  const handled = new Set(handledOrderIds);
  const pending = plan.affectedOrders.filter((order) => !handled.has(order.orderId)).map((order) => order.orderId);
  return { ok: pending.length === 0, pending };
}
