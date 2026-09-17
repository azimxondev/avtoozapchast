"""
Auto Sklad — Centralized Environment Configuration & Security Module
Loads and strictly validates environment variables without hardcoded secrets.
"""

import os
import re
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# 1. Environment mode
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION: bool = ENVIRONMENT == "production"
IS_DEVELOPMENT: bool = ENVIRONMENT == "development"

# 2. Demo mode
# In production, DEMO_MODE must ALWAYS be False to prevent unauthorized browser access.
if IS_PRODUCTION:
    DEMO_MODE: bool = False
else:
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").strip().lower() in ("true", "1", "yes")

# 3. Telegram Head Admin
# Strictly loaded from environment variable (.env) without hardcoded fallback.
_raw_head_admin = os.getenv("HEAD_ADMIN_ID", "").strip()
_clean_digits = re.findall(r"\d+", _raw_head_admin)
HEAD_ADMIN_ID: int = int(_clean_digits[0]) if _clean_digits else 0

# Optional co-admin IDs from environment (comma-separated, e.g. "123,456")
_raw_admin_ids = os.getenv("ADMIN_IDS", "").strip()
ADMIN_IDS: list[int] = []
if _raw_admin_ids:
    for item in _raw_admin_ids.split(","):
        found = re.findall(r"\d+", item)
        if found:
            ADMIN_IDS.append(int(found[0]))
if HEAD_ADMIN_ID and HEAD_ADMIN_ID not in ADMIN_IDS:
    ADMIN_IDS.insert(0, HEAD_ADMIN_ID)

# 4. Telegram Bot & WebApp
BOT_TOKEN: str = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL: str = os.getenv("WEBAPP_URL", "http://localhost:8000").strip()

# 5. Security & Session Secret Key
SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-insecure-secret-key-change-in-production").strip()

# 6. Database (PostgreSQL or SQLite fallback)
DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
SQLITE_DB_PATH: Path = BASE_DIR / "warehouse.db"

# 7. Initial Budget (UZS)
INITIAL_BUDGET: int = int(os.getenv("INITIAL_BUDGET", "150000000"))

# 8. Shop Information
SHOP_NAME: str = os.getenv("SHOP_NAME", "Auto Sklad & Ehtiyot Qismlar").strip()
SHOP_PHONE: str = os.getenv("SHOP_PHONE", "+998 90 123 45 67").strip()
SHOP_TELEGRAM: str = os.getenv("SHOP_TELEGRAM", "@avto_sklad_admin").strip()
SHOP_ADDRESS: str = os.getenv("SHOP_ADDRESS", "Toshkent sh., Sergeli mashina bozori, 4-qator, 18-do'kon").strip()
SHOP_WORK_HOURS: str = os.getenv("SHOP_WORK_HOURS", "Dushanba - Shanba: 08:30 - 18:30, Yakshanba: 09:00 - 16:00").strip()
SHOP_LAT: float = float(os.getenv("SHOP_LAT", "41.2258"))
SHOP_LON: float = float(os.getenv("SHOP_LON", "69.2195"))

# Helper functions
def is_head_admin(user_id: int | str | None) -> bool:
    """Check if the given Telegram user ID is the single Head Admin."""
    if not user_id or not HEAD_ADMIN_ID:
        return False
    try:
        return int(user_id) == int(HEAD_ADMIN_ID)
    except (ValueError, TypeError):
        return False

def is_admin(user_id: int | str | None) -> bool:
    """Check if the user ID is Head Admin or listed in ADMIN_IDS."""
    if not user_id:
        return False
    if is_head_admin(user_id):
        return True
    try:
        uid = int(user_id)
        return uid in ADMIN_IDS
    except (ValueError, TypeError):
        return False

def mask_phone_number(phone: str) -> str:
    """Mask phone number for safe logging and UI display (e.g. +998 ** *** 12 34)."""
    if not phone:
        return ""
    clean = re.sub(r"[^\d+]", "", phone)
    if len(clean) >= 9:
        prefix = clean[:4] if clean.startswith("+") else clean[:3]
        suffix = clean[-4:]
        return f"{prefix} ** *** {suffix[:2]} {suffix[2:]}"
    return "***"

def mask_secret(value: str) -> str:
    """Mask sensitive string for logs (e.g. 123456:***...***XYZ)."""
    if not value or len(value) < 8:
        return "********"
    return f"{value[:4]}...{value[-4:]}"

def validate_configuration() -> None:
    """
    Validate environment configuration at application startup.
    Fails safely without exposing secrets.
    """
    errors = []

    if IS_PRODUCTION:
        if not HEAD_ADMIN_ID:
            errors.append("HEAD_ADMIN_ID environment variable is missing or invalid in production.")
        if not BOT_TOKEN:
            errors.append("BOT_TOKEN environment variable is required in production.")
        if not SECRET_KEY or "dev-insecure" in SECRET_KEY:
            errors.append("SECRET_KEY must be a secure random string in production.")
        if not DATABASE_URL:
            # Production warning if postgres is recommended
            print("[CONFIG WARNING] DATABASE_URL is not set; falling back to local SQLite.")
        if DEMO_MODE:
            errors.append("DEMO_MODE must be disabled (false) in production.")

    if errors:
        error_msg = "\n - ".join(errors)
        raise RuntimeError(f"Application Configuration Validation Failed:\n - {error_msg}")

    print(f"[CONFIG] Environment: {ENVIRONMENT.upper()} | Head Admin ID: {mask_secret(str(HEAD_ADMIN_ID))} | Demo Mode: {DEMO_MODE}")
