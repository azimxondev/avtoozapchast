"""
Avto Sklad — QR & Barcode Scanner API
Lookup products by Barcode, SKU or ID, inspect stock, and assign barcodes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.database.db import db
from app.api.auth import get_current_user, require_admin, CurrentUser

router = APIRouter(prefix="/scanner", tags=["Scanner"])

class AssignBarcodeRequest(BaseModel):
    product_id: int
    barcode: str = Field(..., min_length=2, description="QR yoki Shtrix-kod qiymati")

@router.get("/lookup")
async def scanner_lookup(
    code: str = Query(..., min_length=1, description="Barcode, SKU yoki Mahsulot ID"),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Skaner orqali mahsulotni aniqlash:
    1. Avval 'barcode' bo'yicha qidiradi.
    2. Agar topilmasa, 'sku' (artikul) bo'yicha qidiradi.
    3. Agar raqam bo'lsa, 'id' bo'yicha tekshiradi.
    """
    clean_code = code.strip()

    # 1. Look up by barcode
    product = await db.fetchrow("""
        SELECT p.*, c.name as category_name, c.icon as category_icon
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_deleted = 0 AND p.barcode = $1
    """, clean_code)

    # 2. Look up by SKU
    if not product:
        product = await db.fetchrow("""
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0 AND UPPER(p.sku) = UPPER($1)
        """, clean_code)

    # 3. Look up by ID if clean_code is digits
    if not product and clean_code.isdigit():
        product = await db.fetchrow("""
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0 AND p.id = $1
        """, int(clean_code))

    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Skaner kodi bo'yicha mahsulot topilmadi: '{clean_code}'. QR/barcode boshqa mahsulotga tegishli bo'lishi mumkin."
        )

    # Convert to mutable dict
    prod_data = dict(product)

    # Permission-based price masking
    is_staff_or_admin = (user.is_admin or user.role in ("ADMIN", "SUPER_ADMIN", "STAFF"))
    if not is_staff_or_admin:
        prod_data["purchase_price"] = 0

    # Stock status badge
    qty = prod_data.get("quantity", 0)
    min_s = prod_data.get("min_stock", 2)
    if qty == 0:
        prod_data["stock_badge"] = "OUT_OF_STOCK"
        prod_data["stock_label"] = "Tugagan"
        prod_data["stock_color"] = "var(--accent-rose)"
    elif qty <= min_s:
        prod_data["stock_badge"] = "LOW_STOCK"
        prod_data["stock_label"] = "Kam qoldi"
        prod_data["stock_color"] = "var(--accent-amber)"
    else:
        prod_data["stock_badge"] = "IN_STOCK"
        prod_data["stock_label"] = "Mavjud"
        prod_data["stock_color"] = "var(--accent-emerald)"

    return {
        "success": True,
        "product": prod_data,
        "scanned_code": clean_code
    }

@router.post("/assign-barcode")
async def assign_barcode(
    payload: AssignBarcodeRequest,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Mahsulotga yangi shtrix-kod yoki QR identifikator biriktirish (Faqat Admin).
    """
    clean_barcode = payload.barcode.strip()

    # Check product exists
    prod = await db.fetchrow("SELECT id, name, sku FROM products WHERE id = $1 AND is_deleted = 0", payload.product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

    # Check uniqueness of barcode
    existing = await db.fetchrow(
        "SELECT id, name, sku FROM products WHERE barcode = $1 AND id != $2 AND is_deleted = 0",
        clean_barcode, payload.product_id
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ushbu shtrix-kod allaqachon '{existing['name']}' ({existing['sku']}) mahsulotiga biriktirilgan."
        )

    await db.execute("""
        UPDATE products
        SET barcode = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    """, payload.product_id, clean_barcode)

    # Audit log
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
        VALUES ($1, $2, 'ASSIGN_BARCODE', 'product', $3, '', $4)
    """, admin.telegram_id, admin.full_name, str(payload.product_id), f"Barcode: {clean_barcode}")

    return {
        "success": True,
        "message": f"Shtrix-kod muvaffaqiyatli biriktirildi: {clean_barcode}",
        "product_id": payload.product_id,
        "barcode": clean_barcode
    }
