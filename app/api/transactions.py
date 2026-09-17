"""
Avto Sklad — Transactions & Accounting Ledger API
Transparent ledger, filters, detailed calculation explanations ("Nega bu summa o'zgardi?").
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.database.db import db
from app.api.auth import require_staff_or_admin, CurrentUser

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("")
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    tx_type: Optional[str] = Query(None, description="all, kirim, chiqim, tuzatish, xarajat"),
    product_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="TX raqami yoki mahsulot nomi"),
    user: CurrentUser = Depends(require_staff_or_admin)
):
    """Barcha moliyaviy va ombor tranzaksiyalari jurnali."""
    conditions = ["1=1"]
    params = []
    p_idx = 1

    if tx_type and tx_type != "all":
        conditions.append(f"t.type = ${p_idx}")
        params.append(tx_type)
        p_idx += 1

    if product_id:
        conditions.append(f"t.product_id = ${p_idx}")
        params.append(product_id)
        p_idx += 1

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        conditions.append(f"(t.tx_number LIKE ${p_idx} OR t.product_name LIKE ${p_idx} OR t.customer_or_supplier LIKE ${p_idx})")
        params.append(search_pattern)
        p_idx += 1

    where_clause = " AND ".join(conditions)

    # Total count
    total = await db.fetchval(f"SELECT COUNT(*) FROM transactions t WHERE {where_clause}", *params) or 0

    # Paginated rows
    offset = (page - 1) * limit
    paginated_params = params + [limit, offset]
    rows = await db.fetch(f"""
        SELECT
            t.id, t.tx_number, t.product_id, t.product_name, t.type,
            t.quantity, t.unit_price, t.cost_price, t.total_amount, t.profit,
            t.prev_stock, t.new_stock, t.prev_balance, t.new_balance,
            t.admin_id, t.admin_name, t.customer_or_supplier, t.reason, t.note,
            t.created_at,
            p.unit, p.sku
        FROM transactions t
        LEFT JOIN products p ON p.id = t.product_id
        WHERE {where_clause}
        ORDER BY t.id DESC
        LIMIT ${p_idx} OFFSET ${p_idx + 1}
    """, *paginated_params)

    # Decorate with friendly labels
    type_labels = {
        "kirim": "Kirim (Xarid)",
        "chiqim": "Sotuv (Chiqim)",
        "tuzatish": "Tuzatish",
        "xarajat": "Xarajat"
    }

    for r in rows:
        r["type_label"] = type_labels.get(r["type"], r["type"])
        r["formatted_amount"] = f"{r['total_amount']:,} UZS"
        r["formatted_profit"] = f"{r['profit']:,} UZS" if r["type"] == "chiqim" else "—"

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return {
        "items": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/{tx_id}")
async def get_transaction_detail(tx_id: int, user: CurrentUser = Depends(require_staff_or_admin)):
    """Tranzaksiya tafsiloti va hisob-kitob formulasi ("Nega bu summa o'zgardi?")."""
    row = await db.fetchrow("""
        SELECT
            t.*,
            p.unit, p.sku, p.brand, p.car_model
        FROM transactions t
        LEFT JOIN products p ON p.id = t.product_id
        WHERE t.id = $1
    """, tx_id)

    if not row:
        raise HTTPException(status_code=404, detail="Tranzaksiya topilmadi.")

    # Mathematical explanation breakdown
    explanation = {}
    if row["type"] == "chiqim":
        explanation = {
            "title": "Sotuv hisob-kitobi",
            "formula_balance": f"{row['prev_balance']:,} + {row['total_amount']:,} = {row['new_balance']:,} UZS",
            "formula_profit": f"({row['unit_price']:,} - {row['cost_price']:,}) × {row['quantity']} = {row['profit']:,} UZS",
            "unit_profit": row["unit_price"] - row["cost_price"],
            "summary": f"Mijozga {row['quantity']} {row.get('unit', 'dona')} sotildi. Kassa balansiga {row['total_amount']:,} UZS tushum qo'shildi, sof foyda: {row['profit']:,} UZS."
        }
    elif row["type"] == "kirim":
        explanation = {
            "title": "Kirim (Xarid) hisob-kitobi",
            "formula_balance": f"{row['prev_balance']:,} - {row['total_amount']:,} = {row['new_balance']:,} UZS",
            "formula_profit": "Xaridda bevosita foyda shakllanmaydi (tannarx hisobiga o'tadi)",
            "unit_cost": row["cost_price"],
            "summary": f"Omborga {row['quantity']} {row.get('unit', 'dona')} kiritildi. Kassa balansidan {row['total_amount']:,} UZS to'lov yechildi."
        }
    else:
        explanation = {
            "title": "Balans tuzatish hisob-kitobi",
            "formula_balance": f"Kassa yangi holati: {row['new_balance']:,} UZS",
            "summary": row["reason"] or "Boshlang'ich yoki tuzatish operatsiyasi"
        }

    return {
        "transaction": row,
        "explanation": explanation
    }
