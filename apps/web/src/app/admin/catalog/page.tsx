import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderButton, renderEmptyState } from '@jp/ui';
import { AdminGuard } from '../admin-guard';

export const dynamic = 'force-dynamic';

/**
 * 商品草稿與上架（規劃書 04、05 章；模組 04、05）。
 *
 * 同步差異需人工檢視後才發布；售價不得在已核准價格上再次加價。
 */
export default async function AdminCatalogPage(): Promise<ReactNode> {
  return (
    <AdminGuard permission="catalog.draft.edit" title="商品草稿與上架">
      {() => (
        <>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            來源為 Google Drive 的 ApprovedCatalog 工作表。同步後會產生差異清單，需人工檢視並核准才發布。
          </p>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.9 }}>
            <li>新增商品：需補齊中文品名、規格、產地、供貨模式與合規欄位。</li>
            <li>價格變動：超過 15% 需人工確認，且不得在來源已含加價的售價上再次加價。</li>
            <li>下架：來源消失或合規未通過時，先封存而非直接刪除。</li>
          </ul>
          <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '觸發同步預覽', href: '/admin/catalog/sync', variant: 'secondary' }) }} />
          <div
            style={{ marginTop: SPACING.lg }}
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '尚未設定 Google 憑證',
                description: '未設定服務帳號時，同步狀態為 integration_pending，不會以假資料假裝成功。',
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
