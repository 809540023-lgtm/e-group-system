"""
AI 商品辨識器
使用 OpenAI Vision 識別商品信息
"""

import logging
import json
import base64
import requests
from config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

class AIRecognizer:
    def __init__(self):
        self.api_key = OPENAI_API_KEY
        self.model = OPENAI_MODEL
        self.endpoint = "https://api.openai.com/v1/chat/completions"

    def recognize_product(self, image_urls, product_name_hint=None):
        """
        識別商品信息
        Args:
            image_urls: List[str] - 圖片 URL 列表
            product_name_hint: str - 從檔名提取的商品名稱提示

        Returns:
            dict - 辨識結果
        """
        try:
            # 構建 prompt
            prompt = self._build_recognition_prompt(product_name_hint)

            # 構建圖片內容
            image_content = []
            for url in image_urls:
                image_content.append({
                    "type": "image_url",
                    "image_url": {"url": url}
                })

            image_content.append({
                "type": "text",
                "text": prompt
            })

            # 調用 OpenAI API
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": image_content
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            }

            response = requests.post(self.endpoint, json=payload, headers=headers)
            response.raise_for_status()

            result = response.json()
            response_text = result['choices'][0]['message']['content']

            # 解析 JSON 結果
            recognition_data = self._parse_response(response_text)
            return recognition_data

        except Exception as e:
            logger.error(f"商品辨識失敗: {e}")
            return self._get_default_recognition()

    def _build_recognition_prompt(self, product_name_hint=None):
        """構建識別 prompt"""
        hint_text = f"根據檔名提示，商品可能是: {product_name_hint}\n" if product_name_hint else ""

        prompt = f"""{hint_text}
請分析這些商品圖片，並提供以下信息（以 JSON 格式回覆）:

{{
  "product_name": "商品名稱",
  "normalized_product_name": "標準化商品名稱",
  "brand": "品牌 (如無法判斷填 'unknown')",
  "model": "型號 (如無法判斷填 'unknown')",
  "category": "商品分類",
  "condition_summary": "外觀狀況描述",
  "missing_parts": "缺件情況 (如無缺件填 'none')",
  "cleaning_status": "清潔狀態 (clean/needs_cleaning/dirty)",
  "repair_status": "維修狀態 (working/needs_repair/unknown)",
  "condition_score": 0-100,
  "confidence": 0-1.0,
  "needs_review": true/false,
  "review_reason": "如需複核的原因"
}}

評分標準:
- condition_score: 0-100，根據外觀新舊程度
- confidence: 0-1.0，判讀信心程度
- needs_review: 如果信心低於 0.65 或有不確定項目，標記為 true
"""
        return prompt

    def _parse_response(self, response_text):
        """解析 API 回應"""
        try:
            # 嘗試從回應文本中提取 JSON
            json_match = response_text.find('{')
            if json_match != -1:
                json_text = response_text[json_match:]
                # 找到匹配的閉括號
                json_text = json_text[:json_text.rfind('}') + 1]
                result = json.loads(json_text)
                return result
        except json.JSONDecodeError:
            logger.warning(f"無法解析 JSON: {response_text}")

        return self._get_default_recognition()

    def _get_default_recognition(self):
        """返回默認識別結果"""
        return {
            "product_name": "unknown",
            "normalized_product_name": "未識別商品",
            "brand": "unknown",
            "model": "unknown",
            "category": "unknown",
            "condition_summary": "無法判讀",
            "missing_parts": "unknown",
            "cleaning_status": "unknown",
            "repair_status": "unknown",
            "condition_score": 0,
            "confidence": 0.0,
            "needs_review": True,
            "review_reason": "AI 識別失敗，需人工確認"
        }

    def estimate_condition_risk(self, recognition_data):
        """評估是否需要複核"""
        needs_review = False
        reasons = []

        # 信心低於閾值
        if recognition_data.get('confidence', 0) < 0.65:
            needs_review = True
            reasons.append(f"信心度過低 ({recognition_data['confidence']})")

        # 無法判斷品牌
        if recognition_data.get('brand') == 'unknown':
            needs_review = True
            reasons.append("無法判斷品牌")

        # 無法判斷型號
        if recognition_data.get('model') == 'unknown':
            needs_review = True
            reasons.append("無法判斷型號")

        # 外觀分數過低
        if recognition_data.get('condition_score', 100) < 40:
            needs_review = True
            reasons.append("商品狀況不佳")

        # 需要維修
        if recognition_data.get('repair_status') == 'needs_repair':
            needs_review = True
            reasons.append("需要維修")

        return needs_review, reasons
