"""
Avto Sklad — Telegram Bot Keyboards
Professional inline keyboards tailored for Head Admin, Admins, and Customers.
"""

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from app.config import WEBAPP_URL, SHOP_PHONE, SHOP_TELEGRAM

def get_webapp_url() -> str:
    url = (WEBAPP_URL or "").strip()
    if not url or "localhost" in url or "127.0.0.1" in url:
        return "https://kuzavnoy-app.onrender.com"
    if url.startswith("http://"):
        return url.replace("http://", "https://")
    if not url.startswith("https://"):
        return f"https://{url}"
    return url

def webapp_head_admin_keyboard() -> InlineKeyboardMarkup:
    """Yagona Bosh Admin (Head Admin) uchun boshqaruv tugmalari."""
    app_url = get_webapp_url()
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📦 Ombor & Buxgalteriya (ERP)",
                    web_app=WebAppInfo(url=app_url)
                )
            ],
            [
                InlineKeyboardButton(text="📊 Holat", callback_data="cmd:status"),
                InlineKeyboardButton(text="⚠️ Kam qolganlar", callback_data="cmd:stock")
            ],
            [
                InlineKeyboardButton(text="💰 Kassa", callback_data="cmd:balance"),
                InlineKeyboardButton(text="👥 Adminlar", callback_data="cmd:admins")
            ],
            [
                InlineKeyboardButton(text="➕ Taklif Havolasi", callback_data="cmd:invite"),
                InlineKeyboardButton(text="📋 Barcha Takliflar", callback_data="cmd:invites")
            ]
        ]
    )

def webapp_admin_keyboard() -> InlineKeyboardMarkup:
    """Operatsion Admin uchun boshqaruv tugmalari."""
    app_url = get_webapp_url()
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📦 Ombor & Buxgalteriya (ERP)",
                    web_app=WebAppInfo(url=app_url)
                )
            ],
            [
                InlineKeyboardButton(text="📊 Holat", callback_data="cmd:status"),
                InlineKeyboardButton(text="⚠️ Kam qolganlar", callback_data="cmd:stock")
            ],
            [
                InlineKeyboardButton(text="💰 Kassa", callback_data="cmd:balance"),
                InlineKeyboardButton(text="🛒 Sotuvlar", callback_data="cmd:sales")
            ],
            [
                InlineKeyboardButton(text="📥 Xaridlar", callback_data="cmd:purchases"),
                InlineKeyboardButton(text="🔍 Qidirish", callback_data="cmd:search_hint")
            ]
        ]
    )

def webapp_customer_keyboard() -> InlineKeyboardMarkup:
    """Mijozlar / Xaridorlar uchun do'kon katalogi tugmalari."""
    app_url = get_webapp_url()
    tg_contact = SHOP_TELEGRAM.replace("@", "") if SHOP_TELEGRAM else "avto_sklad_admin"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚗 Ehtiyot Qismlar Katalogi",
                    web_app=WebAppInfo(url=app_url)
                )
            ],
            [
                InlineKeyboardButton(text="📍 Manzil & Ish vaqti", callback_data="cmd:info"),
                InlineKeyboardButton(text="👤 Profilim", callback_data="cmd:profile")
            ],
            [
                InlineKeyboardButton(
                    text="📞 Sotuvchi bilan bog'lanish",
                    url=f"https://t.me/{tg_contact}"
                )
            ]
        ]
    )

def invite_created_keyboard(invite_url: str, token: str) -> InlineKeyboardMarkup:
    """Yaratilgan 15 daqiqalik taklif havolasi tugmalari."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📤 Havolani Ulashish",
                    url=f"https://t.me/share/url?url={invite_url}&text=Auto%20Sklad%20Admin%20taklif%20havolasi%20(15%20daqiqa)"
                )
            ],
            [
                InlineKeyboardButton(
                    text="❌ Bekor qilish (Revoke)",
                    callback_data=f"revoke_invite:{token}"
                )
            ]
        ]
    )

def admin_action_keyboard(target_telegram_id: int) -> InlineKeyboardMarkup:
    """Bosh Admin uchun adminni boshqarish (o'chirish) tugmasi."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚫 Adminlikni bekor qilish",
                    callback_data=f"revoke_admin:{target_telegram_id}"
                )
            ]
        ]
    )

def invite_admin_options_keyboard() -> InlineKeyboardMarkup:
    """Admin qo'shish usulini tanlash tugmalari."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🆔 Telegram ID orqali", callback_data="invite_opt:by_id"),
                InlineKeyboardButton(text="🔗 15 daqiqalik Invite Link", callback_data="invite_opt:by_link")
            ]
        ]
    )

from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

def contact_request_keyboard() -> ReplyKeyboardMarkup:
    """Telegram kontaktini xavfsiz tasdiqlash klaviaturasi."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="📱 Telefon raqamni tasdiqlash", request_contact=True)
            ]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )
