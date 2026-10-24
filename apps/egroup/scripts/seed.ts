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
