"""
Avto Sklad — API Master Router
"""

from fastapi import APIRouter, Depends
from app.api.auth import get_current_user, CurrentUser
from app.api.products import router as products_router
from app.api.categories import router as categories_router
from app.api.stock import router as stock_router
from app.api.transactions import router as transactions_router
from app.api.analytics import router as analytics_router
from app.api.settings import router as settings_router
from app.api.audit import router as audit_router
from app.api.admin_management import router as admin_management_router

api_router = APIRouter(prefix="/api")

# Current user verification endpoint
@api_router.get("/auth/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    return {"user": current_user}

# Include sub-routers
api_router.include_router(products_router)
api_router.include_router(categories_router)
api_router.include_router(stock_router)
api_router.include_router(transactions_router)
api_router.include_router(analytics_router)
api_router.include_router(settings_router)
api_router.include_router(audit_router)
api_router.include_router(admin_management_router)
