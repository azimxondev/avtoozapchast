"""Statistics API — sklad qiymati, sotuv hisobi (kun/hafta/oy/yil)."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_user
from app.database import queries

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("")
async def overview(user: dict = Depends(get_current_user)):
    """Umumiy sklad statistikasi: mahsulot soni, jami qoldiq, sklad qiymati."""
    return await queries.get_overview_stats()


@router.get("/{period}")
async def period_stats(period: str, user: dict = Depends(get_current_user)):
    """
    Davriy statistika.
    period: daily | weekly | monthly | yearly
    """
    if period not in ("daily", "weekly", "monthly", "yearly"):
        raise HTTPException(status_code=400, detail="Noto'g'ri davr. Faqat: daily, weekly, monthly, yearly")
    return await queries.get_period_stats(period)
