"""Kirim va chiqim bilan bog'liq PostgreSQL transactional logikasi."""

from app.database.pool import get_pool


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
