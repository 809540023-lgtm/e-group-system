import { AppError } from './errors.ts';

/**
 * 員工與顧客權限。
 *
 * 規則：角色可組合，但每次 API 寫入都必須在服務端查角色。
 * 前端隱藏按鈕不能替代後端檢查。
 */

export type StaffRole =
  | 'owner'
  | 'catalog'
  | 'marketing'
  | 'support'
  | 'finance'
  | 'logistics';

export type Permission =
  | 'catalog.draft.edit'
  | 'catalog.publish'
  | 'catalog.archive'
  | 'source.sync.trigger'
  | 'order.read.own'
  | 'order.read.all'
  | 'order.cancel'
  | 'payment.reconcile'
  | 'refund.request'
  | 'refund.approve'
  | 'procurement.create'
  | 'procurement.pay'
  | 'shipment.create'
  | 'shipment.update'
  | 'customer.private.read'
  | 'customer.export'
  | 'staff.invite'
  | 'staff.role.change'
  | 'ads.draft.create'
  | 'ads.budget.change'
  | 'ads.activate'
  | 'report.finance.read'
  | 'audit.read';

const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  owner: [
    'catalog.draft.edit',
    'catalog.publish',
    'catalog.archive',
    'source.sync.trigger',
    'order.read.all',
    'order.cancel',
    'payment.reconcile',
    'refund.request',
    'refund.approve',
    'procurement.create',
    'procurement.pay',
    'shipment.create',
    'shipment.update',
    'customer.private.read',
    'customer.export',
    'staff.invite',
    'staff.role.change',
    'ads.draft.create',
    'ads.budget.change',
    'ads.activate',
    'report.finance.read',
    'audit.read',
  ],
  catalog: ['catalog.draft.edit', 'catalog.publish', 'catalog.archive', 'source.sync.trigger', 'order.read.all'],
  marketing: ['ads.draft.create', 'order.read.all'],
  support: ['order.read.all', 'order.cancel', 'refund.request'],
  finance: ['payment.reconcile', 'refund.request', 'refund.approve', 'report.finance.read', 'order.read.all'],
  logistics: ['shipment.create', 'shipment.update', 'order.read.all'],
};

export interface StaffPrincipal {
  readonly staffId: string;
  readonly roles: readonly StaffRole[];
  readonly active: boolean;
  /** 角色變更或停用後遞增，舊 session 立即失效。 */
  readonly sessionEpoch: number;
}

export interface CustomerPrincipal {
  readonly customerId: string;
  readonly verified: boolean;
}

export function permissionsFor(roles: readonly StaffRole[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      result.add(permission);
    }
  }
  return result;
}

export function assertStaffActive(staff: StaffPrincipal): void {
  if (!staff.active) {
    throw new AppError('FORBIDDEN', '此員工帳號已停用');
  }
}

export function assertPermission(staff: StaffPrincipal, permission: Permission): void {
  assertStaffActive(staff);
  if (!permissionsFor(staff.roles).has(permission)) {
    throw new AppError('FORBIDDEN', `缺少權限 ${permission}`);
  }
}

export function assertSessionValid(staff: StaffPrincipal, sessionEpoch: number): void {
  assertStaffActive(staff);
  if (staff.sessionEpoch !== sessionEpoch) {
    throw new AppError('UNAUTHENTICATED', '工作階段已失效，請重新登入');
  }
}

/**
 * 顧客查單必查所有權。電話查單需驗證及限流，
 * 不裸用「訂單號 + 電話」當授權。
 */
export function assertOrderOwnership(
  principal: CustomerPrincipal,
  orderCustomerId: string,
): void {
  if (!principal.verified) {
    throw new AppError('UNAUTHENTICATED', '請先完成身分驗證');
  }
  if (principal.customerId !== orderCustomerId) {
    throw new AppError('FORBIDDEN', '只能檢視自己的訂單');
  }
}

/** 敏感資料依角色遮罩。 */
export function maskCustomerPrivate<T extends Record<string, unknown>>(
  record: T,
  staff: StaffPrincipal,
): Partial<T> {
  if (permissionsFor(staff.roles).has('customer.private.read')) {
    return record;
  }
  const masked: Record<string, unknown> = { ...record };
  for (const key of ['phone', 'address', 'idNumber', 'customsId', 'email']) {
    if (key in masked) masked[key] = '***';
  }
  return masked as Partial<T>;
}

/** 需要稽核的操作。 */
export const AUDITED_ACTIONS: readonly Permission[] = [
  'customer.export',
  'staff.role.change',
  'staff.invite',
  'refund.approve',
  'ads.budget.change',
  'ads.activate',
  'catalog.archive',
];

export function requiresAudit(permission: Permission): boolean {
  return AUDITED_ACTIONS.includes(permission);
}
