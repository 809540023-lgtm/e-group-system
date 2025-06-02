import gate_api
from gate_api.exceptions import ApiException, GateApiException
from typing import List, Dict, Optional
import time
from datetime import datetime

from config.config import (
    API_KEY, API_SECRET, API_HOST, 
    PRICE_RANGE_MIN, PRICE_RANGE_MAX,
    ORDER_AMOUNT_USD, BOTS_CONFIG
)
from models import TradingBot
from utils import setup_logger, calculate_grid_prices

class GateIOTradingBot:
    def __init__(self):
        self.logger = setup_logger('trading_bot')
        
        # 初始化API配置
        self.config = gate_api.Configuration(
            key=API_KEY,
            secret=API_SECRET,
            host=API_HOST
        )
        self.client = gate_api.ApiClient(self.config)
        self.futures_api = gate_api.FuturesApi(self.client)
        
        # 初始化交易機器人
        self.bots = [
            TradingBot(
                bot_id=config['id'],
                is_long=config['is_long'],
                grid_count=config['grid_count'],
                amount_usd=ORDER_AMOUNT_USD
            ) for config in BOTS_CONFIG
        ]
        
    def get_current_price(self) -> Optional[float]:
        try:
            # 使用 list_futures_tickers 方法並指定 settle 參數
            tickers = self.futures_api.list_futures_tickers('usdt', contract='BTC_USDT')
            if tickers and len(tickers) > 0:
                return float(tickers[0].last)
            return None
        except (ApiException, GateApiException) as e:
            self.logger.error(f"獲取價格失敗: {e}")
            return None
    
    def place_order(self, bot: TradingBot, price: float) -> Optional[Dict]:
        try:
            order = gate_api.FuturesOrder(
                contract="BTC_USDT",  # 更新為 USDT 結算的合約
                size=bot.amount_usd,
                price=str(price),
                tif='gtc',  # good till cancel
                type='limit',
                side='buy' if bot.is_long else 'sell'
            )
            result = self.futures_api.create_futures_order("usdt", order)  # 添加 settle 參數
            self.logger.info(f"機器人 {bot.bot_id} 下單成功: {price} USD")
            return result
        except (ApiException, GateApiException) as e:
            self.logger.error(f"下單失敗: {e}")
            return None
    
    def run(self):
        self.logger.info("交易機器人啟動")
        
        while True:
            try:
                current_price = self.get_current_price()
                if current_price is None:
                    time.sleep(5)
                    continue
                
                if PRICE_RANGE_MIN <= current_price <= PRICE_RANGE_MAX:
                    for bot in self.bots:
                        if not bot.active:
                            # 計算網格價格
                            bot.grid_prices = calculate_grid_prices(
                                PRICE_RANGE_MIN,
                                PRICE_RANGE_MAX,
                                bot.grid_count
                            )
                            
                            # 下單
                            for price in bot.grid_prices:
                                order = self.place_order(bot, price)
                                if order:
                                    bot.orders.append(order)
                            
                            bot.active = True
                            self.logger.info(f"機器人 {bot.bot_id} 已啟動，共設置 {len(bot.orders)} 個訂單")
                
                time.sleep(5)  # 每5秒檢查一次
                
            except Exception as e:
                self.logger.error(f"運行出錯: {e}")
                time.sleep(5)

if __name__ == "__main__":
    bot = GateIOTradingBot()
    bot.run()
