"""
Avto Sklad — Bot Handlers Package
Includes all routers:
- start_router (/start, deep linking, /help, /info, /contact, /profile, /app)
- admin_router (/status, /stock, /balance, /sales, /purchases, /transactions, /search)
- head_admin_router (/admins, /invite, /invites, /addadmin, /removeadmin, /broadcast)
"""

from aiogram import Router
from app.bot.handlers.start import router as start_router
from app.bot.handlers.admin import router as admin_router
from app.bot.handlers.head_admin import router as head_admin_router

bot_router = Router()
bot_router.include_router(head_admin_router)
bot_router.include_router(admin_router)
bot_router.include_router(start_router)

__all__ = ["bot_router"]
