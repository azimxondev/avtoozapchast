"""
Avto Sklad — Stock In & Stock Out (Sale) API
Strictly Atomic Transactions, Inventory Balance & Cash Ledger Tracking, Transparent Math.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.database.db import db
from app.api.auth import require_staff_or_admin, CurrentUser

router = APIRouter(prefix="/stock", tags=["Stock Management"])

class StockInRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Kirim miqdori kamida 1 bo'lishi kerak")
    purchase_price: int = Field(..., ge=0, description="Donasining tannarxi")
    supplier: Optional[str] = Field("", description="Yetkazib beruvchi nomi")
    note: Optional[str] = Field("", description="Qo'shimcha izoh")

class StockOutRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Sotuv miqdori kamida 1 bo'lishi kerak")
    selling_price: int = Field(..., ge=0, description="Donasining sotish narxi")
    customer_info: Optional[str] = Field("", description="Xaridor / Usta nomi yoki telefoni")
    note: Optional[str] = Field("", description="Qo'shimcha izoh")

@router.post("/in")
async def stock_in(payload: StockInRequest, user: CurrentUser = Depends(require_staff_or_admin)):
    """
    KIRIM (Stock In / Purchase):
    1. Ombordagi mahsulot qoldig'ini oshiradi.
    2. Mahsulot tannarxini yangilaydi (agar ko'rsatilgan bo'lsa).
    3. Kassadagi byudjetdan to'lov summasini ayiradi.
    4. To'liq tranzaksiya va kassa kiritmasini yaratadi.
    """
    async with db.transaction():
        product = await db.fetchrow("SELECT * FROM products WHERE id = $1 AND is_deleted = 0", payload.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

        prev_stock = product["quantity"]
        new_stock = prev_stock + payload.quantity

        total_cost = payload.quantity * payload.purchase_price

        # Last running balance
        last_bal = await db.fetchval("SELECT new_balance FROM transactions ORDER BY id DESC LIMIT 1")
        if last_bal is None:
            last_bal = 0
        new_bal = last_bal - total_cost

        # Unique transaction number
        tx_count = await db.fetchval("SELECT COUNT(*) FROM transactions") or 0
        tx_num = f"TX-{10001 + tx_count}"

        # Update product
        await db.execute("""
            UPDATE products
            SET quantity = $2, purchase_price = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        """, payload.product_id, new_stock, payload.purchase_price)

        # Create transaction
        await db.execute("""
            INSERT INTO transactions (
                tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                admin_id, admin_name, customer_or_supplier, reason, note
            ) VALUES (
                $1, $2, $3, 'kirim', $4, $5, $5, $6, 0, $7, $8, $9, $10,
                $11, $12, $13, 'Omborga tovar kiritish', $14
            )
        """,
            tx_num, payload.product_id, product["name"], payload.quantity,
            payload.purchase_price, total_cost, prev_stock, new_stock,
            last_bal, new_bal, user.telegram_id, user.full_name,
            payload.supplier or "Yetkazib beruvchi", payload.note or ""
        )

        tx_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = $1", tx_num)

        # Create cash ledger entry
        await db.execute("""
            INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
            VALUES ($1, 'CREDIT', $2, $3, $4)
        """, tx_id, total_cost, new_bal, f"{product['name']} ({payload.quantity} {product['unit']}) xaridi uchun chiqim")

        # Audit log
        await db.execute("""
            INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
            VALUES ($1, $2, 'STOCK_IN', 'product', $3, $4, $5)
        """, user.telegram_id, user.full_name, payload.product_id,
            f"Oldingi qoldiq: {prev_stock}",
            f"+{payload.quantity} {product['unit']}, Jami xarajat: {total_cost:,} UZS")

        return {
            "success": True,
            "message": f"Kirim muvaffaqiyatli saqlandi! +{payload.quantity} {product['unit']} omborga qo'shildi.",
            "transaction": {
                "tx_number": tx_num,
                "product_name": product["name"],
                "type": "kirim",
                "quantity": payload.quantity,
                "unit": product["unit"],
                "purchase_price": payload.purchase_price,
                "total_cost": total_cost,
                "prev_stock": prev_stock,
                "new_stock": new_stock,
                "prev_balance": last_bal,
                "new_balance": new_bal
            }
        }

@router.post("/out")
async def stock_out(payload: StockOutRequest, user: CurrentUser = Depends(require_staff_or_admin)):
    """
    SOTUV / CHIQIM (Stock Out / Sale):
    1. Ombordagi mahsulot qoldig'ini tekshiradi (qoldiq yetarli bo'lmasa qat'iy xatolik beradi!).
    2. Mahsulot qoldig'ini kamaytiradi.
    3. Kassadagi byudjetga sotuv tushumini qo'shadi.
    4. Sof foydani hisoblaydi: (Sotuv narxi - Tannarx) * Miqdor.
    5. To'liq tranzaksiya va kassa kiritmasini yaratadi.
    """
    async with db.transaction():
        product = await db.fetchrow("SELECT * FROM products WHERE id = $1 AND is_deleted = 0", payload.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

        prev_stock = product["quantity"]

        # Strict safety check: Never allow negative inventory!
        if prev_stock < payload.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Omborda tovar yetarli emas! Mavjud: {prev_stock} {product['unit']}, sotuv uchun so'ralgan: {payload.quantity} {product['unit']}."
            )

        new_stock = prev_stock - payload.quantity

        revenue = payload.quantity * payload.selling_price
        unit_cost = product["purchase_price"]
        total_cost = payload.quantity * unit_cost
        profit = revenue - total_cost

        # Last running balance
        last_bal = await db.fetchval("SELECT new_balance FROM transactions ORDER BY id DESC LIMIT 1")
        if last_bal is None:
            last_bal = 0
        new_bal = last_bal + revenue

        # Unique transaction number
        tx_count = await db.fetchval("SELECT COUNT(*) FROM transactions") or 0
        tx_num = f"TX-{10001 + tx_count}"

        # Update product stock
        await db.execute("""
            UPDATE products
            SET quantity = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        """, payload.product_id, new_stock)

        # Create transaction
        await db.execute("""
            INSERT INTO transactions (
                tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                admin_id, admin_name, customer_or_supplier, reason, note
            ) VALUES (
                $1, $2, $3, 'chiqim', $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $13, $14, $15, 'Mijozga sotuv', $16
            )
        """,
            tx_num, payload.product_id, product["name"], payload.quantity,
            payload.selling_price, unit_cost, revenue, profit,
            prev_stock, new_stock, last_bal, new_bal,
            user.telegram_id, user.full_name,
            payload.customer_info or "Mijoz", payload.note or ""
        )

        tx_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = $1", tx_num)

        # Create cash ledger entry
        await db.execute("""
            INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
            VALUES ($1, 'DEBIT', $2, $3, $4)
        """, tx_id, revenue, new_bal, f"{product['name']} ({payload.quantity} {product['unit']}) sotuv tushumi")

        # Audit log
        await db.execute("""
            INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, old_values, new_values)
            VALUES ($1, $2, 'SALE', 'product', $3, $4, $5)
        """, user.telegram_id, user.full_name, payload.product_id,
            f"Oldingi qoldiq: {prev_stock}",
            f"-{payload.quantity} {product['unit']}, Tushum: {revenue:,} UZS, Sof foyda: {profit:,} UZS")

        return {
            "success": True,
            "message": f"Sotuv muvaffaqiyatli amalga oshirildi! Tushum: {revenue:,} UZS, Sof foyda: {profit:,} UZS",
            "transaction": {
                "tx_number": tx_num,
                "product_name": product["name"],
                "type": "chiqim",
                "quantity": payload.quantity,
                "unit": product["unit"],
                "selling_price": payload.selling_price,
                "unit_cost": unit_cost,
                "revenue": revenue,
                "profit": profit,
                "prev_stock": prev_stock,
                "new_stock": new_stock,
                "prev_balance": last_bal,
                "new_balance": new_bal
            }
        }
