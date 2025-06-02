import logging
from typing import List, Tuple
from datetime import datetime
from config.config import LOG_DIR, LOG_FORMAT
import os

def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # 確保日誌目錄存在
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)

    # 檔案處理器
    file_handler = logging.FileHandler(
        os.path.join(LOG_DIR, f'{name}_{datetime.now().strftime("%Y%m%d")}.log')
    )
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    # 控制台處理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

def calculate_grid_prices(start_price: float, end_price: float, grid_count: int) -> List[float]:
    if grid_count == 1:
        return [(start_price + end_price) / 2]
    
    interval = (end_price - start_price) / (grid_count - 1)
    return [start_price + i * interval for i in range(grid_count)]
