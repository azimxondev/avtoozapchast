"""Barcha SQL querylar — products, transactions, statistics, bot_users."""

from datetime import datetime, timedelta, timezone
from app.database.pool import get_pool

TZ_TASHKENT = timezone(timedelta(hours=5))


# ─────────────────────────── SCHEMA INIT ───────────────────────────

async def init_tables() -> None:
    """Jadvallarni yaratish va mavjud jadvallarni avto-migratsiya qilish."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS stock_products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                price BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
                description TEXT DEFAULT '',
                condition VARCHAR(10) NOT NULL DEFAULT 'NEW',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                product_id INT NOT NULL REFERENCES stock_products(id) ON DELETE CASCADE,
                type VARCHAR(10) NOT NULL DEFAULT 'chiqim',
                amount INT NOT NULL DEFAULT 1,
                price_at_transaction BIGINT NOT NULL DEFAULT 0,
                admin_id BIGINT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS bot_users (
                telegram_id BIGINT PRIMARY KEY,
                full_name VARCHAR(255) DEFAULT '',
                username VARCHAR(255) DEFAULT '',
                is_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- Avto-migratsiya: Eski jadvallarga yetishmayotgan ustunlarni avtomatik qo'shish
            ALTER TABLE stock_products ADD COLUMN IF NOT EXISTS condition VARCHAR(10) DEFAULT 'NEW';
            ALTER TABLE stock_products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount INT DEFAULT 1;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS price_at_transaction BIGINT DEFAULT 0;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_id BIGINT;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'chiqim';

            CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
            CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_products_name ON stock_products(name);
        """)
        print("✅ Jadvallar va indekslar tayyor va avto-migratsiya qilindi.")



# ─────────────────────── BOT USERS ───────────────────────

async def upsert_bot_user(telegram_id: int, full_name: str, username: str, is_admin: bool = False) -> None:
    pool = get_pool()
    await pool.execute("""
        INSERT INTO bot_users (telegram_id, full_name, username, is_admin)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (telegram_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            username = EXCLUDED.username,
            is_admin = EXCLUDED.is_admin
    """, telegram_id, full_name, username or '', is_admin)


async def get_all_bot_users() -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch("SELECT telegram_id, full_name, is_admin FROM bot_users")
    return [dict(r) for r in rows]


# ─────────────────────── PRODUCTS ───────────────────────

async def get_all_products() -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT * FROM stock_products ORDER BY id DESC"
    )
    return [dict(r) for r in rows]


async def get_product(product_id: int) -> dict | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM stock_products WHERE id = $1", product_id
    )
    return dict(row) if row else None


async def create_product(name: str, quantity: int, price: int, description: str, condition: str) -> dict:
    pool = get_pool()
    row = await pool.fetchrow("""
        INSERT INTO stock_products (name, quantity, price, description, condition)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """, name, quantity, price, description, condition)
    return dict(row)


async def update_product(product_id: int, name: str, price: int, description: str, condition: str) -> dict | None:
    pool = get_pool()
    row = await pool.fetchrow("""
        UPDATE stock_products
        SET name = $2, price = $3, description = $4, condition = $5, updated_at = NOW()
        WHERE id = $1
        RETURNING *
    """, product_id, name, price, description, condition)
    return dict(row) if row else None


async def delete_product(product_id: int) -> bool:
    pool = get_pool()
    result = await pool.execute(
        "DELETE FROM stock_products WHERE id = $1", product_id
    )
    return result == "DELETE 1"


# ─────────────────── KIRIM / CHIQIM (ATOMIC) ───────────────────

async def stock_in(product_id: int, amount: int, admin_id: int) -> dict:
    """Kirim: omborga tovar qo'shish. Atomic transaction."""
    if amount <= 0:
        raise ValueError("Miqdor 0 dan katta bo'lishi kerak.")

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT * FROM stock_products WHERE id = $1 FOR UPDATE",
                product_id
            )
            if not row:
                raise ValueError("Mahsulot topilmadi.")

            new_qty = row["quantity"] + amount
            await conn.execute(
                "UPDATE stock_products SET quantity = $1, updated_at = NOW() WHERE id = $2",
                new_qty, product_id
            )
            await conn.execute("""
                INSERT INTO transactions (product_id, type, amount, price_at_transaction, admin_id)
                VALUES ($1, 'kirim', $2, $3, $4)
            """, product_id, amount, row["price"], admin_id)

            updated = await conn.fetchrow(
                "SELECT * FROM stock_products WHERE id = $1", product_id
            )
            return dict(updated)


async def stock_out(product_id: int, amount: int, admin_id: int) -> dict:
    """Chiqim: ombordan tovar sotish. Atomic transaction."""
    if amount <= 0:
        raise ValueError("Miqdor 0 dan katta bo'lishi kerak.")

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT * FROM stock_products WHERE id = $1 FOR UPDATE",
                product_id
            )
            if not row:
                raise ValueError("Mahsulot topilmadi.")

            if row["quantity"] < amount:
                raise ValueError(
                    f"Omborda faqat {row['quantity']} dona mavjud. "
                    f"{amount} dona chiqim qilib bo'lmaydi."
                )

            new_qty = row["quantity"] - amount
            await conn.execute(
                "UPDATE stock_products SET quantity = $1, updated_at = NOW() WHERE id = $2",
                new_qty, product_id
            )
            await conn.execute("""
                INSERT INTO transactions (product_id, type, amount, price_at_transaction, admin_id)
                VALUES ($1, 'chiqim', $2, $3, $4)
            """, product_id, amount, row["price"], admin_id)

            updated = await conn.fetchrow(
                "SELECT * FROM stock_products WHERE id = $1", product_id
            )
            return dict(updated)


# ─────────────────── TRANSACTIONS HISTORY ───────────────────

async def get_transactions(limit: int = 100, offset: int = 0) -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch("""
        SELECT t.*, sp.name AS product_name
        FROM transactions t
        JOIN stock_products sp ON sp.id = t.product_id
        ORDER BY t.created_at DESC
        LIMIT $1 OFFSET $2
    """, limit, offset)
    return [dict(r) for r in rows]


# ─────────────────── STATISTICS ───────────────────

async def get_overview_stats() -> dict:
    """Umumiy sklad statistikasi."""
    pool = get_pool()
    row = await pool.fetchrow("""
        SELECT
            COUNT(*) AS total_products,
            COALESCE(SUM(quantity), 0) AS total_quantity,
            COALESCE(SUM(quantity::bigint * price), 0) AS stock_value
        FROM stock_products
    """)
    return dict(row)


async def get_period_stats(period: str) -> dict:
    """Davriy sotuv/kirim/chiqim statistikasi."""
    now = datetime.now(TZ_TASHKENT)

    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "yearly":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        raise ValueError("Noto'g'ri davr. Faqat: daily, weekly, monthly, yearly")

    pool = get_pool()
    row = await pool.fetchrow("""
        SELECT
            COALESCE(SUM(CASE WHEN type = 'chiqim' THEN amount::bigint * price_at_transaction ELSE 0 END), 0) AS total_sales,
            COALESCE(SUM(CASE WHEN type = 'kirim' THEN amount::bigint * price_at_transaction ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN type = 'chiqim' THEN amount ELSE 0 END), 0) AS items_sold,
            COALESCE(SUM(CASE WHEN type = 'kirim' THEN amount ELSE 0 END), 0) AS items_received
        FROM transactions
        WHERE created_at >= $1
    """, start)
    return dict(row)
