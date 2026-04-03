"""
E 組主程序
已購入商品入倉建檔完整流程
"""

import logging
import sys
from datetime import datetime
from config import (
    GOOGLE_DRIVE_FOLDER_ID, E_GROUP_CONFIG, LOG_DIR
)
from supabase_init import SupabaseManager
from google_drive_scanner import GoogleDriveScanner
from image_processor import ImageProcessor
from ai_recognizer import AIRecognizer
from price_estimator import PriceEstimator
from marketing_generator import MarketingGenerator
from telegram_notifier import TelegramNotifier

# 設置日誌
log_file = f"{LOG_DIR}/e_group_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

class EGroupPipeline:
    def __init__(self):
        self.supabase_manager = SupabaseManager()
        self.drive_scanner = GoogleDriveScanner()
        self.image_processor = ImageProcessor()
        self.ai_recognizer = AIRecognizer()
        self.price_estimator = PriceEstimator()
        self.marketing_generator = MarketingGenerator()
        self.telegram_notifier = TelegramNotifier()

        self.stats = {
            'total_products': 0,
            'successful': 0,
            'failed': 0,
            'pending_review': 0,
            'total_value': 0,
            'products_for_review': []
        }

    def run(self, folder_id=GOOGLE_DRIVE_FOLDER_ID):
        """執行完整的 E 組流程"""
        logger.info("=" * 80)
        logger.info("E 組已購入商品入倉建檔流程開始")
        logger.info("=" * 80)

        try:
            # 第 1 步: 掃描 Google Drive
            logger.info("第 1 步: 掃描 Google Drive...")
            warehouse_date, warehouse_folder_id = self.drive_scanner.get_latest_warehouse_date(folder_id)

            if not warehouse_date:
                logger.error("找不到倉庫日期資料夾")
                self.telegram_notifier.send_error_notification("找不到倉庫日期資料夾")
                return False

            logger.info(f"找到最新倉庫日期: {warehouse_date}")

            # 第 2 步: 讀取該日期資料夾的圖片
            logger.info(f"第 2 步: 讀取 {warehouse_date} 資料夾的圖片...")
            images = self.drive_scanner.list_images_in_folder(warehouse_folder_id)

            if not images:
                logger.warning(f"資料夾 {warehouse_date} 內沒有圖片")
                return False

            logger.info(f"共找到 {len(images)} 張圖片")

            # 第 3 步: 分組圖片
            logger.info("第 3 步: 分組圖片...")
            image_groups = self.image_processor.group_images(images)
            logger.info(f"分組完成: {len(image_groups)} 個商品組")

            # 第 4 步: 逐組處理商品
            logger.info("第 4 步: 處理商品...")
            for group_idx, image_group in enumerate(image_groups, 1):
                self._process_product_group(warehouse_date, group_idx, image_group)

            # 第 5 步: 生成報告
            logger.info("第 5 步: 生成報告...")
            self._send_summary()

            logger.info("=" * 80)
            logger.info("E 組流程完成！")
            logger.info("=" * 80)
            return True

        except Exception as e:
            logger.error(f"流程執行失敗: {e}", exc_info=True)
            self.telegram_notifier.send_error_notification(f"E 組流程失敗: {str(e)}")
            return False

    def _process_product_group(self, warehouse_date, group_idx, image_group):
        """處理單個商品組"""
        try:
            logger.info(f"\n處理商品 #{group_idx}...")

            # 提取檔名和圖片 URL
            product_name_hint = self.image_processor._extract_product_name(image_group[0]['name'])
            image_urls = [self.drive_scanner.get_file_url(img['id']) for img in image_group]

            logger.info(f"商品提示: {product_name_hint}, 圖片數: {len(image_urls)}")

            # AI 識別
            logger.info("執行 AI 識別...")
            recognition_data = self.ai_recognizer.recognize_product(image_urls, product_name_hint)
            logger.info(f"識別結果: {recognition_data.get('product_name')}, 信心度: {recognition_data.get('confidence')}")

            # 估價
            logger.info("計算估價...")
            price_data = self.price_estimator.estimate_price(recognition_data)
            logger.info(f"估價: ${price_data['suggested_price']}")

            # 生成行銷文
            logger.info("生成行銷文...")
            marketing_data = self.marketing_generator.generate_marketing_content(recognition_data, price_data)

            # 判斷是否需要複核
            needs_review, review_reasons = self.ai_recognizer.estimate_condition_risk(recognition_data)

            # 建立商品檔案
            logger.info("建立商品檔案...")
            item_data = {
                'warehouse_date': warehouse_date,
                'folder_name': f"{warehouse_date}_{group_idx}",
                'product_name': recognition_data.get('product_name'),
                'normalized_product_name': recognition_data.get('normalized_product_name'),
                'brand': recognition_data.get('brand'),
                'model': recognition_data.get('model'),
                'category': recognition_data.get('category'),
                'condition_summary': recognition_data.get('condition_summary'),
                'missing_parts': recognition_data.get('missing_parts'),
                'cleaning_status': recognition_data.get('cleaning_status'),
                'repair_status': recognition_data.get('repair_status'),
                'suggested_price': price_data['suggested_price'],
                'min_price': price_data['min_price'],
                'suggested_platforms': price_data['suggested_platforms'],
                'confidence': recognition_data.get('confidence', 0),
                'needs_review': needs_review,
            }

            item = self.supabase_manager.insert_inventory_item(item_data)
            if not item:
                logger.error("商品檔案建立失敗")
                self.stats['failed'] += 1
                return

            item_id = item['id']
            logger.info(f"商品檔案已建立: {item_id}")

            # 建立圖片記錄
            images_data = [
                {
                    'inventory_item_id': item_id,
                    'image_name': img['name'],
                    'image_url': self.drive_scanner.get_file_url(img['id']),
                    'image_order': idx + 1
                }
                for idx, img in enumerate(image_group)
            ]

            self.supabase_manager.insert_item_images(images_data)
            logger.info(f"圖片記錄已建立: {len(images_data)} 張")

            # 建立行銷文記錄
            marketing_item = {
                'inventory_item_id': item_id,
                'listing_title': marketing_data.get('listing_title'),
                'short_description': marketing_data.get('short_description'),
                'facebook_post': marketing_data.get('facebook_post'),
                'threads_post': marketing_data.get('threads_post'),
                'hashtags': marketing_data.get('hashtags', []),
                'seo_keywords': marketing_data.get('seo_keywords', [])
            }

            self.supabase_manager.insert_marketing_assets(marketing_item)
            logger.info("行銷文已建立")

            # 更新統計
            self.stats['total_products'] += 1
            self.stats['successful'] += 1
            self.stats['total_value'] += price_data['suggested_price']

            if needs_review:
                self.stats['pending_review'] += 1
                self.stats['products_for_review'].append({
                    'product_name': recognition_data.get('product_name'),
                    'review_reason': ', '.join(review_reasons) if review_reasons else '信心度低'
                })

            logger.info(f"✅ 商品 #{group_idx} 處理完成")

        except Exception as e:
            logger.error(f"處理商品 #{group_idx} 失敗: {e}", exc_info=True)
            self.stats['failed'] += 1

    def _send_summary(self):
        """發送處理摘要"""
        try:
            self.telegram_notifier.send_batch_summary(
                self.stats['total_products'],
                self.stats['successful'],
                self.stats['failed'],
                self.stats['pending_review']
            )

            if self.stats['products_for_review']:
                self.telegram_notifier.send_review_required_list(self.stats['products_for_review'])

            logger.info(f"摘要已發送")
            logger.info(f"統計: 總計 {self.stats['total_products']}, 成功 {self.stats['successful']}, "
                       f"失敗 {self.stats['failed']}, 待複核 {self.stats['pending_review']}")
        except Exception as e:
            logger.error(f"發送摘要失敗: {e}")

def main():
    pipeline = EGroupPipeline()
    success = pipeline.run()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
