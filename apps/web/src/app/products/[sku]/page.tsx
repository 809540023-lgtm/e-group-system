import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING, renderButton, renderQuantityStepper, renderStatusBadge, SUPPLY_MODE_TEXT, type SupplyModeLabel } from '@jp/ui';
import { formatMoney, twd } from '@jp/domain';
import { resolveRepository } from '@/lib/catalog-db';
import { SiteNav } from '../../site-nav';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { readonly params: Promise<{ readonly sku: string }> }): Promise<ReactNode> {
  const { sku } = await params;
  const repo = await resolveRepository();
  const product = await repo.bySku(decodeURIComponent(sku));

  if (product === null) {
    return (
      <>
        <SiteNav />
        <main id="main">
          <h1 style={{ fontSize: FONT_SIZE.headingLarge }}>找不到此商品</h1>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>商品可能已下架，請回商品分類重新選擇。</p>
          <div dangerouslySetInnerHTML={{ __html: renderButton({ label: '回商品分類', href: '/categories', variant: 'secondary' }) }} />
        </main>
      </>
    );
  }

  const mode = product.supplyMode as SupplyModeLabel;
  const tone = mode === 'in_stock' ? 'success' : mode === 'preorder' ? 'progress' : 'warning';
  const description = mode === 'in_stock' ? '可立即出貨' : mode === 'preorder' ? '需向日本下單後出貨' : '需先詢問供貨';
  const badge = renderStatusBadge({ label: SUPPLY_MODE_TEXT[mode], tone, description });
  const stepper = renderQuantityStepper({ name: 'quantity', value: 1, max: 99 });
  const addButton = renderButton({ label: '加入購物車', type: 'submit', ariaLabel: `將 ${product.titleZh} 加入購物車` });
  const inquiryButton = renderButton({ label: '詢問供貨', href: '/support', variant: 'secondary' });

  return (
    <>
      <SiteNav />
      <main id="main">
        <nav aria-label="麵包屑" style={{ marginBottom: SPACING.md }}>
          <a href="/categories" style={{ color: COLORS.brandDeep, fontSize: FONT_SIZE.body }}>
            商品分類
          </a>
          <span aria-hidden="true"> / </span>
          <a href={`/categories/${encodeURIComponent(product.category)}`} style={{ color: COLORS.brandDeep, fontSize: FONT_SIZE.body }}>
            {product.category}
          </a>
        </nav>

        <article style={{ display: 'grid', gap: SPACING.lg, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div>
            {product.assetId === null ? (
              <div
                role="img"
                aria-label={`${product.titleZh} 尚無商品圖`}
                style={{ background: COLORS.creamSunken, borderRadius: RADIUS.lg, minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.inkMuted }}
              >
                尚無商品圖
              </div>
            ) : (
              <img
                src={`/api/assets/${encodeURIComponent(product.assetId)}`}
                alt={`${product.titleZh} 商品圖`}
                style={{ width: '100%', height: 'auto', borderRadius: RADIUS.lg, background: COLORS.creamSunken }}
              />
            )}
          </div>

          <div>
            <h1 style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>{product.titleZh}</h1>
            {product.titleJa === null ? null : (
              <p style={{ fontSize: FONT_SIZE.caption, color: COLORS.inkMuted, margin: `0 0 ${SPACING.sm} 0` }}>{product.titleJa}</p>
            )}
            <p style={{ fontSize: FONT_SIZE.price, fontWeight: 700, color: COLORS.brandDeep, margin: `0 0 ${SPACING.sm} 0` }}>
              {formatMoney(twd(product.saleTwd))}
            </p>
            <div dangerouslySetInnerHTML={{ __html: badge }} />

            <dl style={{ fontSize: FONT_SIZE.body, margin: `${SPACING.md} 0` }}>
              <dt style={{ fontWeight: 700 }}>規格</dt>
              <dd style={{ margin: `0 0 ${SPACING.sm} 0` }}>{product.spec ?? '未提供'}</dd>
              <dt style={{ fontWeight: 700 }}>單位</dt>
              <dd style={{ margin: `0 0 ${SPACING.sm} 0` }}>{product.unitsPerPack} 件／組</dd>
              <dt style={{ fontWeight: 700 }}>產地</dt>
              <dd style={{ margin: `0 0 ${SPACING.sm} 0` }}>{product.origin === 'JP' ? '日本' : product.origin}</dd>
              <dt style={{ fontWeight: 700 }}>到貨區間</dt>
              <dd style={{ margin: `0 0 ${SPACING.sm} 0` }}>{product.arrivalWindow}</dd>
              <dt style={{ fontWeight: 700 }}>費用條件</dt>
              <dd style={{ margin: `0 0 ${SPACING.sm} 0` }}>售價為商品金額，運費於結帳第二步顯示，不隱藏。</dd>
              <dt style={{ fontWeight: 700 }}>合法商品說明</dt>
              <dd style={{ margin: `0 0 ${SPACING.sm} 0` }}>
                {product.complianceApproved ? '已完成合法銷售審核。' : '尚未完成合法銷售審核，暫不開放結帳。'}
              </dd>
            </dl>

            {mode === 'inquiry' ? (
              <div dangerouslySetInnerHTML={{ __html: inquiryButton }} />
            ) : (
              <form method="post" action="/cart/add">
                <input type="hidden" name="sku" value={product.sku} />
                <div dangerouslySetInnerHTML={{ __html: stepper }} />
                <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: addButton }} />
              </form>
            )}
          </div>
        </article>
      </main>
    </>
  );
}
