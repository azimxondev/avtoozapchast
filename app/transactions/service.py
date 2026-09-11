"""Transactions service for stock in/out and history retrieval."""

from app.database import queries
from app.database import transactions as db_tx


async def stock_in_service(product_id: int, amount: int, admin_id: int) -> dict:
    return await db_tx.stock_in(product_id, amount, admin_id)


async def stock_out_service(product_id: int, amount: int, admin_id: int) -> dict:
    return await db_tx.stock_out(product_id, amount, admin_id)


async def get_history_service(limit: int = 100, offset: int = 0) -> list[dict]:
    return await queries.get_transactions(limit=limit, offset=offset)
