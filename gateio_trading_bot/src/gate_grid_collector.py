import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import json
import logging
from datetime import datetime
import os

class GateGridCollector:
    def __init__(self, config_path="config/config.json"):
        self.config = self.load_config(config_path)
        self.setup_logging()
        self.driver = None
        
    def load_config(self, config_path):
        """載入配置文件"""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            # 預設配置
            return {
                "target_url": "https://www.gate.io/zh-tw/futures/USDT/BTC_USDT",
                "wait_timeout": 10,
                "page_load_delay": 3,
                "tab_switch_delay": 2,
                "output_file": "gate_grid_all_tabs.xlsx",
                "headless": False
            }
    
    def setup_logging(self):
        """設置日誌記錄"""
        # 確保 logs 目錄存在
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        log_file = os.path.join(log_dir, 'gate_collector.log')
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def setup_driver(self):
        """設置瀏覽器驅動"""
        chrome_options = Options()
        if self.config.get("headless", False):
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, self.config["wait_timeout"])
        
    def navigate_to_grid_page(self):
        """導航到合約網格頁面"""
        try:
            self.logger.info("正在訪問 Gate.io 期貨頁面...")
            self.driver.get(self.config["target_url"])
            time.sleep(self.config["page_load_delay"])
            
            # 等待頁面載入
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # 尋找並點擊「永續合約」下的「合約網格」
            self.logger.info("正在尋找合約網格按鈕...")
            
            # 可能的選擇器（根據實際頁面結構調整）
            grid_selectors = [
                "//a[contains(text(), '合約網格')]",
                "//button[contains(text(), '合約網格')]",
                "//span[contains(text(), '合約網格')]",
                "[data-testid*='grid']",
                "[class*='grid']"
            ]
            
            grid_button = None
            for selector in grid_selectors:
                try:
                    if selector.startswith("//"):
                        grid_button = self.wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                    else:
                        grid_button = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                    break
                except TimeoutException:
                    continue
            
            if grid_button:
                grid_button.click()
                self.logger.info("成功點擊合約網格按鈕")
                time.sleep(self.config["page_load_delay"])
                return True
            else:
                self.logger.warning("未找到合約網格按鈕，嘗試手動導航")
                return False
                
        except Exception as e:
            self.logger.error(f"導航到網格頁面時發生錯誤: {e}")
            return False
    
    def collect_tab_data(self, tab_name, tab_selector):
        """收集指定分頁的數據"""
        try:
            self.logger.info(f"正在收集 {tab_name} 數據...")
            
            # 點擊分頁
            tab_element = self.wait.until(EC.element_to_be_clickable((By.XPATH, tab_selector)))
            tab_element.click()
            time.sleep(self.config["tab_switch_delay"])
            
            # 等待數據載入
            time.sleep(2)
            
            # 尋找表格數據
            table_selectors = [
                "table",
                "[class*='table']",
                "[class*='grid']",
                "[role='table']"
            ]
            
            data = []
            for selector in table_selectors:
                try:
                    tables = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if tables:
                        for table in tables:
                            rows = table.find_elements(By.TAG_NAME, "tr")
                            if len(rows) > 1:  # 有標題行和數據行
                                # 提取標題
                                headers = []
                                header_row = rows[0]
                                header_cells = header_row.find_elements(By.TAG_NAME, "th")
                                if not header_cells:
                                    header_cells = header_row.find_elements(By.TAG_NAME, "td")
                                
                                for cell in header_cells:
                                    headers.append(cell.text.strip())
                                
                                # 提取數據行
                                for row in rows[1:]:
                                    cells = row.find_elements(By.TAG_NAME, "td")
                                    if cells:
                                        row_data = {}
                                        for i, cell in enumerate(cells):
                                            if i < len(headers):
                                                row_data[headers[i]] = cell.text.strip()
                                        if row_data:
                                            data.append(row_data)
                                break
                    if data:
                        break
                except Exception as e:
                    continue
            
            if not data:
                # 如果沒有找到表格，嘗試提取其他格式的數據
                self.logger.info(f"未找到 {tab_name} 的表格數據，嘗試提取文本數據")
                text_elements = self.driver.find_elements(By.CSS_SELECTOR, "[class*='item'], [class*='row'], [class*='line']")
                for element in text_elements[:10]:  # 限制提取數量
                    text = element.text.strip()
                    if text:
                        data.append({"內容": text})
            
            self.logger.info(f"成功收集到 {len(data)} 條 {tab_name} 數據")
            return data
            
        except Exception as e:
            self.logger.error(f"收集 {tab_name} 數據時發生錯誤: {e}")
            return []
    
    def collect_all_data(self):
        """收集所有分頁的數據"""
        all_data = {}
        
        # 定義要收集的分頁
        tabs = {
            "交易記錄": "//span[contains(text(), '交易記錄')] | //a[contains(text(), '交易記錄')] | //button[contains(text(), '交易記錄')]",
            "當前持倉": "//span[contains(text(), '當前持倉')] | //a[contains(text(), '當前持倉')] | //button[contains(text(), '當前持倉')]",
            "網格明細": "//span[contains(text(), '網格明細')] | //a[contains(text(), '網格明細')] | //button[contains(text(), '網格明細')]",
            "訂單歷史": "//span[contains(text(), '訂單歷史')] | //a[contains(text(), '訂單歷史')] | //button[contains(text(), '訂單歷史')]"
        }
        
        for tab_name, tab_selector in tabs.items():
            data = self.collect_tab_data(tab_name, tab_selector)
            all_data[tab_name] = data
        
        return all_data
    
    def save_to_excel(self, data):
        """將數據保存到 Excel 文件"""
        try:
            output_file = self.config["output_file"]
            
            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                for sheet_name, sheet_data in data.items():
                    if sheet_data:
                        df = pd.DataFrame(sheet_data)
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
                        self.logger.info(f"已保存 {sheet_name} 數據到 {sheet_name} 工作表")
                    else:
                        # 創建空的工作表
                        pd.DataFrame({"說明": [f"未找到 {sheet_name} 數據"]}).to_excel(
                            writer, sheet_name=sheet_name, index=False
                        )
            
            self.logger.info(f"所有數據已保存到 {output_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"保存數據時發生錯誤: {e}")
            return False
    
    def run(self):
        """執行數據收集"""
        try:
            self.logger.info("開始 Gate.io 合約網格數據收集...")
            
            # 設置瀏覽器
            self.setup_driver()
            
            # 導航到網格頁面
            if not self.navigate_to_grid_page():
                self.logger.error("無法導航到合約網格頁面")
                return False
            
            # 收集所有數據
            all_data = self.collect_all_data()
            
            # 保存數據
            if self.save_to_excel(all_data):
                self.logger.info("數據收集完成！")
                return True
            else:
                self.logger.error("數據保存失敗")
                return False
                
        except Exception as e:
            self.logger.error(f"執行過程中發生錯誤: {e}")
            return False
        finally:
            if self.driver:
                self.driver.quit()
                self.logger.info("瀏覽器已關閉")

def main():
    collector = GateGridCollector()
    success = collector.run()
    
    if success:
        print("✅ 數據收集成功完成！")
        print(f"📁 數據已保存到: {collector.config['output_file']}")
    else:
        print("❌ 數據收集失敗，請檢查日誌文件")

if __name__ == "__main__":
    main()