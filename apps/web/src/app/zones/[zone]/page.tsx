import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING } from '@jp/ui';
import { resolveRepository } from '@/lib/catalog-db';
import { ProductCard } from '../../product-card';
import { SiteNav } from '../../site-nav';

export const dynamic = 'force-dynamic';

export default async function ZonePage({ params }: { readonly params: Promise<{ readonly zone: string }> }): Promise<ReactNode> {
  const { zone } = await params;
  const decoded = decodeURIComponent(zone);
  const repo = await resolveRepository();
  const products = await repo.list({ zone: decoded, limit: 60 });

  return (
    <>
      <SiteNav />
      <main id="main">
        <nav aria-label="麵包屑" style={{ marginBottom: SPACING.md }}>
          <a href="/" style={{ color: COLORS.brandDeep, fontSize: FONT_SIZE.body }}>
            首頁
          </a>
          <span aria-hidden="true"> / </span>
          <span>{decoded}</span>
        </nav>
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.lg} 0` }}>{decoded}</h1>
        {products.length === 0 ? (
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>此專區目前沒有已發布商品。</p>
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
