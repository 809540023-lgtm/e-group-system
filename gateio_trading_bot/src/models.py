from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class TradingBot:
    bot_id: str
    is_long: bool
    grid_count: int
    amount_usd: float
    orders: List[Dict] = field(default_factory=list)
    active: bool = False

    def __post_init__(self):
        self.grid_prices: List[float] = []

    def calculate_interval(self) -> float:
        if self.grid_count == 30:
            return 100
        elif self.grid_count == 20:
            return 150
        elif self.grid_count == 10:
            return 300
        return 0
