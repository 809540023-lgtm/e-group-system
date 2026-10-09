import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addLine, cartCookieOptions, CART_COOKIE, parseCart, removeLine, serializeCart, setQuantity, type CartLine } from '@/lib/cart';

export const dynamic = 'force-dynamic';

async function readForm(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) params.set(key, String(value));
    return params;
  }
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of form.entries()) params.set(key, typeof value === 'string' ? value : '');
  return params;
}

export async function POST(request: Request, context: { readonly params: Promise<{ readonly action: string }> }): Promise<NextResponse> {
  const { action } = await context.params;
  const params = await readForm(request);
  const sku = params.get('sku') ?? '';
  const quantityRaw = params.get('quantity');
  const quantity = quantityRaw === null ? 1 : Number.parseInt(quantityRaw, 10);
  const safeQuantity = Number.isNaN(quantity) ? 1 : quantity;

  const store = await cookies();
  const lines = parseCart(store.get(CART_COOKIE)?.value);

  let next: readonly CartLine[];
  if (action === 'add') next = addLine(lines, sku, safeQuantity);
  else if (action === 'update') next = setQuantity(lines, sku, safeQuantity);
  else if (action === 'remove') next = removeLine(lines, sku);
  else return NextResponse.json({ error: 'UNKNOWN_CART_ACTION' }, { status: 400 });

  store.set(CART_COOKIE, serializeCart(next), cartCookieOptions());

  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  if (wantsJson) return NextResponse.json({ lines: next });
  return NextResponse.redirect(new URL('/cart', request.url), { status: 303 });
}
