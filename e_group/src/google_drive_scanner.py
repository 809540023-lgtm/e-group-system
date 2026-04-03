"""
Google Drive 掃描器
掃描 agai2_new 資料夾，讀取日期資料夾和圖片
"""

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import logging
from datetime import datetime
import io
from config import GOOGLE_API_KEY

logger = logging.getLogger(__name__)

class GoogleDriveScanner:
    def __init__(self):
        # 使用 API key 初始化 Drive service
        self.drive_service = build('drive', 'v3', developerKey=GOOGLE_API_KEY)

    def scan_folder(self, folder_id):
        """掃描指定資料夾，列出所有日期子資料夾"""
        try:
            results = self.drive_service.files().list(
                q=f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder'",
                spaces='drive',
                fields='files(id, name, createdTime, modifiedTime)',
                pageSize=100
            ).execute()

            folders = results.get('files', [])
            # 按日期排序，取最新
            folders = sorted(folders, key=lambda x: x['modifiedTime'], reverse=True)

            logger.info(f"掃描到 {len(folders)} 個日期資料夾")
            return folders
        except Exception as e:
            logger.error(f"掃描資料夾失敗: {e}")
            return []

    def list_images_in_folder(self, folder_id):
        """列出資料夾內的所有圖片"""
        try:
            image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
            query = f"'{folder_id}' in parents and ("
            query += " or ".join([f"mimeType contains '{ext}'" for ext in ['image']])
            query += ")"

            results = self.drive_service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, createdTime, size, webContentLink)',
                pageSize=100,
                orderBy='createdTime'
            ).execute()

            images = results.get('files', [])
            logger.info(f"資料夾 {folder_id} 內找到 {len(images)} 張圖片")
            return images
        except Exception as e:
            logger.error(f"列出圖片失敗: {e}")
            return []

    def get_file_url(self, file_id):
        """獲取檔案下載 URL"""
        return f"https://drive.google.com/uc?export=view&id={file_id}"

    def download_image(self, file_id, output_path):
        """下載圖片到本地"""
        try:
            request = self.drive_service.files().get_media(fileId=file_id)
            file = io.BytesIO()
            downloader = MediaIoBaseDownload(file, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()

            with open(output_path, 'wb') as f:
                f.write(file.getvalue())

            logger.info(f"圖片已下載: {output_path}")
            return True
        except Exception as e:
            logger.error(f"下載圖片失敗: {e}")
            return False

    def get_latest_warehouse_date(self, root_folder_id):
        """取得最新的倉庫日期資料夾"""
        folders = self.scan_folder(root_folder_id)
        if folders:
            latest = folders[0]
            return latest['name'], latest['id']
        return None, None

    def parse_warehouse_date(self, folder_name):
        """解析日期資料夾名稱 (YYYYMMDD 格式)"""
        try:
            datetime.strptime(folder_name, '%Y%m%d')
            return folder_name
        except:
            logger.warning(f"無效的日期格式: {folder_name}")
            return None
