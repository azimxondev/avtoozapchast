"""Telegram inline keyboard builders matching Screenshot 2 design."""

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from app.config import WEBAPP_URL


def webapp_keyboard(is_admin: bool = True) -> InlineKeyboardMarkup:
    """Screenshot 2 ga moslangan inline keyboard."""
    buttons = [
        [InlineKeyboardButton(
            text="🛒 Katalog & Xarid qilish (Mini App)",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ]

    if is_admin:
        buttons.append([
            InlineKeyboardButton(
                text="👤 Admin Dashboardni ochish",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ])

    buttons.append([
        InlineKeyboardButton(
            text="📸 Instagram (@kuzavnoy.uz)",
            url="https://instagram.com/kuzavnoy.uz"
        ),
        InlineKeyboardButton(
            text="▶️ YouTube",
            url="https://youtube.com/@kuzavnoy"
        )
    ])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def no_access_keyboard() -> InlineKeyboardMarkup:
    """Ruxsat yo'q yoki oddiy user uchun tugmalar."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="📞 Admin bilan bog'lanish",
            url="https://t.me/kuzavnoy_uz"
        )],
        [
            InlineKeyboardButton(
                text="📸 Instagram",
                url="https://instagram.com/kuzavnoy.uz"
            ),
            InlineKeyboardButton(
                text="▶️ YouTube",
                url="https://youtube.com/@kuzavnoy"
            )
        ]
    ])
