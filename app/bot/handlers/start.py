"""Bot /start and /help handlers matching Screenshot 2 design."""

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import CommandStart, Command

from app.config import is_admin, is_head_admin
from app.bot.keyboards.main import webapp_keyboard
from app.database import queries

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    """
    /start handler.
    """
    user = message.from_user
    user_is_admin = is_admin(user.id)

    # Foydalanuvchini bazaga yozish
    try:
        await queries.upsert_bot_user(
            telegram_id=user.id,
            full_name=user.full_name or "",
            username=user.username or "",
            is_admin=user_is_admin,
        )
    except Exception as e:
        print(f"⚠️ User upsert error: {e}")

    text = (
        "• Elektron buklanadigan qizdirgichli bakavoy oynalar\n"
        "• Michelin va yetakchi brendlarning sifatli shinalari\n"
        "• Kuzov detallari, radiator panjaralari va sport optika\n\n"
        "⚡ <b>Nima uchun aynan kuzavnoy.uzz?</b>\n"
        "✅ 100% Zavodskoy sifat va rasmiy servis kafolati\n"
        "🚀 Toshkent shahri bo'ylab 2 soatda tezkor kuryerlik yetkazishi\n"
        "📦 O'zbekistonning barcha viloyatlariga ishonchli jo'natish\n"
        "💳 Qulay to'lov: Uzcard, Humo, Visa yoki qabul qilinganda naqd\n\n"
    )

    if user_is_admin:
        role_title = "Bosh Admin" if is_head_admin(user.id) else "Admin"
        text += (
            f"⭐ <b>Hurmatli {role_title}</b>, siz tizimda do'kon boshqaruvchisi sifatida aniqlandingiz.\n\n"
            f"Pastdagi «🛒 Katalog & Xarid qilish» tugmasini bosing va ilovamizdan kerakli detalni qulay tanlang! 👇"
        )
        await message.answer(text, reply_markup=webapp_keyboard(is_admin=True))
    else:
        text += (
            "Pastdagi «🛒 Katalog & Xarid qilish» tugmasini bosing va kerakli detalni qulay tanlang! 👇"
        )
        await message.answer(text, reply_markup=webapp_keyboard(is_admin=False))


@router.message(Command("help"))
async def cmd_help(message: Message):
    """Yordam buyrug'i."""
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
