import time
import os
import logging
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import pandas as pd
import pytesseract
from PIL import Image
import threading
import schedule
import shutil

class SmartDataCollector:
    def __init__(self):
        self.setup_logging()
        self.setup_directories()
        self.driver = None
        self.data_collection_count = 0
        self.screenshot_paths = []
        
    def setup_logging(self):
        """設置日誌記錄"""
        if not os.path.exists('logs'):
            os.makedirs('logs')
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_filename = f'logs/smart_collector_{timestamp}.log'
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_filename, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def setup_directories(self):
        """設置目錄結構"""
        directories = ['smart_screenshots', 'smart_data', 'logs']
        for directory in directories:
            if not os.path.exists(directory):
                os.makedirs(directory)
                
    def setup_driver(self):
        """設置Chrome瀏覽器"""
        try:
            chrome_options = Options()
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.maximize_window()
            self.logger.info("瀏覽器設置完成")
            return True
        except Exception as e:
            self.logger.error(f"瀏覽器設置失敗: {e}")
            return False
            
    def navigate_to_gate(self):
        """導航到Gate.io網站"""
        try:
            self.driver.get("https://www.gate.io")
            time.sleep(3)
            self.logger.info("成功導航到Gate.io")
            return True
        except Exception as e:
            self.logger.error(f"導航失敗: {e}")
            return False
            
    def take_screenshot(self, name_suffix=""):
        """拍攝截圖"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"smart_screenshots/screenshot_{timestamp}_{name_suffix}.png"
            self.driver.save_screenshot(filename)
            self.screenshot_paths.append(filename)
            self.logger.info(f"截圖已保存: {filename}")
            return filename
        except Exception as e:
            self.logger.error(f"截圖失敗: {e}")
            return None
            
    def extract_text_from_screenshot(self, screenshot_path):
        """使用OCR從截圖中提取文字"""
        try:
            image = Image.open(screenshot_path)
            text = pytesseract.image_to_string(image, lang='eng+chi_tra')
            return text.strip()
        except Exception as e:
            self.logger.error(f"OCR提取失敗: {e}")
            return ""
            
    def find_and_click_element(self, keywords):
        """智能查找並點擊包含關鍵字的元素"""
        try:
            # 嘗試多種選擇器
            selectors = [
                f"//a[contains(text(), '{keywords}')]",
                f"//button[contains(text(), '{keywords}')]",
                f"//span[contains(text(), '{keywords}')]",
                f"//div[contains(text(), '{keywords}')]",
                f"//*[contains(@title, '{keywords}')]",
                f"//*[contains(@aria-label, '{keywords}')]"
            ]
            
            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.XPATH, selector)
                    if elements:
                        element = elements[0]
                        self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
                        time.sleep(1)
                        element.click()
                        self.logger.info(f"成功點擊包含'{keywords}'的元素")
                        return True
                except:
                    continue
                    
            self.logger.warning(f"未找到包含'{keywords}'的可點擊元素")
            return False
        except Exception as e:
            self.logger.error(f"點擊元素失敗: {e}")
            return False
            
    def collect_single_data_entry(self, entry_index):
        """收集單條數據（包含4張截圖）"""
        data_entry = {
            'entry_index': entry_index,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'screenshots': [],
            'ocr_texts': []
        }
        
        # 為每條數據拍攝4張截圖
        for i in range(4):
            screenshot_name = f"entry_{entry_index}_shot_{i+1}"
            screenshot_path = self.take_screenshot(screenshot_name)
            
            if screenshot_path:
                data_entry['screenshots'].append(screenshot_path)
                
                # 提取OCR文字
                ocr_text = self.extract_text_from_screenshot(screenshot_path)
                data_entry['ocr_texts'].append(ocr_text)
                
                self.logger.info(f"數據條目 {entry_index} - 截圖 {i+1}/4 完成")
                
            # 間隔時間
            time.sleep(2)
            
        return data_entry
        
    def collect_18_data_entries(self):
        """收集18條數據"""
        self.logger.info("開始收集18條數據...")
        collected_data = []
        
        for i in range(18):
            self.logger.info(f"正在收集第 {i+1}/18 條數據...")
            
            # 收集單條數據
            data_entry = self.collect_single_data_entry(i+1)
            collected_data.append(data_entry)
            
            # 嘗試導航到下一個數據項目（如果需要）
            if i < 17:  # 不是最後一條
                self.navigate_to_next_data_item()
                
        return collected_data
        
    def navigate_to_next_data_item(self):
        """導航到下一個數據項目"""
        try:
            # 嘗試點擊下一頁或下一個項目
            next_selectors = [
                "//button[contains(text(), '下一頁')]",
                "//a[contains(text(), '下一頁')]",
                "//button[contains(@class, 'next')]",
                "//a[contains(@class, 'next')]"
            ]
            
            for selector in next_selectors:
                try:
                    element = self.driver.find_element(By.XPATH, selector)
                    element.click()
                    time.sleep(3)
                    self.logger.info("成功導航到下一個數據項目")
                    return True
                except:
                    continue
                    
            # 如果沒有找到下一頁按鈕，嘗試滾動頁面
            self.driver.execute_script("window.scrollBy(0, 500);")
            time.sleep(2)
            
        except Exception as e:
            self.logger.error(f"導航到下一個數據項目失敗: {e}")
            
    def save_data_to_excel(self, data, filename_suffix=""):
        """將數據保存為Excel檔案"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"smart_data/collected_data_{timestamp}{filename_suffix}.xlsx"
            
            # 準備Excel數據
            excel_data = []
            for entry in data:
                row = {
                    '數據編號': entry['entry_index'],
                    '收集時間': entry['timestamp'],
                    '截圖1路徑': entry['screenshots'][0] if len(entry['screenshots']) > 0 else '',
                    '截圖2路徑': entry['screenshots'][1] if len(entry['screenshots']) > 1 else '',
                    '截圖3路徑': entry['screenshots'][2] if len(entry['screenshots']) > 2 else '',
                    '截圖4路徑': entry['screenshots'][3] if len(entry['screenshots']) > 3 else '',
                    'OCR文字1': entry['ocr_texts'][0] if len(entry['ocr_texts']) > 0 else '',
                    'OCR文字2': entry['ocr_texts'][1] if len(entry['ocr_texts']) > 1 else '',
                    'OCR文字3': entry['ocr_texts'][2] if len(entry['ocr_texts']) > 2 else '',
                    'OCR文字4': entry['ocr_texts'][3] if len(entry['ocr_texts']) > 3 else ''
                }
                excel_data.append(row)
                
            df = pd.DataFrame(excel_data)
            df.to_excel(filename, index=False, engine='openpyxl')
            self.logger.info(f"數據已保存到Excel檔案: {filename}")
            return filename
        except Exception as e:
            self.logger.error(f"保存Excel檔案失敗: {e}")
            return None
            
    def cleanup_screenshots(self):
        """10分鐘後自動刪除截圖"""
        def delete_screenshots():
            try:
                for screenshot_path in self.screenshot_paths:
                    if os.path.exists(screenshot_path):
                        os.remove(screenshot_path)
                        self.logger.info(f"已刪除截圖: {screenshot_path}")
                        
                # 清空截圖路徑列表
                self.screenshot_paths.clear()
                self.logger.info("所有截圖已自動清理完成")
            except Exception as e:
                self.logger.error(f"清理截圖失敗: {e}")
                
        # 10分鐘後執行刪除
        timer = threading.Timer(600, delete_screenshots)  # 600秒 = 10分鐘
        timer.start()
        self.logger.info("已設置10分鐘後自動刪除截圖")
        
    def run_data_collection_cycle(self):
        """執行一次完整的數據收集週期"""
        try:
            self.data_collection_count += 1
            self.logger.info(f"開始第 {self.data_collection_count} 次數據收集週期")
            
            # 設置瀏覽器
            if not self.setup_driver():
                return False
                
            # 導航到Gate.io
            if not self.navigate_to_gate():
                return False
                
            # 智能導航到合約頁面
            self.find_and_click_element("合約")
            time.sleep(3)
            
            self.find_and_click_element("永續合約")
            time.sleep(3)
            
            self.find_and_click_element("機器人")
            time.sleep(3)
            
            # 收集18條數據
            collected_data = self.collect_18_data_entries()
            
            # 保存數據到Excel
            excel_filename = self.save_data_to_excel(collected_data, f"_cycle_{self.data_collection_count}")
            
            # 設置自動刪除截圖
            self.cleanup_screenshots()
            
            self.logger.info(f"第 {self.data_collection_count} 次數據收集週期完成")
            self.logger.info(f"收集了 {len(collected_data)} 條數據")
            self.logger.info(f"Excel檔案: {excel_filename}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"數據收集週期失敗: {e}")
            return False
        finally:
            if self.driver:
                self.driver.quit()
                
    def start_automated_collection(self):
        """啟動自動化數據收集（每10分鐘一次）"""
        self.logger.info("啟動智能數據收集系統")
        self.logger.info("系統將每10分鐘自動收集一次數據")
        
        # 立即執行第一次收集
        self.run_data_collection_cycle()
        
        # 設置定時任務
        schedule.every(10).minutes.do(self.run_data_collection_cycle)
        
        # 持續運行
        while True:
            schedule.run_pending()
            time.sleep(60)  # 每分鐘檢查一次
            
    def run_single_collection(self):
        """執行單次數據收集"""
        self.logger.info("執行單次數據收集")
        return self.run_data_collection_cycle()

def main():
    collector = SmartDataCollector()
    
    print("智能數據收集系統")
    print("=" * 50)
    print("1. 啟動自動化收集（每10分鐘一次）")
    print("2. 執行單次收集")
    print("3. 退出")
    
    choice = input("請選擇操作 (1-3): ")
    
    if choice == "1":
        collector.start_automated_collection()
    elif choice == "2":
        collector.run_single_collection()
    elif choice == "3":
        print("退出系統")
    else:
        print("無效選擇")

if __name__ == "__main__":
    main()
