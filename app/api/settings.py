"""
Avto Sklad — Settings & Shop Info API
Configuration, Shop location, Cash adjustment with mandatory reason, Admin management.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.database.db import db
from app.api.auth import require_admin, require_super_admin, CurrentUser, get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])

class ShopSettingsUpdate(BaseModel):
    shop_name: Optional[str] = None
    shop_phone: Optional[str] = None
    shop_telegram: Optional[str] = None
    shop_address: Optional[str] = None
    shop_work_hours: Optional[str] = None
    shop_lat: Optional[str] = None
    shop_lon: Optional[str] = None

class BalanceAdjustmentRequest(BaseModel):
    new_balance: int = Field(..., ge=0, description="Yangi kassa balansi")
    reason: str = Field(..., min_length=5, description="Kassa o'zgarishi sababi (majburiy!)")
    note: Optional[str] = ""

class UserRoleUpdate(BaseModel):
    role: str # 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER'

@router.get("")
async def get_settings(user: CurrentUser = Depends(get_current_user)):
    """Do'kon sozlamalari va kassa ma'lumotlari."""
    rows = await db.fetch("SELECT key, value FROM shop_settings")
    settings = {r["key"]: r["value"] for r in rows}

    # Current running balance
    last_tx = await db.fetchrow("SELECT new_balance FROM transactions ORDER BY id DESC LIMIT 1")
    settings["current_balance"] = last_tx["new_balance"] if last_tx else 0

    return {"settings": settings}

@router.put("")
async def update_settings(payload: ShopSettingsUpdate, admin: CurrentUser = Depends(require_admin)):
    """Do'kon ma'lumotlarini yangilash (Admin)."""
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            await db.execute("""
                INSERT INTO shop_settings (key, value) VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """, k, str(v))

    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
        VALUES ($1, $2, 'UPDATE_SETTINGS', 'shop_settings', 1, '', 'Do''kon ma''lumotlari yangilandi')
    """, admin.telegram_id, admin.full_name)

    return {"message": "Sozlamalar muvaffaqiyatli saqlandi"}

@router.post("/balance-adjustment")
async def adjust_balance(payload: BalanceAdjustmentRequest, admin: CurrentUser = Depends(require_super_admin)):
    """
    Kassa balansini rasmiy tuzatish (Faqat Bosh Admin).
    Hech qachon shunchaki o'zgartirilmaydi — sababi va tranzaksiya yoziladi!
    """
    async with db.transaction():
        last_tx = await db.fetchrow("SELECT new_balance FROM transactions ORDER BY id DESC LIMIT 1")
        prev_bal = last_tx["new_balance"] if last_tx else 0
        diff = payload.new_balance - prev_bal

        tx_count = await db.fetchval("SELECT COUNT(*) FROM transactions") or 0
        tx_num = f"TX-{10001 + tx_count}"

        await db.execute("""
            INSERT INTO transactions (
                tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                admin_id, admin_name, customer_or_supplier, reason, note
            ) VALUES (
                $1, NULL, 'Kassa Balansi Tuzatish', 'tuzatish', 1, $2, 0,
                $3, 0, 0, 0, $4, $5,
                $6, $7, 'Admin', $8, $9
            )
        """,
            tx_num, abs(diff), abs(diff), prev_bal, payload.new_balance,
            admin.telegram_id, admin.full_name, payload.reason, payload.note or ""
        )

        tx_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = $1", tx_num)

        entry_type = "DEBIT" if diff >= 0 else "CREDIT"
        await db.execute("""
            INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
            VALUES ($1, $2, $3, $4, $5)
        """, tx_id, entry_type, abs(diff), payload.new_balance, f"Kassa tuzatildi: {payload.reason}")

        await db.execute("""
            INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
            VALUES ($1, $2, 'BALANCE_ADJUSTMENT', 'cash', 1, $3, $4)
        """, admin.telegram_id, admin.full_name, f"Eski: {prev_bal:,} UZS", f"Yangi: {payload.new_balance:,} UZS. Sabab: {payload.reason}")

        return {
            "success": True,
            "message": "Kassa balansi tuzatildi va tranzaksiya qayd etildi.",
            "tx_number": tx_num,
            "prev_balance": prev_bal,
            "new_balance": payload.new_balance
        }

@router.get("/users")
async def list_users(admin: CurrentUser = Depends(require_admin)):
    """Foydalanuvchilar va adminlar ro'yxati."""
    users = await db.fetch("SELECT id, telegram_id, full_name, username, role, is_active, created_at FROM users ORDER BY id ASC")
    return {"users": users}

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: int, payload: UserRoleUpdate, admin: CurrentUser = Depends(require_super_admin)):
    """Foydalanuvchi rolini o'zgartirish (Faqat Bosh Admin)."""
    if payload.role not in ("SUPER_ADMIN", "ADMIN", "STAFF", "USER"):
        raise HTTPException(status_code=400, detail="Noto'g'ri rol.")

    await db.execute("UPDATE users SET role = $2 WHERE id = $1", user_id, payload.role)
    return {"message": "Foydalanuvchi roli yangilandi"}
