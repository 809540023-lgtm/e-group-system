import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderEmptyState } from '@jp/ui';
import { AdminGuard } from '../admin-guard';

export const dynamic = 'force-dynamic';

/** 退款（規劃書 08 章；模組 08）。 */
export default async function AdminRefundsPage(): Promise<ReactNode> {
  return (
    <AdminGuard permission="refund.request" title="退款">
      {() => (
        <>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            退款申請以 request_key 冪等；同一筆申請重送不會重複退款。核准與申請分屬不同權限。
          </p>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.9 }}>
            <li>可退金額 = 已付款金額 − 已退款金額。</li>
            <li>並發退款以資料列鎖定序列化，不會超退。</li>
            <li>退款完成後寫入對帳紀錄，並回寫原訂單月份。</li>
          </ul>
          <div
            style={{ marginTop: SPACING.lg }}
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '尚未設定 DATABASE_URL',
                description: '未連線資料庫時無法列出退款申請。',
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
