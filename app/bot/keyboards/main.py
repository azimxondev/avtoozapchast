"""Telegram inline keyboard builders."""

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from app.config import WEBAPP_URL


def webapp_keyboard() -> InlineKeyboardMarkup:
    """Skladni ochish tugmasi (WebApp)."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="📦 Skladni ochish",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])


def no_access_keyboard() -> InlineKeyboardMarkup:
    """Ruxsat yo'q — aloqa tugmasi."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="📞 Admin bilan bog'lanish",
            url="https://t.me/kuzavnoy_uz"
        )]
    ])
