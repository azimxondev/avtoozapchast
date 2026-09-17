"""
Avto Sklad — Categories API
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.database.db import db
from app.api.auth import require_admin, CurrentUser

router = APIRouter(prefix="/categories", tags=["Categories"])

class CategoryCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = "📦"
    description: Optional[str] = ""
    sort_order: Optional[int] = 0

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None

@router.get("")
async def get_categories():
    """Barcha toifalarni mahsulotlar soni bilan olish."""
    query = """
        SELECT c.*, COUNT(p.id) AS product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_deleted = 0
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
    """
    cats = await db.fetch(query)
    return {"categories": cats}

@router.post("")
async def create_category(payload: CategoryCreate, admin: CurrentUser = Depends(require_admin)):
    """Yangi toifa qo'shish (Admin)."""
    exists = await db.fetchval("SELECT id FROM categories WHERE slug = $1", payload.slug)
    if exists:
        raise HTTPException(status_code=400, detail="Bu toifa kodi (slug) allaqachon mavjud.")

    cat_id = await db.execute("""
        INSERT INTO categories (name, slug, icon, description, sort_order)
        VALUES ($1, $2, $3, $4, $5)
    """, payload.name, payload.slug, payload.icon, payload.description, payload.sort_order)

    # Log audit
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
        VALUES ($1, $2, 'CREATE_CATEGORY', 'category', $3, '', $4)
    """, admin.telegram_id, admin.full_name, cat_id or 0, payload.name)

    return {"message": "Toifa muvaffaqiyatli yaratildi", "id": cat_id}

@router.put("/{category_id}")
async def update_category(category_id: int, payload: CategoryUpdate, admin: CurrentUser = Depends(require_admin)):
    """Toifani tahrirlash (Admin)."""
    cat = await db.fetchrow("SELECT * FROM categories WHERE id = $1", category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Toifa topilmadi.")

    name = payload.name if payload.name is not None else cat["name"]
    icon = payload.icon if payload.icon is not None else cat["icon"]
    desc = payload.description if payload.description is not None else cat["description"]
    sort_o = payload.sort_order if payload.sort_order is not None else cat["sort_order"]

    await db.execute("""
        UPDATE categories
        SET name = $2, icon = $3, description = $4, sort_order = $5
        WHERE id = $1
    """, category_id, name, icon, desc, sort_o)

    return {"message": "Toifa yangilandi"}
