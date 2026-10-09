import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING } from '@jp/ui';
import { resolveRepository } from '@/lib/catalog-db';
import { ProductCard } from '../../product-card';
import { SiteNav } from '../../site-nav';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: { readonly params: Promise<{ readonly category: string }> }): Promise<ReactNode> {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  const repo = await resolveRepository();
  const products = await repo.list({ category: decoded, limit: 60 });

  return (
    <>
      <SiteNav current="/categories" />
      <main id="main">
        <nav aria-label="麵包屑" style={{ marginBottom: SPACING.md }}>
          <a href="/categories" style={{ color: COLORS.brandDeep, fontSize: FONT_SIZE.body }}>
            商品分類
          </a>
          <span aria-hidden="true"> / </span>
          <span>{decoded}</span>
        </nav>
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.lg} 0` }}>{decoded}</h1>
        {products.length === 0 ? (
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>此分類目前沒有已發布商品，請改用搜尋或聯絡客服。</p>
        ) : (
          <div className="jp-grid">
            {products.map((product) => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
