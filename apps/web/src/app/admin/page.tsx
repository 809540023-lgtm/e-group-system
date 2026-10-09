import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING, renderButton, renderEmptyState } from '@jp/ui';
import { describeAuthError, loadAdminContext } from '@/lib/admin';
import { SiteNav } from '../site-nav';

export const dynamic = 'force-dynamic';

const SECTIONS: readonly { readonly href: string; readonly title: string; readonly description: string; readonly permission: string }[] = [
  { href: '/admin/catalog', title: '商品草稿與上架', description: '檢視同步差異、編輯草稿、核准上架與封存。', permission: 'catalog.draft.edit' },
  { href: '/admin/orders', title: '訂單與付款', description: '查詢訂單、付款核對、取消與退款申請。', permission: 'order.read.all' },
  { href: '/admin/refunds', title: '退款', description: '退款申請、核准與對帳。', permission: 'refund.request' },
  { href: '/admin/shipments', title: '出貨與物流', description: '建立出貨、更新物流狀態與報關待辦。', permission: 'shipment.create' },
  { href: '/admin/staff', title: '員工與權限', description: '邀請員工、調整角色與檢視稽核紀錄。', permission: 'staff.invite' },
  { href: '/admin/reports', title: '報表', description: '營收、貢獻、廣告成效與對帳報表。', permission: 'report.finance.read' },
];

/**
 * 後臺首頁（規劃書 03、18 章；模組 03）。
 *
 * 每個區塊都標示所需權限；沒有權限的區塊不顯示連結。
 * 未登入時顯示明確的登入說明，不洩漏後臺內容。
 */
export default async function AdminPage(): Promise<ReactNode> {
  let context: Awaited<ReturnType<typeof loadAdminContext>> | null = null;
  let error: { readonly code: string; readonly message: string } | null = null;
  try {
    context = await loadAdminContext();
  } catch (cause) {
    error = describeAuthError(cause);
  }

  if (context === null) {
    return (
      <>
        <SiteNav />
        <main id="main">
          <h1 style={{ fontSize: FONT_SIZE.headingLarge }}>後臺</h1>
          <p role="alert" style={{ fontSize: FONT_SIZE.body, color: COLORS.danger, fontWeight: 700 }}>
            {error?.message ?? '請先登入。'}
          </p>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            後臺需要員工帳號。開發環境可設定 DEV_AUTH_ENABLED=true 並以 dev-owner 等帳號登入；正式環境一律使用資料庫中的員工帳號與角色。
          </p>
        </main>
      </>
    );
  }

  const visible = SECTIONS.filter((section) => context.permissions.has(section.permission as never));

  return (
    <>
      <SiteNav />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.sm} 0` }}>後臺</h1>
        <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
          目前登入：{context.principal.staffId}（角色：{context.principal.roles.join('、')}）
        </p>

        {visible.length === 0 ? (
          <div
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '目前角色沒有可用的後臺功能',
                description: '請聯絡擁有者調整角色，或改用具備權限的帳號登入。',
                actionLabel: '回到首頁',
                actionHref: '/',
              }),
            }}
          />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: SPACING.lg }}>
            {visible.map((section) => (
              <li
                key={section.href}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.md,
                  padding: SPACING.md,
                  marginBottom: SPACING.md,
                  background: COLORS.creamRaised,
                }}
              >
                <h2 style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.xs} 0` }}>{section.title}</h2>
                <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted, margin: `0 0 ${SPACING.sm} 0` }}>{section.description}</p>
                <div dangerouslySetInnerHTML={{ __html: renderButton({ label: `前往${section.title}`, href: section.href, variant: 'secondary' }) }} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
