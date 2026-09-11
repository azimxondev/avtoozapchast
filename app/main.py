"""
Avto Sklad — Main Application Entry Point.
FastAPI + aiogram 3.x birgalikda ishlaydi.
"""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database.pool import create_pool, close_pool
from app.database.queries import init_tables
from app.api.routes import api_router
from app.bot.bot import bot, dp
from app.bot.handlers import router as bot_router
from app.config import BOT_TOKEN

# Bot router ni dispatcher ga ulash
dp.include_router(bot_router)

# Bot polling task reference
_bot_task: asyncio.Task | None = None


async def _start_bot_polling():
    """Bot polling ni background task sifatida ishga tushirish."""
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"⚠️ Bot polling xatosi: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup va shutdown."""
    # STARTUP
    print("🚀 Avto Sklad tizimi ishga tushmoqda...")

    # 1. Database pool ochish
    await create_pool()
    await init_tables()

    # 2. Bot polling ni boshlash (background task)
    global _bot_task
    if BOT_TOKEN:
        _bot_task = asyncio.create_task(_start_bot_polling())
        print("🤖 Telegram bot polling boshlandi.")
    else:
        print("⚠️ BOT_TOKEN topilmadi — bot ishga tushmadi.")

    print("✅ Tizim tayyor!")
    yield

    # SHUTDOWN
    print("🛑 Tizim to'xtatilmoqda...")

    if _bot_task:
        await dp.stop_polling()
        _bot_task.cancel()
        try:
            await _bot_task
        except asyncio.CancelledError:
            pass
        await bot.session.close()

    await close_pool()
    print("👋 Tizim to'xtatildi.")


# FastAPI instance
app = FastAPI(
    title="Avto Sklad",
    description="Avto ehtiyot qismlari sklad boshqaruv tizimi",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)

# Frontend static fayllar
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
async def serve_frontend():
    """Mini App bosh sahifasi."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"status": "Avto Sklad API ishlamoqda", "version": "2.0.0"}


@app.get("/health")
async def health_check():
    """Health check (UptimeRobot uchun)."""
    return {"status": "ok"}
