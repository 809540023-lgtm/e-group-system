import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderEmptyState } from '@jp/ui';
import { AdminGuard } from '../admin-guard';

export const dynamic = 'force-dynamic';

/** 員工與權限（規劃書 03、17 章；模組 03、17）。 */
export default async function AdminStaffPage(): Promise<ReactNode> {
  return (
    <AdminGuard permission="staff.invite" title="員工與權限">
      {() => (
        <>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            角色變更或停用後會遞增 sessionEpoch，舊登入立即失效。所有權限變更都寫入稽核紀錄。
          </p>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.9 }}>
            <li>角色：擁有者、商品、行銷、客服、財務、物流。</li>
            <li>敏感資料（客戶電話、地址、報關證件）僅具備對應權限者可讀取。</li>
            <li>員工離職時停用帳號並重新指派未完成工作。</li>
          </ul>
          <div
            style={{ marginTop: SPACING.lg }}
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '尚未設定 DATABASE_URL',
                description: '未連線資料庫時無法列出員工與角色。',
                actionLabel: '回到後臺',
                actionHref: '/admin',
              }),
            }}
          />
        </>
      )}
    </AdminGuard>
  );
}
