"""
Avto Sklad — Telegram Bot Real-time Notification Service
Sends instant alerts to Head Admin and Admins for:
- Low stock items
- New admin joined via invitation link
- Large sales/purchases
- System budget changes
"""

from typing import Optional
from app.config import HEAD_ADMIN_ID
from app.database.db import db

async def _get_active_admin_ids() -> list[int]:
    """Get all active admin telegram IDs including Head Admin."""
    admin_ids = set()
    if HEAD_ADMIN_ID:
        admin_ids.add(int(HEAD_ADMIN_ID))
    
    rows = await db.fetch("SELECT telegram_id FROM admins WHERE status = 'ACTIVE'")
    for r in rows:
        if r.get("telegram_id"):
            admin_ids.add(int(r["telegram_id"]))
    return list(admin_ids)

async def send_telegram_message(chat_id: int, text: str, reply_markup=None) -> bool:
    """Send message via bot if bot is configured."""
    try:
        from app.bot.bot import get_bot
        bot = get_bot()
        if not bot:
            return False
        await bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_markup, parse_mode="HTML")
        return True
    except Exception as e:
        print(f"[Telegram Notify Error] chat_id={chat_id}: {e}")
        return False

async def notify_head_admin(text: str, reply_markup=None) -> bool:
    """Send direct notification to Head Admin."""
    if not HEAD_ADMIN_ID:
        return False
    return await send_telegram_message(HEAD_ADMIN_ID, text, reply_markup)

async def notify_all_admins(text: str, reply_markup=None) -> int:
    """Broadcast notification to all active admins."""
    admin_ids = await _get_active_admin_ids()
    count = 0
    for tid in admin_ids:
        if await send_telegram_message(tid, text, reply_markup):
            count += 1
    return count

async def notify_new_admin_joined(admin_name: str, admin_id: int, username: str = ""):
    """Notify Head Admin that an invited user accepted admin invitation."""
    u_str = f"@{username}" if username else "mavjud emas"
    msg = (
        "🎉 <b>Yangi Admin Qabul Qilindi!</b>\n\n"
        f"👤 <b>Ism:</b> {admin_name}\n"
        f"🆔 <b>Telegram ID:</b> <code>{admin_id}</code>\n"
        f"📱 <b>Username:</b> {u_str}\n"
        f"🔑 <b>Rol:</b> Operatsion Admin\n\n"
        "Foydalanuvchi taklif havolasi orqali tizimga muvaffaqiyatli ulandi."
    )
    await notify_head_admin(msg)

async def notify_low_stock(product_name: str, sku: str, car_model: str, current_qty: int, min_qty: int):
    """Alert all admins when an item drops below safety stock."""
    msg = (
        "⚠️ <b>DIQQAT: Mahsulot Qoldig'i Kamaydi!</b>\n\n"
        f"📦 <b>Mahsulot:</b> {product_name}\n"
        f"🏷 <b>Artikul:</b> <code>{sku}</code>\n"
        f"🚗 <b>Mos avto:</b> {car_model}\n"
        f"📉 <b>Joriy qoldiq:</b> <b>{current_qty} dona</b> (Minimal chegara: {min_qty})\n\n"
        "Zudlik bilan yangi partiya kirim qilish tavsiya etiladi."
    )
    await notify_all_admins(msg)
