import { NextResponse } from 'next/server';
import { resolveRepository } from '@/lib/catalog-db';
import { toPublicJson } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

/** 公開商品 API：只輸出已發布版本，成本欄位不出現。 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const repo = await resolveRepository();
  const sku = url.searchParams.get('sku');
  if (sku !== null) {
    const product = await repo.bySku(sku);
    if (product === null) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ source: repo.kind, product: toPublicJson(product) });
  }
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw === null ? 60 : Math.min(Math.max(Number.parseInt(limitRaw, 10) || 60, 1), 200);
  const products = await repo.list({
    ...(url.searchParams.get('category') === null ? {} : { category: url.searchParams.get('category') as string }),
    ...(url.searchParams.get('zone') === null ? {} : { zone: url.searchParams.get('zone') as string }),
    ...(url.searchParams.get('q') === null ? {} : { keyword: url.searchParams.get('q') as string }),
    limit,
  });
  return NextResponse.json({ source: repo.kind, count: products.length, products: products.map(toPublicJson) });
}
