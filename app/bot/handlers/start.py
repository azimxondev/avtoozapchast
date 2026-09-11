"""Bot /start and /help handlers."""

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import CommandStart, Command

from app.config import is_admin, is_head_admin
from app.bot.keyboards.main import webapp_keyboard, no_access_keyboard
from app.database import queries

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    """
    /start handler.
    Admin → Sklad WebApp tugmasi.
    User → User ma'lumoti.
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
            f"Sizning rolingiz: <b>{role}</b>\n\n"
            f"Skladni boshqarish va hisob-kitoblarni ko'rish uchun quyidagi tugmani bosing.",
            reply_markup=webapp_keyboard(),
        )
    else:
        await message.answer(
            "❌ <b>Sizda ushbu sklad tizimidan foydalanish uchun ruxsat yo'q.</b>\n\n"
            "Agar savollaringiz bo'lsa, admin bilan bog'laning.",
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
            "/broadcast <i>xabar</i> — Barcha foydalanuvchilarga e'lon yuborish\n"
        )
    await message.answer(text)
