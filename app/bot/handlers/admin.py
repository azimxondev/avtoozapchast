"""Bot admin command handlers (/broadcast, etc.)."""

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

from app.config import is_head_admin
from app.database import queries

router = Router()


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
