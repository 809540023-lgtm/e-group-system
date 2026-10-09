import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@jp/ui';
import { resolveRepository } from '@/lib/catalog-db';
import { CATEGORIES, ZONES } from '@/lib/catalog';
import { ProductCard } from './product-card';
import { SiteNav } from './site-nav';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactNode> {
  const repo = await resolveRepository();
  const [recent, inStock, preorder] = await Promise.all([
    repo.list({ limit: 8 }),
    repo.list({ zone: '臺灣現貨', limit: 4 }),
    repo.list({ zone: '日本預購', limit: 4 }),
  ]);

  return (
    <>
      <SiteNav current="/" />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.sm} 0` }}>日本日貨代購</h1>
        <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted, margin: `0 0 ${SPACING.lg} 0` }}>
          日本商品代購與臺灣現貨：選好商品加入購物車，結帳後可查付款、採購、出貨與物流進度。
        </p>

        <section aria-labelledby="categories">
          <h2 id="categories" style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
            商品分類
          </h2>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, listStyle: 'none', padding: 0, margin: `0 0 ${SPACING.lg} 0` }}>
            {CATEGORIES.map((category) => (
              <li key={category}>
                <a
                  href={`/categories/${encodeURIComponent(category)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: '48px',
                    padding: `0 ${SPACING.md}`,
                    border: `2px solid ${COLORS.brandDeep}`,
                    borderRadius: RADIUS.md,
                    color: COLORS.brandDeep,
                    textDecoration: 'none',
                    fontSize: FONT_SIZE.body,
                  }}
                >
                  {category}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="zones">
          <h2 id="zones" style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
            專區
          </h2>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, listStyle: 'none', padding: 0, margin: `0 0 ${SPACING.lg} 0` }}>
            {ZONES.map((zone) => (
              <li key={zone}>
                <a
                  href={`/zones/${encodeURIComponent(zone)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: '48px',
                    padding: `0 ${SPACING.md}`,
                    border: `2px solid ${COLORS.borderStrong}`,
                    borderRadius: RADIUS.md,
                    color: COLORS.ink,
                    textDecoration: 'none',
                    fontSize: FONT_SIZE.body,
                  }}
                >
                  {zone}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="recent">
          <h2 id="recent" style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
            近期商品
          </h2>
          <div className="jp-grid">
            {recent.map((product) => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>
        </section>

        <section aria-labelledby="stock" style={{ marginTop: SPACING.xl }}>
          <h2 id="stock" style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
            臺灣現貨
          </h2>
          <p style={{ color: COLORS.inkMuted, margin: `0 0 ${SPACING.md} 0` }}>現貨可立即出貨，到貨區間約 1–3 個工作天。</p>
          <div className="jp-grid">
            {inStock.map((product) => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>
        </section>

        <section aria-labelledby="preorder" style={{ marginTop: SPACING.xl }}>
          <h2 id="preorder" style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
            日本預購
          </h2>
          <p style={{ color: COLORS.inkMuted, margin: `0 0 ${SPACING.md} 0` }}>預購需向日本下單後出貨，到貨區間約 14–20 個工作天。</p>
          <div className="jp-grid">
            {preorder.map((product) => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>
        </section>

        <section aria-labelledby="support" style={{ marginTop: SPACING.xl }}>
          <h2 id="support" style={{ fontSize: FONT_SIZE.heading, margin: `0 0 ${SPACING.sm} 0` }}>
            客服
          </h2>
          <p style={{ fontSize: FONT_SIZE.body }}>
            客服時間：週一至週五 10:00–18:00（臺北時間）。可透過 <a href="/support">客服頁面</a> 或 LINE 官方帳號詢問，請提供訂單編號。
          </p>
        </section>
      </main>
    </>
  );
}
