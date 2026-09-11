"""asyncpg connection pool with retry logic for Neon PostgreSQL."""

import asyncio
import asyncpg
from app.config import DATABASE_URL

_pool: asyncpg.Pool | None = None

MAX_RETRIES = 3
RETRY_DELAY = 1.0  # sekundda


async def create_pool() -> asyncpg.Pool:
    """Connection pool ochish (startup da chaqiriladi)."""
    global _pool
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            _pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=2,
                max_size=10,
                command_timeout=30,
                statement_cache_size=0,  # Neon uchun tavsiya etiladi
            )
            print(f"✅ PostgreSQL (Neon) bazasiga muvaffaqiyatli ulandi!")
            return _pool
        except Exception as e:
            print(f"⚠️ DB ulanish xatosi (urinish {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY * attempt)
            else:
                raise


async def close_pool() -> None:
    """Connection pool yopish (shutdown da chaqiriladi)."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        print("🔒 PostgreSQL connection pool yopildi.")


def get_pool() -> asyncpg.Pool:
    """Joriy pool ni qaytarish."""
    if _pool is None:
        raise RuntimeError("Database pool hali yaratilmagan. create_pool() ni chaqiring.")
    return _pool
