import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type StaffMember,
  type SupportTicket,
  type WorkTask,
  assertAiDraftCited,
  assertAssignable,
  assertMarketingAllowed,
  assertMeasurementAllowed,
  assertSummarySafe,
  assertTaskComplete,
  buildDailyBoard,
  delegateTask,
  firstResponseDue,
  isOverdue,
  reassignOnDeactivation,
  routeTicket,
} from '../src/staff.ts';

const now = new Date('2026-10-09T04:00:00Z');

const staff: StaffMember = { staffId: 'S-1', name: '小明', roles: ['support'], active: true, onLeave: false };

const task: WorkTask = {
  taskId: 'T-1',
  title: '確認缺貨替代品',
  assigneeId: 'S-1',
  requiredRole: 'catalog',
  dueAt: '2026-10-10T00:00:00Z',
  status: 'open',
  orderId: 'O-1',
  productId: 'SKU-A',
  evidence: [],
  createdAt: '2026-10-09T00:00:00Z',
};

describe('staff 任務指派', () => {
  it('停用員工不可被指派', () => {
    expect(() => assertAssignable({ ...staff, active: false })).toThrow(AppError);
    expect(() => assertAssignable(staff)).not.toThrow();
  });

  it('標記完成必須有完成證據', () => {
    expect(() => assertTaskComplete({ ...task, status: 'done' })).toThrow(AppError);
    expect(() => assertTaskComplete({ ...task, status: 'done', evidence: ['照片'] })).not.toThrow();
    expect(() => assertTaskComplete(task)).not.toThrow();
  });

  it('代理需填原因且保留原負責人', () => {
    const { task: delegated, delegation } = delegateTask(task, staff, '原負責人請假', now);
    expect(delegated.assigneeId).toBe('S-1');
    expect(delegation.originalAssigneeId).toBe('S-1');
    expect(delegation.reason).toBe('原負責人請假');
  });

  it('代理未指派任務或未填原因被拒', () => {
    expect(() => delegateTask({ ...task, assigneeId: null }, staff, '請假', now)).toThrow(AppError);
    expect(() => delegateTask(task, staff, '   ', now)).toThrow(AppError);
  });

  it('離職停用後未完成任務回到未指派', () => {
    const tasks = reassignOnDeactivation(
      [task, { ...task, taskId: 'T-2', status: 'done' }, { ...task, taskId: 'T-3', status: 'cancelled' }],
      'S-1',
    );
    expect(tasks[0]?.assigneeId).toBeNull();
    expect(tasks[0]?.status).toBe('open');
    expect(tasks[1]?.assigneeId).toBe('S-1');
    expect(tasks[2]?.assigneeId).toBe('S-1');
  });
});

describe('staff 客服時限', () => {
  it('依品類設定首次回覆期限', () => {
    expect(firstResponseDue('payment', now).getTime() - now.getTime()).toBe(4 * 3_600_000);
    expect(firstResponseDue('return', now).getTime() - now.getTime()).toBe(24 * 3_600_000);
  });

  it('未回覆且逾期才算逾期', () => {
    const ticket: SupportTicket = {
      ticketId: 'TK-1',
      customerId: 'C-1',
      orderId: 'O-1',
      category: 'payment',
      status: 'new',
      assignedRole: 'finance',
      createdAt: '2026-10-09T00:00:00Z',
      firstResponseDueAt: '2026-10-09T04:00:00Z',
      messages: [],
    };
    expect(isOverdue(ticket, now)).toBe(false);
    expect(isOverdue(ticket, new Date('2026-10-09T05:00:00Z'))).toBe(true);
    expect(isOverdue({ ...ticket, status: 'resolved' }, new Date('2026-10-09T05:00:00Z'))).toBe(false);
    expect(
      isOverdue(
        {
          ...ticket,
          messages: [{ messageId: 'M-1', author: 'staff', body: '已處理', createdAt: '2026-10-09T03:00:00Z', citedFacts: [] }],
        },
        new Date('2026-10-09T05:00:00Z'),
      ),
    ).toBe(false);
  });
});

describe('staff 客服分流', () => {
  it('金流狀態未定轉財務', () => {
    const routing = routeTicket({ category: 'payment', orderStatus: 'established', paymentStatus: 'needs_review', stockAvailable: 5 });
    expect(routing).toEqual({ action: 'route_to_role', role: 'finance', reason: '金流狀態未定，需財務核對' });
  });

  it('缺貨轉商品人員，不由 AI 自行換商品', () => {
    const routing = routeTicket({ category: 'product', orderStatus: 'established', paymentStatus: 'paid', stockAvailable: 0 });
    expect(routing.action).toBe('route_to_role');
    if (routing.action === 'route_to_role') expect(routing.role).toBe('catalog');
  });

  it('退貨與配送異常轉對應角色', () => {
    const ret = routeTicket({ category: 'return', orderStatus: 'established', paymentStatus: 'paid', stockAvailable: 5 });
    expect(ret.action === 'route_to_role' && ret.role === 'support').toBe(true);
    const ship = routeTicket({ category: 'shipping', orderStatus: 'established', paymentStatus: 'paid', stockAvailable: 5 });
    expect(ship.action === 'route_to_role' && ship.role === 'logistics').toBe(true);
  });

  it('一般查單可產生 AI 草稿', () => {
    expect(
      routeTicket({ category: 'order_status', orderStatus: 'established', paymentStatus: 'paid', stockAvailable: 5 }),
    ).toEqual({ action: 'ai_draft_allowed' });
  });

  it('AI 草稿必須引用已驗證事實', () => {
    expect(() =>
      assertAiDraftCited({ messageId: 'M-1', author: 'ai_draft', body: '您的訂單已出貨', createdAt: '2026-10-09T00:00:00Z', citedFacts: [] }),
    ).toThrow(AppError);
    expect(() =>
      assertAiDraftCited({ messageId: 'M-1', author: 'ai_draft', body: '您的訂單已出貨', createdAt: '2026-10-09T00:00:00Z', citedFacts: ['shipment:S1'] }),
    ).not.toThrow();
    expect(() =>
      assertAiDraftCited({ messageId: 'M-2', author: 'staff', body: '您好', createdAt: '2026-10-09T00:00:00Z', citedFacts: [] }),
    ).not.toThrow();
  });
});

describe('staff 同意管理', () => {
  const consents = { serviceUpdates: true, marketing: false, measurement: false, version: 'v1', updatedAt: '2026-10-09T00:00:00Z' };

  it('服務通知與行銷同意分開', () => {
    expect(() => assertMarketingAllowed(consents)).toThrow(AppError);
    expect(() => assertMarketingAllowed({ ...consents, marketing: true })).not.toThrow();
  });

  it('量測需另外同意', () => {
    expect(() => assertMeasurementAllowed(consents)).toThrow(AppError);
    expect(() => assertMeasurementAllowed({ ...consents, measurement: true })).not.toThrow();
  });
});

describe('staff 每日看板與 LINE 摘要', () => {
  it('看板由共享任務生成', () => {
    const board = buildDailyBoard({
      date: '2026-10-09',
      tasks: [task, { ...task, taskId: 'T-2', requiredRole: 'finance', status: 'open' }],
      tickets: [],
      now,
    });
    expect(board.pendingPublish).toEqual(['T-1']);
    expect(board.paymentExceptions).toEqual(['T-2']);
  });

  it('LINE 摘要不得含客戶個資', () => {
    expect(() => assertSummarySafe({ orderNumber: 'JP1', taskKind: 'ship' })).not.toThrow();
    expect(() => assertSummarySafe({ orderNumber: 'JP1', address: '臺北市' })).toThrow(AppError);
    expect(() => assertSummarySafe({ orderNumber: 'JP1', phone: '0912' })).toThrow(AppError);
    expect(() => assertSummarySafe({ orderNumber: 'JP1', customsId: 'EZ1' })).toThrow(AppError);
  });
});
