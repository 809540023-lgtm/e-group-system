import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING } from '@jp/ui';
import { resolveRepository } from '@/lib/catalog-db';
import { ProductCard } from '../product-card';
import { SiteNav } from '../site-nav';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage(): Promise<ReactNode> {
  const repo = await resolveRepository();
  const categories = await repo.categories();
  const groups = await Promise.all(
    categories.map(async (category) => ({ category, products: await repo.list({ category, limit: 6 }) })),
  );

  return (
    <>
      <SiteNav current="/categories" />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.lg} 0` }}>商品分類</h1>
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`cat-${group.category}`} style={{ marginBottom: SPACING.xl }}>
            <h2 id={`cat-${group.category}`} style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
              <a href={`/categories/${encodeURIComponent(group.category)}`} style={{ color: COLORS.brandDeep }}>
                {group.category}
              </a>
            </h2>
            {group.products.length === 0 ? (
              <p style={{ color: COLORS.inkMuted }}>此分類目前沒有已發布商品。</p>
            ) : (
              <div className="jp-grid">
                {group.products.map((product) => (
                  <ProductCard key={product.sku} product={product} />
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
    </>
  );
}
