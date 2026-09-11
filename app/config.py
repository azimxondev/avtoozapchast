"""Application configuration — loads settings from .env"""

import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
WEBAPP_URL: str = os.getenv("WEBAPP_URL", "http://localhost:8000")
SHOP_ADDRESS: str = os.getenv("SHOP_ADDRESS", "")
SHOP_LAT: str = os.getenv("SHOP_LAT", "")
SHOP_LON: str = os.getenv("SHOP_LON", "")

# Head Admin — birinchi ID (boshqa adminlarni boshqara oladi)
HEAD_ADMIN_ID: int = 0
# Barcha adminlar (Head Admin + Co-admins)
ADMIN_IDS: list[int] = []

_raw_ids = os.getenv("ADMIN_IDS", "")
if _raw_ids:
    _parsed = [int(x.strip()) for x in _raw_ids.split(",") if x.strip().isdigit()]
    if _parsed:
        HEAD_ADMIN_ID = _parsed[0]
        ADMIN_IDS = _parsed
else:
    # Fallback to user's Telegram ID if ADMIN_IDS env var is not set yet
    HEAD_ADMIN_ID = 5846655013
    ADMIN_IDS = [5846655013]


def is_admin(user_id: int) -> bool:
    """Foydalanuvchi admin yoki yo'qligini tekshirish."""
    return user_id in ADMIN_IDS


def is_head_admin(user_id: int) -> bool:
    """Foydalanuvchi bosh admin yoki yo'qligini tekshirish."""
    return user_id == HEAD_ADMIN_ID

