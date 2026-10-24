import { createHmac } from 'node:crypto';
import { Client } from 'pg';
import { databaseUrl, pickupSecret } from '../src/lib/env.ts';
import { hashPassword } from '../src/lib/password.ts';

const connectionString = databaseUrl();
const PICKUP_SECRET = pickupSecret();
const DEMO_PASSWORD = 'demo1234';

const client = new Client({ connectionString });
await client.connect();

function day(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

function pickupHash(code: string): string {
  return createHmac('sha256', PICKUP_SECRET).update(code, 'utf8').digest('hex');
}

async function one<T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<T> {
  const result = await client.query<T>(sql, params as unknown[]);
  const row = result.rows[0];
  if (row === undefined) throw new Error(`預期一筆資料但沒有結果：${sql.slice(0, 60)}`);
  return row;
}

const SUPPLIERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: '綠野食研股份有限公司',
    reg: 'A-12345678-0001',
    haccp: 'verified',
    insurance: day(240),
    contact: '品保部 02-2345-6789',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: '海港鮮食有限公司',
    reg: 'A-23456789-0002',
    haccp: 'verified',
    insurance: day(180),
    contact: '品保部 02-3456-7890',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: '穀物工房有限公司',
    reg: 'A-34567890-0003',
    haccp: 'pending',
    insurance: day(90),
    contact: '品保部 02-4567-8901',
  },
] as const;

const STATIONS = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    code: 'EG-A01',
    name: '中山站前取貨站',
    type: 'A',
    address: '台北市中山區中山北路二段 45 號 1 樓',
    line: '淡水信義線',
    mrt: '中山',
    walk: 3,
    corridor: '中山－雙連',
    capacity: 180,
    fixedCost: 30000,
    hours: '11:00-21:00',
    contact: '站長 林怡君 02-2511-0001',
    scores: [28, 16, 18, 13, 12],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    code: 'EG-B01',
    name: '雙連自助冷鏈櫃',
    type: 'B',
    address: '台北市中山區民生西路 66 號 B1',
    line: '淡水信義線',
    mrt: '雙連',
    walk: 2,
    corridor: '中山－雙連',
    capacity: 90,
    fixedCost: 22000,
    hours: '24 小時',
    contact: '維運 陳柏宇 02-2555-0002',
    scores: [24, 18, 19, 14, 11],
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    code: 'EG-C01',
    name: '民權西路加熱站',
    type: 'C',
    address: '台北市中山區民權西路 88 號 1 樓',
    line: '中和新蘆線',
    mrt: '民權西路',
    walk: 5,
    corridor: '中山－雙連',
    capacity: 120,
    fixedCost: 48000,
    hours: '10:30-20:30',
    contact: '站長 黃士豪 02-2588-0003',
    scores: [22, 14, 16, 12, 10],
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    code: 'EG-D01',
    name: '大同區域補給站',
    type: 'D',
    address: '台北市大同區承德路三段 120 號',
    line: '淡水信義線',
    mrt: '圓山',
    walk: 8,
    corridor: '中山－雙連',
    capacity: 300,
    fixedCost: 65000,
    hours: '06:00-22:00',
    contact: '物流 張文豪 02-2599-0004',
    scores: [18, 19, 17, 15, 9],
  },
] as const;

const CUSTOMERS = [
  { id: 'f0000000-0000-4000-8000-000000000001', name: '林小美', phone: '0912-000-001', email: 'customer@egroup.tw', code: 'EGMIMI', allergens: ['花生'] },
  { id: 'f0000000-0000-4000-8000-000000000002', name: '陳大文', phone: '0912-000-002', email: 'customer2@egroup.tw', code: 'EGDAWEN', allergens: [] },
  { id: 'f0000000-0000-4000-8000-000000000003', name: '王雅婷', phone: '0912-000-003', email: 'customer3@egroup.tw', code: 'EGYATING', allergens: ['牛奶'] },
] as const;

interface ProductSeed {
  sku: string;
  name: string;
  category: string;
  description: string;
  supplier: number;
  price: number;
  cost: number;
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  satFat: number | null;
  carbs: number;
  sugar: number | null;
  sodium: number;
  allergens: string[];
  storage: 'frozen' | 'chilled' | 'ambient';
  shelfLife: number;
  heating: string;
  claims: string[];
}

const PRODUCTS: ProductSeed[] = [
  { sku: 'CHK-001', name: '舒肥雞胸佐藜麥', category: '主菜', description: '低溫舒肥雞胸，搭配藜麥與烤時蔬。', supplier: 0, price: 220, cost: 110, weight: 200, calories: 320, protein: 38, fat: 9, satFat: 2.4, carbs: 22, sugar: 3, sodium: 420, allergens: ['大豆'], storage: 'chilled', shelfLife: 5, heating: '微波 700W 90 秒，或電鍋加熱 8 分鐘。', claims: ['高蛋白'] },
  { sku: 'CHK-002', name: '香草雞腿排', category: '主菜', description: '香草醃漬去骨雞腿排，氣炸後鎖住肉汁。', supplier: 0, price: 240, cost: 120, weight: 220, calories: 380, protein: 32, fat: 18, satFat: 5.1, carbs: 20, sugar: 2, sodium: 520, allergens: ['牛奶'], storage: 'chilled', shelfLife: 5, heating: '氣炸 180°C 6 分鐘。', claims: ['高蛋白'] },
  { sku: 'CHK-003', name: '椒麻雞胸', category: '主菜', description: '花椒與青花椒調味，微麻不辣。', supplier: 0, price: 230, cost: 115, weight: 200, calories: 310, protein: 36, fat: 10, satFat: 2.8, carbs: 18, sugar: 4, sodium: 600, allergens: ['花生', '芝麻'], storage: 'chilled', shelfLife: 5, heating: '微波 700W 90 秒。', claims: ['高蛋白'] },
  { sku: 'BEF-001', name: '番茄燉牛肉', category: '主菜', description: '紐澳牛腱低溫燉煮，番茄基底。', supplier: 1, price: 260, cost: 140, weight: 250, calories: 360, protein: 30, fat: 14, satFat: 5.6, carbs: 28, sugar: 8, sodium: 560, allergens: ['含麩質穀物'], storage: 'frozen', shelfLife: 30, heating: '完全解凍後微波 700W 2 分鐘。', claims: ['高蛋白'] },
  { sku: 'FSH-001', name: '味噌鮭魚', category: '主菜', description: '挪威鮭魚佐白味噌，附檸檬角。', supplier: 1, price: 280, cost: 150, weight: 180, calories: 300, protein: 26, fat: 16, satFat: 3.2, carbs: 12, sugar: 5, sodium: 480, allergens: ['魚類', '大豆'], storage: 'frozen', shelfLife: 30, heating: '氣炸 180°C 8 分鐘。', claims: ['高蛋白'] },
  { sku: 'FSH-002', name: '檸檬鯖魚', category: '主菜', description: '薄鹽鯖魚，檸檬與黑胡椒調味。', supplier: 1, price: 270, cost: 140, weight: 180, calories: 340, protein: 28, fat: 20, satFat: 4.8, carbs: 8, sugar: 1, sodium: 450, allergens: ['魚類'], storage: 'frozen', shelfLife: 30, heating: '氣炸 190°C 7 分鐘。', claims: ['高蛋白'] },
  { sku: 'VEG-001', name: '烤時蔬藜麥', category: '配菜', description: '季節時蔬與三色藜麥，橄欖油輕調味。', supplier: 0, price: 160, cost: 70, weight: 200, calories: 220, protein: 8, fat: 7, satFat: 1.1, carbs: 32, sugar: 6, sodium: 260, allergens: [], storage: 'chilled', shelfLife: 4, heating: '微波 700W 60 秒。', claims: ['高纖'] },
  { sku: 'VEG-002', name: '胡麻菠菜', category: '配菜', description: '嫩菠菜佐日式胡麻醬。', supplier: 0, price: 90, cost: 40, weight: 120, calories: 140, protein: 6, fat: 9, satFat: 1.4, carbs: 10, sugar: 3, sodium: 300, allergens: ['芝麻'], storage: 'chilled', shelfLife: 3, heating: '冷藏直接食用。', claims: [] },
  { sku: 'VEG-003', name: '南瓜濃湯', category: '湯品', description: '台灣南瓜與鮮奶熬煮，無添加麵粉。', supplier: 0, price: 120, cost: 50, weight: 250, calories: 180, protein: 4, fat: 6, satFat: 3.5, carbs: 28, sugar: 12, sodium: 380, allergens: ['牛奶'], storage: 'frozen', shelfLife: 30, heating: '微波 700W 2 分鐘。', claims: [] },
  { sku: 'GRN-001', name: '糙米藜麥飯', category: '主食', description: '糙米與藜麥 3:1，獨立真空包。', supplier: 2, price: 60, cost: 25, weight: 180, calories: 260, protein: 7, fat: 3, satFat: 0.6, carbs: 50, sugar: 0, sodium: 5, allergens: [], storage: 'frozen', shelfLife: 60, heating: '微波 700W 90 秒。', claims: ['低脂'] },
  { sku: 'GRN-002', name: '地瓜泥', category: '主食', description: '台農 66 號地瓜，無糖無油。', supplier: 2, price: 70, cost: 30, weight: 150, calories: 180, protein: 3, fat: 1, satFat: 0.2, carbs: 40, sugar: 9, sodium: 30, allergens: [], storage: 'frozen', shelfLife: 60, heating: '微波 700W 60 秒。', claims: ['低脂'] },
  { sku: 'GRN-003', name: '花椰菜米', category: '主食', description: '白花椰菜切碎，低碳水替代主食。', supplier: 0, price: 80, cost: 35, weight: 200, calories: 70, protein: 5, fat: 1, satFat: 0.2, carbs: 10, sugar: 4, sodium: 40, allergens: [], storage: 'frozen', shelfLife: 60, heating: '平底鍋乾炒 3 分鐘。', claims: ['低脂'] },
  { sku: 'SID-001', name: '胡麻醬', category: '醬料', description: '日式胡麻醬，單包 30 公克。', supplier: 2, price: 25, cost: 10, weight: 30, calories: 120, protein: 3, fat: 10, satFat: 1.6, carbs: 4, sugar: 2, sodium: 180, allergens: ['芝麻', '大豆'], storage: 'ambient', shelfLife: 90, heating: '常溫使用。', claims: [] },
  { sku: 'SID-002', name: '和風醬', category: '醬料', description: '鰹魚和風醬，單包 30 公克。', supplier: 2, price: 25, cost: 10, weight: 30, calories: 45, protein: 1, fat: 2, satFat: 0.3, carbs: 5, sugar: 3, sodium: 320, allergens: ['含麩質穀物', '大豆'], storage: 'ambient', shelfLife: 90, heating: '常溫使用。', claims: [] },
  { sku: 'FAM-001', name: '雙人家庭組 A', category: '組合', description: '主菜 2 份、配菜 2 份、主食 2 份。', supplier: 0, price: 480, cost: 240, weight: 500, calories: 760, protein: 60, fat: 28, satFat: 8.2, carbs: 60, sugar: 10, sodium: 980, allergens: ['大豆', '牛奶'], storage: 'chilled', shelfLife: 5, heating: '各品項依標示加熱。', claims: ['高蛋白'] },
  { sku: 'FAM-002', name: '三至五餐週計畫', category: '組合', description: '冷凍主菜 3 份、主食 3 份、醬料 3 包。', supplier: 1, price: 1080, cost: 540, weight: 1200, calories: 1800, protein: 120, fat: 60, satFat: 18, carbs: 160, sugar: 22, sodium: 2200, allergens: ['魚類', '大豆', '含麩質穀物'], storage: 'frozen', shelfLife: 30, heating: '各品項依標示加熱。', claims: ['高蛋白'] },
];

interface BatchSeed {
  sku: string;
  lot: string;
  produced: number;
  expires: number;
  qty: number;
  station: string;
  temp: number;
}

const BATCHES: BatchSeed[] = [
  { sku: 'CHK-001', lot: 'L2601-CHK001-A', produced: -1, expires: 4, qty: 60, station: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', temp: 3.2 },
  { sku: 'CHK-001', lot: 'L2601-CHK001-B', produced: -2, expires: 3, qty: 40, station: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', temp: 3.0 },
  { sku: 'CHK-002', lot: 'L2601-CHK002-A', produced: -1, expires: 4, qty: 50, station: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', temp: 3.4 },
  { sku: 'CHK-003', lot: 'L2601-CHK003-A', produced: -1, expires: 4, qty: 45, station: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', temp: 3.1 },
  { sku: 'BEF-001', lot: 'L2601-BEF001-A', produced: -5, expires: 25, qty: 80, station: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', temp: -18.2 },
  { sku: 'FSH-001', lot: 'L2601-FSH001-A', produced: -4, expires: 26, qty: 70, station: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', temp: -18.6 },
  { sku: 'FSH-002', lot: 'L2601-FSH002-A', produced: -4, expires: 26, qty: 60, station: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', temp: -18.4 },
  { sku: 'VEG-001', lot: 'L2601-VEG001-A', produced: -1, expires: 3, qty: 70, station: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', temp: 3.3 },
  { sku: 'VEG-002', lot: 'L2601-VEG002-A', produced: -1, expires: 2, qty: 50, station: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', temp: 3.5 },
  { sku: 'VEG-003', lot: 'L2601-VEG003-A', produced: -6, expires: 24, qty: 40, station: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', temp: -18.1 },
  { sku: 'GRN-001', lot: 'L2601-GRN001-A', produced: -7, expires: 53, qty: 120, station: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', temp: -18.5 },
  { sku: 'GRN-002', lot: 'L2601-GRN002-A', produced: -7, expires: 53, qty: 100, station: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', temp: -18.3 },
  { sku: 'GRN-003', lot: 'L2601-GRN003-A', produced: -6, expires: 54, qty: 60, station: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', temp: -18.7 },
  { sku: 'SID-001', lot: 'L2601-SID001-A', produced: -10, expires: 80, qty: 200, station: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', temp: 22.0 },
  { sku: 'SID-002', lot: 'L2601-SID002-A', produced: -10, expires: 80, qty: 200, station: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', temp: 22.0 },
  { sku: 'FAM-001', lot: 'L2601-FAM001-A', produced: -1, expires: 4, qty: 30, station: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', temp: 3.2 },
  { sku: 'FAM-002', lot: 'L2601-FAM002-A', produced: -5, expires: 25, qty: 25, station: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', temp: -18.2 },
];

try {
  await client.query('BEGIN');

  for (const supplier of SUPPLIERS) {
    await client.query(
      `INSERT INTO suppliers(id, name, food_business_reg_no, haccp_status, insurance_expires_on, recall_contact)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, haccp_status = EXCLUDED.haccp_status,
         insurance_expires_on = EXCLUDED.insurance_expires_on, recall_contact = EXCLUDED.recall_contact`,
      [supplier.id, supplier.name, supplier.reg, supplier.haccp, supplier.insurance, supplier.contact],
    );
  }

  for (const station of STATIONS) {
    await client.query(
      `INSERT INTO stations(id, code, name, type, address, mrt_line, mrt_station, walk_minutes, corridor,
         status, capacity, opening_hours, contact, demand_score, cost_score, cold_chain_score,
         replenishment_score, competition_score, food_safety_pass, venue_pass, monthly_fixed_cost_twd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12,$13,$14,$15,$16,$17,true,true,$18)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address,
         capacity = EXCLUDED.capacity, opening_hours = EXCLUDED.opening_hours, contact = EXCLUDED.contact,
         monthly_fixed_cost_twd = EXCLUDED.monthly_fixed_cost_twd`,
      [
        station.id, station.code, station.name, station.type, station.address, station.line, station.mrt,
        station.walk, station.corridor, station.capacity, station.hours, station.contact,
        ...station.scores, station.fixedCost,
      ],
    );
  }

  // 計畫書第十四章：試點資金分三關放款，資金承諾與現金部位是擴點關卡的證據來源。
  const FUNDING = [
    { label: '創辦人資本', amount: 1_500_000, status: 'received', note: '第一階段自有資金' },
    { label: '設備租賃融資', amount: 450_000, status: 'received', note: '冷鏈設備與感測器' },
    { label: '首批存貨週轉', amount: 300_000, status: 'received', note: '供應商付款條件' },
    { label: '下一站設備採購', amount: 450_000, status: 'committed', note: '試點達標後才投入' },
  ] as const;

  for (const item of FUNDING) {
    await client.query(
      `INSERT INTO funding_commitments(label, amount_twd, status, note)
       SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM funding_commitments WHERE label = $1)`,
      [item.label, item.amount, item.status, item.note],
    );
  }

  await client.query(
    `INSERT INTO cash_positions(as_of, available_twd, committed_obligations_twd, worst_case_twd, note)
     VALUES (current_date, 1850000, 620000, 1230000, '試點期每月更新')
     ON CONFLICT (as_of) DO UPDATE SET available_twd = EXCLUDED.available_twd,
       committed_obligations_twd = EXCLUDED.committed_obligations_twd,
       worst_case_twd = EXCLUDED.worst_case_twd, note = EXCLUDED.note`,
  );

  for (const customer of CUSTOMERS) {
    await client.query(
      `INSERT INTO customers(id, name, phone, email, referral_code, allergens)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone,
         email = EXCLUDED.email, allergens = EXCLUDED.allergens`,
      [customer.id, customer.name, customer.phone, customer.email, customer.code, customer.allergens],
    );
  }

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const accounts = [
    { email: 'admin@egroup.tw', role: 'admin', name: '總部管理者', customer: null, supplier: null, station: null },
    { email: 'supplier@egroup.tw', role: 'supplier', name: '綠野食研品保', customer: null, supplier: SUPPLIERS[0].id, station: null },
    { email: 'station@egroup.tw', role: 'station', name: '中山站前取貨站', customer: null, supplier: null, station: STATIONS[0].id },
    { email: 'customer@egroup.tw', role: 'customer', name: '林小美', customer: CUSTOMERS[0].id, supplier: null, station: null },
    { email: 'customer2@egroup.tw', role: 'customer', name: '陳大文', customer: CUSTOMERS[1].id, supplier: null, station: null },
  ] as const;

  for (const account of accounts) {
    await client.query(
      `INSERT INTO accounts(email, password_hash, role, display_name, customer_id, supplier_id, station_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name, active = true`,
      [account.email, passwordHash, account.role, account.name, account.customer, account.supplier, account.station],
    );
  }

  for (const product of PRODUCTS) {
    await client.query(
      `INSERT INTO products(sku, name, category, description, supplier_id, price_twd, cost_twd, weight_g,
         calories, protein_g, fat_g, saturated_fat_g, carbs_g, sugar_g, sodium_mg, allergens, storage,
         shelf_life_days, heating_instructions, claims, status, nutrition_reviewed_by, nutrition_reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'active','營養師 王思涵',now())
       ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, price_twd = EXCLUDED.price_twd,
         cost_twd = EXCLUDED.cost_twd, description = EXCLUDED.description, status = 'active',
         allergens = EXCLUDED.allergens, claims = EXCLUDED.claims`,
      [
        product.sku, product.name, product.category, product.description, SUPPLIERS[product.supplier].id,
        product.price, product.cost, product.weight, product.calories, product.protein, product.fat,
        product.satFat, product.carbs, product.sugar, product.sodium, product.allergens, product.storage,
        product.shelfLife, product.heating, product.claims,
      ],
    );
  }

  for (const batch of BATCHES) {
    const product = PRODUCTS.find((item) => item.sku === batch.sku);
    if (product === undefined) throw new Error(`未知 SKU：${batch.sku}`);
    const row = await one<{ id: string }>(
      `INSERT INTO batches(sku, supplier_id, lot_no, produced_on, expires_on, quantity_received,
         quantity_available, status, received_temp_c, station_id)
       VALUES ($1,$2,$3,$4,$5,$6,$6,'available',$7,$8)
       ON CONFLICT (sku, lot_no) DO UPDATE SET quantity_available = EXCLUDED.quantity_available
       RETURNING id`,
      [batch.sku, SUPPLIERS[product.supplier].id, batch.lot, day(batch.produced), day(batch.expires), batch.qty, batch.temp, batch.station],
    );

    await client.query(
      `INSERT INTO inspection_docs(batch_id, doc_type, file_name, file_hash, issued_on, valid_until, scope, uploaded_by)
       SELECT $1, '檢驗報告', $2, encode(digest($2, 'sha256'), 'hex'), $3, $4, '微生物、重金屬、營養標示', 'supplier@egroup.tw'
       WHERE NOT EXISTS (SELECT 1 FROM inspection_docs WHERE batch_id = $1 AND doc_type = '檢驗報告')`,
      [row.id, `${batch.lot}-inspection.pdf`, day(batch.produced), day(batch.expires)],
    );

    await client.query(
      `INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor, note)
       SELECT $1, $2, 'receive', $3, 'seed', $4, 'seed', '初始入庫'
       WHERE NOT EXISTS (SELECT 1 FROM inventory_movements WHERE batch_id = $1 AND type = 'receive')`,
      [row.id, batch.station, batch.qty, batch.lot],
    );
  }

  const equipment = [
    { asset: 'EG-FRZ-0001', type: '冷凍櫃', station: STATIONS[0].id, serial: 'FRZ-2026-0001', owner: 'EG 總部', price: 68000, next: day(20), status: 'active' },
    { asset: 'EG-CHL-0001', type: '冷藏櫃', station: STATIONS[0].id, serial: 'CHL-2026-0001', owner: 'EG 總部', price: 52000, next: day(35), status: 'active' },
    { asset: 'EG-HTR-0001', type: '加熱設備', station: STATIONS[2].id, serial: 'HTR-2026-0001', owner: 'EG 總部', price: 24000, next: day(12), status: 'active' },
    { asset: 'EG-SEN-0001', type: '溫度感測器', station: STATIONS[1].id, serial: 'SEN-2026-0001', owner: 'EG 總部', price: 4800, next: day(60), status: 'active' },
  ] as const;

  for (const item of equipment) {
    const row = await one<{ id: string }>(
      `INSERT INTO equipment(asset_no, type, station_id, serial_no, owner, purchase_date, purchase_price_twd,
         insurance_policy, insurance_expires_on, last_calibrated_at, next_maintenance_on, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (asset_no) DO UPDATE SET next_maintenance_on = EXCLUDED.next_maintenance_on, status = EXCLUDED.status
       RETURNING id`,
      [item.asset, item.type, item.station, item.serial, item.owner, day(-120), item.price, `POL-${item.asset}`, day(200), day(-30), item.next, item.status],
    );

    await client.query(
      `INSERT INTO leases(equipment_id, lessor, lessee, monthly_rent_twd, start_date, end_date, status)
       SELECT $1, 'EG 資產管理', 'EG 營運', $2, $3, $4, 'active'
       WHERE NOT EXISTS (SELECT 1 FROM leases WHERE equipment_id = $1)`,
      [row.id, Math.round(item.price / 24), day(-120), day(245)],
    );

    await client.query(
      `INSERT INTO maintenance_records(equipment_id, type, performed_on, cost_twd, notes)
       SELECT $1, '定期保養', $2, $3, '溫度校正與清潔'
       WHERE NOT EXISTS (SELECT 1 FROM maintenance_records WHERE equipment_id = $1)`,
      [row.id, day(-30), 1200],
    );
  }

  for (const product of PRODUCTS.slice(0, 4)) {
    await client.query(
      `INSERT INTO purchase_orders(supplier_id, sku, quantity, unit_cost_twd, status, expected_on)
       SELECT $1, $2, $3, $4, 'ordered', $5
       WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE sku = $2 AND status = 'ordered')`,
      [SUPPLIERS[product.supplier].id, product.sku, 60, product.cost, day(2)],
    );
  }

  const shipmentBatch = await one<{ id: string }>('SELECT id FROM batches WHERE lot_no = $1', ['L2601-CHK002-A']);
  await client.query(
    `INSERT INTO shipments(supplier_id, station_id, batch_id, quantity, status, note)
     SELECT $1, $2, $3, 20, 'in_transit', '低溫車配送中'
     WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE batch_id = $3 AND status = 'in_transit')`,
    [SUPPLIERS[0].id, STATIONS[0].id, shipmentBatch.id],
  );

  for (const staff of [
    { name: '林怡君', module: '食安與召回', score: 96 },
    { name: '陳柏宇', module: '冷鏈溫度管理', score: 92 },
    { name: '黃士豪', module: '取貨核銷與客服', score: 88 },
  ]) {
    await client.query(
      `INSERT INTO training_records(station_id, staff_name, module, completed_at, score)
       SELECT $1, $2, $3, now(), $4
       WHERE NOT EXISTS (SELECT 1 FROM training_records WHERE station_id = $1 AND staff_name = $2 AND module = $3)`,
      [STATIONS[0].id, staff.name, staff.module, staff.score],
    );
  }

  await client.query(
    `INSERT INTO support_tickets(customer_id, subject, body, status)
     SELECT $1, '取貨碼遺失', '手機換機後找不到取貨碼，請協助。', 'open'
     WHERE NOT EXISTS (SELECT 1 FROM support_tickets WHERE customer_id = $1)`,
    [CUSTOMERS[0].id],
  );

  const orderCount = await one<{ count: string }>('SELECT count(*)::text AS count FROM orders');
  if (orderCount.count === '0') {
    const hash = pickupHash('123456');
    const expires = new Date(Date.now() + 3 * 86_400_000).toISOString();

    const order1 = await one<{ order_id: string }>(
      `SELECT (eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULL,$6,'seed'))->>'order_id' AS order_id`,
      [CUSTOMERS[0].id, STATIONS[0].id, JSON.stringify([{ sku: 'CHK-001', quantity: 2 }, { sku: 'GRN-001', quantity: 1 }]), hash, expires, 'seed-order-1'],
    );
    await client.query(`SELECT eg_pay_order($1,'demo_pay','TXN-SEED-1','seed-pay-1','seed')`, [order1.order_id]);
    await client.query(`SELECT eg_mark_order_ready($1,'seed')`, [order1.order_id]);
    await client.query(`SELECT eg_deliver_order($1,'123456',$2,'seed')`, [order1.order_id, PICKUP_SECRET]);

    const order2 = await one<{ order_id: string }>(
      `SELECT (eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULL,$6,'seed'))->>'order_id' AS order_id`,
      [CUSTOMERS[1].id, STATIONS[1].id, JSON.stringify([{ sku: 'BEF-001', quantity: 1 }]), hash, expires, 'seed-order-2'],
    );
    await client.query(`SELECT eg_pay_order($1,'demo_pay','TXN-SEED-2','seed-pay-2','seed')`, [order2.order_id]);
    await client.query(`SELECT eg_mark_order_ready($1,'seed')`, [order2.order_id]);
    await client.query(`SELECT eg_deliver_order($1,'123456',$2,'seed')`, [order2.order_id, PICKUP_SECRET]);

    const referral = await one<{ referral_id: string }>(
      `SELECT (eg_apply_referral($1,'EGMIMI',50,'seed'))->>'referral_id' AS referral_id`,
      [order2.order_id],
    );
    await client.query(`SELECT eg_approve_referral($1,'seed')`, [referral.referral_id]);

    const order3 = await one<{ order_id: string }>(
      `SELECT (eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULL,$6,'seed'))->>'order_id' AS order_id`,
      [CUSTOMERS[2].id, STATIONS[2].id, JSON.stringify([{ sku: 'FSH-001', quantity: 1 }]), hash, expires, 'seed-order-3'],
    );
    await client.query(`SELECT eg_pay_order($1,'demo_pay','TXN-SEED-3','seed-pay-3','seed')`, [order3.order_id]);
    await client.query(`SELECT eg_mark_order_ready($1,'seed')`, [order3.order_id]);

    await client.query(
      `SELECT eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULL,$6,'seed')`,
      [CUSTOMERS[0].id, STATIONS[0].id, JSON.stringify([{ sku: 'VEG-001', quantity: 1 }]), hash, expires, 'seed-order-4'],
    );

    await client.query(
      `SELECT eg_settle_station($1, current_date, current_date, 40, 0, '[]'::jsonb, 'seed')`,
      [STATIONS[0].id],
    );
  }

  // 歷史訂單：讓「連續 8 週單筆貢獻為正」與站點可持續性有真實資料可判讀。
  // 一律走正式函式建立，再把時間欄位整體往前平移，維持事件先後順序。
  const historyCount = await one<{ count: string }>(
    `SELECT count(*)::text AS count FROM audit_events WHERE actor_id = 'seed-history' AND action = 'order.create'`,
  );
  if (historyCount.count === '0') {
    const hash = pickupHash('123456');
    const expires = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const plan = [
      { sku: 'CHK-001', qty: 2, station: 0, customer: 0 },
      { sku: 'BEF-001', qty: 1, station: 1, customer: 1 },
      { sku: 'FSH-001', qty: 1, station: 2, customer: 2 },
      { sku: 'VEG-001', qty: 2, station: 0, customer: 1 },
      { sku: 'GRN-001', qty: 1, station: 3, customer: 2 },
      { sku: 'CHK-002', qty: 1, station: 0, customer: 0 },
    ] as const;

    for (let week = 1; week <= 8; week += 1) {
      for (let index = 0; index < 3; index += 1) {
        const line = plan[(week + index) % plan.length]!;
        const daysAgo = week * 7 - index * 2;
        const created = await one<{ order_id: string }>(
          `SELECT (eg_create_order($1,$2,$3::jsonb,0,15,$4,$5,NULL,$6,'seed-history'))->>'order_id' AS order_id`,
          [
            CUSTOMERS[line.customer]!.id,
            STATIONS[line.station]!.id,
            JSON.stringify([{ sku: line.sku, quantity: line.qty }]),
            hash,
            expires,
            `seed-history-${week}-${index}`,
          ],
        );
        const orderId = created.order_id;
        await client.query(`SELECT eg_pay_order($1,'demo_pay',$2,$3,'seed-history')`, [
          orderId,
          `TXN-HIST-${week}-${index}`,
          `seed-history-pay-${week}-${index}`,
        ]);
        await client.query(`SELECT eg_mark_order_ready($1,'seed-history')`, [orderId]);
        await client.query(`SELECT eg_deliver_order($1,'123456',$2,'seed-history')`, [orderId, PICKUP_SECRET]);

        const shift = `${daysAgo} * interval '1 day'`;
        await client.query(
          `UPDATE orders
              SET created_at = created_at - ${shift},
                  promised_ready_at = promised_ready_at - ${shift},
                  updated_at = updated_at - ${shift}
            WHERE id = $1`,
          [orderId],
        );
        await client.query(`UPDATE payments SET created_at = created_at - ${shift} WHERE order_id = $1`, [orderId]);
        await client.query(`UPDATE deliveries SET delivered_at = delivered_at - ${shift} WHERE order_id = $1`, [orderId]);
        await client.query(`UPDATE audit_events SET created_at = created_at - ${shift} WHERE entity_id = $1::text`, [orderId]);
        await client.query(`UPDATE inventory_movements SET created_at = created_at - ${shift} WHERE ref_id = $1::text`, [orderId]);
      }
    }
  }


  /* ---------------------------------------------------------------- */
  /* 資本市場：RWA 資產護照、STO 三階段、STO+ 代幣                      */
  /* ---------------------------------------------------------------- */

  const assetSpecs = [
    {
      assetNo: 'EG-FRZ-0001', kind: 'equipment', invoice: 'INV-2026-0001', invoiceDate: day(-120),
      value: 68000, lien: 0, lienHolder: null, eligible: true,
    },
    {
      assetNo: 'EG-CHL-0001', kind: 'equipment', invoice: 'INV-2026-0002', invoiceDate: day(-120),
      value: 52000, lien: 0, lienHolder: null, eligible: true,
    },
    {
      assetNo: 'EG-HTR-0001', kind: 'equipment', invoice: 'INV-2026-0003', invoiceDate: day(-120),
      value: 24000, lien: 0, lienHolder: null, eligible: true,
    },
    {
      // 感測器缺發票與估值，示範「護照不完整即不得進入載體」。
      assetNo: 'EG-SEN-0001', kind: 'equipment', invoice: null, invoiceDate: null,
      value: null, lien: 0, lienHolder: null, eligible: false,
    },
  ] as const;

  for (const spec of assetSpecs) {
    const equipmentRow = await one<{ id: string; station_id: string; serial_no: string; owner: string; insurance_policy: string; insurance_expires_on: string }>(
      `SELECT id, station_id, serial_no, owner, insurance_policy,
              to_char(insurance_expires_on, 'YYYY-MM-DD') AS insurance_expires_on
         FROM equipment WHERE asset_no = $1`,
      [spec.assetNo],
    );
    const leaseRow = await one<{ id: string }>('SELECT id FROM leases WHERE equipment_id = $1', [equipmentRow.id]);

    await client.query(
      `INSERT INTO asset_passports(asset_no, equipment_id, kind, serial_no, invoice_no, invoice_date,
         owner_legal_entity, location_station_id, maintenance_current, insurance_policy_no,
         insurance_expires_on, appraised_value_twd, appraisal_date, appraiser, existing_lien_twd,
         lien_holder, lease_id, rwa_eligible, eligibility_score, eligibility_blockers,
         eligibility_warnings, evaluated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,now())
       ON CONFLICT (asset_no) DO UPDATE SET
         invoice_no = EXCLUDED.invoice_no, appraised_value_twd = EXCLUDED.appraised_value_twd,
         existing_lien_twd = EXCLUDED.existing_lien_twd, rwa_eligible = EXCLUDED.rwa_eligible,
         eligibility_score = EXCLUDED.eligibility_score,
         eligibility_blockers = EXCLUDED.eligibility_blockers,
         eligibility_warnings = EXCLUDED.eligibility_warnings, evaluated_at = now()`,
      [
        spec.assetNo, equipmentRow.id, spec.kind, equipmentRow.serial_no, spec.invoice, spec.invoiceDate,
        equipmentRow.owner, equipmentRow.station_id, equipmentRow.insurance_policy,
        equipmentRow.insurance_expires_on, spec.value, spec.value === null ? null : day(-45),
        spec.value === null ? null : '台灣公正資產鑑價', spec.lien, spec.lienHolder, leaseRow.id,
        spec.eligible, spec.eligible ? 100 : 64,
        JSON.stringify(spec.eligible ? [] : ['缺少發票或憑證', '缺少第三方估值']),
        JSON.stringify([]),
      ],
    );

    if (spec.value !== null) {
      const passport = await one<{ id: string }>('SELECT id FROM asset_passports WHERE asset_no = $1', [spec.assetNo]);
      await client.query(
        `INSERT INTO asset_valuations(asset_id, valued_on, value_twd, method, appraiser, note)
         SELECT $1, $2, $3, '成本法', '台灣公正資產鑑價', '購入成本扣除累計折舊'
         WHERE NOT EXISTS (SELECT 1 FROM asset_valuations WHERE asset_id = $1 AND valued_on = $2)`,
        [passport.id, day(-45), spec.value],
      );
    }
  }

  const vehicle = await one<{ id: string }>(
    `INSERT INTO rwa_vehicles(code, name, kind, status, legal_counsel, securities_firm, collection_account,
       maintenance_reserve_pct, senior_debt_twd, distributable_basis, disclosure_url, total_units, note)
     VALUES ('RWA-EQ-001', '冷鏈設備租賃收益載體', 'equipment_lease', 'legal_review',
       '尚未委任', '尚未委任', 'EG 資產管理信託專戶', 0.05, 0, 'equipment_rent', NULL, 1000,
       '第一階段只納入可辨識冷鏈設備與真實設備租約；食品庫存不得作為公開投資標的。')
     ON CONFLICT (code) DO UPDATE SET status = EXCLUDED.status, total_units = EXCLUDED.total_units
     RETURNING id`,
  );

  for (const assetNo of ['EG-FRZ-0001', 'EG-CHL-0001', 'EG-HTR-0001']) {
    const passport = await one<{ id: string; appraised_value_twd: number }>(
      'SELECT id, appraised_value_twd FROM asset_passports WHERE asset_no = $1',
      [assetNo],
    );
    await client.query(
      `INSERT INTO rwa_vehicle_assets(vehicle_id, asset_id, allocated_twd)
       VALUES ($1,$2,$3) ON CONFLICT (vehicle_id, asset_id) DO UPDATE SET allocated_twd = EXCLUDED.allocated_twd`,
      [vehicle.id, passport.id, passport.appraised_value_twd],
    );
  }

  // 三期設備租金分配。營運收入只記錄、不分配。
  for (const period of [
    { start: day(-90), end: day(-61), rent: 6000, revenue: 412000, fees: 200 },
    { start: day(-60), end: day(-31), rent: 6000, revenue: 468000, fees: 200 },
    { start: day(-30), end: day(-1), rent: 6000, revenue: 503000, fees: 200 },
  ]) {
    await client.query(
      `SELECT eg_compute_rwa_distribution($1,$2,$3,$4,$5,$6,'seed-capital')`,
      [vehicle.id, period.start, period.end, period.rent, period.revenue, period.fees],
    );
  }

  for (const scenario of [
    { key: 'station_closure', assumption: '站點歇業 3 個月，租金收入歸零', impact: 18000, recovery: 0, shortfall: 18000, atRisk: false },
    { key: 'lessee_default', assumption: '承租人欠款 2 個月並加計違約金 10%', impact: 13200, recovery: 0, shortfall: 13200, atRisk: false },
    { key: 'equipment_damage', assumption: '設備損壞，損失帳面 35%，保險理賠上限內', impact: 50400, recovery: 50400, shortfall: 0, atRisk: false },
    { key: 'double_financing', assumption: '同一設備重複設定擔保，清償順位落後', impact: 144000, recovery: 144000, shortfall: 0, atRisk: false },
    { key: 'insurance_denial', assumption: '保險拒賠，全額損失且無回收', impact: 144000, recovery: 0, shortfall: 144000, atRisk: true },
    { key: 'residual_shortfall', assumption: '殘值僅剩帳面 30%，不足清償本金', impact: 144000, recovery: 43200, shortfall: 100800, atRisk: true },
  ]) {
    await client.query(
      `INSERT INTO rwa_stress_scenarios(vehicle_id, scenario, assumption, impact_twd, recovery_twd,
         shortfall_twd, principal_at_risk, evaluated_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,current_date)
       ON CONFLICT (vehicle_id, scenario, evaluated_on) DO UPDATE SET
         assumption = EXCLUDED.assumption, impact_twd = EXCLUDED.impact_twd,
         recovery_twd = EXCLUDED.recovery_twd, shortfall_twd = EXCLUDED.shortfall_twd,
         principal_at_risk = EXCLUDED.principal_at_risk`,
      [vehicle.id, scenario.key, scenario.assumption, scenario.impact, scenario.recovery, scenario.shortfall, scenario.atRisk],
    );
  }

  const program = await one<{ id: string }>(
    `INSERT INTO sto_programs(code, name, stage, status, target_instrument, issuer_entity, tpex_regime,
       professional_investor_only, issuance_cap_twd, disclosure_doc_url, counsel_opinion_url,
       securities_firm, approved_on, note)
     VALUES ('STO-EG-001', '冷鏈設備收益權證券型代幣', 2, 'legal_review', 'equipment_right',
       'EG 資產管理股份有限公司（規劃中）', '櫃買中心證券商經營證券型代幣業務管理規則',
       true, 3000000, NULL, NULL, '尚未委任', NULL,
       '投資標的僅限設備相關權利，法律審閱前不得混入股權或債權。')
     ON CONFLICT (code) DO UPDATE SET stage = EXCLUDED.stage, status = EXCLUDED.status
     RETURNING id`,
  );

  for (const requirement of [
    { stage: 1, key: 'founder_capital', label: '創辦人資本到位', category: '資本', status: 'done', blocking: true, evidence: '現金部位表已建立', owner: '財務長' },
    { stage: 1, key: 'equity_structure', label: '適法股權結構', category: '資本', status: 'done', blocking: true, evidence: '股東名冊與章程', owner: '法務' },
    { stage: 1, key: 'supplier_terms', label: '供應商付款條件', category: '營運', status: 'done', blocking: true, evidence: '採購合約', owner: '採購' },
    { stage: 1, key: 'equipment_lease', label: '設備租賃合約', category: '營運', status: 'done', blocking: true, evidence: '4 份租約', owner: '資產管理' },
    { stage: 2, key: 'audited_financials', label: '經會計師查核財報', category: '財務', status: 'in_progress', blocking: true, evidence: '查核進行中', owner: '財務長' },
    { stage: 2, key: 'asset_inventory', label: '資產清冊與護照', category: '資產', status: 'done', blocking: true, evidence: '4 份護照，3 份合格', owner: '資產管理' },
    { stage: 2, key: 'lease_review', label: '租約法律審閱', category: '法律', status: 'in_progress', blocking: true, evidence: '委任中', owner: '法務' },
    { stage: 2, key: 'station_performance', label: '站點績效與風險資料', category: '營運', status: 'done', blocking: true, evidence: 'KPI 與擴點關卡', owner: '營運' },
    { stage: 2, key: 'counsel_opinion', label: '台灣證券法律意見書', category: '法律', status: 'pending', blocking: true, evidence: null, owner: '法務' },
    { stage: 2, key: 'securities_firm_assessment', label: '合格證券商評估', category: '法律', status: 'pending', blocking: true, evidence: null, owner: '資本市場' },
    { stage: 3, key: 'issuance_approval', label: '發行核准', category: '監理', status: 'pending', blocking: true, evidence: null, owner: '資本市場' },
    { stage: 3, key: 'investor_eligibility', label: '投資人適格審查', category: '監理', status: 'pending', blocking: true, evidence: null, owner: '法遵' },
    { stage: 3, key: 'custody_arrangement', label: '保管與錢包安排', category: '營運', status: 'pending', blocking: true, evidence: null, owner: '資產管理' },
    { stage: 3, key: 'distribution_mechanism', label: '分配機制與揭露', category: '營運', status: 'pending', blocking: true, evidence: null, owner: '財務長' },
  ]) {
    await client.query(
      `INSERT INTO sto_requirements(program_id, stage, key, label, category, status, blocking, evidence, owner)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (program_id, key) DO UPDATE SET status = EXCLUDED.status,
         evidence = EXCLUDED.evidence, owner = EXCLUDED.owner, updated_at = now()`,
      [program.id, requirement.stage, requirement.key, requirement.label, requirement.category,
        requirement.status, requirement.blocking, requirement.evidence, requirement.owner],
    );
  }

  for (const audit of [
    { layer: 'code_security', auditor: '外部資安顧問', standard: 'OWASP ASVS L2', status: 'in_progress', findings: '待補錢包金鑰管理程序' },
    { layer: 'legal', auditor: '台灣證券法律事務所', standard: '證交法與櫃買中心規則', status: 'pending', findings: null },
    { layer: 'governance', auditor: '內部治理委員會', standard: '多簽與安全模式程序', status: 'passed', findings: '多簽門檻 2/3 已建立' },
    { layer: 'regulatory', auditor: '法遵部', standard: '監理沙盒與專業投資人限制', status: 'pending', findings: null },
  ]) {
    await client.query(
      `INSERT INTO compliance_audits(program_id, layer, auditor, standard, status, performed_on, findings)
       SELECT $1,$2,$3,$4,$5,$6,$7
       WHERE NOT EXISTS (SELECT 1 FROM compliance_audits WHERE program_id = $1 AND layer = $2)`,
      [program.id, audit.layer, audit.auditor, audit.standard, audit.status,
        audit.status === 'pending' ? null : day(-20), audit.findings],
    );
  }

  await client.query(
    `INSERT INTO safe_mode_events(program_id, trigger, mode, authorized_by, multi_sig_count,
       expires_at, announced_at, resolved_at, resolution, note)
     SELECT $1, 'oracle_error', 'pause_conversion', '["財務長","法務","技術長"]'::jsonb, 3,
       now() - interval '10 days', now() - interval '12 days', now() - interval '11 days',
       '預言機價格來源修正後恢復', '歷史事件，示範限期、多簽、公告與解除紀錄'
     WHERE NOT EXISTS (SELECT 1 FROM safe_mode_events WHERE program_id = $1)`,
    [program.id],
  );

  // 第二個計畫：已完成三階段的小規模設備收益權試點，用來驗證跨境要約的放行路徑。
  const pilot = await one<{ id: string }>(
    `INSERT INTO sto_programs(code, name, stage, status, target_instrument, issuer_entity, tpex_regime,
       professional_investor_only, issuance_cap_twd, disclosure_doc_url, counsel_opinion_url,
       securities_firm, approved_on, note)
     VALUES ('STO-EG-002', '單站冷鏈設備收益權試點代幣', 3, 'live', 'equipment_right',
       'EG 資產管理股份有限公司（規劃中）', '櫃買中心證券商經營證券型代幣業務管理規則',
       true, 600000, 'https://example.invalid/disclosure/STO-EG-002', 'https://example.invalid/opinion/STO-EG-002',
       '示範綜合證券', DATE '2026-09-15',
       '僅限單一示範站點之設備租賃收益，規模上限 60 萬元，限專業投資人。')
     ON CONFLICT (code) DO UPDATE SET stage = EXCLUDED.stage, status = EXCLUDED.status
     RETURNING id`,
  );

  for (const requirement of [
    { stage: 1, key: 'founder_capital', label: '創辦人資本到位', category: '資本', evidence: '現金部位表已建立', owner: '財務長' },
    { stage: 1, key: 'equity_structure', label: '適法股權結構', category: '資本', evidence: '股東名冊與章程', owner: '法務' },
    { stage: 1, key: 'supplier_terms', label: '供應商付款條件', category: '營運', evidence: '採購合約', owner: '採購' },
    { stage: 1, key: 'equipment_lease', label: '設備租賃合約', category: '營運', evidence: '單站租約', owner: '資產管理' },
    { stage: 2, key: 'audited_financials', label: '經會計師查核財報', category: '財務', evidence: '2026 上半年查核報告', owner: '財務長' },
    { stage: 2, key: 'asset_inventory', label: '資產清冊與護照', category: '資產', evidence: 'EG-FRZ-0001 護照', owner: '資產管理' },
    { stage: 2, key: 'lease_review', label: '租約法律審閱', category: '法律', evidence: '審閱意見書', owner: '法務' },
    { stage: 2, key: 'station_performance', label: '站點績效與風險資料', category: '營運', evidence: 'KPI 與擴點關卡', owner: '營運' },
    { stage: 2, key: 'counsel_opinion', label: '台灣證券法律意見書', category: '法律', evidence: '意見書已出具', owner: '法務' },
    { stage: 2, key: 'securities_firm_assessment', label: '合格證券商評估', category: '法律', evidence: '示範綜合證券評估報告', owner: '資本市場' },
    { stage: 3, key: 'issuance_approval', label: '發行核准', category: '監理', evidence: '核准函 2026-09-15', owner: '資本市場' },
    { stage: 3, key: 'investor_eligibility', label: '投資人適格審查', category: '監理', evidence: '專業投資人名冊', owner: '法遵' },
    { stage: 3, key: 'custody_arrangement', label: '保管與錢包安排', category: '營運', evidence: '多簽託管合約', owner: '資產管理' },
    { stage: 3, key: 'distribution_mechanism', label: '分配機制與揭露', category: '營運', evidence: '分配瀑布與揭露文件', owner: '財務長' },
  ]) {
    await client.query(
      `INSERT INTO sto_requirements(program_id, stage, key, label, category, status, blocking, evidence, owner)
       VALUES ($1,$2,$3,$4,$5,'done',true,$6,$7)
       ON CONFLICT (program_id, key) DO UPDATE SET status = 'done',
         evidence = EXCLUDED.evidence, owner = EXCLUDED.owner, updated_at = now()`,
      [pilot.id, requirement.stage, requirement.key, requirement.label, requirement.category,
        requirement.evidence, requirement.owner],
    );
  }

  for (const audit of [
    { layer: 'code_security', auditor: '外部資安顧問', standard: 'OWASP ASVS L2', findings: '無高風險發現' },
    { layer: 'legal', auditor: '台灣證券法律事務所', standard: '證交法與櫃買中心規則', findings: '意見書已出具' },
    { layer: 'governance', auditor: '內部治理委員會', standard: '多簽與安全模式程序', findings: '多簽門檻 2/3 已建立' },
    { layer: 'regulatory', auditor: '法遵部', standard: '監理沙盒與專業投資人限制', findings: '專業投資人限制已落實' },
  ]) {
    await client.query(
      `INSERT INTO compliance_audits(program_id, layer, auditor, standard, status, performed_on, findings)
       SELECT $1,$2,$3,$4,'passed',$5,$6
       WHERE NOT EXISTS (SELECT 1 FROM compliance_audits WHERE program_id = $1 AND layer = $2)`,
      [pilot.id, audit.layer, audit.auditor, audit.standard, day(-30), audit.findings],
    );
  }

  const holderSpecs = [
    { email: 'admin@egroup.tw', wallet: 'eg-admin-custody', addressClass: 'custody', kyc: 'verified', category: 'professional' },
    { email: 'admin@egroup.tw', wallet: 'eg-admin-market', addressClass: 'secondary_market', kyc: 'verified', category: 'professional' },
    { email: 'customer@egroup.tw', wallet: 'eg-cust-0001', addressClass: 'platform', kyc: 'verified', category: 'general' },
    { email: 'customer2@egroup.tw', wallet: 'eg-cust-0002', addressClass: 'platform', kyc: 'verified', category: 'general' },
    { email: 'station@egroup.tw', wallet: 'eg-station-market', addressClass: 'secondary_market', kyc: 'verified', category: 'general' },
    { email: 'supplier@egroup.tw', wallet: 'eg-supplier-pending', addressClass: 'platform', kyc: 'pending', category: 'general' },
  ] as const;

  for (const spec of holderSpecs) {
    const account = await one<{ id: string }>('SELECT id FROM accounts WHERE email = $1', [spec.email]);
    await client.query(
      `INSERT INTO token_holders(account_id, wallet_address, address_class, kyc_status, kyc_verified_on,
         investor_category, jurisdiction, sanctions_checked_on)
       VALUES ($1,$2,$3,$4,$5,$6,'TW',$7)
       ON CONFLICT (wallet_address) DO UPDATE SET address_class = EXCLUDED.address_class,
         kyc_status = EXCLUDED.kyc_status, investor_category = EXCLUDED.investor_category`,
      [account.id, spec.wallet, spec.addressClass, spec.kyc,
        spec.kyc === 'verified' ? day(-60) : null, spec.category,
        spec.kyc === 'verified' ? day(-30) : null],
    );
  }

  // 購買取得：完整 Rule 144 鎖定期。
  for (const lot of [
    { wallet: 'eg-cust-0001', quantity: 100, consideration: 100000, lockup: day(180) },
    { wallet: 'eg-cust-0002', quantity: 50, consideration: 50000, lockup: day(300) },
    { wallet: 'eg-admin-custody', quantity: 200, consideration: 200000, lockup: day(90) },
    { wallet: 'eg-station-market', quantity: 30, consideration: 30000, lockup: day(200) },
  ]) {
    const holder = await one<{ id: string; address_class: string }>(
      'SELECT id, address_class FROM token_holders WHERE wallet_address = $1',
      [lot.wallet],
    );
    await client.query(
      `INSERT INTO token_lots(holder_id, program_id, quantity, acquisition, acquired_at, consideration_twd,
         lockup_until, lockup_basis, state, status)
       SELECT $1,$2,$3,'purchased',$4,$5,$6,'rule_144',$7,'active'
       WHERE NOT EXISTS (
         SELECT 1 FROM token_lots WHERE holder_id = $1 AND acquisition = 'purchased' AND quantity = $3)`,
      [holder.id, program.id, lot.quantity, day(-70), lot.consideration, lot.lockup,
        holder.address_class === 'secondary_market' ? 'ST' : 'ST+'],
    );
  }

  const miningRule = await one<{ id: string }>(
    `INSERT INTO social_mining_rules(program_id, version, content_quality_weight,
       interaction_depth_weight, governance_weight, time_weight, per_account_cap, decay_pct,
       reset_period_days, effective_from, note)
     VALUES ($1, 1, 0.4, 0.25, 0.2, 0.15, 500, 0.05, 90, $2,
       '論文所載 Knowpia 規格：內容品質 40%、互動深度 25%、治理參與 20%、時間 15%。')
     ON CONFLICT (program_id, version) DO UPDATE SET per_account_cap = EXCLUDED.per_account_cap
     RETURNING id`,
    [program.id, day(-90)],
  );

  // 賺取取得：勞務對價，豁免鎖定期，但仍受 KYC 與單一帳戶上限約束。
  for (const award of [
    { wallet: 'eg-cust-0001', scores: { contentQuality: 88, interactionDepth: 72, governance: 65, time: 90, contributionType: 'content' }, requested: 120 },
    { wallet: 'eg-cust-0002', scores: { contentQuality: 70, interactionDepth: 60, governance: 80, time: 55, contributionType: 'curation' }, requested: 100 },
    { wallet: 'eg-admin-custody', scores: { contentQuality: 95, interactionDepth: 88, governance: 92, time: 85, contributionType: 'governance' }, requested: 90 },
    { wallet: 'eg-station-market', scores: { contentQuality: 60, interactionDepth: 50, governance: 40, time: 70, contributionType: 'technical' }, requested: 30 },
    { wallet: 'eg-supplier-pending', scores: { contentQuality: 80, interactionDepth: 80, governance: 80, time: 80, contributionType: 'content' }, requested: 50 },
  ]) {
    const holder = await one<{ id: string }>('SELECT id FROM token_holders WHERE wallet_address = $1', [award.wallet]);
    await client.query(
      `SELECT eg_award_social_mining($1,$2,$3,$4,$5::jsonb,$6,'seed-capital')`,
      [holder.id, miningRule.id, day(-30), day(-1), JSON.stringify(award.scores), award.requested],
    );
  }

  // 狀態轉換：由接收地址性質自動判斷，並示範鎖定期規避防線。
  const purchasedLot = await one<{ id: string }>(
    `SELECT l.id FROM token_lots l JOIN token_holders h ON h.id = l.holder_id
      WHERE h.wallet_address = 'eg-cust-0001' AND l.acquisition = 'purchased' LIMIT 1`,
  );
  const earnedLot = await one<{ id: string }>(
    `SELECT l.id FROM token_lots l JOIN token_holders h ON h.id = l.holder_id
      WHERE h.wallet_address = 'eg-cust-0002' AND l.acquisition = 'earned' LIMIT 1`,
  );

  if (purchasedLot !== undefined && earnedLot !== undefined) {
    const already = await one<{ count: string }>(
      `SELECT count(*)::text AS count FROM token_state_transitions WHERE actor = 'seed-capital'`,
    );
    if (already.count === '0') {
      for (const step of [
        { lot: purchasedLot.id, to: 'eg-admin-market' },
        { lot: purchasedLot.id, to: 'eg-admin-custody' },
        { lot: purchasedLot.id, to: 'eg-cust-0001' },
        { lot: purchasedLot.id, to: 'eg-station-market' },
        { lot: purchasedLot.id, to: 'eg-supplier-pending' },
        { lot: earnedLot.id, to: 'eg-admin-market' },
        { lot: earnedLot.id, to: 'eg-cust-0002' },
      ]) {
        await client.query(`SELECT eg_transition_token_state($1,$2,'seed-capital')`, [step.lot, step.to]);
      }
    }
  }

  /* 監理環境：制度轉型、安全港、揭露、跨境要約、稅務會計              */
  {
    const regimes = [
      {
        code: 'US', name: '美國', posture: 'innovation_oriented',
        framework: 'SEC／CFTC 聯合框架（Project Crypto）',
        retail: true, professional: false, equivalenceRequired: false,
        equivalenceDetermined: false, localLicense: false,
        effectiveFrom: '2025-01-21',
        source: 'SEC Staff Statements 2025；Project Crypto 聯合聲明 2025-09-02',
        note: '2025 年由執法導向轉為規則導向；CLARITY Act 尚未成法，引用須用條件語氣。',
        legitimacy: [true, true, true, true, false],
      },
      {
        code: 'EU', name: '歐盟', posture: 'equivalence_required',
        framework: 'MiCA',
        retail: true, professional: false, equivalenceRequired: true,
        equivalenceDetermined: false, localLicense: false,
        effectiveFrom: '2024-06-30',
        source: 'Regulation (EU) 2023/1114 第 16、60 條；ESMA Q&A 2024',
        note: '第三國發行人須經等同性認定或設立歐盟分支機構。',
        legitimacy: [true, true, true, true, true],
      },
      {
        code: 'SG', name: '新加坡', posture: 'innovation_oriented',
        framework: '支付服務法（PSA）',
        retail: true, professional: false, equivalenceRequired: false,
        equivalenceDetermined: false, localLicense: false,
        effectiveFrom: '2020-01-28',
        source: 'MAS Payment Services Act；Project Guardian',
        note: '以監理沙盒與創新加速器扶植，為亞洲樞紐。',
        legitimacy: [true, true, true, true, true],
      },
      {
        code: 'HK', name: '香港', posture: 'innovation_oriented',
        framework: 'SFC 虛擬資產服務提供者（VASP）牌照',
        retail: true, professional: false, equivalenceRequired: false,
        equivalenceDetermined: false, localLicense: false,
        effectiveFrom: '2023-06-01',
        source: 'SFC VASP 牌照制度',
        note: '2023 年起開放零售參與，採選擇性開放。',
        legitimacy: [true, true, true, true, true],
      },
      {
        code: 'TW', name: '台灣', posture: 'restricted',
        framework: '證券交易法與櫃買中心證券型代幣規範',
        retail: false, professional: true, equivalenceRequired: false,
        equivalenceDetermined: false, localLicense: false,
        effectiveFrom: '2020-01-01',
        source: '櫃買中心證券型代幣發行與交易規則',
        note: '有專業投資人人數上限；建立平台不等於取得發行或交易許可。',
        legitimacy: [true, true, true, true, true],
      },
    ];

    for (const regime of regimes) {
      await client.query(
        `INSERT INTO regulatory_regimes (
           code, name, posture, framework, retail_allowed, professional_only,
           equivalence_required, equivalence_determined, local_license_held,
           effective_from, source, note,
           transparent_rulemaking, multi_stakeholder, continuous_disclosure,
           independent_judgment, accountability
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (code) DO NOTHING`,
        [
          regime.code, regime.name, regime.posture, regime.framework,
          regime.retail, regime.professional, regime.equivalenceRequired,
          regime.equivalenceDetermined, regime.localLicense,
          regime.effectiveFrom, regime.source, regime.note,
          ...regime.legitimacy,
        ],
      );
    }

    const events = [
      { date: '2020-12-22', kind: 'enforcement', title: 'SEC 對 Ripple 提起訴訟', summary: '執法監管期的代表性案件，以訴訟建立規則而非以規則明確標準。', posture: 'enforcement_led' },
      { date: '2023-07-13', kind: 'enforcement', title: 'SEC v. Ripple Labs 部分敗訴', summary: '法院認定 XRP 在程序化銷售中不構成證券，削弱執法立場的法律基礎。', posture: 'enforcement_led' },
      { date: '2023-08-29', kind: 'enforcement', title: 'Grayscale 案裁定 SEC 拒絕現貨 ETF 為任意反覆', summary: '司法挫折累積，成為 2025 年轉向的正當性來源之一。', posture: 'enforcement_led' },
      { date: '2025-01-20', kind: 'personnel', title: 'Gensler 辭去 SEC 主席', summary: '關鍵時刻：既有制度均衡被打破，新軌跡得以確立。', posture: 'enforcement_led' },
      { date: '2025-01-21', kind: 'personnel', title: '成立 Crypto Task Force，由 Peirce 領導', summary: 'Uyeda 代理主席期間的過渡措施，重啟規則制定議程。', posture: 'innovation_oriented' },
      { date: '2025-01-23', kind: 'accounting', title: '撤銷 SAB 121，改以 SAB 122 處理託管義務', summary: '由強制負債認列改為或有負債判斷，解除銀行進入加密託管的會計障礙。', posture: 'innovation_oriented' },
      { date: '2025-02-27', kind: 'guidance', title: '迷因幣指引：通常不構成證券', summary: '改採事實導向的個案分析，不再一概而論。', posture: 'innovation_oriented' },
      { date: '2025-03-20', kind: 'guidance', title: 'PoW 挖礦指引：挖礦本身不構成證券交易', summary: '礦工以算力換取獎勵屬服務對價，不符合 Howey 的「來自他人努力」。', posture: 'innovation_oriented' },
      { date: '2025-04-04', kind: 'guidance', title: '穩定幣指引：足額儲備的特定穩定幣不構成證券', summary: '購買者合理期待價值穩定而非利潤；「充足儲備」範圍仍待明確。', posture: 'innovation_oriented' },
      { date: '2025-04-21', kind: 'personnel', title: 'Paul Atkins 接任 SEC 主席', summary: '監理哲學由風險規避轉向創新促進，由執法導向轉向規則導向。', posture: 'innovation_oriented' },
      { date: '2025-05-29', kind: 'legislation', title: 'CLARITY Act（H.R. 3633）提出', summary: '試圖劃分 SEC 與 CFTC 管轄權、建立資產分類標準與 DeFi 安全港。', posture: 'innovation_oriented' },
      { date: '2025-07-17', kind: 'legislation', title: 'CLARITY Act 通過眾議院', summary: '仍待參議院全院審議、兩院版本協調與總統簽署，尚未成法。', posture: 'innovation_oriented' },
      { date: '2025-08-05', kind: 'guidance', title: '流動性質押指引：非託管質押不構成證券', summary: '區分託管與非託管質押；流動性質押代幣的法律地位仍待釐清。', posture: 'innovation_oriented' },
      { date: '2025-09-02', kind: 'coordination', title: 'SEC-CFTC 聯合聲明：Project Crypto 與 Crypto Sprint', summary: '建立聯合工作組，目標 2026 年完成初步聯合框架。', posture: 'innovation_oriented' },
      { date: '2026-05-14', kind: 'legislation', title: '參議院銀行委員會以 15-9 通過市場結構法案版本', summary: '仍待參議院全院審議、兩院協調與總統簽署；引用須用條件語氣。', posture: 'innovation_oriented' },
    ];

    for (const event of events) {
      await client.query(
        `INSERT INTO regulatory_events (regime_code, event_date, kind, title, summary, posture_after, source)
         VALUES ('US', $1, $2, $3, $4, $5, '論文第三章第二節')
         ON CONFLICT (regime_code, event_date, title) DO NOTHING`,
        [event.date, event.kind, event.title, event.summary, event.posture],
      );
    }

    const harbors = [
      {
        ref: 'SH-EG-001', kind: 'temporary_safe_harbor', regime: 'US',
        applicant: '雙北健康餐食節點網路', subject: '冷鏈設備收益權代幣（STO-EG-001）',
        status: 'submitted', goodFaith: true, measures: true, cadence: 'semiannual',
        opened: '2026-06-01', expires: '2027-12-31', extension: 0,
        userCap: null, volumeCap: null, exit: 'none', published: true,
      },
      {
        ref: 'SH-EG-002', kind: 'sandbox', regime: 'SG',
        applicant: '雙北健康餐食節點網路', subject: '代幣化設備租賃收益跨境試點',
        status: 'draft', goodFaith: true, measures: true, cadence: 'quarterly',
        opened: '2026-09-01', expires: '2028-09-01', extension: 12,
        userCap: 200, volumeCap: 5_000_000, exit: 'modified', published: true,
      },
      {
        ref: 'SH-EG-003', kind: 'no_action_letter', regime: 'US',
        applicant: '雙北健康餐食節點網路', subject: '非託管錢包與自託管權利確認',
        status: 'granted', goodFaith: true, measures: true, cadence: 'annual',
        opened: '2026-03-01', expires: '2028-02-28', extension: 0,
        userCap: null, volumeCap: null, exit: 'approved', published: true,
      },
      {
        ref: 'SH-EG-004', kind: 'sandbox', regime: 'TW',
        applicant: '雙北健康餐食節點網路', subject: '未取得規模上限的沙盒申請（示範阻擋）',
        status: 'rejected', goodFaith: true, measures: false, cadence: 'none',
        opened: '2026-04-01', expires: '2029-04-01', extension: 18,
        userCap: null, volumeCap: null, exit: 'none', published: false,
      },
    ];

    for (const harbor of harbors) {
      await client.query(
        `INSERT INTO safe_harbor_applications (
           reference_no, kind, regime_code, applicant, subject, status,
           good_faith, compliance_measures, reporting_cadence,
           opened_on, expires_on, extension_months, user_cap, volume_cap_twd,
           exit_mechanism, published
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (reference_no) DO NOTHING`,
        [
          harbor.ref, harbor.kind, harbor.regime, harbor.applicant, harbor.subject,
          harbor.status, harbor.goodFaith, harbor.measures, harbor.cadence,
          harbor.opened, harbor.expires, harbor.extension, harbor.userCap,
          harbor.volumeCap, harbor.exit, harbor.published,
        ],
      );
    }

    const disclosures = [
      { type: 'staking', ref: 'STO-EG-001', key: 'yield_calculation', label: '收益率計算方法', satisfied: true, evidence: '白皮書 §4.2 收益分配公式' },
      { type: 'staking', ref: 'STO-EG-001', key: 'slashing_risk', label: '削減風險（Slashing）', satisfied: true, evidence: '風險揭露 §6.1' },
      { type: 'staking', ref: 'STO-EG-001', key: 'unlock_period', label: '解鎖期', satisfied: false, evidence: null },
      { type: 'custody', ref: 'EG-CUSTODY-01', key: 'key_management', label: '私鑰管理', satisfied: true, evidence: '託管作業手冊 v1.2' },
      { type: 'custody', ref: 'EG-CUSTODY-01', key: 'self_custody_right', label: '自託管權利', satisfied: true, evidence: '不採取行動信函 SH-EG-003' },
      { type: 'custody', ref: 'EG-CUSTODY-01', key: 'segregation', label: '客戶資產隔離', satisfied: false, evidence: null },
      { type: 'token_issuance', ref: 'STO-EG-001', key: 'underlying_asset', label: '底層資產', satisfied: true, evidence: '資產護照 EG-FRZ-0001／EG-CHL-0001／EG-HTR-0001' },
      { type: 'token_issuance', ref: 'STO-EG-001', key: 'transfer_restriction', label: '轉讓限制', satisfied: true, evidence: 'Rule 144 鎖定與地址類別規則' },
      { type: 'token_issuance', ref: 'STO-EG-001', key: 'investor_eligibility', label: '投資人適格條件', satisfied: true, evidence: '限專業投資人，KYC 須完成' },
      { type: 'token_issuance', ref: 'STO-EG-001', key: 'risk_factors', label: '風險因素', satisfied: false, evidence: null },
    ];

    for (const item of disclosures) {
      await client.query(
        `INSERT INTO disclosure_obligations (
           subject_type, subject_ref, item_key, label, required, satisfied, evidence, satisfied_at
         ) VALUES ($1,$2,$3,$4,true,$5,$6,$7)
         ON CONFLICT (subject_type, subject_ref, item_key) DO NOTHING`,
        [
          item.type, item.ref, item.key, item.label, item.satisfied, item.evidence,
          item.satisfied ? new Date().toISOString() : null,
        ],
      );
    }

    const treatments = [
      { kind: 'mining_reward', label: 'PoW 挖礦或 PoS 驗證者報酬', tax: '取得可支配控制時，按公允市場價值認列普通所得；營業活動可能另有自雇稅或費用扣除。', accounting: '符合 ASU 2023-08 範圍者，後續按公允價值衡量，變動計入損益。', caveat: '證券法上屬技術功能，不排除稅法上構成所得。', authority: 'IRS Notice 2014-21；FASB ASU 2023-08' },
      { kind: 'staking_reward', label: '非託管質押獎勵', tax: '依 Rev. Rul. 2023-14，於取得支配權與控制權時按公允市場價值認列。', accounting: '獎勵與原持有代幣分別追蹤成本基礎及公允價值。', caveat: '須區分自行質押與第三方託管質押，避免把證券法分析與稅法時點混同。', authority: 'Rev. Rul. 2023-14' },
      { kind: 'liquid_staking_swap', label: '流動性質押代幣交換', tax: '可能被主張為非處分，也可能因權利實質不同而被視為交換；爭議未定。', accounting: '須揭露衍生代幣估值、贖回風險、折價與流動性風險。', caveat: '不可斷言不課稅；IRS 尚未提供完整專門規則。', authority: 'Eisner v. Macomber；Cottage Savings' },
      { kind: 'gas_fee', label: 'Gas fee 與優先費', tax: '若為取得或處分資產所必要，可能資本化為成本基礎或處分成本；營業使用可作費用。', accounting: '平台或驗證者收取優先費時，按收入確認邏輯處理。', caveat: '個人投資人、企業、平台三者處理不同。', authority: 'IRS Notice 2014-21' },
      { kind: 'platform_custody', label: '平台託管或混合託管', tax: '重點在受益所有權與資訊申報；是否產生所得取決於資產處分或收益分配。', accounting: 'SAB 122 後不再機械式認列託管負債，改依 ASC 450-20 或 IAS 37 判斷。', caveat: '託管會計現代化不等於免除風險揭露、內控與資本要求。', authority: 'SEC SAB 122；ASC 450-20／IAS 37' },
      { kind: 'cross_border_reporting', label: '跨境申報與 CARF', tax: '平台與中介可能面臨資訊申報、資料交換與 Form 1099-DA 等制度銜接。', accounting: '須建立使用者、地址、交易與受益所有權的可稽核流程。', caveat: '跨境稅務合作可能與隱私、去中心化及資料最小化原則衝突。', authority: 'OECD CARF；IRS Form 1099-DA' },
    ];

    for (const item of treatments) {
      await client.query(
        `INSERT INTO tax_accounting_treatments (kind, label, tax_treatment, accounting_treatment, caveat, authority)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (kind) DO NOTHING`,
        [item.kind, item.label, item.tax, item.accounting, item.caveat, item.authority],
      );
    }

    const already = await one<{ count: string }>(
      `SELECT count(*)::text AS count FROM cross_border_assessments WHERE assessed_by = 'seed-regulatory'`,
    );
    if (already?.count === '0') {
      for (const step of [
        { code: 'STO-EG-001', regime: 'US', holder: 'professional' },
        { code: 'STO-EG-001', regime: 'EU', holder: 'professional' },
        { code: 'STO-EG-001', regime: 'TW', holder: 'professional' },
        { code: 'STO-EG-002', regime: 'US', holder: 'professional' },
        { code: 'STO-EG-002', regime: 'EU', holder: 'professional' },
        { code: 'STO-EG-002', regime: 'TW', holder: 'professional' },
        { code: 'STO-EG-002', regime: 'SG', holder: 'general' },
        { code: 'STO-EG-002', regime: 'HK', holder: 'professional' },
      ]) {
        const target = await one<{ id: string }>('SELECT id FROM sto_programs WHERE code = $1', [step.code]);
        if (target === null) continue;
        await client.query(`SELECT eg_assess_cross_border($1,$2,$3,'seed-regulatory')`, [
          target.id, step.regime, step.holder,
        ]);
      }
    }
  }

  const freezer = await one<{ id: string }>('SELECT id FROM equipment WHERE asset_no = $1', ['EG-FRZ-0001']);
  for (const event of [
    { temp: 3.1, status: 'ok', action: '正常，無需處理' },
    { temp: 4.2, status: 'warning', action: '縮短巡檢間隔至 2 小時' },
    { temp: 7.8, status: 'breach', action: '批次隔離並通知品保' },
  ]) {
    await client.query(
      `INSERT INTO temperature_events(station_id, equipment_id, temp_c, duration_minutes, status, action, actor)
       SELECT $1, $2, $3, 15, $4, $5, 'seed'
       WHERE NOT EXISTS (SELECT 1 FROM temperature_events WHERE equipment_id = $2 AND temp_c = $3)`,
      [STATIONS[0].id, freezer.id, event.temp, event.status, event.action],
    );
  }

  await client.query('COMMIT');
  console.log('seed 完成。');
  console.log('示範帳號（密碼皆為 demo1234）：');
  for (const account of accounts) console.log(`  ${account.role.padEnd(8)} ${account.email}`);
  console.log('示範取貨碼：123456');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
