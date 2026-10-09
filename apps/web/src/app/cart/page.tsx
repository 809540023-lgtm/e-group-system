import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING, renderButton, renderEmptyState, renderQuantityStepper, renderStatusBadge, SUPPLY_MODE_TEXT, type SupplyModeLabel } from '@jp/ui';
import { formatMoney, twd } from '@jp/domain';
import { readCart } from '@/lib/cart';
import { resolveRepository } from '@/lib/catalog-db';
import { SiteNav } from '../site-nav';

export const dynamic = 'force-dynamic';

export default async function CartPage(): Promise<ReactNode> {
  const lines = await readCart();
  const repo = await resolveRepository();
  const products = await Promise.all(lines.map((l) => repo.bySku(l.sku)));
  const rows = lines
    .map((line, index) => ({ line, product: products[index] ?? null }))
    .filter((row): row is { line: (typeof lines)[number]; product: NonNullable<(typeof products)[number]> } => row.product !== null);

  const subtotal = rows.reduce((sum, row) => sum + row.product.saleTwd * row.line.quantity, 0);

  return (
    <>
      <SiteNav current="/cart" />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.lg} 0` }}>購物車</h1>

        {rows.length === 0 ? (
          <div
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '購物車是空的',
                description: '先挑選商品再加入購物車，結帳前會顯示完整費用。',
                actionLabel: '看商品分類',
                actionHref: '/categories',
              }),
            }}
          />
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT_SIZE.body }}>
              <caption style={{ textAlign: 'left', color: COLORS.inkMuted, fontSize: FONT_SIZE.caption }}>
                商品、狀態、價格、數量與配送方式
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left', padding: SPACING.sm }}>
                    商品
                  </th>
                  <th scope="col" style={{ textAlign: 'left', padding: SPACING.sm }}>
                    狀態
                  </th>
                  <th scope="col" style={{ textAlign: 'right', padding: SPACING.sm }}>
                    價格
                  </th>
                  <th scope="col" style={{ textAlign: 'left', padding: SPACING.sm }}>
                    數量
                  </th>
                  <th scope="col" style={{ textAlign: 'left', padding: SPACING.sm }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ line, product }) => {
                  const mode = product.supplyMode as SupplyModeLabel;
                  const tone = mode === 'in_stock' ? 'success' : mode === 'preorder' ? 'progress' : 'warning';
                  const description = mode === 'in_stock' ? '可立即出貨' : mode === 'preorder' ? '需向日本下單後出貨' : '需先詢問供貨';
                  return (
                    <tr key={line.sku} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: SPACING.sm }}>
                        <a href={`/products/${encodeURIComponent(product.sku)}`} style={{ color: COLORS.ink, fontSize: FONT_SIZE.bodyLarge }}>
                          {product.titleZh}
                        </a>
                        <div style={{ fontSize: FONT_SIZE.caption, color: COLORS.inkMuted }}>{product.spec ?? ''}</div>
                      </td>
                      <td style={{ padding: SPACING.sm }}>
                        <span dangerouslySetInnerHTML={{ __html: renderStatusBadge({ label: SUPPLY_MODE_TEXT[mode], tone, description }) }} />
                      </td>
                      <td style={{ padding: SPACING.sm, textAlign: 'right', fontSize: FONT_SIZE.priceSmall, fontWeight: 700, color: COLORS.brandDeep }}>
                        {formatMoney(twd(product.saleTwd * line.quantity))}
                      </td>
                      <td style={{ padding: SPACING.sm }}>
                        <form method="post" action="/cart/update">
                          <input type="hidden" name="sku" value={product.sku} />
                          <div dangerouslySetInnerHTML={{ __html: renderQuantityStepper({ name: 'quantity', value: line.quantity, max: 99 }) }} />
                          <div style={{ marginTop: SPACING.sm }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '更新數量', type: 'submit', variant: 'secondary' }) }} />
                        </form>
                      </td>
                      <td style={{ padding: SPACING.sm }}>
                        <form method="post" action="/cart/remove">
                          <input type="hidden" name="sku" value={product.sku} />
                          <div dangerouslySetInnerHTML={{ __html: renderButton({ label: '刪除', type: 'submit', variant: 'quiet', ariaLabel: `從購物車刪除 ${product.titleZh}` }) }} />
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p style={{ fontSize: FONT_SIZE.priceSmall, fontWeight: 700, marginTop: SPACING.lg }}>
              商品合計：{formatMoney(twd(subtotal))}
            </p>
            <p style={{ fontSize: FONT_SIZE.caption, color: COLORS.inkMuted }}>運費與稅費於結帳第二步顯示，不隱藏。</p>
            <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '前往結帳', href: '/checkout' }) }} />
          </>
        )}
      </main>
    </>
  );
}
