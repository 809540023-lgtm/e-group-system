import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderButton, renderEmptyState } from '@jp/ui';
import { AdminGuard } from '../admin-guard';

export const dynamic = 'force-dynamic';

/** 訂單與付款（規劃書 07、08 章；模組 07、08）。 */
export default async function AdminOrdersPage(): Promise<ReactNode> {
  return (
    <AdminGuard permission="order.read.all" title="訂單與付款">
      {() => (
        <>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            付款狀態為 needs_review 的訂單必須先人工核對，核對完成前不得出貨。
          </p>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.9 }}>
            <li>重送的付款通知以事件鍵去重，不會重複扣庫存。</li>
            <li>取消後才收到的付款會轉為待核對，並保留退款處理紀錄。</li>
            <li>退款金額不得超過實際已付款金額。</li>
          </ul>
          <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '前往退款作業', href: '/admin/refunds', variant: 'secondary' }) }} />
          <div
            style={{ marginTop: SPACING.lg }}
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '尚未設定 DATABASE_URL',
                description: '未連線資料庫時無法列出訂單；此頁不會顯示假訂單。',
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
