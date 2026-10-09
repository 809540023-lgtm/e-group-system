import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderEmptyState } from '@jp/ui';
import { AdminGuard } from '../admin-guard';

export const dynamic = 'force-dynamic';

/** 出貨與物流（規劃書 10 章；模組 10）。 */
export default async function AdminShipmentsPage(): Promise<ReactNode> {
  return (
    <AdminGuard permission="shipment.create" title="出貨與物流">
      {() => (
        <>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            出貨前必須確認付款已完成、報關資料齊備；物流狀態以事件方式附加，保留完整歷程。
          </p>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.9 }}>
            <li>材積重以 cm³/kg 係數計算，取實際重與材積重較大者計費。</li>
            <li>需要報關證件時，先建立待辦並以客服訊息個別說明，不在群組索取。</li>
            <li>配送異常會標記為 delivery_exception，並通知物流角色。</li>
          </ul>
          <div
            style={{ marginTop: SPACING.lg }}
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '尚未設定物流整合',
                description: '未設定物流憑證時，狀態為 integration_pending，不會產生假託運單號。',
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
