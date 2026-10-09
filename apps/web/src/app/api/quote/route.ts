import { NextResponse } from 'next/server';
import { AppError } from '@jp/domain';
import { parseCart } from '@/lib/cart';
import { resolveRepository } from '@/lib/catalog-db';
import { buildServerQuote, fixtureInventory } from '@/lib/quote';

export const dynamic = 'force-dynamic';

interface QuoteBody {
  readonly lines?: readonly { readonly sku?: unknown; readonly quantity?: unknown }[];
  readonly shipping?: unknown;
}

/** 報價 API：伺服器重新讀取售價、版本、可售量與配送規則。 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const rawLines = Array.isArray(body.lines)
    ? body.lines
    : parseCart(request.headers.get('cookie')?.match(/jp_cart=([^;]+)/)?.[1]).map((l) => ({ sku: l.sku, quantity: l.quantity }));

  const lines = rawLines
    .map((l) => ({ sku: typeof l.sku === 'string' ? l.sku : '', quantity: typeof l.quantity === 'number' ? l.quantity : Number.NaN }))
    .filter((l) => l.sku !== '' && Number.isInteger(l.quantity) && l.quantity > 0);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'EMPTY_CART', message: '購物車為空' }, { status: 400 });
  }

  const shipping = typeof body.shipping === 'string' ? body.shipping : 'tw_home';
  const repo = await resolveRepository();

  try {
    const quote = await buildServerQuote({
      quoteId: crypto.randomUUID(),
      lines,
      shippingOptionCode: shipping,
      repo,
      inventory: async (skus) => {
        const products = await Promise.all(skus.map((sku) => repo.bySku(sku)));
        return fixtureInventory(products.filter((p): p is NonNullable<typeof p> => p !== null));
      },
    });
    return NextResponse.json({ quote });
  } catch (cause) {
    if (cause instanceof AppError) {
      return NextResponse.json({ error: cause.error_code, message: cause.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'INTERNAL', message: cause instanceof Error ? cause.message : '報價失敗' }, { status: 500 });
  }
}
