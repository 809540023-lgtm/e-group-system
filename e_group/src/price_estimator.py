"""
商品估價器
根據商品信息和狀況估計售價
"""

import logging
from config import E_GROUP_CONFIG

logger = logging.getLogger(__name__)

class PriceEstimator:
    def __init__(self):
        # 商品分類價格參考表
        self.category_base_prices = {
            '商用冷藏設備': {'min': 10000, 'max': 50000, 'typical': 25000},
            '商用冷凍設備': {'min': 8000, 'max': 45000, 'typical': 22000},
            '廚房設備': {'min': 2000, 'max': 20000, 'typical': 8000},
            '餐飲店設備': {'min': 5000, 'max': 30000, 'typical': 12000},
            '辦公家具': {'min': 500, 'max': 10000, 'typical': 3000},
            '家電': {'min': 1000, 'max': 25000, 'typical': 8000},
            '機械設備': {'min': 5000, 'max': 100000, 'typical': 30000},
            'unknown': {'min': 1000, 'max': 10000, 'typical': 3000},
        }

        self.price_buffer = E_GROUP_CONFIG.get('price_buffer_ratio', 0.15)

    def estimate_price(self, recognition_data):
        """
        估計商品售價
        Args:
            recognition_data: dict - AI 識別結果

        Returns:
            dict - 估價結果
        """
        try:
            category = recognition_data.get('category', 'unknown')
            condition_score = recognition_data.get('condition_score', 50)
            repair_status = recognition_data.get('repair_status', 'unknown')

            # 取得分類基礎價格
            base_prices = self._get_category_price(category)

            # 根據狀況調整價格
            condition_factor = self._get_condition_factor(condition_score, repair_status)

            # 計算建議售價
            suggested_price = base_prices['typical'] * condition_factor
            min_price = base_prices['min'] * condition_factor
            max_price = base_prices['max'] * condition_factor

            # 應用價格緩衝
            suggested_price = int(suggested_price * (1 - self.price_buffer))
            min_price = int(min_price * (1 - self.price_buffer))
            max_price = int(max_price * (1 - self.price_buffer))

            # 建議上架平台
            platforms = self._suggest_platforms(suggested_price, condition_score)

            # 是否適合快速出清
            quick_clearance = self._should_quick_clearance(condition_score, repair_status)

            return {
                'suggested_price': suggested_price,
                'min_price': min_price,
                'max_price': max_price,
                'price_range': f"{min_price} - {max_price}",
                'suggested_platforms': platforms,
                'quick_clearance': quick_clearance,
                'condition_factor': round(condition_factor, 2),
            }

        except Exception as e:
            logger.error(f"估價失敗: {e}")
            return self._get_default_price()

    def _get_category_price(self, category):
        """取得分類基礎價格"""
        return self.category_base_prices.get(category, self.category_base_prices['unknown'])

    def _get_condition_factor(self, condition_score, repair_status):
        """
        根據狀況分數和維修狀態計算價格因子
        100 分 = 100% 原價
        50 分 = 50% 原價
        """
        # 基礎因子
        base_factor = condition_score / 100.0

        # 如果需要維修，額外打折
        if repair_status == 'needs_repair':
            base_factor *= 0.6
        elif repair_status == 'working':
            base_factor *= 1.0

        # 最低不低於 0.2 (20% 原價)
        return max(base_factor, 0.2)

    def _suggest_platforms(self, price, condition_score):
        """根據價格和狀況建議上架平台"""
        platforms = []

        # 高價/新品 -> 官方平台或專業平台
        if price > 20000 and condition_score > 80:
            platforms.extend(['Facebook Marketplace', 'Threads'])

        # 中價 -> FB Marketplace
        elif 5000 <= price <= 20000:
            platforms.extend(['Facebook Marketplace', 'Threads'])

        # 低價 -> 快速出清平台
        else:
            platforms.extend(['Facebook Marketplace', 'Threads', '蝦皮'])

        return platforms

    def _should_quick_clearance(self, condition_score, repair_status):
        """判斷是否應該快速出清"""
        # 狀況差或需要維修
        if condition_score < 40 or repair_status == 'needs_repair':
            return True

        # 狀況一般且需要清潔
        if condition_score < 60:
            return True

        return False

    def _get_default_price(self):
        """返回默認估價"""
        return {
            'suggested_price': 5000,
            'min_price': 3000,
            'max_price': 8000,
            'price_range': '3000 - 8000',
            'suggested_platforms': ['Facebook Marketplace'],
            'quick_clearance': True,
            'condition_factor': 0.0,
        }
