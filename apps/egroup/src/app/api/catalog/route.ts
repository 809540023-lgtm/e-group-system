import { json } from '../../../lib/api.ts';
import { listProducts } from '../../../lib/queries.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const allergens = (url.searchParams.get('excludeAllergens') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

  const filters: Parameters<typeof listProducts>[0] = { excludeAllergens: allergens };
  const search = url.searchParams.get('search');
  const category = url.searchParams.get('category');
  const storage = url.searchParams.get('storage');
  if (search !== null) filters.search = search;
  if (category !== null) filters.category = category;
  if (storage !== null) filters.storage = storage;

  const products = await listProducts(filters);

  return json({
    count: products.length,
    products: products.map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category,
      price_twd: product.price_twd,
      storage: product.storage,
      shelf_life_days: product.shelf_life_days,
      calories: product.calories,
      protein_g: Number(product.protein_g),
      allergens: product.allergens,
      claims: product.claims,
      available: Number(product.available),
    })),
  });
}
