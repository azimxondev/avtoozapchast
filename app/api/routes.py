"""API router — barcha endpointlarni birlashtirish."""

from fastapi import APIRouter

from app.api.products import router as products_router
from app.api.statistics import router as statistics_router
from app.api.shop import router as shop_router
from app.api.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(products_router)
api_router.include_router(statistics_router)
api_router.include_router(shop_router)
api_router.include_router(transactions_router)
