"""
Avto Sklad — Authentication & Role Authorization
Supports Telegram WebApp initData HMAC-SHA256 validation + Demo mode switcher.
"""

import hmac
import hashlib
import json
import time
import urllib.parse
from typing import Optional
from fastapi import Header, HTTPException, Depends
from pydantic import BaseModel

from app.config import BOT_TOKEN, HEAD_ADMIN_ID, DEMO_MODE, IS_PRODUCTION
from app.database.db import db

class CurrentUser(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    username: str
    role: str  # 'HEAD_ADMIN', 'ADMIN', 'USER'
    is_admin: bool
    is_super_admin: bool

def parse_telegram_init_data(init_data: str) -> Optional[dict]:
    """
    Telegram WebApp initData HMAC-SHA256 signature validation with timing-safe comparison
    and replay attack protection via auth_date checking.
    """
    if not init_data or not BOT_TOKEN:
        return None

    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        hash_check = parsed.pop("hash", None)
        if not hash_check:
            return None

        # Replay attack protection: reject tokens older than 24 hours
        auth_date = int(parsed.get("auth_date", 0))
        if auth_date and (time.time() - auth_date > 86400):
            return None

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode("utf-8"), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

        # Timing-safe comparison to prevent side-channel timing attacks
        if hmac.compare_digest(computed_hash, hash_check):
            user_data = parsed.get("user")
            if user_data:
                return json.loads(user_data)
        return None
    except Exception:
        return None

async def get_current_user(
    x_telegram_init_data: Optional[str] = Header(None),
    x_demo_role: Optional[str] = Header(None)
) -> CurrentUser:
    """
    Foydalanuvchi identifikatsiyasi:
    1. Telegram WebApp initData mavjud bo'lsa - kriptografik tasdiqlangan haqiqiy Telegram ma'lumotlari.
    2. Ishlab chiqarishda (Production): Telegram imzosi bo'lmasa, so'rov darhol rad etiladi (401).
    3. Faqat ishlab chiqish/demo rejimida (DEMO_MODE=True): brauzerda sinash uchun x_demo_role qabul qilinadi.
    """
    # 1. Telegram WebApp tekshiruvi (Kriptografik HMAC)
    if x_telegram_init_data:
        tg_user = parse_telegram_init_data(x_telegram_init_data)
        if tg_user:
            tg_id = int(tg_user.get("id", 0))
            first_name = tg_user.get("first_name", "")
            last_name = tg_user.get("last_name", "")
            username = tg_user.get("username", "")
            full_name = f"{first_name} {last_name}".strip() or f"User {tg_id}"

            # Exact role determination
            # Only exactly HEAD_ADMIN_ID is HEAD_ADMIN
            if HEAD_ADMIN_ID and tg_id == HEAD_ADMIN_ID:
                user_role = "HEAD_ADMIN"
            else:
                admin_row = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", tg_id)
                if admin_row and admin_row.get("status") == "ACTIVE" and admin_row.get("role") in ("HEAD_ADMIN", "ADMIN"):
                    # If DB has HEAD_ADMIN but it's not the configured HEAD_ADMIN_ID, downgrade to ADMIN
                    user_role = "ADMIN"
                else:
                    user_role = "USER"

            # Update last_login if admin
            if user_role in ("HEAD_ADMIN", "ADMIN"):
                await db.execute(
                    "UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE telegram_id = $1",
                    tg_id
                )

            # Check / Sync users table
            row = await db.fetchrow("SELECT * FROM users WHERE telegram_id = $1", tg_id)
            if not row:
                await db.execute("""
                    INSERT INTO users (telegram_id, full_name, username, role, is_active)
                    VALUES ($1, $2, $3, $4, 1)
                """, tg_id, full_name, username, user_role)
                row = await db.fetchrow("SELECT * FROM users WHERE telegram_id = $1", tg_id)
            else:
                if row.get("role") != user_role or row.get("full_name") != full_name:
                    await db.execute("""
                        UPDATE users SET role = $1, full_name = $2, username = $3 WHERE telegram_id = $4
                    """, user_role, full_name, username, tg_id)

            is_head = (user_role == "HEAD_ADMIN") or (HEAD_ADMIN_ID and tg_id == HEAD_ADMIN_ID)
            is_adm = is_head or (user_role == "ADMIN")

            return CurrentUser(
                id=row["id"] if row else 1,
                telegram_id=tg_id,
                full_name=full_name,
                username=username,
                role="HEAD_ADMIN" if is_head else user_role,
                is_admin=is_adm,
                is_super_admin=is_head
            )

    # 2. Production Security Barrier: In production, reject non-Telegram requests
    if IS_PRODUCTION or not DEMO_MODE:
        raise HTTPException(
            status_code=401,
            detail="Autentifikatsiya talab qilinadi: Telegram WebApp orqali kiring."
        )

    # 3. Development / Demo Rejimi (Faqat DEMO_MODE=True bo'lganda)
    role_requested = (x_demo_role or "HEAD_ADMIN").upper()
    if role_requested in ("SUPER_ADMIN", "HEAD_ADMIN"):
        role_requested = "HEAD_ADMIN"
    elif role_requested not in ("HEAD_ADMIN", "ADMIN", "USER"):
        role_requested = "HEAD_ADMIN"

    demo_profiles = {
        "HEAD_ADMIN": {
            "id": 1,
            "telegram_id": HEAD_ADMIN_ID,
            "full_name": "Bosh Admin (Head Admin)",
            "username": "head_admin",
            "role": "HEAD_ADMIN",
            "is_admin": True,
            "is_super_admin": True
        },
        "ADMIN": {
            "id": 2,
            "telegram_id": 999999001,
            "full_name": "Sardor Rahimov (Menejer)",
            "username": "sardor_sklad",
            "role": "ADMIN",
            "is_admin": True,
            "is_super_admin": False
        },
        "USER": {
            "id": 3,
            "telegram_id": 999999003,
            "full_name": "Xaridor / Mijoz",
            "username": "mijoz_avto",
            "role": "USER",
            "is_admin": False,
            "is_super_admin": False
        }
    }

    prof = demo_profiles.get(role_requested, demo_profiles["HEAD_ADMIN"])
    return CurrentUser(**prof)

def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not (user.is_admin or user.role in ("HEAD_ADMIN", "SUPER_ADMIN", "ADMIN")):
        raise HTTPException(
            status_code=403,
            detail="Ushbu amalni bajarish uchun Admin huquqi talab qilinadi."
        )
    return user

require_staff_or_admin = require_admin

def require_super_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Only Head Admin has permission for admin management, invitations, and system control."""
    if not user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Ushbu amalni bajarish uchun faqat Bosh Admin (Head Admin) huquqi talab qilinadi."
        )
    return user

require_head_admin = require_super_admin
