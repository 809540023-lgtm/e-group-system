import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# API配置
API_KEY = os.getenv('GATE_API_KEY', '')
API_SECRET = os.getenv('GATE_API_SECRET', '')
API_HOST = 'https://api.gateio.ws/api/v4'

# 交易配置
PRICE_RANGE_MIN = 106000
PRICE_RANGE_MAX = 109000
ORDER_AMOUNT_USD = 35

# 機器人配置
BOTS_CONFIG = [
    {"id": "A", "is_long": False, "grid_count": 30},  # 空單30格
    {"id": "B", "is_long": False, "grid_count": 20},  # 空單20格
    {"id": "C", "is_long": False, "grid_count": 10},  # 空單10格
    {"id": "D", "is_long": True, "grid_count": 30},   # 多單30格
    {"id": "E", "is_long": True, "grid_count": 20},   # 多單20格
    {"id": "F", "is_long": True, "grid_count": 10},   # 多單10格
]

# 日誌配置
LOG_DIR = 'logs'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
