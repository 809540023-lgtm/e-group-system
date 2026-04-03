"""
Telegram 通知系統
發送商品處理進度和結果通知
"""

import logging
import requests
import json
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

class TelegramNotifier:
    def __init__(self):
        self.bot_token = TELEGRAM_BOT_TOKEN
        self.chat_id = TELEGRAM_CHAT_ID
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"

    def send_message(self, message):
        """發送簡單文本消息"""
        try:
            url = f"{self.base_url}/sendMessage"
            payload = {
                'chat_id': self.chat_id,
                'text': message,
                'parse_mode': 'Markdown'
            }
            response = requests.post(url, json=payload)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"發送 Telegram 消息失敗: {e}")
            return False

    def send_product_summary(self, product_data, image_count):
        """發送商品摘要通知"""
        product_name = product_data.get('normalized_product_name', 'unknown')
        confidence = product_data.get('confidence', 0)
        condition = product_data.get('condition_summary', 'unknown')

        message = f"""
✅ 商品已識別:
- 名稱: {product_name}
- 圖片: {image_count} 張
- 信心度: {confidence:.1%}
- 狀況: {condition}
"""
        return self.send_message(message)

    def send_batch_summary(self, total, success, failed, review_count):
        """發送批次處理摘要"""
        message = f"""
📊 批次處理完成:
- 總計: {total} 個商品
- 成功: {success} 個
- 失敗: {failed} 個
- 待複核: {review_count} 個

✨ 已完成入倉建檔流程！
"""
        return self.send_message(message)

    def send_error_notification(self, error_message):
        """發送錯誤通知"""
        message = f"""
❌ 發生錯誤:
{error_message}

請檢查日誌並手動處理。
"""
        return self.send_message(message)

    def send_review_required_list(self, products_for_review):
        """發送需要複核的商品清單"""
        if not products_for_review:
            return True

        message = f"📋 需要人工複核的商品 ({len(products_for_review)} 個):\n"
        for i, product in enumerate(products_for_review[:10], 1):  # 最多顯示 10 個
            name = product.get('product_name', 'unknown')
            reason = product.get('review_reason', '信心度低')
            message += f"{i}. {name} - {reason}\n"

        if len(products_for_review) > 10:
            message += f"... 及其他 {len(products_for_review) - 10} 個"

        return self.send_message(message)

    def send_daily_report(self, report_data):
        """發送每日報告"""
        message = f"""
📅 E 組每日報告:
- 處理商品: {report_data.get('total_products', 0)} 件
- 成功建檔: {report_data.get('successful', 0)} 件
- 待複核: {report_data.get('pending_review', 0)} 件
- 總估值: ${report_data.get('total_value', 0):,}
- 平均信心度: {report_data.get('avg_confidence', 0):.1%}

最高估價: ${report_data.get('max_price', 0):,}
最低估價: ${report_data.get('min_price', 0):,}
"""
        return self.send_message(message)

    def send_photo(self, image_url, caption=""):
        """發送圖片消息"""
        try:
            url = f"{self.base_url}/sendPhoto"
            payload = {
                'chat_id': self.chat_id,
                'photo': image_url,
                'caption': caption,
                'parse_mode': 'Markdown'
            }
            response = requests.post(url, json=payload)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"發送圖片失敗: {e}")
            return False

    def test_connection(self):
        """測試 Telegram 連接"""
        try:
            message = "🤖 E 組系統連接測試成功！"
            return self.send_message(message)
        except Exception as e:
            logger.error(f"Telegram 連接測試失敗: {e}")
            return False
