import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderEmptyState } from '@jp/ui';
import { AdminGuard } from '../admin-guard';

export const dynamic = 'force-dynamic';

/** 報表（規劃書 15 章；模組 15）。 */
export default async function AdminReportsPage(): Promise<ReactNode> {
  return (
    <AdminGuard permission="report.finance.read" title="報表">
      {() => (
        <>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            平台歸因與實際營收分開呈現；廣告後臺數字不得當作實際營收。匯出報表需填寫用途。
          </p>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.9 }}>
            <li>淨貢獻 = 營收 − 商品成本 − 金流費 − 運費 − 廣告費 − 退款。</li>
            <li>ROAS 與 CAC 以實際花費與實際成交計算。</li>
            <li>退款歸回原訂單月份，不重算當月營收。</li>
          </ul>
          <div
            style={{ marginTop: SPACING.lg }}
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '尚未設定 DATABASE_URL',
                description: '未連線資料庫時無法產生報表。',
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
