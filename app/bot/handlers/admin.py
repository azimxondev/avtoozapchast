"""Bot admin command handlers (/admin, /broadcast, etc.)."""

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

from app.config import is_admin, is_head_admin
from app.bot.keyboards.main import webapp_keyboard
from app.database import queries

router = Router()


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """
    /admin — Admin panel va statistikani Telegram xabarida ko'rish.
    """
    user_id = message.from_user.id
    if not is_admin(user_id):
        await message.answer("❌ <b>Sizda admin ruxsati yo'q.</b>")
        return

    role_title = "🔑 Bosh Admin" if is_head_admin(user_id) else "👨‍💼 Co-Admin"

    try:
        overview = await queries.get_overview_stats()
        total_prods = overview.get("total_products", 0)
        total_qty = overview.get("total_quantity", 0)
        stock_val = overview.get("stock_value", 0)
        val_str = f"{int(stock_val):,} so'm".replace(",", " ")
    except Exception:
        total_prods = 0
        total_qty = 0
        val_str = "0 so'm"

    text = (
        f"⚙️ <b>ADMIN PANEL — SKLAD BOSH QARUVI</b>\n\n"
        f"👤 <b>Foydalanuvchi:</b> {message.from_user.full_name}\n"
        f"🔑 <b>Rol:</b> {role_title}\n"
        f"🆔 <b>Telegram ID:</b> <code>{user_id}</code>\n\n"
        f"📊 <b>Sklad Qisqa Statistikasi:</b>\n"
        f"• Mahsulot turlari: <b>{total_prods} tur</b>\n"
        f"• Jami ombor qoldig'i: <b>{total_qty} dona</b>\n"
        f"• Sklad umumi qiymati: <b>{val_str}</b>\n\n"
        f"Boshqarish va hisobotlar uchun pastdagi tugmani bosing: 👇"
    )

    await message.answer(text, reply_markup=webapp_keyboard(is_admin=True))


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message):
    """
    /broadcast — Bosh Admin barcha foydalanuvchilarga xabar yuboradi.
    Faqat HEAD_ADMIN uchun ishlaydi.
    """
    if not is_head_admin(message.from_user.id):
        await message.answer("❌ Bu buyruq faqat Bosh Admin uchun.")
        return

    text = message.text
    if text:
        text = text.replace("/broadcast", "", 1).strip()

    if not text:
        await message.answer(
            "📢 <b>Xabar yuborish:</b>\n\n"
            "Foydalanish: <code>/broadcast Sizning xabaringiz</code>\n\n"
            "Misol:\n"
            "<code>/broadcast 🚗 Sklad yangilandi! Yangi mahsulotlar keldi.</code>"
        )
        return

    users = await queries.get_all_bot_users()
    sent = 0
    failed = 0

    broadcast_text = f"📢 <b>Xabar:</b>\n\n{text}"

    for u in users:
        try:
            await message.bot.send_message(
                chat_id=u["telegram_id"],
                text=broadcast_text,
            )
            sent += 1
        except Exception:
            failed += 1

    await message.answer(
        f"✅ <b>Xabar yuborildi!</b>\n\n"
        f"📨 Yuborildi: {sent} ta\n"
        f"❌ Xatolik: {failed} ta\n"
        f"👥 Jami: {len(users)} ta foydalanuvchi"
    )
