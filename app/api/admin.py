"""Admin management API — for Head Admin to manage co-admins and view user roles."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.config import is_admin, is_head_admin, ADMIN_IDS, HEAD_ADMIN_ID
from app.database import queries

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminAddRequest(BaseModel):
    telegram_id: int = Field(..., description="Yangi adminning Telegram ID si")


@router.get("/me")
async def get_my_role(user: dict = Depends(get_current_user)):
    """Joriy foydalanuvchi rolu va adminlik statusi."""
    user_id = user.get("id", 0)
    user_is_head = is_head_admin(user_id)
    user_is_adm = is_admin(user_id)
    
    role = "user"
    if user_is_head:
        role = "head_admin"
    elif user_is_adm:
        role = "admin"
        
    return {
        "user_id": user_id,
        "role": role,
        "is_admin": user_is_adm,
        "is_head_admin": user_is_head,
    }


@router.get("/list")
async def list_admins(user: dict = Depends(get_current_user)):
    """Barcha adminlar ro'yxatini olish."""
    user_id = user.get("id", 0)
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Sizda admin ruxsati yo'q.")
        
    users = await queries.get_all_bot_users()
    admins = []
    
    for u in users:
        tid = u["telegram_id"]
        if is_admin(tid):
            admins.append({
                "telegram_id": tid,
                "full_name": u.get("full_name", ""),
                "is_head_admin": is_head_admin(tid),
            })
            
    # Agar ADMIN_IDS dagi ba'zi id lar bot_users da bo'lmasa, ularni ham qo'shamiz
    existing_ids = {a["telegram_id"] for a in admins}
    for tid in ADMIN_IDS:
        if tid not in existing_ids:
            admins.append({
                "telegram_id": tid,
                "full_name": f"Admin ({tid})",
                "is_head_admin": is_head_admin(tid),
            })
            
    return admins


@router.post("/add")
async def add_admin_user(data: AdminAddRequest, user: dict = Depends(get_current_user)):
    """Yangi admin qo'shish (Faqat Bosh Admin qila oladi)."""
    user_id = user.get("id", 0)
    if not is_head_admin(user_id):
        raise HTTPException(status_code=403, detail="Faqat Bosh Admin yangi admin qo'sha oladi.")
        
    if data.telegram_id not in ADMIN_IDS:
        ADMIN_IDS.append(data.telegram_id)
        
    await queries.upsert_bot_user(
        telegram_id=data.telegram_id,
        full_name=f"Admin ({data.telegram_id})",
        username="",
        is_admin=True,
    )
    return {"status": "ok", "message": f"{data.telegram_id} adminlar ro'yxatiga qo'shildi."}


@router.delete("/{target_id}")
async def remove_admin_user(target_id: int, user: dict = Depends(get_current_user)):
    """Adminlik ruxsatini bekor qilish (Faqat Bosh Admin)."""
    user_id = user.get("id", 0)
    if not is_head_admin(user_id):
        raise HTTPException(status_code=403, detail="Faqat Bosh Admin adminni o'chira oladi.")
        
    if target_id == HEAD_ADMIN_ID:
        raise HTTPException(status_code=400, detail="Bosh Adminni o'chirib bo'lmaydi.")
        
    if target_id in ADMIN_IDS:
        ADMIN_IDS.remove(target_id)
        
    await queries.upsert_bot_user(
        telegram_id=target_id,
        full_name="",
        username="",
        is_admin=False,
    )
    return {"status": "ok", "message": f"{target_id} adminlikdan chiqarildi."}
