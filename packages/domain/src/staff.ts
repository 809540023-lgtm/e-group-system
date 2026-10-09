import { AppError } from './errors.ts';
import type { StaffRole } from './auth.ts';

/**
 * 員工待辦、客服與交接。
 *
 * 核心不變式：
 * 1. 任務包含負責人、截止時間、狀態、訂單/商品連結及完成證據。
 * 2. 支援代理與離職停用；停用員工不得再被指派。
 * 3. AI 草稿只能引用已驗證狀態與合法商品資訊。
 * 4. 每日看板與 LINE 摘要由共享任務生成，不以群組對話取代正式工作紀錄。
 */

export type WorkTaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export interface WorkTask {
  readonly taskId: string;
  readonly title: string;
  readonly assigneeId: string | null;
  readonly requiredRole: StaffRole;
  readonly dueAt: string | null;
  readonly status: WorkTaskStatus;
  readonly orderId: string | null;
  readonly productId: string | null;
  readonly evidence: readonly string[];
  readonly createdAt: string;
}

export interface StaffMember {
  readonly staffId: string;
  readonly name: string;
  readonly roles: readonly StaffRole[];
  readonly active: boolean;
  readonly onLeave: boolean;
}

export function assertAssignable(staff: StaffMember): void {
  if (!staff.active) {
    throw new AppError('FORBIDDEN', `員工 ${staff.staffId} 已停用，不可指派任務`);
  }
}

export function assertTaskComplete(task: WorkTask): void {
  if (task.status !== 'done') return;
  if (task.evidence.length === 0) {
    throw new AppError('VALIDATION_FAILED', `任務 ${task.taskId} 標記完成但缺少完成證據`);
  }
}

/** 代理：原負責人請假時指派代理，保留原負責人紀錄。 */
export interface TaskDelegation {
  readonly taskId: string;
  readonly originalAssigneeId: string;
  readonly delegateId: string;
  readonly reason: string;
  readonly delegatedAt: string;
}

export function delegateTask(
  task: WorkTask,
  delegate: StaffMember,
  reason: string,
  now: Date,
): { readonly task: WorkTask; readonly delegation: TaskDelegation } {
  assertAssignable(delegate);
  if (!task.assigneeId) {
    throw new AppError('VALIDATION_FAILED', '未指派的任務不可代理，請先指派負責人');
  }
  if (reason.trim() === '') {
    throw new AppError('VALIDATION_FAILED', '代理必須填寫原因');
  }
  return {
    task: { ...task, assigneeId: delegate.staffId },
    delegation: {
      taskId: task.taskId,
      originalAssigneeId: task.assigneeId,
      delegateId: delegate.staffId,
      reason,
      delegatedAt: now.toISOString(),
    },
  };
}

/** 離職停用：未完成任務需重新指派。 */
export function reassignOnDeactivation(
  tasks: readonly WorkTask[],
  staffId: string,
): readonly WorkTask[] {
  return tasks.map((task) =>
    task.assigneeId === staffId && task.status !== 'done' && task.status !== 'cancelled'
      ? { ...task, assigneeId: null, status: 'open' as WorkTaskStatus }
      : task,
  );
}

export type TicketStatus = 'new' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketCategory = 'order_status' | 'payment' | 'shipping' | 'return' | 'product' | 'other';

export interface SupportTicket {
  readonly ticketId: string;
  readonly customerId: string;
  readonly orderId: string | null;
  readonly category: TicketCategory;
  readonly status: TicketStatus;
  readonly assignedRole: StaffRole;
  readonly createdAt: string;
  readonly firstResponseDueAt: string;
  readonly messages: readonly TicketMessage[];
}

export interface TicketMessage {
  readonly messageId: string;
  readonly author: 'customer' | 'staff' | 'ai_draft';
  readonly body: string;
  readonly createdAt: string;
  /** AI 草稿必須標示引用來源。 */
  readonly citedFacts: readonly string[];
}

/** 客服時限：依品類設定首次回覆期限。 */
export const FIRST_RESPONSE_HOURS: Readonly<Record<TicketCategory, number>> = {
  order_status: 8,
  payment: 4,
  shipping: 8,
  return: 24,
  product: 24,
  other: 24,
};

export function firstResponseDue(category: TicketCategory, now: Date): Date {
  const hours = FIRST_RESPONSE_HOURS[category];
  return new Date(now.getTime() + hours * 3_600_000);
}

export function isOverdue(ticket: SupportTicket, now: Date): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
  const hasStaffReply = ticket.messages.some((m) => m.author === 'staff');
  if (hasStaffReply) return false;
  return new Date(ticket.firstResponseDueAt).getTime() < now.getTime();
}

/**
 * AI 草稿只能引用已驗證狀態與合法商品資訊。
 * 缺貨、改品、遲付及退款轉所屬角色，不由 AI 自行決定。
 */
export type TicketRouting =
  | { readonly action: 'ai_draft_allowed' }
  | { readonly action: 'route_to_role'; readonly role: StaffRole; readonly reason: string };

export function routeTicket(input: {
  readonly category: TicketCategory;
  readonly orderStatus: string | null;
  readonly paymentStatus: string | null;
  readonly stockAvailable: number | null;
}): TicketRouting {
  if (input.paymentStatus === 'needs_review' || input.paymentStatus === 'processing') {
    return { action: 'route_to_role', role: 'finance', reason: '金流狀態未定，需財務核對' };
  }
  if (input.stockAvailable !== null && input.stockAvailable <= 0) {
    return { action: 'route_to_role', role: 'catalog', reason: '缺貨需商品人員處理替代或下架' };
  }
  if (input.category === 'return') {
    return { action: 'route_to_role', role: 'support', reason: '退貨需人工確認 RMA 與退款方式' };
  }
  if (input.category === 'shipping') {
    return { action: 'route_to_role', role: 'logistics', reason: '配送異常需物流人員處理' };
  }
  return { action: 'ai_draft_allowed' };
}

export function assertAiDraftCited(message: TicketMessage): void {
  if (message.author !== 'ai_draft') return;
  if (message.citedFacts.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'AI 客服草稿必須引用已驗證的訂單或商品事實');
  }
}

/** 服務與行銷同意分開。 */
export interface Consents {
  readonly serviceUpdates: boolean;
  readonly marketing: boolean;
  readonly measurement: boolean;
  readonly version: string;
  readonly updatedAt: string;
}

export function assertMarketingAllowed(consents: Consents): void {
  if (!consents.marketing) {
    throw new AppError('FORBIDDEN', '顧客未同意行銷訊息');
  }
}

export function assertMeasurementAllowed(consents: Consents): void {
  if (!consents.measurement) {
    throw new AppError('FORBIDDEN', '顧客未同意量測');
  }
}

/** 每日看板：由共享任務生成，不以群組對話取代正式工作紀錄。 */
export interface DailyBoard {
  readonly date: string;
  readonly pendingPublish: readonly string[];
  readonly pendingProcurement: readonly string[];
  readonly pendingShipment: readonly string[];
  readonly paymentExceptions: readonly string[];
  readonly overdueTickets: readonly string[];
}

export function buildDailyBoard(input: {
  readonly date: string;
  readonly tasks: readonly WorkTask[];
  readonly tickets: readonly SupportTicket[];
  readonly now: Date;
}): DailyBoard {
  const byRole = (role: StaffRole): string[] =>
    input.tasks
      .filter((t) => t.requiredRole === role && t.status !== 'done' && t.status !== 'cancelled')
      .map((t) => t.taskId);

  return {
    date: input.date,
    pendingPublish: byRole('catalog'),
    pendingProcurement: byRole('logistics'),
    pendingShipment: byRole('logistics'),
    paymentExceptions: byRole('finance'),
    overdueTickets: input.tickets.filter((t) => isOverdue(t, input.now)).map((t) => t.ticketId),
  };
}

/** LINE 摘要只含必要欄位，不含客戶完整地址、電話或報關證件。 */
export interface LineSummaryItem {
  readonly orderNumber: string;
  readonly taskKind: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly role: StaffRole;
  readonly adminLink: string;
}

const FORBIDDEN_SUMMARY_FIELDS = ['address', 'phone', 'idNumber', 'customsId', 'email', 'fullName'];

export function assertSummarySafe(item: Record<string, unknown>): void {
  for (const field of FORBIDDEN_SUMMARY_FIELDS) {
    if (field in item) {
      throw new AppError('FORBIDDEN', `LINE 摘要不得包含 ${field}`);
    }
  }
}
