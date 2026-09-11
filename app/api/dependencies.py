"""FastAPI dependencies — authentication and authorization."""

from fastapi import Header, HTTPException

from app.auth.telegram_auth import validate_init_data
from app.config import is_admin


async def get_current_user(x_telegram_init_data: str = Header("")) -> dict:
    """
    Telegram initData dan foydalanuvchi ma'lumotlarini olish.
    Noto'g'ri yoki muddati o'tgan bo'lsa 403.
    """
    user_data = validate_init_data(x_telegram_init_data)
    if not user_data or "id" not in user_data:
        raise HTTPException(status_code=403, detail="Telegram autentifikatsiya xatosi.")
    return user_data


async def get_current_admin(x_telegram_init_data: str = Header("")) -> dict:
    """
    Admin ekanligini tekshirish.
    Foydalanuvchi admin bo'lmasa 403.
    """
    user_data = validate_init_data(x_telegram_init_data)
    if not user_data or "id" not in user_data:
        raise HTTPException(status_code=403, detail="Telegram autentifikatsiya xatosi.")
    if not is_admin(user_data["id"]):
        raise HTTPException(status_code=403, detail="Sizda admin ruxsati yo'q.")
    return user_data
