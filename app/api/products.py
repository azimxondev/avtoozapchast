"""
Avto Sklad — Products API
Advanced search, automotive filters, server-side pagination, CRUD, soft delete, history.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
import json

from app.database.db import db
from app.api.auth import require_admin, require_staff_or_admin, CurrentUser, get_current_user

router = APIRouter(prefix="/products", tags=["Products"])

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2)
    sku: str = Field(..., min_length=2)
    category_id: int
    brand: Optional[str] = ""
    car_brand: Optional[str] = ""
    car_model: Optional[str] = ""
    compatible_years: Optional[str] = ""
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    condition: Optional[str] = "NEW" # NEW or USED
    purchase_price: int = Field(0, ge=0)
    selling_price: int = Field(..., ge=0)
    quantity: int = Field(0, ge=0)
    min_stock: Optional[int] = 2
    unit: Optional[str] = "dona"
    shelf_location: Optional[str] = ""

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    compatible_years: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    condition: Optional[str] = None
    purchase_price: Optional[int] = None
    selling_price: Optional[int] = None
    min_stock: Optional[int] = None
    unit: Optional[str] = None
    shelf_location: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/meta/cars")
async def get_car_metadata():
    """Avtomobil modellari va brendlari ro'yxati (tezkor filtrlar uchun)."""
    rows = await db.fetch("""
        SELECT DISTINCT car_brand, car_model
        FROM products
        WHERE is_deleted = 0 AND car_model != ''
        ORDER BY car_brand, car_model
    """)
    brands = sorted(list({r["car_brand"] for r in rows if r["car_brand"]}))
    models = sorted(list({r["car_model"] for r in rows if r["car_model"]}))
    return {"brands": brands, "models": models}

@router.get("")
async def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    q: Optional[str] = Query(None, description="Qidiruv (nom, SKU, brend, model)"),
    category_id: Optional[int] = Query(None),
    car_brand: Optional[str] = Query(None),
    car_model: Optional[str] = Query(None),
    condition: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None, description="all, in_stock, low_stock, out_of_stock"),
    sort_by: Optional[str] = Query("created_desc", description="created_desc, price_asc, price_desc, stock_asc, stock_desc, name_asc"),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Mahsulotlar katalogi (server-side pagination, ko'p qirrali qidiruv va filtrlash).
    Mijoz ko'rinishida tannarx (purchase_price) ko'rsatilmaydi!
    """
    conditions = ["p.is_deleted = 0"]
    params = []
    p_idx = 1

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        conditions.append(f"""(
            p.name LIKE ${p_idx} OR
            p.sku LIKE ${p_idx} OR
            p.brand LIKE ${p_idx} OR
            p.car_brand LIKE ${p_idx} OR
            p.car_model LIKE ${p_idx} OR
            p.description LIKE ${p_idx}
        )""")
        params.append(search_pattern)
        p_idx += 1

    if category_id:
        conditions.append(f"p.category_id = ${p_idx}")
        params.append(category_id)
        p_idx += 1

    if car_brand and car_brand != "all":
        conditions.append(f"p.car_brand LIKE ${p_idx}")
        params.append(f"%{car_brand}%")
        p_idx += 1

    if car_model and car_model != "all":
        conditions.append(f"p.car_model LIKE ${p_idx}")
        params.append(f"%{car_model}%")
        p_idx += 1

    if condition and condition in ("NEW", "USED"):
        conditions.append(f"p.condition = ${p_idx}")
        params.append(condition)
        p_idx += 1

    if stock_status == "in_stock":
        conditions.append("p.quantity > p.min_stock")
    elif stock_status == "low_stock":
        conditions.append("p.quantity <= p.min_stock AND p.quantity > 0")
    elif stock_status == "out_of_stock":
        conditions.append("p.quantity = 0")

    # If user is regular customer (USER), only show active products
    if not (user.is_admin or user.role in ("ADMIN", "SUPER_ADMIN", "STAFF")):
        conditions.append("p.is_active = 1")

    where_clause = " AND ".join(conditions)

    # Sorting
    order_map = {
        "created_desc": "p.id DESC",
        "price_asc": "p.selling_price ASC",
        "price_desc": "p.selling_price DESC",
        "stock_asc": "p.quantity ASC",
        "stock_desc": "p.quantity DESC",
        "name_asc": "p.name ASC"
    }
    order_clause = order_map.get(sort_by, "p.id DESC")

    # Total count query
    count_query = f"SELECT COUNT(*) FROM products p WHERE {where_clause}"
    total = await db.fetchval(count_query, *params) or 0

    # Paginated data query
    offset = (page - 1) * limit
    data_query = f"""
        SELECT
            p.id, p.name, p.sku, p.category_id, p.brand, p.car_brand, p.car_model,
            p.compatible_years, p.description, p.image_url, p.condition,
            p.selling_price, p.quantity, p.min_stock, p.unit, p.shelf_location,
            p.is_active, p.created_at, p.updated_at,
            c.name AS category_name, c.icon AS category_icon,
            {"p.purchase_price" if (user.is_admin or user.role in ("ADMIN", "SUPER_ADMIN")) else "0 AS purchase_price"}
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE {where_clause}
        ORDER BY {order_clause}
        LIMIT ${p_idx} OFFSET ${p_idx + 1}
    """
    paginated_params = params + [limit, offset]
    items = await db.fetch(data_query, *paginated_params)

    # Decorate stock status
    for item in items:
        qty = item["quantity"]
        min_s = item["min_stock"]
        if qty == 0:
            item["stock_badge"] = "OUT_OF_STOCK"
            item["stock_label"] = "Qolmagan"
        elif qty <= min_s:
            item["stock_badge"] = "LOW_STOCK"
            item["stock_label"] = "Kam qoldi"
        else:
            item["stock_badge"] = "IN_STOCK"
            item["stock_label"] = "Mavjud"

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return {
        "items": items,
        "products": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/{product_id}")
async def get_product_detail(product_id: int, user: CurrentUser = Depends(get_current_user)):
    """Mahsulot haqida to'liq ma'lumot va harakatlar tarixi."""
    product = await db.fetchrow("""
        SELECT p.*, c.name AS category_name, c.icon AS category_icon
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = $1 AND p.is_deleted = 0
    """, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

    # Hide purchase_price if regular user
    is_staff_or_admin = (user.is_admin or user.role in ("ADMIN", "SUPER_ADMIN", "STAFF"))
    if not is_staff_or_admin:
        product["purchase_price"] = 0

    # Stock badge
    qty = product["quantity"]
    min_s = product["min_stock"]
    if qty == 0:
        product["stock_badge"] = "OUT_OF_STOCK"
        product["stock_label"] = "Tugagan"
    elif qty <= min_s:
        product["stock_badge"] = "LOW_STOCK"
        product["stock_label"] = "Kam qoldi"
    else:
        product["stock_badge"] = "IN_STOCK"
        product["stock_label"] = "Mavjud"

    # Recent transaction history for this product (only for staff/admin)
    history = []
    if is_staff_or_admin:
        history = await db.fetch("""
            SELECT id, tx_number, type, quantity, unit_price, cost_price, total_amount, profit,
                   prev_stock, new_stock, prev_balance, new_balance, admin_name,
                   customer_or_supplier, note, created_at
            FROM transactions
            WHERE product_id = $1
            ORDER BY id DESC
            LIMIT 10
        """, product_id)

    return {
        "product": product,
        "history": history
    }

@router.post("")
async def create_product(payload: ProductCreate, admin: CurrentUser = Depends(require_admin)):
    """Yangi mahsulot qo'shish (Admin)."""
    # Check SKU uniqueness
    existing_sku = await db.fetchval("SELECT id FROM products WHERE sku = $1 AND is_deleted = 0", payload.sku.strip())
    if existing_sku:
        raise HTTPException(status_code=400, detail=f"'{payload.sku}' artikulli mahsulot omborda allaqachon mavjud.")

    # Check category
    cat_exists = await db.fetchval("SELECT id FROM categories WHERE id = $1", payload.category_id)
    if not cat_exists:
        raise HTTPException(status_code=400, detail="Bunday toifa mavjud emas.")

    prod_id = await db.execute("""
        INSERT INTO products (
            name, sku, category_id, brand, car_brand, car_model, compatible_years,
            description, image_url, condition, purchase_price, selling_price,
            quantity, min_stock, unit, shelf_location, is_active, is_deleted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, 0)
    """,
        payload.name.strip(), payload.sku.strip(), payload.category_id,
        payload.brand.strip() if payload.brand else "",
        payload.car_brand.strip() if payload.car_brand else "",
        payload.car_model.strip() if payload.car_model else "",
        payload.compatible_years.strip() if payload.compatible_years else "",
        payload.description.strip() if payload.description else "",
        payload.image_url.strip() if payload.image_url else "",
        payload.condition, payload.purchase_price, payload.selling_price,
        payload.quantity, payload.min_stock or 2, payload.unit or "dona",
        payload.shelf_location.strip() if payload.shelf_location else ""
    )

    # If initial quantity > 0 and purchase price > 0, record initial stock-in transaction
    if payload.quantity > 0:
        total_cost = payload.quantity * payload.purchase_price
        tx_count = await db.fetchval("SELECT COUNT(*) FROM transactions") or 0
        tx_num = f"TX-{10001 + tx_count}"
        last_bal = await db.fetchval("SELECT new_balance FROM transactions ORDER BY id DESC LIMIT 1") or 0
        new_bal = last_bal - total_cost

        await db.execute("""
            INSERT INTO transactions (
                tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                admin_id, admin_name, customer_or_supplier, reason, note
            ) VALUES (
                $1, $2, $3, 'kirim', $4, $5, $5, $6, 0, 0, $4, $7, $8,
                $9, $10, 'Boshlang''ich qoldiq', 'Mahsulot yaratish', 'Dastlabki ombor hisobi'
            )
        """, tx_num, prod_id, payload.name, payload.quantity, payload.purchase_price,
            total_cost, last_bal, new_bal, admin.telegram_id, admin.full_name)

        tx_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = $1", tx_num)
        await db.execute("""
            INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
            VALUES ($1, 'CREDIT', $2, $3, $4)
        """, tx_id, total_cost, new_bal, f"{payload.name} boshlang'ich qoldiq xaridi")

    # Audit log
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
        VALUES ($1, $2, 'CREATE_PRODUCT', 'product', $3, '', $4)
    """, admin.telegram_id, admin.full_name, prod_id or 0, f"Qo'shildi: {payload.name} ({payload.sku})")

    return {"message": "Mahsulot muvaffaqiyatli saqlandi", "id": prod_id}

@router.put("/{product_id}")
async def update_product(product_id: int, payload: ProductUpdate, admin: CurrentUser = Depends(require_admin)):
    """Mahsulot ma'lumotlarini tahrirlash (Admin)."""
    current = await db.fetchrow("SELECT * FROM products WHERE id = $1 AND is_deleted = 0", product_id)
    if not current:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

    # If SKU changed, check uniqueness
    if payload.sku and payload.sku.strip() != current["sku"]:
        exists = await db.fetchval("SELECT id FROM products WHERE sku = $1 AND id != $2 AND is_deleted = 0", payload.sku.strip(), product_id)
        if exists:
            raise HTTPException(status_code=400, detail="Bu artikul boshqa mahsulotda ishlatilgan.")

    name = payload.name.strip() if payload.name is not None else current["name"]
    sku = payload.sku.strip() if payload.sku is not None else current["sku"]
    cat_id = payload.category_id if payload.category_id is not None else current["category_id"]
    brand = payload.brand.strip() if payload.brand is not None else current["brand"]
    car_brand = payload.car_brand.strip() if payload.car_brand is not None else current["car_brand"]
    car_model = payload.car_model.strip() if payload.car_model is not None else current["car_model"]
    compat = payload.compatible_years.strip() if payload.compatible_years is not None else current["compatible_years"]
    desc = payload.description.strip() if payload.description is not None else current["description"]
    img = payload.image_url.strip() if payload.image_url is not None else current["image_url"]
    cond = payload.condition if payload.condition is not None else current["condition"]
    p_price = payload.purchase_price if payload.purchase_price is not None else current["purchase_price"]
    s_price = payload.selling_price if payload.selling_price is not None else current["selling_price"]
    min_s = payload.min_stock if payload.min_stock is not None else current["min_stock"]
    unit = payload.unit if payload.unit is not None else current["unit"]
    shelf = payload.shelf_location.strip() if payload.shelf_location is not None else current["shelf_location"]
    active = int(payload.is_active) if payload.is_active is not None else current["is_active"]

    await db.execute("""
        UPDATE products SET
            name = $2, sku = $3, category_id = $4, brand = $5, car_brand = $6,
            car_model = $7, compatible_years = $8, description = $9, image_url = $10,
            condition = $11, purchase_price = $12, selling_price = $13, min_stock = $14,
            unit = $15, shelf_location = $16, is_active = $17, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    """, product_id, name, sku, cat_id, brand, car_brand, car_model, compat, desc, img, cond, p_price, s_price, min_s, unit, shelf, active)

    # Audit log
    changes = []
    if s_price != current["selling_price"]:
        changes.append(f"Narx: {current['selling_price']} -> {s_price}")
    if p_price != current["purchase_price"]:
        changes.append(f"Tannarx: {current['purchase_price']} -> {p_price}")
    change_summary = ", ".join(changes) if changes else "Tahrirlandi"

    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
        VALUES ($1, $2, 'UPDATE_PRODUCT', 'product', $3, $4, $5)
    """, admin.telegram_id, admin.full_name, product_id, f"Eski narx: {current['selling_price']}", change_summary)

    return {"message": "Mahsulot yangilandi"}

@router.delete("/{product_id}")
async def delete_product(product_id: int, admin: CurrentUser = Depends(require_admin)):
    """Mahsulotni xavfsiz arxivlash / soft-delete (Admin)."""
    current = await db.fetchrow("SELECT * FROM products WHERE id = $1 AND is_deleted = 0", product_id)
    if not current:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

    # Soft delete
    await db.execute("UPDATE products SET is_deleted = 1, is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1", product_id)

    # Audit log
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
        VALUES ($1, $2, 'SOFT_DELETE_PRODUCT', 'product', $3, $4, 'Mahsulot arxivlandi (tarix saqlandi)')
    """, admin.telegram_id, admin.full_name, product_id, current["name"])

    return {"message": "Mahsulot xavfsiz arxivlandi. Moliyaviy tranzaksiyalar tarixi to'liq saqlandi."}
