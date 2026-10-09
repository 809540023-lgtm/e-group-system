import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.ts';
import {
  type StaffPrincipal,
  assertOrderOwnership,
  assertPermission,
  assertSessionValid,
  assertStaffActive,
  maskCustomerPrivate,
  permissionsFor,
  requiresAudit,
} from '../src/auth.ts';

const owner: StaffPrincipal = { staffId: 'S-1', roles: ['owner'], active: true, sessionEpoch: 1 };
const support: StaffPrincipal = { staffId: 'S-2', roles: ['support'], active: true, sessionEpoch: 1 };
const marketing: StaffPrincipal = { staffId: 'S-3', roles: ['marketing'], active: true, sessionEpoch: 1 };
const finance: StaffPrincipal = { staffId: 'S-4', roles: ['finance'], active: true, sessionEpoch: 1 };

describe('auth 角色權限', () => {
  it('owner 擁有全部權限', () => {
    const permissions = permissionsFor(['owner']);
    expect(permissions.has('staff.role.change')).toBe(true);
    expect(permissions.has('refund.approve')).toBe(true);
    expect(permissions.has('ads.activate')).toBe(true);
  });

  it('客服可取消訂單與申請退款，但不可核准退款', () => {
    const permissions = permissionsFor(['support']);
    expect(permissions.has('order.cancel')).toBe(true);
    expect(permissions.has('refund.request')).toBe(true);
    expect(permissions.has('refund.approve')).toBe(false);
  });

  it('行銷不可發布商品或動用財務報表', () => {
    const permissions = permissionsFor(['marketing']);
    expect(permissions.has('catalog.publish')).toBe(false);
    expect(permissions.has('report.finance.read')).toBe(false);
    expect(permissions.has('ads.draft.create')).toBe(true);
  });

  it('財務不可建立出貨', () => {
    expect(permissionsFor(['finance']).has('shipment.create')).toBe(false);
  });

  it('角色可組合', () => {
    const permissions = permissionsFor(['support', 'finance']);
    expect(permissions.has('order.cancel')).toBe(true);
    expect(permissions.has('refund.approve')).toBe(true);
  });

  it('未知角色不授予任何權限', () => {
    expect(permissionsFor(['unknown' as never]).size).toBe(0);
  });
});

describe('auth 服務端檢查', () => {
  it('停用員工一律拒絕', () => {
    const disabled = { ...owner, active: false };
    expect(() => assertStaffActive(disabled)).toThrow(AppError);
    expect(() => assertPermission(disabled, 'order.read.all')).toThrow(AppError);
    expect(() => assertSessionValid(disabled, 1)).toThrow(AppError);
  });

  it('缺少權限被拒（前端隱藏按鈕不能替代後端檢查）', () => {
    expect(() => assertPermission(marketing, 'catalog.publish')).toThrow(AppError);
    expect(() => assertPermission(marketing, 'ads.draft.create')).not.toThrow();
  });

  it('角色變更後舊 session 立即失效', () => {
    expect(() => assertSessionValid(owner, 1)).not.toThrow();
    expect(() => assertSessionValid(owner, 2)).toThrow(AppError);
  });
});

describe('auth 顧客查單', () => {
  it('未驗證身分不得查單', () => {
    expect(() =>
      assertOrderOwnership({ customerId: 'C-1', verified: false }, 'C-1'),
    ).toThrow(AppError);
  });

  it('只能檢視自己的訂單', () => {
    expect(() => assertOrderOwnership({ customerId: 'C-1', verified: true }, 'C-1')).not.toThrow();
    expect(() => assertOrderOwnership({ customerId: 'C-1', verified: true }, 'C-2')).toThrow(AppError);
  });
});

describe('auth 敏感資料遮罩', () => {
  const record = {
    orderNumber: 'JP20261009001',
    phone: '0912345678',
    address: '臺北市信義區',
    idNumber: 'A123456789',
    customsId: 'EZ123',
    email: 'a@example.com',
  };

  it('無 customer.private.read 權限時遮罩敏感欄位', () => {
    const masked = maskCustomerPrivate(record, support);
    expect(masked.phone).toBe('***');
    expect(masked.address).toBe('***');
    expect(masked.idNumber).toBe('***');
    expect(masked.customsId).toBe('***');
    expect(masked.email).toBe('***');
    expect(masked.orderNumber).toBe('JP20261009001');
  });

  it('owner 可讀取完整資料', () => {
    const masked = maskCustomerPrivate(record, owner);
    expect(masked.phone).toBe('0912345678');
  });

  it('財務角色預設不可讀取客戶個資', () => {
    expect(maskCustomerPrivate(record, finance).phone).toBe('***');
  });
});

describe('auth 稽核', () => {
  it('敏感操作需稽核', () => {
    expect(requiresAudit('customer.export')).toBe(true);
    expect(requiresAudit('refund.approve')).toBe(true);
    expect(requiresAudit('ads.budget.change')).toBe(true);
    expect(requiresAudit('catalog.archive')).toBe(true);
  });

  it('一般讀取不需稽核', () => {
    expect(requiresAudit('order.read.all')).toBe(false);
    expect(requiresAudit('catalog.draft.edit')).toBe(false);
  });
});
