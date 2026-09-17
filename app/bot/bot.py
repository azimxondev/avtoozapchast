"""
Avto Sklad — aiogram 3.x Bot Instance
"""

from typing import Optional
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from app.config import BOT_TOKEN

bot: Optional[Bot] = None
dp = Dispatcher()

def get_bot() -> Optional[Bot]:
    global bot
    if bot is None and BOT_TOKEN and BOT_TOKEN.strip():
        bot = Bot(
            token=BOT_TOKEN.strip(),
            default=DefaultBotProperties(parse_mode=ParseMode.HTML)
        )
    return bot
