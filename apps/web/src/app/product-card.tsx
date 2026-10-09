import type { ReactNode } from 'react';
import { renderProductCard, renderStatusBadge, SUPPLY_MODE_TEXT, type SupplyModeLabel } from '@jp/ui';
import { twd } from '@jp/domain';
import type { PublicProduct } from '@/lib/catalog';

export function ProductCard({ product }: { readonly product: PublicProduct }): ReactNode {
  const html = renderProductCard({
    title: product.titleZh,
    ...(product.spec === null ? {} : { spec: product.spec }),
    price: twd(product.saleTwd),
    supplyMode: product.supplyMode as SupplyModeLabel,
    href: `/products/${encodeURIComponent(product.sku)}`,
    arrivalWindow: product.arrivalWindow,
    origin: product.origin === 'JP' ? '日本' : product.origin,
    ...(product.assetId === null ? {} : { imageUrl: `/api/assets/${encodeURIComponent(product.assetId)}` }),
    imageAlt: `${product.titleZh} 商品圖`,
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SupplyBadge({ mode }: { readonly mode: SupplyModeLabel }): ReactNode {
  const tone = mode === 'in_stock' ? 'success' : mode === 'preorder' ? 'progress' : 'warning';
  const description = mode === 'in_stock' ? '可立即出貨' : mode === 'preorder' ? '需向日本下單後出貨' : '需先詢問供貨';
  const html = renderStatusBadge({ label: SUPPLY_MODE_TEXT[mode], tone, description });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
