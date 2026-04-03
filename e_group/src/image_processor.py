"""
圖片分組器
根據檔名、時間、相似度把圖片分組成同一商品
"""

import re
import logging
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ImageProcessor:
    def __init__(self):
        self.similarity_time_window = 300  # 5分鐘內上傳視為同組

    def group_images(self, images):
        """
        根據檔名和時間分組圖片
        返回: List[List[image_dict]]
        """
        if not images:
            return []

        # 嘗試用檔名分組
        filename_groups = self._group_by_filename(images)
        if filename_groups:
            return filename_groups

        # 如果檔名分組失敗，用時間和順序分組
        time_groups = self._group_by_time_and_order(images)
        return time_groups

    def _group_by_filename(self, images):
        """根據檔名相似度分組"""
        groups = defaultdict(list)
        used = set()

        for image in images:
            if image['id'] in used:
                continue

            # 提取商品名（去掉後綴的 _1, _2, _3, _4）
            product_name = self._extract_product_name(image['name'])

            if not product_name:
                continue

            # 找出所有同商品的圖片
            for other_image in images:
                if other_image['id'] not in used:
                    other_product_name = self._extract_product_name(other_image['name'])
                    if other_product_name == product_name:
                        groups[product_name].append(other_image)
                        used.add(other_image['id'])

        if groups:
            # 驗證分組有效性（每組至少 2-4 張圖）
            valid_groups = []
            for product_name, group_images in groups.items():
                if 2 <= len(group_images) <= 4:
                    # 按圖片編號排序
                    sorted_group = self._sort_images_by_number(group_images)
                    valid_groups.append(sorted_group)

            return valid_groups if valid_groups else []

        return []

    def _extract_product_name(self, filename):
        """
        從檔名提取商品名
        例如: 四門冰箱_1.jpg -> 四門冰箱
        """
        # 移除副檔名
        name_without_ext = filename.rsplit('.', 1)[0]

        # 移除末尾的 _1, _2, _3, _4 等編號
        product_name = re.sub(r'_[0-9]+$', '', name_without_ext)

        # 移除所有空格和特殊字符
        product_name = product_name.strip()

        if len(product_name) < 2:
            return None

        return product_name

    def _sort_images_by_number(self, images):
        """根據檔名末尾的編號排序圖片"""
        def get_number(image):
            match = re.search(r'_([0-9]+)', image['name'])
            if match:
                return int(match.group(1))
            return 999

        return sorted(images, key=get_number)

    def _group_by_time_and_order(self, images):
        """根據上傳時間和順序分組"""
        if not images:
            return []

        # 按時間排序
        sorted_images = sorted(
            images,
            key=lambda x: datetime.fromisoformat(x['createdTime'].replace('Z', '+00:00'))
        )

        groups = []
        current_group = []
        last_time = None

        for image in sorted_images:
            image_time = datetime.fromisoformat(image['createdTime'].replace('Z', '+00:00'))

            # 如果是第一張或在時間窗口內，加入當前組
            if last_time is None or (image_time - last_time).total_seconds() < self.similarity_time_window:
                current_group.append(image)
                last_time = image_time
            else:
                # 時間差太大，開始新組
                if 2 <= len(current_group) <= 4:
                    groups.append(current_group)
                current_group = [image]
                last_time = image_time

        # 加入最後一組
        if 2 <= len(current_group) <= 4:
            groups.append(current_group)

        return groups

    def validate_group(self, group):
        """驗證圖片組是否有效"""
        if not group or len(group) < 2 or len(group) > 4:
            return False, "圖片數量不符合要求 (需要 2-4 張)"

        return True, "有效"

    def mark_for_manual_review(self, group):
        """標記圖片組需要人工複核"""
        issues = []

        if len(group) < 2:
            issues.append("圖片不足 2 張")
        if len(group) > 4:
            issues.append("圖片超過 4 張")

        # 檢查檔名是否清晰
        for image in group:
            if len(image['name']) < 3:
                issues.append(f"檔名不清楚: {image['name']}")

        return len(issues) > 0, issues
