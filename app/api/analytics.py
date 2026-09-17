"""
Avto Sklad — Analytics & Financial Reports API
Daily, Weekly, Monthly, Yearly, Inventory Valuation, Top Sellers, Transparent Explanations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database.db import db
from app.api.auth import require_admin, require_staff_or_admin, CurrentUser

TZ_TASHKENT = timezone(timedelta(hours=5))

router = APIRouter(prefix="/analytics", tags=["Analytics & Accounting"])

@router.get("/overview")
async def get_overview(user: CurrentUser = Depends(require_staff_or_admin)):
    """Asosiy boshqaruv paneli uchun umumiy moliyaviy va ombor ko'rsatkichlari."""
    # 1. Current cash/budget balance
    last_tx = await db.fetchrow("SELECT new_balance FROM transactions ORDER BY id DESC LIMIT 1")
    current_balance = last_tx["new_balance"] if last_tx else 0

    # 2. Today's stats (Tashkent timezone)
    now = datetime.now(TZ_TASHKENT)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    today_sales_row = await db.fetchrow("""
        SELECT
            COALESCE(SUM(total_amount), 0) AS revenue,
            COALESCE(SUM(profit), 0) AS profit,
            COALESCE(SUM(quantity), 0) AS items_sold,
            COUNT(*) AS tx_count
        FROM transactions
        WHERE type = 'chiqim' AND created_at >= $1
    """, today_start_utc)

    today_purchases_row = await db.fetchrow("""
        SELECT
            COALESCE(SUM(total_amount), 0) AS expenses,
            COALESCE(SUM(quantity), 0) AS items_received,
            COUNT(*) AS tx_count
        FROM transactions
        WHERE type = 'kirim' AND created_at >= $1
    """, today_start_utc)

    # 3. Inventory valuation
    inv_stats = await db.fetchrow("""
        SELECT
            COUNT(*) AS total_products,
            COALESCE(SUM(quantity), 0) AS total_quantity,
            COALESCE(SUM(quantity * purchase_price), 0) AS total_cost_value,
            COALESCE(SUM(quantity * selling_price), 0) AS potential_selling_value,
            COALESCE(SUM(quantity * (selling_price - purchase_price)), 0) AS potential_profit
        FROM products
        WHERE is_deleted = 0
    """)

    # 4. Low stock & Out of stock counts
    stock_alerts = await db.fetchrow("""
        SELECT
            COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count,
            COALESCE(SUM(CASE WHEN quantity > 0 AND quantity <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock_count
        FROM products
        WHERE is_deleted = 0
    """)

    # 5. Low stock sample items (for quick dashboard widget)
    low_stock_items = await db.fetch("""
        SELECT id, name, sku, quantity, min_stock, unit, shelf_location, selling_price
        FROM products
        WHERE is_deleted = 0 AND quantity <= min_stock
        ORDER BY quantity ASC
        LIMIT 5
    """)

    return {
        "current_balance": current_balance,
        "today": {
            "revenue": today_sales_row["revenue"] if today_sales_row else 0,
            "expenses": today_purchases_row["expenses"] if today_purchases_row else 0,
            "profit": today_sales_row["profit"] if today_sales_row else 0,
            "items_sold": today_sales_row["items_sold"] if today_sales_row else 0,
            "items_received": today_purchases_row["items_received"] if today_purchases_row else 0,
            "transactions_count": (today_sales_row["tx_count"] if today_sales_row else 0) + (today_purchases_row["tx_count"] if today_purchases_row else 0)
        },
        "inventory": {
            "total_products": inv_stats["total_products"] if inv_stats else 0,
            "total_quantity": inv_stats["total_quantity"] if inv_stats else 0,
            "total_cost_value": inv_stats["total_cost_value"] if inv_stats else 0,
            "potential_selling_value": inv_stats["potential_selling_value"] if inv_stats else 0,
            "potential_profit": inv_stats["potential_profit"] if inv_stats else 0,
            "out_of_stock_count": stock_alerts["out_of_stock_count"] if stock_alerts else 0,
            "low_stock_count": stock_alerts["low_stock_count"] if stock_alerts else 0,
            "low_stock_items": low_stock_items
        }
    }

@router.get("/period")
async def get_period_analytics(
    period: str = Query("daily", description="daily, weekly, monthly, yearly, custom"),
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    user: CurrentUser = Depends(require_admin)
):
    """
    Davriy tahlil:
    - Ochilish balansi (Opening balance)
    - Xaridlar (Purchases)
    - Sotuvlar (Sales)
    - Tushum (Revenue)
    - Sof foyda (Gross profit)
    - Yopilish balansi (Closing balance)
    - Shaffof hisob-kitob formulasi
    - Grafik va toifalar bo'yicha taqsimot
    """
    now = datetime.now(TZ_TASHKENT)

    if target_date:
        try:
            base_date = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=TZ_TASHKENT)
        except ValueError:
            base_date = now
    else:
        base_date = now

    if period == "daily":
        start_time = base_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(days=1)
        period_title = f"{start_time.strftime('%d.%m.%Y')} kunlik hisob-kitob"
    elif period == "weekly":
        start_time = (base_date - timedelta(days=base_date.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(days=7)
        period_title = f"{start_time.strftime('%d.%m')} - {(end_time - timedelta(days=1)).strftime('%d.%m.%Y')} haftalik hisob-kitob"
    elif period == "monthly":
        start_time = base_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Next month start
        if start_time.month == 12:
            end_time = start_time.replace(year=start_time.year + 1, month=1)
        else:
            end_time = start_time.replace(month=start_time.month + 1)
        period_title = f"{start_time.strftime('%B %Y')} oylik hisob-kitob"
    elif period == "yearly":
        start_time = base_date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_time = start_time.replace(year=start_time.year + 1)
        period_title = f"{start_time.year} yillik hisob-kitob"
    else:
        raise HTTPException(status_code=400, detail="Noto'g'ri davr. Faqat: daily, weekly, monthly, yearly")

    start_iso = start_time.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    end_iso = end_time.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # 1. Opening balance (balance before start_time)
    opening_tx = await db.fetchrow("""
        SELECT new_balance FROM transactions
        WHERE created_at < $1
        ORDER BY id DESC LIMIT 1
    """, start_iso)
    opening_balance = opening_tx["new_balance"] if opening_tx else 0

    # 2. Sales in period
    sales_data = await db.fetchrow("""
        SELECT
            COALESCE(SUM(total_amount), 0) AS revenue,
            COALESCE(SUM(cost_price * quantity), 0) AS cost,
            COALESCE(SUM(profit), 0) AS profit,
            COALESCE(SUM(quantity), 0) AS items_sold,
            COUNT(*) AS count
        FROM transactions
        WHERE type = 'chiqim' AND created_at >= $1 AND created_at < $2
    """, start_iso, end_iso)

    # 3. Purchases in period
    purchases_data = await db.fetchrow("""
        SELECT
            COALESCE(SUM(total_amount), 0) AS expenses,
            COALESCE(SUM(quantity), 0) AS items_received,
            COUNT(*) AS count
        FROM transactions
        WHERE type = 'kirim' AND created_at >= $1 AND created_at < $2
    """, start_iso, end_iso)

    revenue = sales_data["revenue"] if sales_data else 0
    expenses = purchases_data["expenses"] if purchases_data else 0
    profit = sales_data["profit"] if sales_data else 0
    items_sold = sales_data["items_sold"] if sales_data else 0
    items_received = purchases_data["items_received"] if purchases_data else 0
    total_tx_count = (sales_data["count"] if sales_data else 0) + (purchases_data["count"] if purchases_data else 0)

    # 4. Closing balance (balance after last tx in period, or opening + sales - purchases)
    closing_tx = await db.fetchrow("""
        SELECT new_balance FROM transactions
        WHERE created_at < $1
        ORDER BY id DESC LIMIT 1
    """, end_iso)

    if closing_tx:
        closing_balance = closing_tx["new_balance"]
    else:
        closing_balance = opening_balance - expenses + revenue

    # 5. Transparent calculation breakdown
    formula_text = f"{opening_balance:,} - {expenses:,} + {revenue:,} = {closing_balance:,} UZS"

    # 6. Top 5 selling products in period
    top_products = await db.fetch("""
        SELECT
            product_name,
            SUM(quantity) AS total_sold,
            SUM(total_amount) AS total_revenue,
            SUM(profit) AS total_profit
        FROM transactions
        WHERE type = 'chiqim' AND created_at >= $1 AND created_at < $2
        GROUP BY product_name
        ORDER BY total_sold DESC
        LIMIT 5
    """, start_iso, end_iso)

    # 7. Category sales distribution
    category_sales = await db.fetch("""
        SELECT
            c.name AS category_name,
            c.icon AS category_icon,
            COALESCE(SUM(t.quantity), 0) AS items_sold,
            COALESCE(SUM(t.total_amount), 0) AS total_revenue,
            COALESCE(SUM(t.profit), 0) AS total_profit
        FROM transactions t
        JOIN products p ON p.id = t.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE t.type = 'chiqim' AND t.created_at >= $1 AND t.created_at < $2
        GROUP BY c.id, c.name, c.icon
        ORDER BY total_revenue DESC
    """, start_iso, end_iso)

    # 8. Timeline series data for charts
    # Daily breakdown if monthly/weekly, or hourly if daily
    chart_points = []
    if period in ("weekly", "monthly"):
        # Group by date
        chart_rows = await db.fetch("""
            SELECT
                SUBSTR(created_at, 1, 10) AS day_date,
                COALESCE(SUM(CASE WHEN type = 'chiqim' THEN total_amount ELSE 0 END), 0) AS day_revenue,
                COALESCE(SUM(CASE WHEN type = 'kirim' THEN total_amount ELSE 0 END), 0) AS day_expenses,
                COALESCE(SUM(CASE WHEN type = 'chiqim' THEN profit ELSE 0 END), 0) AS day_profit
            FROM transactions
            WHERE created_at >= $1 AND created_at < $2
            GROUP BY SUBSTR(created_at, 1, 10)
            ORDER BY day_date ASC
        """, start_iso, end_iso)
        chart_points = [dict(r) for r in chart_rows]
    elif period == "yearly":
        # Group by month
        chart_rows = await db.fetch("""
            SELECT
                SUBSTR(created_at, 1, 7) AS month_date,
                COALESCE(SUM(CASE WHEN type = 'chiqim' THEN total_amount ELSE 0 END), 0) AS month_revenue,
                COALESCE(SUM(CASE WHEN type = 'kirim' THEN total_amount ELSE 0 END), 0) AS month_expenses,
                COALESCE(SUM(CASE WHEN type = 'chiqim' THEN profit ELSE 0 END), 0) AS month_profit
            FROM transactions
            WHERE created_at >= $1 AND created_at < $2
            GROUP BY SUBSTR(created_at, 1, 7)
            ORDER BY month_date ASC
        """, start_iso, end_iso)
        chart_points = [dict(r) for r in chart_rows]

    # Navigation dates for previous and next periods
    if period == "daily":
        prev_date = (base_date - timedelta(days=1)).strftime("%Y-%m-%d")
        next_date = (base_date + timedelta(days=1)).strftime("%Y-%m-%d")
        can_next = (base_date + timedelta(days=1)).date() <= now.date()
    elif period == "weekly":
        prev_date = (start_time - timedelta(days=7)).strftime("%Y-%m-%d")
        next_date = (start_time + timedelta(days=7)).strftime("%Y-%m-%d")
        can_next = (start_time + timedelta(days=7)).date() <= now.date()
    elif period == "monthly":
        prev_date = (start_time.replace(day=1) - timedelta(days=1)).replace(day=1).strftime("%Y-%m-%d")
        next_date = end_time.strftime("%Y-%m-%d")
        can_next = end_time.date() <= now.date()
    elif period == "yearly":
        prev_date = f"{start_time.year - 1}-01-01"
        next_date = f"{start_time.year + 1}-01-01"
        can_next = (start_time.year + 1) <= now.year
    else:
        prev_date = None
        next_date = None
        can_next = False

    # Detailed itemized transactions for click drill-down (Revenue & Purchases breakdown)
    sales_items = await db.fetch("""
        SELECT id, tx_number, product_name, quantity, unit_price, cost_price, total_amount, profit,
               customer_or_supplier, admin_name, created_at
        FROM transactions
        WHERE type = 'chiqim' AND created_at >= $1 AND created_at < $2
        ORDER BY id DESC
        LIMIT 100
    """, start_iso, end_iso)

    purchases_items = await db.fetch("""
        SELECT id, tx_number, product_name, quantity, unit_price, cost_price, total_amount,
               customer_or_supplier, admin_name, created_at
        FROM transactions
        WHERE type = 'kirim' AND created_at >= $1 AND created_at < $2
        ORDER BY id DESC
        LIMIT 100
    """, start_iso, end_iso)

    return {
        "period": period,
        "title": period_title,
        "target_date": base_date.strftime("%Y-%m-%d"),
        "start_date": start_time.strftime("%Y-%m-%d"),
        "end_date": (end_time - timedelta(days=1)).strftime("%Y-%m-%d") if period != "yearly" else f"{start_time.year}-12-31",
        "prev_target_date": prev_date,
        "next_target_date": next_date,
        "can_navigate_next": can_next,
        "start_time": start_iso,
        "end_time": end_iso,
        "opening_balance": opening_balance,
        "expenses": expenses,
        "revenue": revenue,
        "profit": profit,
        "closing_balance": closing_balance,
        "items_sold": items_sold,
        "items_received": items_received,
        "transactions_count": total_tx_count,
        "formula": {
            "expression": formula_text,
            "explanation": f"Boshlang'ich kassa: {opening_balance:,} UZS | Xaridlar (Chiqim): -{expenses:,} UZS | Sotuvlar (Kirim): +{revenue:,} UZS | Yakuniy kassa: {closing_balance:,} UZS"
        },
        "top_products": top_products,
        "category_sales": category_sales,
        "chart_points": chart_points,
        "sales_items": [dict(r) for r in sales_items],
        "purchases_items": [dict(r) for r in purchases_items]
    }
