-- E 組完整資料庫結構

-- 1. 用戶表
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  full_name text,
  password_hash text NOT NULL,
  role_id uuid REFERENCES roles(id),
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 角色表
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. 商品主檔（擴展）
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY key DEFAULT gen_random_uuid(),
  warehouse_date text NOT NULL,
  folder_name text NOT NULL,
  product_name text,
  normalized_product_name text,
  brand text,
  model text,
  category text,
  condition_summary text,
  missing_parts text,
  cleaning_status text,
  repair_status text,
  suggested_price numeric,
  min_price numeric,
  max_price numeric,
  suggested_platforms jsonb DEFAULT '[]'::jsonb,
  confidence numeric,
  needs_review boolean DEFAULT false,
  review_status text DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by uuid REFERENCES users(id),
  review_notes text,
  reviewed_at timestamptz,
  source_type text DEFAULT 'purchased_inventory',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. 商品圖片表
CREATE TABLE IF NOT EXISTS inventory_item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  image_name text,
  image_url text,
  image_order int,
  created_at timestamptz DEFAULT now()
);

-- 5. 行銷文表
CREATE TABLE IF NOT EXISTS inventory_marketing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  listing_title text,
  short_description text,
  facebook_post text,
  threads_post text,
  instagram_post text,
  hashtags jsonb DEFAULT '[]'::jsonb,
  seo_keywords jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. 上架紀錄表
CREATE TABLE IF NOT EXISTS platform_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  platform text NOT NULL, -- facebook, threads, shopee, etc
  listing_status text DEFAULT 'draft', -- draft, active, sold, removed
  external_id text, -- platform 上的商品 ID
  listed_at timestamptz,
  sold_at timestamptz,
  final_price numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. 銷售訂單表
CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id),
  platform text NOT NULL,
  platform_order_id text UNIQUE,
  buyer_name text,
  buyer_contact text,
  sale_price numeric NOT NULL,
  sale_status text DEFAULT 'pending', -- pending, completed, cancelled
  payment_method text,
  paid_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. 庫存日誌表
CREATE TABLE IF NOT EXISTS inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id),
  action text NOT NULL, -- added, moved, sold, deleted, status_changed
  old_status text,
  new_status text,
  updated_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 9. 系統告警表
CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL, -- low_stock, high_review_count, sync_failed, etc
  severity text DEFAULT 'info', -- info, warning, error, critical
  title text NOT NULL,
  message text,
  related_item_id uuid REFERENCES inventory_items(id),
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 10. 統計快照表（用於性能）
CREATE TABLE IF NOT EXISTS daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date date NOT NULL UNIQUE,
  total_items int,
  pending_review_count int,
  approved_count int,
  sold_count int,
  total_revenue numeric,
  avg_price numeric,
  avg_condition_score numeric,
  created_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_date ON inventory_items(warehouse_date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_review_status ON inventory_items(review_status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_needs_review ON inventory_items(needs_review);
CREATE INDEX IF NOT EXISTS idx_platform_listings_status ON platform_listings(listing_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(sale_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_item_id ON inventory_logs(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
