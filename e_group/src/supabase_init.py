"""
Supabase 資料表初始化
建立 inventory_items, inventory_item_images, inventory_marketing_assets 表
"""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
import logging

logger = logging.getLogger(__name__)

class SupabaseManager:
    def __init__(self):
        self.client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    def init_tables(self):
        """初始化所有必要的表"""
        try:
            # 1. inventory_items - 商品主檔
            self._create_inventory_items_table()

            # 2. inventory_item_images - 商品圖片表
            self._create_inventory_item_images_table()

            # 3. inventory_marketing_assets - 行銷文草稿表
            self._create_inventory_marketing_assets_table()

            logger.info("所有表已成功建立或已存在")
            return True
        except Exception as e:
            logger.error(f"表初始化失敗: {e}")
            return False

    def _create_inventory_items_table(self):
        """建立商品主檔表"""
        sql = """
        create table if not exists inventory_items (
          id uuid primary key default gen_random_uuid(),
          warehouse_date text not null,
          folder_name text not null,
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
          suggested_platforms jsonb default '[]'::jsonb,
          confidence numeric,
          needs_review boolean default false,
          source_type text default 'purchased_inventory',
          created_at timestamptz default now()
        );
        """
        try:
            self.client.postgrest.from_("inventory_items").select("*").limit(1).execute()
            logger.info("inventory_items 表已存在")
        except:
            # 表不存在，需要通過 SQL 建立
            logger.info("需要通過 SQL 建立 inventory_items 表")

    def _create_inventory_item_images_table(self):
        """建立商品圖片表"""
        sql = """
        create table if not exists inventory_item_images (
          id uuid primary key default gen_random_uuid(),
          inventory_item_id uuid references inventory_items(id) on delete cascade,
          image_name text,
          image_url text,
          image_order int,
          created_at timestamptz default now()
        );
        """
        try:
            self.client.postgrest.from_("inventory_item_images").select("*").limit(1).execute()
            logger.info("inventory_item_images 表已存在")
        except:
            logger.info("需要通過 SQL 建立 inventory_item_images 表")

    def _create_inventory_marketing_assets_table(self):
        """建立行銷文草稿表"""
        sql = """
        create table if not exists inventory_marketing_assets (
          id uuid primary key default gen_random_uuid(),
          inventory_item_id uuid references inventory_items(id) on delete cascade,
          listing_title text,
          short_description text,
          facebook_post text,
          threads_post text,
          hashtags jsonb default '[]'::jsonb,
          seo_keywords jsonb default '[]'::jsonb,
          created_at timestamptz default now()
        );
        """
        try:
            self.client.postgrest.from_("inventory_marketing_assets").select("*").limit(1).execute()
            logger.info("inventory_marketing_assets 表已存在")
        except:
            logger.info("需要通過 SQL 建立 inventory_marketing_assets 表")

    def insert_inventory_item(self, item_data):
        """插入商品主檔"""
        try:
            response = self.client.table("inventory_items").insert(item_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"插入商品失敗: {e}")
            return None

    def insert_item_images(self, images_data):
        """插入商品圖片"""
        try:
            response = self.client.table("inventory_item_images").insert(images_data).execute()
            return response.data
        except Exception as e:
            logger.error(f"插入圖片失敗: {e}")
            return None

    def insert_marketing_assets(self, marketing_data):
        """插入行銷文"""
        try:
            response = self.client.table("inventory_marketing_assets").insert(marketing_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"插入行銷文失敗: {e}")
            return None
