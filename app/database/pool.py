"""asyncpg connection pool with retry logic for Neon PostgreSQL."""

import asyncio
import asyncpg
from app.config import DATABASE_URL

_pool: asyncpg.Pool | None = None

MAX_RETRIES = 3
RETRY_DELAY = 1.0  # sekundda


def _clean_db_url(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


async def create_pool() -> asyncpg.Pool | None:
    """Connection pool ochish (startup da chaqiriladi)."""
    global _pool
    db_url = _clean_db_url(DATABASE_URL)

    if not db_url:
        print("⚠️ DATABASE_URL environment variable o'rnatilmagan!")
        return None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            _pool = await asyncpg.create_pool(
                db_url,
                min_size=1,
                max_size=10,
                command_timeout=30,
                statement_cache_size=0,
            )
            print("✅ PostgreSQL (Neon) bazasiga muvaffaqiyatli ulandi!")
            return _pool
        except Exception as e:
            print(f"⚠️ DB ulanish xatosi (urinish {attempt}/{MAX_RETRIES}): {e}")
            try:
                _pool = await asyncpg.create_pool(
                    db_url,
                    min_size=1,
                    max_size=10,
                    command_timeout=30,
                    statement_cache_size=0,
                    ssl="require",
                )
                print("✅ PostgreSQL bazasiga (SSL) muvaffaqiyatli ulandi!")
                return _pool
            except Exception as ssl_err:
                print(f"⚠️ SSL ulanish ham xato berdi: {ssl_err}")

            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY * attempt)

    print("❌ DB ga ulanib bo'lmadi.")
    return None


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
        raise RuntimeError("DATABASE_URL Render Sozlamalarida (Environment) kiritilmagan yoki Neon bazasi bilan aloqa yo'q.")
    return _pool

