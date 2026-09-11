"""Statistics service for computing dashboard overview and period metrics."""

from app.database import queries


async def get_overview_statistics() -> dict:
    return await queries.get_overview_stats()


async def get_period_statistics(period: str) -> dict:
    return await queries.get_period_stats(period)
