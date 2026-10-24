/**
 * AI 端護欄（計畫書第十五章）。
 *
 * AI 可提供需求預測、即期庫存建議、客服草稿與異常提示；
 * 不得自行解除召回、修改保存期限、批准投資或提供疾病診斷。
 */

export const AI_FORBIDDEN_ACTIONS = [
  'lift_recall',
  'modify_shelf_life',
  'approve_investment',
  'diagnose_disease',
  'change_price_without_approval',
  'delete_audit_event',
] as const;

export type AiForbiddenAction = (typeof AI_FORBIDDEN_ACTIONS)[number];

export class AiGuardrailError extends Error {
  constructor(action: string) {
    super(`AI_GUARDRAIL: AI 不得執行 ${action}；請由具權限人員依流程處理。`);
    this.name = 'AiGuardrailError';
  }
}

export function assertAiActionAllowed(action: string): void {
  if ((AI_FORBIDDEN_ACTIONS as readonly string[]).includes(action)) {
    throw new AiGuardrailError(action);
  }
}

export interface SupportTicketDraftInput {
  readonly orderNo: string;
  readonly customerName: string;
  readonly issue: string;
  readonly orderStatus: string;
  readonly stationName: string;
}

/** 客服草稿只使用事實欄位，不承諾退款或療效。 */
export function draftCustomerReply(input: SupportTicketDraftInput): string {
  const safeIssue = input.issue.replace(/[<>]/g, '').slice(0, 200);
  return [
    `${input.customerName} 您好，`,
    `已收到您關於訂單 ${input.orderNo} 的反映：${safeIssue}`,
    `目前訂單狀態為「${input.orderStatus}」，取貨站點為「${input.stationName}」。`,
    '我們會依實際情況與相關規範處理，若有退款或補償需求，將由客服人員確認後另行通知。',
    '若涉及食品異常，請先停止食用並保留商品與包裝，謝謝您。',
  ].join('\n');
}

export interface AnomalyMetric {
  readonly name: string;
  readonly value: number;
  readonly threshold: number;
  readonly direction: 'above' | 'below';
  readonly unit: string;
}

export interface AnomalyAlert {
  readonly name: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
}

export function detectAnomalies(metrics: readonly AnomalyMetric[]): readonly AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  for (const metric of metrics) {
    const breached = metric.direction === 'above' ? metric.value > metric.threshold : metric.value < metric.threshold;
    if (!breached) continue;
    const ratio = metric.threshold === 0 ? 1 : Math.abs(metric.value - metric.threshold) / Math.abs(metric.threshold);
    alerts.push({
      name: metric.name,
      severity: ratio >= 0.5 ? 'critical' : ratio >= 0.2 ? 'warning' : 'info',
      message: `${metric.name} 為 ${metric.value}${metric.unit}，${metric.direction === 'above' ? '高於' : '低於'}門檻 ${metric.threshold}${metric.unit}。`,
    });
  }
  return alerts;
}
