import os
from dotenv import load_dotenv

load_dotenv()

# Google
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
GOOGLE_DRIVE_FOLDER_ID = os.getenv('GOOGLE_DRIVE_FOLDER_ID', 'agai2_new')

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
DATABASE_PASSWORD = os.getenv('DATABASE_PASSWORD')

# Apify
APIFY_API_KEY = os.getenv('APIFY_API_KEY')

# OpenAI
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Telegram
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

# GitHub
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

# Render
RENDER_API_TOKEN = os.getenv('RENDER_API_TOKEN')

# E 组配置
E_GROUP_CONFIG = {
    'warehouse_date_format': '%Y%m%d',
    'image_extensions': ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
    'min_images_per_product': 2,
    'max_images_per_product': 4,
    'min_confidence_threshold': 0.65,
    'price_buffer_ratio': 0.15,
    'enable_telegram_notifications': True,
    'enable_review_marking': True,
}

# 日志配置
LOG_DIR = '/Users/linemily/Desktop/claude_code_fb20260402/.claude/worktrees/nostalgic-jackson/e_group/logs'
os.makedirs(LOG_DIR, exist_ok=True)
