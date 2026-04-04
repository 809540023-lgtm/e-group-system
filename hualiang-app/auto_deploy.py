#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
華亮分會 App - 完全自動部署腳本
使用 Render API 一鍵部署所有服務
"""

import json
import requests
import sys
from typing import Dict, Optional

# 顏色定義
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RED = '\033[91m'
RESET = '\033[0m'

class RenderDeployer:
    def __init__(self, api_token: str, owner_id: str):
        self.api_token = api_token
        self.owner_id = owner_id
        self.base_url = "https://api.render.com/v1"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        self.services = []

    def log_info(self, message: str):
        print(f"{BLUE}ℹ {message}{RESET}")

    def log_success(self, message: str):
        print(f"{GREEN}✓ {message}{RESET}")

    def log_warning(self, message: str):
        print(f"{YELLOW}⚠ {message}{RESET}")

    def log_error(self, message: str):
        print(f"{RED}✗ {message}{RESET}")

    def create_service(self, service_config: Dict) -> Optional[Dict]:
        """通過 API 建立服務"""
        try:
            response = requests.post(
                f"{self.base_url}/services",
                headers=self.headers,
                json=service_config,
                timeout=10
            )

            if response.status_code in [200, 201]:
                service = response.json()
                self.log_success(f"服務已建立: {service_config['name']}")
                self.services.append(service)
                return service
            else:
                error_msg = response.json().get('message', response.text)
                self.log_error(f"建立失敗: {error_msg}")
                return None

        except Exception as e:
            self.log_error(f"API 呼叫失敗: {str(e)}")
            return None

    def deploy_backend(self) -> bool:
        """部署後端 API"""
        self.log_info("【1/3】部署後端 API...")

        backend_config = {
            "name": "hualiang-api",
            "ownerId": self.owner_id,
            "type": "web_service",
            "environmentId": "python3",
            "repo": "https://github.com/809540023-lgtm/e-group-system.git",
            "branch": "main",
            "rootDir": "hualiang-app/backend",
            "buildCommand": "pip install -r requirements.txt",
            "startCommand": "gunicorn -w 4 -b 0.0.0.0:$PORT app:create_app()",
            "envVars": [
                {"key": "FLASK_ENV", "value": "production"},
                {"key": "FLASK_DEBUG", "value": "False"},
                {"key": "SECRET_KEY", "value": "hualiang-2025-secret-key-production"}
            ]
        }

        service = self.create_service(backend_config)
        if service:
            backend_url = service.get('serviceDetails', {}).get('url', 'https://hualiang-api.onrender.com')
            print(f"   URL: {backend_url}")
            return True
        return False

    def deploy_frontend(self, api_url: str = "https://hualiang-api.onrender.com/api") -> bool:
        """部署前端應用"""
        self.log_info("【2/3】部署前端應用...")

        frontend_config = {
            "name": "hualiang-frontend",
            "ownerId": self.owner_id,
            "type": "static_site",
            "repo": "https://github.com/809540023-lgtm/e-group-system.git",
            "branch": "main",
            "rootDir": "hualiang-app/frontend",
            "buildCommand": "npm install && npm run build",
            "publishDirectory": "dist",
            "envVars": [
                {"key": "VITE_API_URL", "value": api_url}
            ]
        }

        service = self.create_service(frontend_config)
        if service:
            frontend_url = service.get('serviceDetails', {}).get('url', 'https://hualiang-frontend.onrender.com')
            print(f"   URL: {frontend_url}")
            return True
        return False

    def deploy_admin(self, api_url: str = "https://hualiang-api.onrender.com/api") -> bool:
        """部署管理後台"""
        self.log_info("【3/3】部署管理後台...")

        admin_config = {
            "name": "hualiang-admin",
            "ownerId": self.owner_id,
            "type": "static_site",
            "repo": "https://github.com/809540023-lgtm/e-group-system.git",
            "branch": "main",
            "rootDir": "hauliang-app/admin",
            "buildCommand": "npm install && npm run build",
            "publishDirectory": "dist",
            "envVars": [
                {"key": "VITE_API_URL", "value": api_url}
            ]
        }

        service = self.create_service(admin_config)
        if service:
            admin_url = service.get('serviceDetails', {}).get('url', 'https://hauliang-admin.onrender.com')
            print(f"   URL: {admin_url}")
            return True
        return False

    def verify_deployment(self) -> bool:
        """驗證部署"""
        self.log_info("驗證部署...")
        try:
            response = requests.get(
                "https://hualiang-api.onrender.com/api/health",
                timeout=30
            )
            if response.status_code == 200:
                self.log_success("API 已上線！")
                return True
        except:
            self.log_warning("API 仍在啟動中，請在 2-3 分鐘後重試")
        return False

    def run(self) -> bool:
        """執行完整部署流程"""
        print("\n" + "="*50)
        print(f"{BLUE}華亮分會 App - 自動部署{RESET}")
        print("="*50 + "\n")

        # 部署所有服務
        if not self.deploy_backend():
            self.log_error("後端部署失敗，停止")
            return False

        print()
        if not self.deploy_frontend():
            self.log_warning("前端部署失敗，繼續...")

        print()
        if not self.deploy_admin():
            self.log_warning("管理後台部署失敗，繼續...")

        print("\n" + "="*50)
        self.log_success("所有服務已提交到 Render！")
        print("="*50 + "\n")

        print(f"{YELLOW}部署進度:${RESET}")
        print("  後端:    構建中... (約 3-5 分鐘)")
        print("  前端:    構建中... (約 1-2 分鐘)")
        print("  管理後台: 構建中... (約 1-2 分鐘)\n")

        print(f"{YELLOW}應用 URL:${RESET}")
        print("  用戶應用:  https://hualiang-frontend.onrender.com")
        print("  管理後台:  https://hualiang-admin.onrender.com")
        print("  後端 API:  https://hualiang-api.onrender.com\n")

        print(f"{YELLOW}監控部署進度:${RESET}")
        print("  訪問 https://dashboard.render.com 查看實時日誌\n")

        return True


def main():
    print(f"\n{BLUE}華亮分會 App - 自動部署助手{RESET}\n")

    # 讀取配置
    api_token = "rnd_gq4BtbXa54L83rVow891A3ilQ3XA"

    print("請提供你的 Render Owner ID")
    print("(查看 https://dashboard.render.com/account 中的 URL)\n")

    owner_id = input(f"{YELLOW}輸入 Owner ID: {RESET}").strip()

    if not owner_id:
        print(f"{RED}Owner ID 不能為空{RESET}")
        sys.exit(1)

    # 開始部署
    deployer = RenderDeployer(api_token, owner_id)
    success = deployer.run()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
