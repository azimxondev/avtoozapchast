"""Bot handlers package."""

from aiogram import Router
from app.bot.handlers.start import router as start_router
from app.bot.handlers.admin import router as admin_router

bot_router = Router()
bot_router.include_router(start_router)
bot_router.include_router(admin_router)
