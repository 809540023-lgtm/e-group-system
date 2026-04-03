"""
行銷文生成器
自動生成商品的行銷文案和標籤
"""

import logging
import requests
import json
from config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

class MarketingGenerator:
    def __init__(self):
        self.api_key = OPENAI_API_KEY
        self.model = OPENAI_MODEL
        self.endpoint = "https://api.openai.com/v1/chat/completions"

    def generate_marketing_content(self, product_data, price_data):
        """
        生成完整的行銷文案
        Args:
            product_data: dict - 商品信息 (從 AI 識別)
            price_data: dict - 估價信息

        Returns:
            dict - 行銷文案數據
        """
        try:
            prompt = self._build_marketing_prompt(product_data, price_data)

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.8,
                "max_tokens": 1500
            }

            response = requests.post(self.endpoint, json=payload, headers=headers)
            response.raise_for_status()

            result = response.json()
            response_text = result['choices'][0]['message']['content']

            # 解析結果
            marketing_data = self._parse_marketing_response(response_text)
            return marketing_data

        except Exception as e:
            logger.error(f"行銷文生成失敗: {e}")
            return self._get_default_marketing(product_data)

    def _build_marketing_prompt(self, product_data, price_data):
        """構建行銷文 prompt"""
        product_name = product_data.get('normalized_product_name', '二手商品')
        category = product_data.get('category', '商品')
        condition = product_data.get('condition_summary', '外觀有使用痕跡')
        price = price_data.get('suggested_price', 5000)
        platforms = ", ".join(price_data.get('suggested_platforms', ['Facebook']))

        prompt = f"""
你是一個專業的二手商品行銷文案撰寫者。
請根據以下商品信息，生成行銷文案（JSON 格式）:

商品: {product_name}
分類: {category}
狀況: {condition}
建議售價: ${price}

請生成:
{{
  "listing_title": "2-4 個字的吸引人標題，包含商品名和賣點",
  "short_description": "50-80 字簡介，說明商品用途和特點",
  "facebook_post": "100-150 字的 FB 貼文，親切口吻，鼓勵私訊",
  "threads_post": "80-120 字的 Threads 貼文，更隨性，包含行動召喚",
  "hashtags": ["#二手商品", "#商品類別", "#主要特徵", "#生財器具"],
  "seo_keywords": ["關鍵字1", "關鍵字2", "關鍵字3"]
}}

要求:
- 標題要吸引眼球，包含關鍵信息
- 描述要突出商品優勢和實用性
- FB 文案要親切感強，鼓勵互動
- Threads 文案要更casual和直接
- 標籤要相關且能增加曝光
- 用繁體中文

生成結果只需要 JSON，不需要其他說明。
"""
        return prompt

    def _parse_marketing_response(self, response_text):
        """解析行銷文回應"""
        try:
            json_match = response_text.find('{')
            if json_match != -1:
                json_text = response_text[json_match:]
                json_text = json_text[:json_text.rfind('}') + 1]
                result = json.loads(json_text)
                return result
        except json.JSONDecodeError:
            logger.warning(f"無法解析行銷文 JSON: {response_text}")

        return self._get_default_marketing({})

    def _get_default_marketing(self, product_data):
        """返回默認行銷文"""
        product_name = product_data.get('normalized_product_name', '二手商品')

        return {
            'listing_title': f"二手{product_name}｜狀況佳｜可議",
            'short_description': f"二手{product_name}，外觀有正常使用痕跡，功能良好。",
            'facebook_post': f"二手{product_name}，適合各類使用場景，有興趣可私訊看詳細資訊唷！",
            'threads_post': f"有個二手{product_name}，想了解可以私訊喔。",
            'hashtags': ['#二手商品', f'#{product_name}', '#生財器具', '#淘寶'],
            'seo_keywords': ['二手', product_name, '商品', '出售'],
        }

    def generate_bulk_marketing(self, products_list):
        """
        批量生成行銷文案
        Args:
            products_list: List[dict] - 商品清單，每個包含 product_data 和 price_data

        Returns:
            List[dict] - 行銷文案清單
        """
        results = []
        for product in products_list:
            marketing = self.generate_marketing_content(
                product.get('product_data', {}),
                product.get('price_data', {})
            )
            results.append(marketing)
        return results
