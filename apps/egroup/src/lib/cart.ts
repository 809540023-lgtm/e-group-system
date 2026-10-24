import { cookies } from 'next/headers';
import { listProducts, type ProductRow } from './queries.ts';

const CART_COOKIE = 'eg_cart';

export type Cart = Record<string, number>;

export async function readCart(): Promise<Cart> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (raw === undefined) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const cart: Cart = {};
    for (const [sku, qty] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof qty === 'number' && Number.isInteger(qty) && qty > 0) cart[sku] = Math.min(qty, 99);
    }
    return cart;
  } catch {
    return {};
  }
}

export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies();
  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
  if (entries.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, JSON.stringify(Object.fromEntries(entries)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export interface CartLine {
  product: ProductRow;
  quantity: number;
  lineTotal: number;
}

export async function cartLines(): Promise<{ lines: CartLine[]; subtotal: number; count: number }> {
  const cart = await readCart();
  const skus = Object.keys(cart);
  if (skus.length === 0) return { lines: [], subtotal: 0, count: 0 };

  const products = await listProducts();
  const bySku = new Map(products.map((product) => [product.sku, product]));
  const lines: CartLine[] = [];
  let subtotal = 0;
  let count = 0;

  for (const sku of skus) {
    const product = bySku.get(sku);
    const quantity = cart[sku] ?? 0;
    if (product === undefined || quantity <= 0) continue;
    const lineTotal = product.price_twd * quantity;
    lines.push({ product, quantity, lineTotal });
    subtotal += lineTotal;
    count += quantity;
  }

  return { lines, subtotal, count };
}
