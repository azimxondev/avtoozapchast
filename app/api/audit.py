"""
Avto Sklad — Audit Logs API
Every important action is tracked (who, what, when, old values, new values).
"""

from fastapi import APIRouter, Depends, Query
from app.database.db import db
from app.api.auth import require_super_admin, CurrentUser

router = APIRouter(prefix="/audit", tags=["Audit Logs"])

@router.get("")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(require_super_admin)
):
    """Barcha muhim admin amallari auditi (Faqat Bosh Admin ko'ra oladi)."""
    logs = await db.fetch("""
        SELECT * FROM audit_logs
        ORDER BY id DESC
        LIMIT $1
    """, limit)
    return {"logs": logs}
