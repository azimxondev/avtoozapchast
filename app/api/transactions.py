"""Transactions API — kirim/chiqim tarixi."""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_admin
from app.database import queries

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("")
async def list_transactions(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_current_admin),
):
    """Transaction tarixini ko'rish (faqat admin)."""
    return await queries.get_transactions(limit, offset)
