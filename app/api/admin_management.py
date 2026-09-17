"""
Avto Sklad — Admin Management & Invitations API
Only HEAD_ADMIN can manage other admins or create 15-minute single-use invite tokens.
"""

import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, CurrentUser, require_super_admin
from app.config import HEAD_ADMIN_ID, BOT_TOKEN
from app.database.db import db
from app.services.notifications import notify_new_admin_joined

router = APIRouter(prefix="/admin-management", tags=["admin-management"])

class CreateInviteRequest(BaseModel):
    note: Optional[str] = Field(None, description="Taklif uchun eslatma (ixtiyoriy)")

class AddAdminByIdRequest(BaseModel):
    telegram_id: int = Field(..., description="Yangi adminning Telegram ID si")
    first_name: str = Field(..., description="Ismi")
    last_name: Optional[str] = Field("", description="Familiyasi")
    username: Optional[str] = Field("", description="Telegram username (@ siz)")

@router.get("/admins")
async def list_admins(user: CurrentUser = Depends(require_super_admin)):
    """Barcha adminlar ro'yxati (Faqat Bosh Admin ko'ra oladi)."""
    rows = await db.fetch("""
        SELECT id, telegram_id, username, first_name, last_name, role, status, created_by, created_at, last_login, revoked_at
        FROM admins
        ORDER BY id ASC
    """)
    
    # Ensure HEAD_ADMIN is present in result
    admins_list = [dict(r) for r in rows]
    has_head = any(a.get("telegram_id") == HEAD_ADMIN_ID for a in admins_list)
    if not has_head and HEAD_ADMIN_ID:
        admins_list.insert(0, {
            "id": 0,
            "telegram_id": HEAD_ADMIN_ID,
            "username": "bosh_admin",
            "first_name": "Bosh",
            "last_name": "Admin",
            "role": "HEAD_ADMIN",
            "status": "ACTIVE",
            "created_by": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None,
            "revoked_at": None
        })
    return {"status": "success", "admins": admins_list}

@router.post("/admins/by-id")
async def add_admin_by_id(data: AddAdminByIdRequest, user: CurrentUser = Depends(require_super_admin)):
    """Telegram ID orqali yangi admin qo'shish (Faqat Bosh Admin)."""
    if data.telegram_id == HEAD_ADMIN_ID:
        raise HTTPException(status_code=400, detail="Bu foydalanuvchi allaqachon Bosh Admin hisoblanadi.")

    existing = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", data.telegram_id)
    if existing:
        if existing["status"] == "ACTIVE":
            raise HTTPException(status_code=400, detail="Bu foydalanuvchi allaqachon faol admin.")
        # Re-activate revoked admin
        await db.execute("""
            UPDATE admins 
            SET status = 'ACTIVE', role = 'ADMIN', revoked_at = NULL, 
                first_name = $1, last_name = $2, username = $3
            WHERE telegram_id = $4
        """, data.first_name, data.last_name or "", data.username or "", data.telegram_id)
    else:
        await db.execute("""
            INSERT INTO admins (telegram_id, username, first_name, last_name, role, status, created_by)
            VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', $5)
        """, data.telegram_id, data.username or "", data.first_name, data.last_name or "", user.telegram_id)

    # Sync into users table
    user_row = await db.fetchrow("SELECT * FROM users WHERE telegram_id = $1", data.telegram_id)
    full_name = f"{data.first_name} {data.last_name or ''}".strip()
    if user_row:
        await db.execute("UPDATE users SET role = 'ADMIN' WHERE telegram_id = $1", data.telegram_id)
    else:
        await db.execute("""
            INSERT INTO users (telegram_id, full_name, username, role, is_active)
            VALUES ($1, $2, $3, 'ADMIN', 1)
        """, data.telegram_id, full_name, data.username or "")

    # Audit log
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, new_values)
        VALUES ($1, $2, 'ADMIN_ADDED_BY_ID', 'admin', $3, $4)
    """, user.telegram_id, user.full_name, data.telegram_id, f"Added admin: {full_name}")

    return {
        "status": "success",
        "message": f"Admin muvaffaqiyatli qo'shildi: {full_name} ({data.telegram_id})"
    }

@router.delete("/admins/{telegram_id}")
async def revoke_admin(telegram_id: int, user: CurrentUser = Depends(require_super_admin)):
    """Adminlik huquqini bekor qilish (Faqat Bosh Admin)."""
    if telegram_id == HEAD_ADMIN_ID:
        raise HTTPException(status_code=400, detail="Bosh Adminni o'chirish yoki huquqini bekor qilish mumkin emas.")

    admin = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", telegram_id)
    if not admin:
        raise HTTPException(status_code=404, detail="Bunday admin topilmadi.")

    now_utc = datetime.now(timezone.utc)
    await db.execute("""
        UPDATE admins
        SET status = 'REVOKED', revoked_at = $1
        WHERE telegram_id = $2
    """, now_utc, telegram_id)

    await db.execute("UPDATE users SET role = 'USER' WHERE telegram_id = $1", telegram_id)

    # Audit log
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, new_values)
        VALUES ($1, $2, 'ADMIN_REVOKED', 'admin', $3, 'Admin huquqi bekor qilindi')
    """, user.telegram_id, user.full_name, telegram_id)

    return {
        "status": "success",
        "message": f"Admin (ID: {telegram_id}) huquqi bekor qilindi."
    }

@router.post("/invites")
async def create_invite_token(data: CreateInviteRequest = None, user: CurrentUser = Depends(require_super_admin)):
    """
    15 daqiqalik bir martalik admin taklif havolasi yaratish (Faqat Bosh Admin).
    """
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=15)
    token_masked = f"{token[:6]}...{token[-4:]}"

    await db.execute("""
        INSERT INTO admin_invitations (token, token_hash, created_by, created_at, expires_at, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
    """, token, token_hash, user.telegram_id, now, expires_at)

    # Audit log (NEVER store raw tokens in logs)
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, new_values)
        VALUES ($1, $2, 'INVITE_CREATED', 'invitation', 0, $3)
    """, user.telegram_id, user.full_name, f"15-daqiqa amal qiluvchi admin taklifi: {token_masked}")

    bot_username = "avtosklad_bot" # fallback
    try:
        from app.bot.bot import get_bot
        b = get_bot()
        if b:
            me = await b.get_me()
            if me and me.username:
                bot_username = me.username
    except Exception:
        pass

    invite_url = f"https://t.me/{bot_username}?start=admin_invite_{token}"

    return {
        "status": "success",
        "token": token,
        "invite_url": invite_url,
        "expires_at": expires_at.isoformat(),
        "expires_in_seconds": 900,
        "message": "Taklif havolasi yaratildi. U 15 daqiqa davomida va faqat bir marta amal qiladi."
    }

@router.get("/invites")
async def list_invites(user: CurrentUser = Depends(require_super_admin)):
    """Barcha yaratilgan taklif havolalarini ko'rish (Faqat Bosh Admin)."""
    rows = await db.fetch("""
        SELECT id, token, created_by, created_at, expires_at, used_at, used_by, status
        FROM admin_invitations
        ORDER BY id DESC
        LIMIT 50
    """)
    now = datetime.now(timezone.utc)
    
    result = []
    for r in rows:
        item = dict(r)
        exp = item.get("expires_at")
        if isinstance(exp, str):
            try:
                exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            except Exception:
                exp_dt = None
        else:
            exp_dt = exp

        # Dynamic check if expired
        is_expired = False
        if exp_dt:
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if now > exp_dt and item["status"] == "ACTIVE":
                item["status"] = "EXPIRED"
                is_expired = True

        item["is_expired"] = is_expired
        result.append(item)

    return {"status": "success", "invitations": result}

@router.delete("/invites/{token}/revoke")
async def revoke_invite(token: str, user: CurrentUser = Depends(require_super_admin)):
    """Faol taklif havolasini muddatidan oldin bekor qilish (Faqat Bosh Admin)."""
    invite = await db.fetchrow("SELECT * FROM admin_invitations WHERE token = $1", token)
    if not invite:
        raise HTTPException(status_code=404, detail="Taklif havolasi topilmadi.")

    await db.execute("""
        UPDATE admin_invitations
        SET status = 'REVOKED'
        WHERE token = $1
    """, token)

    # Audit log
    masked_token = f"{token[:6]}...{token[-4:]}" if len(token) > 10 else "***"
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, new_values)
        VALUES ($1, $2, 'INVITE_REVOKED', 'invitation', 0, $3)
    """, user.telegram_id, user.full_name, f"Taklif havolasi bekor qilindi: {masked_token}")

    return {"status": "success", "message": "Taklif havolasi bekor qilindi."}
