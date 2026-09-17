"""
Avto Sklad — Main Application Entry Point
FastAPI backend + Telegram WebApp Mini App + Standalone Demo Mode.
"""

import sys
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import db, init_database, seed_initial_data_if_empty
from app.api.router import api_router
from app.config import BOT_TOKEN, SHOP_NAME, IS_PRODUCTION, validate_configuration

# Bot references
_bot_task: asyncio.Task | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup and shutdown."""
    print("[INIT] Avto Sklad tizimi ishga tushmoqda...")

    # 0. Central configuration validation
    validate_configuration()

    # 1. Connect database & run schema/seed
    try:
        await db.connect()
        await init_database()
        await seed_initial_data_if_empty()
        print("[INIT] Ma'lumotlar bazasi tayyor!")
    except Exception as e:
        print(f"[INIT ERROR] Ma'lumotlar bazasi xatosi: {e}")

    # 2. Telegram bot polling (if BOT_TOKEN is set)
    global _bot_task
    if BOT_TOKEN and BOT_TOKEN.strip():
        try:
            from app.bot.bot import get_bot, dp
            from app.bot.handlers import bot_router
            dp.include_router(bot_router)

            async def _start_bot_polling():
                bot_instance = get_bot()
                if not bot_instance:
                    return
                try:
                    from aiogram.types import BotCommand, BotCommandScopeDefault, BotCommandScopeChat
                    from app.config import HEAD_ADMIN_ID

                    user_commands = [
                        BotCommand(command="start", description="🚗 Ehtiyot qismlar katalogi"),
                        BotCommand(command="search", description="🔍 Mahsulot qidirish (SKU/Nom)"),
                        BotCommand(command="info", description="📍 Do'kon manzili va ish vaqti"),
                        BotCommand(command="contact", description="📞 Sotuvchi bilan bog'lanish"),
                        BotCommand(command="profile", description="👤 Mening profilim"),
                        BotCommand(command="help", description="ℹ️ Yordam")
                    ]
                    await bot_instance.set_my_commands(user_commands, scope=BotCommandScopeDefault())

                    admin_commands = [
                        BotCommand(command="start", description="🚗 Bosh sahifa va Mini App"),
                        BotCommand(command="admin", description="👑 Admin boshqaruv paneli"),
                        BotCommand(command="status", description="📊 Kassa va ombor auditi"),
                        BotCommand(command="products", description="📦 Ehtiyot qismlar qoldiqlari"),
                        BotCommand(command="stock", description="⚠️ Kam qolgan va tugagan tovarlar"),
                        BotCommand(command="analytics", description="📈 Kunlik tushum va sof foyda"),
                        BotCommand(command="balance", description="💰 Kassa balansi va aylanma"),
                        BotCommand(command="sales", description="🛒 Bugungi sotuvlar tarixi"),
                        BotCommand(command="purchases", description="📥 Xaridlar va kirimlar"),
                        BotCommand(command="search", description="🔍 Mahsulot qidirish"),
                        BotCommand(command="invite_admin", description="🔑 Yangi adminga taklifnoma berish"),
                        BotCommand(command="admins", description="👥 Barcha adminlar ro'yxati"),
                        BotCommand(command="help", description="ℹ️ Yordam va qo'llanma")
                    ]
                    if HEAD_ADMIN_ID:
                        try:
                            await bot_instance.set_my_commands(admin_commands, scope=BotCommandScopeChat(chat_id=HEAD_ADMIN_ID))
                        except Exception:
                            pass
                    print("[BOT] Telegram buyruqlari muvaffaqiyatli ro'yxatga olindi (User va Admin alohida).")
                except Exception as c_err:
                    print(f"[BOT COMMANDS NOTE] {c_err}")

                try:
                    await dp.start_polling(bot_instance, allowed_updates=dp.resolve_used_update_types())
                except asyncio.CancelledError:
                    pass
                except Exception as b_err:
                    print(f"[BOT ERROR] Polling xatosi: {b_err}")

            _bot_task = asyncio.create_task(_start_bot_polling())
            print("[BOT] Telegram bot polling ishga tushdi.")
        except Exception as bot_init_err:
            print(f"[BOT WARNING] Botni ishga tushirishda xato: {bot_init_err}")
    else:
        print("[MODE] BOT_TOKEN berilmagan — Demo Standalone rejimida to'liq ishlamoqda.")

    print("[READY] Tizim foydalanishga tayyor!")
    yield

    # SHUTDOWN
    print("[SHUTDOWN] Tizim to'xtatilmoqda...")
    if _bot_task:
        try:
            from app.bot.bot import bot, dp
            await dp.stop_polling()
            _bot_task.cancel()
            await bot.session.close()
        except Exception:
            pass

    await db.close()
    print("[SHUTDOWN] Tizim to'xtatildi.")

# FastAPI instance
app = FastAPI(
    title="Avto Sklad — Ombor & Buxgalteriya Tizimi",
    description="Avto ehtiyot qismlari ombori, sotuv, xarid, kassa va tahlil tizimi",
    version="2.5.0",
    lifespan=lifespan,
)

# Global error handler (never expose SQL or internal stack traces to clients)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[GLOBAL ERROR] {request.method} {request.url.path}: {exc}")
    detail_msg = str(exc) if not IS_PRODUCTION else "Serverda ichki xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring."
    return JSONResponse(
        status_code=500,
        content={"detail": detail_msg}
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)

# Static frontend files
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/app", methods=["GET", "HEAD"])
async def serve_frontend():
    """Telegram Mini App va Demo bosh sahifasi."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"status": "Avto Sklad API ishlamoqda", "version": "2.5.0"}

@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Xavfsiz tizim holati (hech qanday sir yoki parollarni oshkor qilmaydi)."""
    db_status = "connected"
    try:
        val = await db.fetchval("SELECT 1")
        if val != 1:
            db_status = "degraded"
    except Exception:
        db_status = "error"

    bot_status = "running" if (_bot_task and not _bot_task.done()) else ("configured" if BOT_TOKEN else "disabled")

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "bot": bot_status,
        "version": "2.5.0"
    }
