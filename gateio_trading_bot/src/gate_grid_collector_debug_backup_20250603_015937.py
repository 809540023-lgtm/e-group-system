# 在現有導入語句後添加
import time
import logging
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import pandas as pd
import os
from pathlib import Path
import time  # 添加這行

class GateGridCollectorDebug:
    def __init__(self):
        self.setup_directories()
        self.setup_logging()
        self.driver = None
        self.wait = None
        self.screenshot_count = 0
        
    def setup_directories(self):
        """創建必要的目錄"""
        self.base_dir = Path(__file__).parent
        self.screenshots_dir = self.base_dir / "screenshots"
        self.logs_dir = self.base_dir / "logs"
        self.data_dir = self.base_dir / "data"
        
        for directory in [self.screenshots_dir, self.logs_dir, self.data_dir]:
            directory.mkdir(exist_ok=True)
            
    def setup_logging(self):
        """設置詳細的日誌記錄"""
        log_file = self.logs_dir / f"debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def setup_browser(self):
        """設置瀏覽器"""
        try:
            chrome_options = Options()
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.wait = WebDriverWait(self.driver, 10)
            
            self.logger.info("瀏覽器設置成功")
            return True
            
        except Exception as e:
            self.logger.error(f"瀏覽器設置失敗: {e}")
            return False
            
    def take_screenshot(self, description=""):
        """截圖並保存"""
        try:
            self.screenshot_count += 1
            filename = f"screenshot_{self.screenshot_count:03d}_{description}.png"
            filepath = self.screenshots_dir / filename
            self.driver.save_screenshot(str(filepath))
            self.logger.info(f"截圖已保存: {filename}")
            return str(filepath)
        except Exception as e:
            self.logger.error(f"截圖失敗: {e}")
            return None
            
    def analyze_page_structure(self):
        """分析當前頁面結構"""
        try:
            # 獲取頁面標題
            title = self.driver.title
            url = self.driver.current_url
            
            self.logger.info(f"當前頁面標題: {title}")
            self.logger.info(f"當前頁面URL: {url}")
            
            # 查找所有可能的導航元素
            nav_selectors = [
                "nav", ".nav", "#nav", ".navbar", ".navigation",
                "[role='navigation']", ".menu", ".header-nav"
            ]
            
            for selector in nav_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        self.logger.info(f"找到導航元素 ({selector}): {len(elements)} 個")
                        for i, elem in enumerate(elements[:3]):  # 只顯示前3個
                            text = elem.text.strip()[:100]  # 限制文本長度
                            self.logger.info(f"  導航元素 {i+1}: {text}")
                except:
                    continue
                    
            # 查找包含「合約」的元素
            contract_keywords = ["合約", "contract", "Contract", "CONTRACT"]
            for keyword in contract_keywords:
                try:
                    elements = self.driver.find_elements(By.XPATH, f"//*[contains(text(), '{keyword}')]")
                    if elements:
                        self.logger.info(f"找到包含'{keyword}'的元素: {len(elements)} 個")
                        for i, elem in enumerate(elements[:5]):  # 只顯示前5個
                            try:
                                text = elem.text.strip()[:50]
                                tag = elem.tag_name
                                self.logger.info(f"  元素 {i+1} ({tag}): {text}")
                            except:
                                continue
                except:
                    continue
                    
            # 查找所有按鈕和鏈接
            button_selectors = ["button", "a", "[role='button']", ".btn", ".button"]
            for selector in button_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        self.logger.info(f"找到按鈕/鏈接 ({selector}): {len(elements)} 個")
                        for i, elem in enumerate(elements[:10]):  # 只顯示前10個
                            try:
                                text = elem.text.strip()[:30]
                                if text:
                                    self.logger.info(f"  按鈕/鏈接 {i+1}: {text}")
                            except:
                                continue
                except:
                    continue
                    
        except Exception as e:
            self.logger.error(f"頁面結構分析失敗: {e}")
            
    # 更新 interactive_navigation 方法
    def interactive_navigation(self):
        """互動式導航"""
        self.logger.info("\n=== 開始互動式導航 ===")
        
        while True:
            print("\n當前頁面分析:")
            self.analyze_page_structure()
            self.take_screenshot("current_page")
            
            print("\n請選擇操作:")
            print("1. 繼續分析當前頁面")
            print("2. 自動導航到網格交易頁面")
            print("3. 收集當前頁面的表格數據")
            print("4. 收集網格交易機器人數據")
            print("5. 導航到網格彈跳畫面並收集四頁數據")
            print("6. 處理當前頁面的網格彈跳畫面")
            print("7. 手動點擊元素")
            print("8. 退出")
            
            choice = input("請輸入選擇 (1-8): ").strip()
            
            if choice == "1":
                continue
            elif choice == "2":
                self.auto_navigate_to_grid_trading()
            elif choice == "3":
                self.collect_current_page_data()
            elif choice == "4":
                self.collect_grid_trading_data()
            elif choice == "5":
                if self.navigate_to_grid_popup():
                    self.handle_grid_popup_pages()
            elif choice == "6":
                self.handle_grid_popup_pages()
            elif choice == "7":
                text = input("請輸入要搜索的文本: ").strip()
                if text:
                    self.try_click_by_text([text])
            elif choice == "8":
                break
            else:
                print("無效選擇，請重新輸入")
                
            time.sleep(2)  # 等待頁面加載
            
    def try_click_by_text(self, keywords):
        """嘗試點擊包含指定文本的元素"""
        for keyword in keywords:
            try:
                # 嘗試多種選擇器
                selectors = [
                    f"//*[contains(text(), '{keyword}')]",
                    f"//button[contains(text(), '{keyword}')]",
                    f"//a[contains(text(), '{keyword}')]",
                    f"//*[@title='{keyword}']",
                    f"//*[contains(@class, '{keyword.lower()}')]"
                ]
                
                for selector in selectors:
                    try:
                        elements = self.driver.find_elements(By.XPATH, selector)
                        if elements:
                            self.logger.info(f"找到包含'{keyword}'的元素: {len(elements)} 個")
                            
                            for i, elem in enumerate(elements):
                                try:
                                    if elem.is_displayed() and elem.is_enabled():
                                        text = elem.text.strip()
                                        self.logger.info(f"嘗試點擊元素 {i+1}: {text}")
                                        
                                        # 滾動到元素位置
                                        self.driver.execute_script("arguments[0].scrollIntoView(true);", elem)
                                        time.sleep(1)
                                        
                                        # 嘗試點擊
                                        elem.click()
                                        self.logger.info(f"成功點擊: {text}")
                                        time.sleep(3)  # 等待頁面加載
                                        return True
                                        
                                except Exception as click_error:
                                    self.logger.warning(f"點擊失敗: {click_error}")
                                    continue
                                    
                    except Exception as find_error:
                        continue
                        
            except Exception as e:
                self.logger.error(f"搜索'{keyword}'時出錯: {e}")
                continue
                
        self.logger.warning(f"未找到可點擊的元素: {keywords}")
        return False
        
    def collect_current_page_data(self):
        """收集當前頁面的數據"""
        try:
            self.logger.info("開始收集當前頁面數據...")
            
            # 查找表格
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            self.logger.info(f"找到 {len(tables)} 個表格")
            
            all_data = []
            
            for i, table in enumerate(tables):
                try:
                    self.logger.info(f"處理表格 {i+1}...")
                    
                    # 獲取表頭
                    headers = []
                    header_elements = table.find_elements(By.TAG_NAME, "th")
                    if not header_elements:
                        # 如果沒有th，嘗試第一行的td
                        first_row = table.find_elements(By.XPATH, ".//tr[1]/td")
                        header_elements = first_row
                        
                    for header in header_elements:
                        text = header.text.strip()
                        if text:
                            headers.append(text)
                            
                    self.logger.info(f"表頭: {headers}")
                    
                    # 獲取數據行
                    rows = table.find_elements(By.TAG_NAME, "tr")
                    for j, row in enumerate(rows[1:], 1):  # 跳過表頭行
                        cells = row.find_elements(By.TAG_NAME, "td")
                        if cells:
                            row_data = {}
                            for k, cell in enumerate(cells):
                                header = headers[k] if k < len(headers) else f"Column_{k+1}"
                                row_data[header] = cell.text.strip()
                                
                            if any(row_data.values()):  # 如果行有數據
                                row_data['Table_Index'] = i + 1
                                row_data['Row_Index'] = j
                                all_data.append(row_data)
                                
                except Exception as table_error:
                    self.logger.error(f"處理表格 {i+1} 時出錯: {table_error}")
                    continue
                    
            # 查找其他數據容器
            data_selectors = [
                ".grid", ".data-grid", ".table-container",
                "[data-table]", ".list-item", ".data-row"
            ]
            
            for selector in data_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elements:
                        text = elem.text.strip()
                        if text and len(text) > 10:  # 過濫掉太短的文本
                            all_data.append({
                                'Type': 'Container',
                                'Selector': selector,
                                'Content': text[:200]  # 限制長度
                            })
                except:
                    continue
                    
            # 保存數據
            if all_data:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"collected_data_{timestamp}.xlsx"
                filepath = self.data_dir / filename
                
                df = pd.DataFrame(all_data)
                df.to_excel(filepath, index=False)
                
                self.logger.info(f"數據已保存到: {filename}")
                self.logger.info(f"共收集到 {len(all_data)} 條數據")
                
                # 顯示前幾條數據
                print("\n收集到的數據預覽:")
                for i, item in enumerate(all_data[:5]):
                    print(f"數據 {i+1}: {item}")
                    
            else:
                self.logger.warning("未找到任何數據")
                
        except Exception as e:
            self.logger.error(f"數據收集失敗: {e}")
            
    # 在 collect_current_page_data 方法後添加新方法
    
    def collect_grid_trading_data(self):
        """專門收集網格交易相關數據"""
        try:
            self.logger.info("開始收集網格交易數據...")
            
            # 收集網格交易機器人列表
            grid_data = []
            
            # 查找網格交易相關的選擇器
            grid_selectors = [
                ".grid-item", ".bot-item", ".trading-bot",
                "[data-testid*='grid']", "[data-testid*='bot']",
                ".strategy-item", ".robot-item"
            ]
            
            for selector in grid_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    self.logger.info(f"找到 {len(elements)} 個 {selector} 元素")
                    
                    for i, elem in enumerate(elements):
                        try:
                            # 提取機器人信息
                            bot_info = self.extract_bot_info(elem)
                            if bot_info:
                                bot_info['Element_Index'] = i + 1
                                bot_info['Selector'] = selector
                                grid_data.append(bot_info)
                        except Exception as e:
                            self.logger.warning(f"提取機器人信息失敗: {e}")
                            continue
                            
                except Exception as e:
                    self.logger.warning(f"查找 {selector} 失敗: {e}")
                    continue
            
            # 保存網格交易數據
            if grid_data:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"grid_trading_data_{timestamp}.xlsx"
                filepath = self.data_dir / filename
                
                df = pd.DataFrame(grid_data)
                df.to_excel(filepath, index=False)
                
                self.logger.info(f"網格交易數據已保存到: {filename}")
                self.logger.info(f"共收集到 {len(grid_data)} 個機器人數據")
                
                return grid_data
            else:
                self.logger.warning("未找到網格交易數據")
                return []
                
        except Exception as e:
            self.logger.error(f"收集網格交易數據失敗: {e}")
            return []
    
    def extract_bot_info(self, element):
        """從元素中提取機器人信息"""
        try:
            bot_info = {}
            
            # 嘗試提取各種信息
            info_patterns = {
                'name': ['.name', '.title', '.bot-name', '[data-testid*="name"]'],
                'profit': ['.profit', '.pnl', '.return', '[data-testid*="profit"]'],
                'status': ['.status', '.state', '[data-testid*="status"]'],
                'pair': ['.pair', '.symbol', '.trading-pair', '[data-testid*="pair"]'],
                'grid_count': ['.grid-count', '.grids', '[data-testid*="grid"]'],
                'investment': ['.investment', '.amount', '[data-testid*="amount"]']
            }
            
            for key, selectors in info_patterns.items():
                for selector in selectors:
                    try:
                        elem = element.find_element(By.CSS_SELECTOR, selector)
                        text = elem.text.strip()
                        if text:
                            bot_info[key] = text
                            break
                    except:
                        continue
            
            # 如果沒有找到具體信息，至少保存元素文本
            if not bot_info:
                text = element.text.strip()
                if text:
                    bot_info['raw_text'] = text[:200]
            
            return bot_info if bot_info else None
            
        except Exception as e:
            self.logger.warning(f"提取機器人信息時出錯: {e}")
            return None
    
    def auto_navigate_to_grid_trading(self):
        """自動導航到網格交易頁面"""
        try:
            self.logger.info("嘗試自動導航到網格交易頁面...")
            
            # 導航步驟
            navigation_steps = [
                {"keywords": ["合約", "Contract", "contract"], "description": "點擊合約"},
                {"keywords": ["永續", "Perpetual", "perpetual"], "description": "點擊永續合約"},
                {"keywords": ["機器人", "Bot", "bot", "Robot", "robot"], "description": "點擊交易機器人"},
                {"keywords": ["網格", "Grid", "grid"], "description": "點擊網格交易"}
            ]
            
            for step in navigation_steps:
                self.logger.info(f"執行步驟: {step['description']}")
                
                if self.try_click_by_text(step['keywords']):
                    self.logger.info(f"成功執行: {step['description']}")
                    time.sleep(3)  # 等待頁面加載
                    self.take_screenshot(f"after_{step['description']}")
                else:
                    self.logger.warning(f"無法執行: {step['description']}")
                    # 繼續嘗試下一步
                    
            return True
            
        except Exception as e:
            self.logger.error(f"自動導航失敗: {e}")
            return False
    
    def continuous_data_collection(self, interval_minutes=5, max_collections=10):
        """持續數據收集"""
        try:
            self.logger.info(f"開始持續數據收集，間隔 {interval_minutes} 分鐘，最多收集 {max_collections} 次")
            
            for i in range(max_collections):
                self.logger.info(f"第 {i+1}/{max_collections} 次數據收集")
                
                # 刷新頁面
                self.driver.refresh()
                time.sleep(5)
                
                # 截圖
                self.take_screenshot(f"collection_{i+1}")
                
                # 收集數據
                self.collect_current_page_data()
                self.collect_grid_trading_data()
                
                if i < max_collections - 1:  # 不是最後一次
                    self.logger.info(f"等待 {interval_minutes} 分鐘後進行下次收集...")
                    time.sleep(interval_minutes * 60)
                    
            self.logger.info("持續數據收集完成")
            
        except Exception as e:
            self.logger.error(f"持續數據收集失敗: {e}")

    def run(self):
        """執行數據收集 - Debug 版本"""
        try:
            self.logger.info("開始 Gate.io 合約網格數據收集 (Debug 模式)...")
            
            # 設置瀏覽器
            self.setup_browser()
            
            # 導航到 Gate.io
            self.logger.info("正在導航到 Gate.io...")
            self.driver.get("https://www.gate.io")
            
            # 等待頁面加載
            time.sleep(3)
            
            # 提示用戶手動登錄
            print("\n" + "="*50)
            print("🔐 請在瀏覽器中手動登錄您的 Gate.io 帳戶")
            print("📍 登錄後，請手動導航到合約網格交易頁面")
            print("⚡ 準備好後，返回此程序繼續操作")
            print("="*50 + "\n")
            
            input("按 Enter 鍵繼續...")
            
            # 開始互動式導航
            self.interactive_navigation()
            
            return True
            
        except Exception as e:
            self.logger.error(f"執行過程中發生錯誤: {e}")
            return False
        finally:
            if hasattr(self, 'driver') and self.driver:
                print("\n是否要關閉瀏覽器？(y/n): ", end="")
                choice = input().lower()
                if choice == 'y':
                    self.driver.quit()
                    self.logger.info("瀏覽器已關閉")
                else:
                    self.logger.info("瀏覽器保持開啟狀態")

def main():
    collector = GateGridCollectorDebug()
    collector.run()
    
if __name__ == "__main__":
    main()

# 在 collect_grid_trading_data 方法之後添加

def handle_grid_popup_pages(self):
    """處理網格交易彈跳畫面的四個頁面數據收集"""
    try:
        self.logger.info("開始處理網格交易彈跳畫面...")
        
        # 等待彈跳畫面出現
        popup_selectors = [
            ".modal", ".popup", ".dialog", ".overlay",
            "[role='dialog']", "[role='modal']",
            ".ant-modal", ".el-dialog", ".v-dialog"
        ]
        
        popup_element = None
        for selector in popup_selectors:
            try:
                popup_element = self.wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                self.logger.info(f"找到彈跳畫面: {selector}")
                break
            except:
                continue
        
        if not popup_element:
            self.logger.warning("未找到網格交易彈跳畫面")
            return False
        
        # 收集四個頁面的數據
        all_pages_data = []
        
        # 查找頁面標籤或按鈕
        tab_selectors = [
            ".tab", ".nav-tab", ".ant-tabs-tab", ".el-tabs__item",
            "[role='tab']", ".page-tab", ".section-tab"
        ]
        
        tabs = []
        for selector in tab_selectors:
            try:
                found_tabs = popup_element.find_elements(By.CSS_SELECTOR, selector)
                if found_tabs:
                    tabs = found_tabs
                    self.logger.info(f"找到 {len(tabs)} 個頁面標籤")
                    break
            except:
                continue
        
        # 如果找到標籤，逐個點擊收集數據
        if tabs:
            for i, tab in enumerate(tabs[:4]):  # 最多處理4個頁面
                try:
                    self.logger.info(f"處理第 {i+1} 個頁面...")
                    
                    # 點擊標籤
                    self.driver.execute_script("arguments[0].click();", tab)
                    time.sleep(2)
                    
                    # 收集當前頁面數據
                    page_data = self.collect_current_page_detailed_data(popup_element, f"頁面{i+1}")
                    all_pages_data.extend(page_data)
                    
                    # 截圖
                    self.take_screenshot(f"grid_popup_page_{i+1}")
                    
                except Exception as e:
                    self.logger.error(f"處理第 {i+1} 個頁面失敗: {e}")
                    continue
        else:
            # 如果沒有標籤，直接收集整個彈跳畫面的數據
            self.logger.info("未找到頁面標籤，收集整個彈跳畫面數據...")
            page_data = self.collect_current_page_detailed_data(popup_element, "完整彈跳畫面")
            all_pages_data.extend(page_data)
        
        # 保存數據
        if all_pages_data:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"grid_popup_data_{timestamp}.xlsx"
            filepath = self.data_dir / filename
            
            df = pd.DataFrame(all_pages_data)
            df.to_excel(filepath, index=False)
            
            self.logger.info(f"網格彈跳畫面數據已保存到: {filename}")
            self.logger.info(f"共收集到 {len(all_pages_data)} 條數據")
            
            return True
        
        return False
        
    except Exception as e:
        self.logger.error(f"處理網格彈跳畫面失敗: {e}")
        return False

def collect_current_page_detailed_data(self, container_element, page_name):
    """收集當前頁面的詳細數據（包含您提到的十幾個欄位）"""
    try:
        self.logger.info(f"收集 {page_name} 的詳細數據...")
        
        page_data = []
        
        # 您之前提到的欄位模式（需要根據實際網站調整）
        field_patterns = {
            '機器人名稱': ['.bot-name', '.robot-name', '.strategy-name', '[data-field="name"]'],
            '交易對': ['.trading-pair', '.symbol', '.pair', '[data-field="symbol"]'],
            '狀態': ['.status', '.state', '.bot-status', '[data-field="status"]'],
            '總投資': ['.total-investment', '.investment', '.capital', '[data-field="investment"]'],
            '已實現盈虧': ['.realized-pnl', '.profit', '.pnl', '[data-field="pnl"]'],
            '未實現盈虧': ['.unrealized-pnl', '.floating-pnl', '[data-field="unrealized"]'],
            '總盈虧': ['.total-pnl', '.total-profit', '[data-field="total_pnl"]'],
            '收益率': ['.roi', '.return-rate', '.yield', '[data-field="roi"]'],
            '網格數量': ['.grid-count', '.grids', '[data-field="grids"]'],
            '網格間距': ['.grid-spacing', '.spacing', '[data-field="spacing"]'],
            '最高價': ['.high-price', '.max-price', '[data-field="high"]'],
            '最低價': ['.low-price', '.min-price', '[data-field="low"]'],
            '當前價格': ['.current-price', '.price', '[data-field="price"]'],
            '創建時間': ['.create-time', '.start-time', '[data-field="created"]'],
            '運行時間': ['.runtime', '.duration', '[data-field="duration"]'],
            '成交次數': ['.trade-count', '.orders', '[data-field="trades"]']
        }
        
        # 查找所有可能的數據行或卡片
        row_selectors = [
            '.data-row', '.table-row', '.bot-card', '.strategy-card',
            '.grid-item', '.list-item', 'tr', '.ant-table-row'
        ]
        
        data_rows = []
        for selector in row_selectors:
            try:
                rows = container_element.find_elements(By.CSS_SELECTOR, selector)
                if rows:
                    data_rows = rows
                    self.logger.info(f"找到 {len(rows)} 個數據行 ({selector})")
                    break
            except:
                continue
        
        # 如果沒找到行，嘗試整個容器
        if not data_rows:
            data_rows = [container_element]
        
        # 提取每行的數據
        for i, row in enumerate(data_rows):
            try:
                row_data = {'頁面': page_name, '行號': i + 1}
                
                # 提取各個欄位
                for field_name, selectors in field_patterns.items():
                    field_value = None
                    
                    for selector in selectors:
                        try:
                            element = row.find_element(By.CSS_SELECTOR, selector)
                            field_value = element.text.strip()
                            if field_value:
                                break
                        except:
                            continue
                    
                    row_data[field_name] = field_value or "未找到"
                
                # 添加原始HTML（用於調試）
                try:
                    row_data['原始HTML'] = row.get_attribute('outerHTML')[:200] + "..."
                except:
                    row_data['原始HTML'] = "無法獲取"
                
                page_data.append(row_data)
                
            except Exception as e:
                self.logger.warning(f"提取第 {i+1} 行數據失敗: {e}")
                continue
        
        self.logger.info(f"{page_name} 收集到 {len(page_data)} 條數據")
        return page_data
        
    except Exception as e:
        self.logger.error(f"收集 {page_name} 詳細數據失敗: {e}")
        return []

def navigate_to_grid_popup(self):
    """專門導航到網格交易彈跳畫面"""
    try:
        self.logger.info("嘗試導航到網格交易彈跳畫面...")
        
        # 更精確的導航步驟
        navigation_steps = [
            {"action": "click", "keywords": ["合約", "Contract"], "description": "點擊合約菜單"},
            {"action": "wait", "time": 3, "description": "等待菜單展開"},
            {"action": "click", "keywords": ["永續", "Perpetual", "永續合約"], "description": "點擊永續合約"},
            {"action": "wait", "time": 3, "description": "等待頁面加載"},
            {"action": "click", "keywords": ["機器人", "Bot", "策略", "Strategy"], "description": "點擊機器人/策略"},
            {"action": "wait", "time": 3, "description": "等待機器人頁面"},
            {"action": "click", "keywords": ["網格", "Grid", "網格交易"], "description": "點擊網格交易"},
            {"action": "wait", "time": 5, "description": "等待網格交易彈跳畫面"}
        ]
        
        for step in navigation_steps:
            if step["action"] == "click":
                success = False
                for keyword in step["keywords"]:
                    if self.try_click_by_text(keyword):
                        self.logger.info(f"成功執行: {step['description']}")
                        success = True
                        break
                
                if not success:
                    self.logger.warning(f"執行失敗: {step['description']}")
                    # 繼續嘗試下一步，不要直接返回False
                    
            elif step["action"] == "wait":
                self.logger.info(f"等待 {step['time']} 秒...")
                time.sleep(step["time"])
                self.take_screenshot(f"navigation_step_{step['description']}")
        
        # 檢查是否成功到達網格交易頁面
        success_indicators = [
            "網格交易", "Grid Trading", "機器人列表", "策略列表",
            "創建機器人", "Create Bot", "網格策略"
        ]
        
        for indicator in success_indicators:
            try:
                elements = self.driver.find_elements(By.XPATH, f"//*[contains(text(), '{indicator}')]")
                if elements:
                    self.logger.info(f"成功到達網格交易頁面，找到指示器: {indicator}")
                    return True
            except:
                continue
        
        self.logger.warning("可能未成功到達網格交易頁面")
        return False
        
    except Exception as e:
        self.logger.error(f"導航到網格交易彈跳畫面失敗: {e}")
        return False