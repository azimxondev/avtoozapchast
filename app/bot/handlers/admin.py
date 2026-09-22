"""
Avto Sklad — Telegram Bot Admin Handlers
Provides quick operational commands for Admins & Head Admin:
/admin, /status, /stock, /balance, /sales, /purchases, /transactions, /products, /analytics, /search
"""

import asyncio
from datetime import datetime, timezone
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command, CommandObject

from app.config import HEAD_ADMIN_ID, is_head_admin, is_admin
from app.database.db import db
from app.bot.keyboards import webapp_admin_keyboard, webapp_head_admin_keyboard
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

router = Router()

async def is_user_admin(telegram_id: int | str | None) -> bool:
    """Check if user is Head Admin, in ADMIN_IDS, or active Admin in DB."""
    if not telegram_id:
        return False
    if is_head_admin(telegram_id) or is_admin(telegram_id):
        return True
    try:
        tid = int(telegram_id)
        row = await db.fetchrow("SELECT role, status FROM admins WHERE telegram_id = $1", tid)
        if row and row["status"] == "ACTIVE":
            return True
        user_row = await db.fetchrow("SELECT role FROM users WHERE telegram_id = $1", tid)
        return bool(user_row and user_row["role"] in ("HEAD_ADMIN", "SUPER_ADMIN", "ADMIN"))
    except Exception:
        return False

def format_sum(amount: int) -> str:
    """Format sum into readable Uzbek So'm string."""
    return f"{int(amount):,} so'm".replace(",", " ")

async def show_status(target: Message, user_id: int, edit: bool = False):
    """Ombor va kassa tezkor holati — parallel tezkor so'rovlar."""
    if not await is_user_admin(user_id):
        await target.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.strftime("%Y-%m-%d 00:00:00")

    # Barcha ma'lumotlarni parallel ravishda (bir vaqtning o'zida) chaqirish - 4x tezroq
    ledger, prods_stat, low_stock, today_sales, today_purchases = await asyncio.gather(
        db.fetchrow("SELECT balance_after FROM cash_ledger ORDER BY id DESC LIMIT 1"),
        db.fetchrow("""
            SELECT COUNT(*) as total_prods, 
                   COALESCE(SUM(quantity), 0) as total_qty,
                   COALESCE(SUM(quantity * purchase_price), 0) as total_cost_val,
                   COALESCE(SUM(quantity * selling_price), 0) as total_sell_val
            FROM products
            WHERE is_active = 1 AND is_deleted = 0
        """),
        db.fetchval("""
            SELECT COUNT(*) FROM products 
            WHERE is_active = 1 AND is_deleted = 0 AND quantity <= min_stock
        """),
        db.fetchrow("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(profit), 0) as profit
            FROM transactions
            WHERE type = 'chiqim' AND created_at >= $1
        """, today_start),
        db.fetchrow("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total
            FROM transactions
            WHERE type = 'kirim' AND created_at >= $1
        """, today_start)
    )

    cash_balance = ledger["balance_after"] if ledger else 150000000
    total_prods = prods_stat["total_prods"] if prods_stat else 0
    total_qty = prods_stat["total_qty"] if prods_stat else 0
    low_stock = low_stock or 0

    s_cnt = today_sales["cnt"] if today_sales else 0
    s_tot = today_sales["total"] if today_sales else 0
    s_prf = today_sales["profit"] if today_sales else 0

    p_cnt = today_purchases["cnt"] if today_purchases else 0
    p_tot = today_purchases["total"] if today_purchases else 0

    text = (
        "📊 <b>AUTO SKLAD — TEZKOR HISOBOT</b>\n\n"
        f"💰 <b>Kassa balansi:</b> <code>{format_sum(cash_balance)}</code>\n\n"
        f"📦 <b>Ombor qoldiqlari:</b>\n"
        f"• Tovar turlari: <b>{total_prods} tur</b>\n"
        f"• Jami qoldiq: <b>{total_qty} dona</b>\n"
        f"• Kam qolganlar (ogohlantirish): <b>{low_stock} ta</b>\n\n"
        f"🛒 <b>Bugungi sotuvlar:</b>\n"
        f"• Miqdori: <b>{s_cnt} ta tranzaksiya</b>\n"
        f"• Tushum: <b>{format_sum(s_tot)}</b>\n"
        f"• Sof foyda: <b>+{format_sum(s_prf)}</b>\n\n"
        f"📥 <b>Bugungi xaridlar:</b>\n"
        f"• Partiyalar: <b>{p_cnt} ta</b>\n"
        f"• Sarflangan: <b>{format_sum(p_tot)}</b>\n\n"
        "Batafsil ko'rish uchun ERP ilovasini oching:"
    )

    is_head = is_head_admin(user_id)
    kb = webapp_head_admin_keyboard() if is_head else webapp_admin_keyboard()
    if edit:
        try:
            await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target.answer(text, reply_markup=kb, parse_mode="HTML")

@router.message(Command("admin"))
@router.message(Command("status"))
async def cmd_status(message: Message):
    await show_status(message, message.from_user.id, edit=False)

def sub_action_keyboard(refresh_cmd: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🔙 Bosh menyu", callback_data="cmd:status"),
            InlineKeyboardButton(text="🔄 Yangilash", callback_data=refresh_cmd)
        ]
    ])

async def show_stock(target: Message, user_id: int, edit: bool = False):
    """Kam qolgan yoki tugagan mahsulotlar ogohlantirishi."""
    if not await is_user_admin(user_id):
        await target.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    low_items = await db.fetch("""
        SELECT id, name, sku, car_model, quantity, min_stock, selling_price, shelf_location
        FROM products
        WHERE is_active = 1 AND is_deleted = 0 AND quantity <= min_stock
        ORDER BY quantity ASC
        LIMIT 15
    """)

    kb = sub_action_keyboard("cmd:stock")
    if not low_items:
        text = "✅ <b>Barcha mahsulotlar yetarli!</b>\n\nOmborda kam qolgan yoki tugagan tovarlar yo'q."
        if edit:
            try:
                await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
                return
            except Exception:
                pass
        await target.answer(text, reply_markup=kb, parse_mode="HTML")
        return

    text = f"⚠️ <b>KAM QOLGAN VA TUGAGAN TOVARLAR ({len(low_items)} ta ko'rsatilmoqda):</b>\n\n"
    for p in low_items:
        qty = p["quantity"]
        status_icon = "🔴" if qty == 0 else "🟡"
        loc = f" (Polka: {p['shelf_location']})" if p['shelf_location'] else ""
        text += (
            f"{status_icon} <b>{p['name']}</b> ({p['car_model']})\n"
            f"   Artikul: <code>{p['sku']}</code> | Qoldiq: <b>{qty} dona</b> (Min: {p['min_stock']}){loc}\n"
            f"   Narxi: {format_sum(p['selling_price'])}\n\n"
        )

    text += "<i>Yangi partiya kirim qilish uchun ilovadagi Kirim bo'limidan foydalaning.</i>"
    if edit:
        try:
            await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target.answer(text, reply_markup=kb, parse_mode="HTML")

@router.message(Command("stock"))
@router.message(Command("inventory"))
async def cmd_stock(message: Message):
    await show_stock(message, message.from_user.id, edit=False)

async def show_balance(target: Message, user_id: int, edit: bool = False):
    """Kassa balansi ma'lumotnomasi."""
    if not await is_user_admin(user_id):
        await target.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    ledger = await db.fetchrow("SELECT balance_after FROM cash_ledger ORDER BY id DESC LIMIT 1")
    cash_balance = ledger["balance_after"] if ledger else 150000000

    last_entry = await db.fetchrow("SELECT * FROM cash_ledger ORDER BY id DESC LIMIT 1")
    last_desc = last_entry["description"] if last_entry else "Boshlang'ich kassa kiritilgan"

    text = (
        "💰 <b>KASSA VA BYUDJET BALANSI</b>\n\n"
        f"💵 <b>Joriy kassa balansi:</b> <code>{format_sum(cash_balance)}</code>\n\n"
        f"📝 <b>Oxirgi kassa o'zgarishi:</b>\n"
        f"{last_desc}\n\n"
        "Shaffoflik: Kassa summasidagi har bir o'zgarish avtomatik tranzaksiya orqali asoslangan."
    )
    kb = sub_action_keyboard("cmd:balance")
    if edit:
        try:
            await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target.answer(text, reply_markup=kb, parse_mode="HTML")

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    await show_balance(message, message.from_user.id, edit=False)

async def show_sales(target: Message, user_id: int, edit: bool = False):
    """Bugungi sotuvlar hisoboti."""
    if not await is_user_admin(user_id):
        await target.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.strftime("%Y-%m-%d 00:00:00")

    today_sales, recent_sales = await asyncio.gather(
        db.fetchrow("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(profit), 0) as profit
            FROM transactions
            WHERE type = 'chiqim' AND created_at >= $1
        """, today_start),
        db.fetch("""
            SELECT t.id, t.quantity, t.total_amount, t.profit, t.created_at, p.name as product_name
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.type = 'chiqim'
            ORDER BY t.id DESC
            LIMIT 5
        """)
    )

    cnt = today_sales["cnt"] if today_sales else 0
    tot = today_sales["total"] if today_sales else 0
    prf = today_sales["profit"] if today_sales else 0

    text = (
        "🛒 <b>BUGUNGI SOTUVLAR HISOBOTI</b>\n\n"
        f"• Sotuvlar soni: <b>{cnt} ta</b>\n"
        f"• Jami tushum: <b>{format_sum(tot)}</b>\n"
        f"• Sof foyda: <b>+{format_sum(prf)}</b>\n\n"
        "<b>Oxirgi 5 ta sotuv:</b>\n"
    )

    if recent_sales:
        for s in recent_sales:
            text += f"• #{s['id']} {s['product_name'] or 'Tovar'}: {s['quantity']} dona = {format_sum(s['total_amount'])} (foyda: +{format_sum(s['profit'])})\n"
    else:
        text += "<i>Hozircha sotuvlar qayd etilmagan.</i>\n"

    kb = sub_action_keyboard("cmd:sales")
    if edit:
        try:
            await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target.answer(text, reply_markup=kb, parse_mode="HTML")

@router.message(Command("sales"))
async def cmd_sales(message: Message):
    await show_sales(message, message.from_user.id, edit=False)

async def show_purchases(target: Message, user_id: int, edit: bool = False):
    """Bugungi xaridlar (kirim) hisoboti — parallel tezkor so'rov."""
    if not await is_user_admin(user_id):
        await target.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.strftime("%Y-%m-%d 00:00:00")

    today_purchases, recent_purchases = await asyncio.gather(
        db.fetchrow("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total
            FROM transactions
            WHERE type = 'kirim' AND created_at >= $1
        """, today_start),
        db.fetch("""
            SELECT t.id, t.quantity, t.total_amount, t.created_at, p.name as product_name
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.type = 'kirim'
            ORDER BY t.id DESC
            LIMIT 5
        """)
    )

    cnt = today_purchases["cnt"] if today_purchases else 0
    tot = today_purchases["total"] if today_purchases else 0

    text = (
        "📥 <b>BUGUNGI XARIDLAR (KIRIM)</b>\n\n"
        f"• Partiyalar soni: <b>{cnt} ta</b>\n"
        f"• Sarflangan summa: <b>{format_sum(tot)}</b>\n\n"
        "<b>Oxirgi 5 ta kirim:</b>\n"
    )

    if recent_purchases:
        for p in recent_purchases:
            text += f"• #{p['id']} {p['product_name'] or 'Tovar'}: +{p['quantity']} dona = {format_sum(p['total_amount'])}\n"
    else:
        text += "<i>Hozircha xaridlar qayd etilmagan.</i>\n"

    kb = sub_action_keyboard("cmd:purchases")
    if edit:
        try:
            await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target.answer(text, reply_markup=kb, parse_mode="HTML")

@router.message(Command("purchases"))
async def cmd_purchases(message: Message):
    await show_purchases(message, message.from_user.id, edit=False)

@router.message(Command("transactions"))
async def cmd_transactions(message: Message):
    """Oxirgi 5 ta kassa tranzaksiyalari va formula."""
    if not await is_user_admin(message.from_user.id):
        await message.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    rows = await db.fetch("""
        SELECT t.id, t.type, t.quantity, t.total_amount, t.profit,
               t.prev_balance, t.new_balance, t.admin_name, t.created_at,
               p.name as product_name
        FROM transactions t
        LEFT JOIN products p ON t.product_id = p.id
        ORDER BY t.id DESC
        LIMIT 5
    """)

    if not rows:
        await message.answer("ℹ️ Hozircha tranzaksiyalar mavjud emas.")
        return

    text = "🧾 <b>OXIRGI 5 TA TRANZAKSIYA VA HISOB-KITOB:</b>\n\n"
    for r in rows:
        sign = "+" if r["type"] == "chiqim" else "-"
        type_str = "Sotuv (Kassa kirimi)" if r["type"] == "chiqim" else "Xarid (Kassa chiqimi)"
        text += (
            f"<b>#{r['id']} — {type_str}</b>\n"
            f"📦 {r['product_name'] or 'Mahsulot'} ({r['quantity']} dona)\n"
            f"💵 Summa: <b>{format_sum(r['total_amount'])}</b>\n"
            f"📐 <i>Formula:</i> {format_sum(r['prev_balance'])} {sign} {format_sum(r['total_amount'])} = <b>{format_sum(r['new_balance'])}</b>\n"
            f"👤 Mas'ul: {r['admin_name']}\n\n"
        )

    await message.answer(text)

@router.message(Command("products"))
async def cmd_products(message: Message):
    """Mahsulotlar katalogi va qoldiqlar (Adminlar uchun)."""
    if not await is_user_admin(message.from_user.id):
        await message.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    rows = await db.fetch("""
        SELECT name, sku, car_model, selling_price, quantity, min_stock
        FROM products
        WHERE is_active = 1 AND is_deleted = 0
        ORDER BY id DESC
        LIMIT 10
    """)

    if not rows:
        await message.answer("ℹ️ Mahsulotlar bazasi hozircha bo'sh.")
        return

    text = f"📦 <b>OMBOR MAHSULOTLARI (Oxirgi {len(rows)} ta):</b>\n\n"
    for p in rows:
        badge = "🟢" if p["quantity"] > p["min_stock"] else ("🟡" if p["quantity"] > 0 else "🔴")
        text += (
            f"{badge} <b>{p['name']}</b> ({p['car_model']})\n"
            f"   Artikul: <code>{p['sku']}</code> | Qoldiq: <b>{p['quantity']} dona</b>\n"
            f"   Sotish narxi: <b>{format_sum(p['selling_price'])}</b>\n\n"
        )

    is_head = is_head_admin(message.from_user.id)
    kb = webapp_head_admin_keyboard() if is_head else webapp_admin_keyboard()
    await message.answer(text, reply_markup=kb)

@router.message(Command("analytics"))
async def cmd_analytics(message: Message):
    """Kunlik va davriy real-vaqt tahlili (Adminlar uchun)."""
    if not await is_user_admin(message.from_user.id):
        await message.answer("❌ Ushbu buyruq faqat adminlar uchun.")
        return

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.strftime("%Y-%m-%d 00:00:00")

    sales_row, purchases_row = await asyncio.gather(
        db.fetchrow("""
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit,
                   COALESCE(SUM(quantity), 0) as units_sold
            FROM transactions
            WHERE type = 'chiqim' AND created_at >= $1
        """, today_start),
        db.fetchrow("""
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as spend,
                   COALESCE(SUM(quantity), 0) as units_bought
            FROM transactions
            WHERE type = 'kirim' AND created_at >= $1
        """, today_start)
    )

    rev = sales_row["revenue"] if sales_row else 0
    prf = sales_row["profit"] if sales_row else 0
    sold_units = sales_row["units_sold"] if sales_row else 0
    spend = purchases_row["spend"] if purchases_row else 0
    bought_units = purchases_row["units_bought"] if purchases_row else 0

    text = (
        "📈 <b>AUTO SKLAD — BUGUNGI TAHLIL</b>\n\n"
        f"💵 <b>Tushum (Revenue):</b> <code>{format_sum(rev)}</code>\n"
        f"💰 <b>Sof foyda (Profit):</b> <code>+{format_sum(prf)}</code>\n"
        f"📤 <b>Sotilgan tovarlar:</b> <b>{sold_units} dona</b>\n\n"
        f"📥 <b>Kirim / Xaridlar:</b> <code>{format_sum(spend)}</code>\n"
        f"📦 <b>Qabul qilingan tovarlar:</b> <b>{bought_units} dona</b>\n\n"
        "🔍 Kunlik, haftalik, oylik va yillik batafsil ma'lumotlar, tranzaksiya va mahsulotlar "
        "kesimidagi drill-down tahlilni ko'rish uchun ERP ilovasini oching:"
    )

    is_head = is_head_admin(message.from_user.id)
    kb = webapp_head_admin_keyboard() if is_head else webapp_admin_keyboard()
    await message.answer(text, reply_markup=kb)

@router.message(Command("search"))
async def cmd_search(message: Message, command: CommandObject):
    """Mahsulotlarni qidirish (Barcha foydalanuvchilar uchun)."""
    query = (command.args or "").strip()
    if not query:
        await message.answer(
            "🔍 <b>Mahsulot qidirish:</b>\n\n"
            "Foydalanish: <code>/search [nomi yoki avto modeli]</code>\n\n"
            "Masalan:\n"
            "• <code>/search Cobalt</code>\n"
            "• <code>/search bamper</code>\n"
            "• <code>/search moy</code>"
        )
        return

    pattern = f"%{query}%"
    rows = await db.fetch("""
        SELECT name, sku, car_model, selling_price, quantity
        FROM products
        WHERE is_active = 1 AND is_deleted = 0
          AND (name LIKE $1 OR car_model LIKE $1 OR sku LIKE $1)
        ORDER BY quantity DESC
        LIMIT 10
    """, pattern)

    if not rows:
        await message.answer(f"🔍 «<b>{query}</b>» bo'yicha hech qanday mahsulot topilmadi.")
        return

    text = f"🔍 <b>«{query}» bo'yicha topilgan mahsulotlar ({len(rows)} ta):</b>\n\n"
    for p in rows:
        status = f"✅ Mavjud ({p['quantity']} dona)" if p['quantity'] > 0 else "❌ Tugagan"
        text += (
            f"📦 <b>{p['name']}</b>\n"
            f"🚗 Avto: {p['car_model']} | Artikul: <code>{p['sku']}</code>\n"
            f"💰 Narxi: <b>{format_sum(p['selling_price'])}</b> | {status}\n\n"
        )

    text += "Barcha tovarlar va buyurtma uchun katalog ilovasini oching."
    await message.answer(text)

# Callback query shortcuts — always use query.from_user.id (the actual user who clicked)
@router.callback_query(F.data == "cmd:status")
async def cb_status(query: CallbackQuery):
    await query.answer()
    await show_status(query.message, query.from_user.id, edit=True)

@router.callback_query(F.data == "cmd:stock")
async def cb_stock(query: CallbackQuery):
    await query.answer()
    await show_stock(query.message, query.from_user.id, edit=True)

@router.callback_query(F.data == "cmd:balance")
async def cb_balance(query: CallbackQuery):
    await query.answer()
    await show_balance(query.message, query.from_user.id, edit=True)

@router.callback_query(F.data == "cmd:sales")
async def cb_sales(query: CallbackQuery):
    await query.answer()
    await show_sales(query.message, query.from_user.id, edit=True)

@router.callback_query(F.data == "cmd:purchases")
async def cb_purchases(query: CallbackQuery):
    await query.answer()
    await show_purchases(query.message, query.from_user.id, edit=True)

@router.callback_query(F.data == "cmd:search_hint")
async def cb_search_hint(query: CallbackQuery):
    await query.answer()
    await query.message.answer(
        "🔍 Mahsulot qidirish uchun buyruq yuboring:\n\n"
        "<code>/search Cobalt</code> yoki <code>/search bamper</code>"
    )

@router.message(Command("refresh"))
@router.callback_query(F.data == "cmd:refresh")
async def cb_refresh(event: Message | CallbackQuery):
    """Real-vaqt rejimida ma'lumotlarni yangilash."""
    if isinstance(event, CallbackQuery):
        await event.answer("🔄 Yangilandi!", show_alert=False)
        user_id = event.from_user.id
        target = event.message
    else:
        user_id = event.from_user.id
        target = event

    if await is_user_admin(user_id):
        await show_status(target, user_id)
    else:
        from app.bot.keyboards import webapp_customer_keyboard
        from app.config import SHOP_NAME
        text = (
            f"🚗 <b>{SHOP_NAME} — Yangilandi</b>\n\n"
            f"Ehtiyot qismlar katalogi ma'lumotlari real-vaqt rejimida yangilandi. "
            f"Katalog ilovasini ochish uchun pastdagi tugmani bosing:"
        )
        await target.answer(text, reply_markup=webapp_customer_keyboard())
