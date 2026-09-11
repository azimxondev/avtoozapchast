"""Telegram bot handlers — /start, /broadcast, /help."""

from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import CommandStart, Command

from app.config import is_admin, is_head_admin, ADMIN_IDS
from app.bot.keyboards import webapp_keyboard, no_access_keyboard
from app.database import queries

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    """
    /start handler.
    Admin → WebApp tugmasi.
    Oddiy user → ruxsat yo'q xabari.
    Barcha userlar bot_users ga yoziladi.
    """
    user = message.from_user
    user_is_admin = is_admin(user.id)

    # Foydalanuvchini bazaga yozish
    await queries.upsert_bot_user(
        telegram_id=user.id,
        full_name=user.full_name or "",
        username=user.username or "",
        is_admin=user_is_admin,
    )

    if user_is_admin:
        role = "🔑 Bosh Admin" if is_head_admin(user.id) else "👨‍💼 Admin"
        await message.answer(
            f"🚗 <b>Avto Sklad — Boshqaruv Tizimi</b>\n\n"
            f"Salom, {user.full_name}!\n"
            f"Sizning rolingiz: {role}\n\n"
            f"Skladni boshqarish uchun quyidagi tugmani bosing.",
            reply_markup=webapp_keyboard(),
        )
    else:
        await message.answer(
            "❌ <b>Sizda ushbu tizimdan foydalanish uchun ruxsat yo'q.</b>\n\n"
            "Agar savol bo'lsa, admin bilan bog'laning.",
            reply_markup=no_access_keyboard(),
        )


@router.message(Command("help"))
async def cmd_help(message: Message):
    """Yordam buyrug'i."""
    if not is_admin(message.from_user.id):
        return

    text = (
        "📋 <b>Buyruqlar:</b>\n\n"
        "/start — Skladni ochish\n"
        "/help — Yordam\n"
    )
    if is_head_admin(message.from_user.id):
        text += (
            "\n🔑 <b>Bosh Admin buyruqlari:</b>\n"
            "/broadcast <i>xabar</i> — Barcha foydalanuvchilarga xabar yuborish\n"
        )
    await message.answer(text)


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message):
    """
    /broadcast — Bosh Admin barcha foydalanuvchilarga xabar yuboradi.
    Faqat HEAD_ADMIN uchun ishlaydi.
    """
    if not is_head_admin(message.from_user.id):
        await message.answer("❌ Bu buyruq faqat Bosh Admin uchun.")
        return

    # /broadcast dan keyingi matnni olish
    text = message.text
    if text:
        text = text.replace("/broadcast", "", 1).strip()

    if not text:
        await message.answer(
            "📢 <b>Xabar yuborish:</b>\n\n"
            "Foydalanish: <code>/broadcast Sizning xabaringiz</code>\n\n"
            "Misol:\n"
            "<code>/broadcast 🚗 Bot yangilandi! Yangi imkoniyatlar qo'shildi.</code>"
        )
        return

    # Barcha foydalanuvchilarni olish
    users = await queries.get_all_bot_users()
    sent = 0
    failed = 0

    broadcast_text = f"📢 <b>Xabar:</b>\n\n{text}"

    for user in users:
        try:
            await message.bot.send_message(
                chat_id=user["telegram_id"],
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
