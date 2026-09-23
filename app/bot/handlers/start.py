"""
Avto Sklad — Telegram Bot /start, /help, /info, /profile, /contact handlers
Includes 15-minute single-use admin invitation deep linking (/start admin_invite_<token>).
"""

from datetime import datetime, timezone
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command, CommandObject

from app.config import (
    HEAD_ADMIN_ID,
    is_head_admin,
    is_admin,
    SHOP_NAME,
    SHOP_PHONE,
    SHOP_TELEGRAM,
    SHOP_ADDRESS,
    SHOP_WORK_HOURS
)
from app.database.db import db
from app.bot.keyboards import (
    webapp_head_admin_keyboard,
    webapp_admin_keyboard,
    webapp_customer_keyboard,
)
from app.services.notifications import notify_new_admin_joined

router = Router()

async def get_user_role(telegram_id: int) -> str:
    """Determine role: 'HEAD_ADMIN', 'ADMIN', or 'USER'."""
    if is_head_admin(telegram_id):
        return "HEAD_ADMIN"
    if is_admin(telegram_id):
        return "ADMIN"
    try:
        row = await db.fetchrow("SELECT role, status FROM admins WHERE telegram_id = $1", telegram_id)
        if row and row["status"] == "ACTIVE":
            return row["role"]
        u_row = await db.fetchrow("SELECT role FROM users WHERE telegram_id = $1", telegram_id)
        if u_row and u_row["role"] in ("HEAD_ADMIN", "SUPER_ADMIN", "ADMIN"):
            return "ADMIN"
    except Exception:
        pass
    return "USER"

@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(message: Message, command: CommandObject):
    """
    Taklif havolasi orqali /start kirish:
    /start admin_invite_<token>
    """
    user = message.from_user
    args = command.args or ""

    if not args.startswith("admin_invite_"):
        # Oddiy deep link yoki noma'lum parametr
        await cmd_start(message)
        return

    token = args.replace("admin_invite_", "").strip()
    current_role = await get_user_role(user.id)

    if current_role in ("HEAD_ADMIN", "ADMIN"):
        await message.answer(
            f"ℹ️ <b>Hurmatli {user.full_name}!</b>\n\n"
            f"Siz allaqachon tizimda <b>{'Bosh Admin' if current_role == 'HEAD_ADMIN' else 'Admin'}</b> maqomiga egasiz.\n"
            f"Ushbu taklif havolasini qayta ishlatishingiz shart emas.",
            reply_markup=webapp_head_admin_keyboard() if current_role == "HEAD_ADMIN" else webapp_admin_keyboard()
        )
        return

    # Taklif tokenini tekshirish
    invite = await db.fetchrow("SELECT * FROM admin_invitations WHERE token = $1", token)
    if not invite:
        await message.answer(
            "❌ <b>Xatolik:</b> Taklif havolasi topilmadi yoki noto'g'ri ko'rsatilgan.",
            reply_markup=webapp_customer_keyboard()
        )
        return

    # Holatini tekshirish
    if invite["status"] == "USED":
        await message.answer(
            "❌ <b>Kechirasiz:</b> Ushbu admin taklif havolasi allaqachon boshqa foydalanuvchi tomonidan ishlatilgan.",
            reply_markup=webapp_customer_keyboard()
        )
        return

    if invite["status"] == "REVOKED":
        await message.answer(
            "❌ <b>Bekor qilingan:</b> Ushbu taklif havolasi Bosh Admin tomonidan bekor qilingan.",
            reply_markup=webapp_customer_keyboard()
        )
        return

    # Muddati (15 daqiqa) tekshirish
    now_utc = datetime.now(timezone.utc)
    exp = invite["expires_at"]
    if isinstance(exp, str):
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except Exception:
            exp_dt = now_utc
    else:
        exp_dt = exp

    if exp_dt:
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if now_utc > exp_dt:
            # Token muddati o'tgan
            await db.execute("UPDATE admin_invitations SET status = 'EXPIRED' WHERE token = $1", token)
            await message.answer(
                "⏳ <b>Muddati tugagan:</b> Ushbu admin taklif havolasining amal qilish muddati (15 daqiqa) tugagan.\n\n"
                "Iltimos, Bosh Admindan yangi taklif havolasi so'rang.",
                reply_markup=webapp_customer_keyboard()
            )
            return

    # MUVAFFAQIYATLI QABUL QILISH:
    # 1. Admin sifatida saqlash
    existing_admin = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", user.id)
    if existing_admin:
        await db.execute("""
            UPDATE admins
            SET status = 'ACTIVE', role = 'ADMIN', revoked_at = NULL,
                first_name = $1, last_name = $2, username = $3
            WHERE telegram_id = $4
        """, user.first_name or "", user.last_name or "", user.username or "", user.id)
    else:
        await db.execute("""
            INSERT INTO admins (telegram_id, username, first_name, last_name, role, status, created_by)
            VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', $5)
        """, user.id, user.username or "", user.first_name or "", user.last_name or "", invite["created_by"])

    # 2. Tokenni USED qilish
    await db.execute("""
        UPDATE admin_invitations
        SET status = 'USED', used_at = $1, used_by = $2
        WHERE token = $3
    """, now_utc, user.id, token)

    # 3. Users jadvalini yangilash
    await db.execute("""
        INSERT INTO users (telegram_id, full_name, username, role, is_active, created_at, last_start_at)
        VALUES ($1, $2, $3, 'ADMIN', 1, $4, $4)
        ON CONFLICT(telegram_id) DO UPDATE SET
            role = 'ADMIN', full_name = EXCLUDED.full_name, username = EXCLUDED.username,
            last_start_at = EXCLUDED.last_start_at
    """, user.id, user.full_name or f"User {user.id}", user.username or "", now_utc)

    # 4. Audit jurnali (never write raw token to logs)
    masked_tok = f"{token[:6]}...{token[-4:]}" if len(token) > 10 else "***"
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, new_values)
        VALUES ($1, $2, 'ADMIN_INVITE_ACCEPTED', 'admin', $3, $4)
    """, user.id, user.full_name, str(user.id), f"Accepted invite token: {masked_tok}")

    # 5. Bosh Adminga xabarnoma
    await notify_new_admin_joined(user.full_name, user.id, user.username or "")

    # 6. Yangi adminga tabrik
    await message.answer(
        "🎉 <b>Tabriklaymiz! Siz Auto Sklad tizimiga Admin sifatida qabul qilindingiz.</b>\n\n"
        "Endi siz ehtiyot qismlar ombori, mahsulotlar qoldig'i, kirim/chiqim, sotuvlar va hisob-kitob bo'limlarini boshqarishingiz mumkin.\n\n"
        "Boshqaruv panelini ochish uchun pastdagi tugmani bosing:",
        reply_markup=webapp_admin_keyboard()
    )

@router.message(CommandStart())
@router.message(Command("start"))
@router.message(Command("menu"))
@router.message(F.text.in_({"Start", "start", "/start", "Menyu", "Bosh sahifa", "🏠 Bosh sahifa"}))
async def cmd_start(message: Message):
    """
    Oddiy /start buyrug'i:
    - Bosh Admin / Admin: Ombor & Buxgalteriya ERP boshqaruvi
    - Mijoz: Avtomobil ehtiyot qismlari katalogi
    """
    if not message.from_user:
        return
    user = message.from_user
    role = await get_user_role(user.id)

    # Sync to users table (saqlash va so'nggi faollik vaqtini qayd etish)
    now_utc = datetime.now(timezone.utc)
    try:
        await db.execute("""
            INSERT INTO users (telegram_id, full_name, username, role, is_active, created_at, last_start_at)
            VALUES ($1, $2, $3, $4, 1, $5, $5)
            ON CONFLICT(telegram_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                username = EXCLUDED.username,
                last_start_at = EXCLUDED.last_start_at,
                is_active = 1
        """, user.id, user.full_name, user.username or "", role, now_utc)
    except Exception:
        pass

    if role == "HEAD_ADMIN":
        welcome_text = (
            f"🚗 <b>{SHOP_NAME} — Boshqaruv Tizimi (ERP)</b>\n\n"
            f"Assalomu alaykum, <b>{user.full_name}</b>!\n"
            f"Sizning maqomingiz: 🔑 <b>Yagona Bosh Admin (Head Admin)</b>\n\n"
            f"• To'liq ombor, kassa, kirim-chiqim nazorati\n"
            f"• Adminlar boshqaruvi va 15 daqiqalik taklif havolalari\n"
            f"• Buxgalteriya, tahlil va audit jurnallari\n\n"
            f"Boshqaruv tizimini ochish uchun quyidagi tugmani bosing:"
        )
        kb = webapp_head_admin_keyboard()
    elif role == "ADMIN":
        welcome_text = (
            f"🚗 <b>{SHOP_NAME} — Ombor Boshqaruvi</b>\n\n"
            f"Assalomu alaykum, <b>{user.full_name}</b>!\n"
            f"Sizning maqomingiz: 👨‍💼 <b>Operatsion Admin</b>\n\n"
            f"• Mahsulotlar katalogi va narxlarni boshqarish\n"
            f"• Yangi tovarlar kirimi va sotuvlarni qayd etish\n"
            f"• Ombor qoldiqlari va hisobotlarni ko'rish\n\n"
            f"Mini App'ni ochish uchun pastdagi tugmani bosing:"
        )
        kb = webapp_admin_keyboard()
    else:
        welcome_text = (
            f"🚗 <b>{SHOP_NAME} — Avto Ehtiyot Qismlar Do'koni</b>\n\n"
            f"Assalomu alaykum, <b>{user.full_name}</b>!\n\n"
            f"Do'konimizda barcha ommabop avtomobillar uchun yuqori sifatli ehtiyot qismlar, "
            f"shinalar, kuzov detallari, oynalar va moylar mavjud:\n\n"
            f"✅ 100% Sifat kafolati\n"
            f"🚀 Tezkor yetkazib berish xizmati\n"
            f"💳 Hamyonbop va shaffof narxlar\n\n"
            f"Katalogimizni ko'rish va tanlash uchun pastdagi tugmani bosing:"
        )
        kb = webapp_customer_keyboard()

    try:
        await message.answer(welcome_text, reply_markup=kb)
    except Exception as send_err:
        print(f"[BOT SEND ERROR] {send_err}")
        await message.answer(welcome_text)

@router.message(Command("help"))
@router.message(Command("yordam"))
@router.message(F.text.in_({"Yordam", "yordam", "Help", "/help", "ℹ️ Yordam"}))
async def cmd_help(message: Message):
    """Rolga mos yordam ma'lumotnomasi."""
    if not message.from_user:
        return
    role = await get_user_role(message.from_user.id)
    
    text = "📋 <b>AUTO SKLAD — BOT BUYRUQLARI</b>\n\n"
    text += "<b>Barcha foydalanuvchilar uchun:</b>\n"
    text += "/start — Botni ishga tushirish / Mini App ochish\n"
    text += "/app — Ehtiyot qismlar katalogini ochish\n"
    text += "/info — Do'kon manzili, telefon va ish vaqti\n"
    text += "/contact — Sotuvchi bilan bog'lanish\n"
    text += "/profile — Profil va foydalanuvchi ma'lumotlari\n"
    text += "/search &lt;nomi&gt; — Mahsulotlarni tezkor qidirish\n"

    if role in ("ADMIN", "HEAD_ADMIN"):
        text += "\n<b>👨‍💼 Admin buyruqlari:</b>\n"
        text += "/status — Ombor va kassa holati qisqacha hisoboti\n"
        text += "/stock — Kam qolgan va tugagan tovarlar ro'yxati\n"
        text += "/balance — Kassa balansi va joriy byudjet\n"
        text += "/sales — Bugungi sotuvlar umumiy summasi\n"
        text += "/purchases — Bugungi xaridlar/kirimlar summasi\n"
        text += "/transactions — Oxirgi kassa tranzaksiyalari\n"

    if role == "HEAD_ADMIN":
        text += "\n<b>🔑 Bosh Admin (Head Admin) buyruqlari:</b>\n"
        text += "/admins — Barcha adminlar ro'yxatini ko'rish\n"
        text += "/invite — Yangi admin uchun 15 daqiqalik bir martalik havola yaratish\n"
        text += "/invites — Faol taklif havolalarini ko'rish\n"
        text += "/addadmin &lt;telegram_id&gt; — ID orqali to'g'ridan-to'g'ri admin qo'shish\n"
        text += "/removeadmin &lt;telegram_id&gt; — Adminlik huquqini bekor qilish\n"
        text += "/broadcast &lt;xabar&gt; — Barcha mijozlarga e'lon yuborish\n"

    await message.answer(text)

@router.message(Command("info"))
@router.message(Command("manzil"))
@router.message(F.text.in_({"Manzil", "manzil", "Info", "/info", "📍 Manzil & Ish vaqti"}))
async def cmd_info(message: Message):
    """Do'kon haqida to'liq ma'lumot."""
    if not message.from_user:
        return
    text = (
        f"ℹ️ <b>{SHOP_NAME} HAQIDA MA'LUMOT</b>\n\n"
        f"📍 <b>Manzil:</b> {SHOP_ADDRESS}\n"
        f"📞 <b>Telefon:</b> {SHOP_PHONE}\n"
        f"⏰ <b>Ish vaqti:</b> {SHOP_WORK_HOURS}\n"
        f"✈️ <b>Telegram aloqa:</b> {SHOP_TELEGRAM}\n\n"
        f"🚚 <b>Yetkazib berish:</b> Toshkent bo'ylab 2 soat ichida, viloyatlarga BTS/Pochta orqali yetkaziladi.\n"
        f"💳 <b>To'lov turi:</b> Naqd pul, Payme, Click, Uzum Bank."
    )
    await message.answer(text)

@router.message(Command("contact"))
@router.message(Command("aloqa"))
@router.message(F.text.in_({"Aloqa", "aloqa", "Contact", "/contact", "📞 Sotuvchi bilan bog'lanish"}))
async def cmd_contact(message: Message):
    """Sotuvchi bilan bog'lanish."""
    if not message.from_user:
        return
    text = (
        f"📞 <b>SOTUVCHI BILAN BOG'LANISH</b>\n\n"
        f"Savollaringiz yoki buyurtmalar bo'lsa, quyidagi raqam yoki Telegram orqali murojaat qilishingiz mumkin:\n\n"
        f"📱 Telefon: <b>{SHOP_PHONE}</b>\n"
        f"💬 Telegram: <b>{SHOP_TELEGRAM}</b>\n\n"
        f"Mutaxassislarimiz kerakli detalni tanlashda mamnuniyat bilan yordam berishadi!"
    )
    await message.answer(text)

from app.config import mask_phone_number
from app.bot.keyboards import contact_request_keyboard
from aiogram.types import ReplyKeyboardRemove

@router.message(Command("profile"))
@router.message(Command("profil"))
@router.message(F.text.in_({"Profil", "profil", "Profile", "/profile", "👤 Profilim"}))
async def cmd_profile(message: Message):
    """Foydalanuvchi profili va telefon raqami holati."""
    if not message.from_user:
        return
    user = message.from_user
    role = await get_user_role(user.id)
    
    role_labels = {
        "HEAD_ADMIN": "🔑 Yagona Bosh Admin (Head Admin)",
        "ADMIN": "👨‍💼 Operatsion Admin",
        "USER": "🚗 Xaridor / Mijoz"
    }

    # Fetch phone number if exists
    db_user = await db.fetchrow("SELECT phone_number FROM users WHERE telegram_id = $1", user.id)
    phone_raw = db_user.get("phone_number") if db_user else ""
    if phone_raw:
        phone_display = mask_phone_number(phone_raw)
    else:
        phone_display = "⚠️ Tasdiqlanmagan (/verify_phone orqali tasdiqlang)"

    text = (
        f"👤 <b>FOYDALANUVCHI PROFILI</b>\n\n"
        f"🆔 <b>Telegram ID:</b> <code>{user.id}</code>\n"
        f"👤 <b>Ism:</b> {user.full_name}\n"
        f"📱 <b>Username:</b> @{user.username or 'mavjud emas'}\n"
        f"📞 <b>Telefon:</b> {phone_display}\n"
        f"🏷 <b>Maqom:</b> {role_labels.get(role, role)}\n"
        f"🟢 <b>Status:</b> Faol"
    )
    await message.answer(text)

@router.message(Command("verify_phone"))
async def cmd_verify_phone(message: Message):
    """Foydalanuvchiga telefon raqamini tasdiqlash uchun tugma yuborish."""
    await message.answer(
        "📱 <b>Telefon raqamni tasdiqlash:</b>\n\n"
        "Quyidagi tugmani bosib, rasmiy Telegram raqamingizni tasdiqlashingiz mumkin:",
        reply_markup=contact_request_keyboard()
    )

@router.message(F.contact)
async def handle_contact_verification(message: Message):
    """Rasmiy Telegram kontaktini qabul qilish va xavfsiz tasdiqlash."""
    contact = message.contact
    if not contact:
        return

    # Security check: Ensure shared contact actually belongs to this sender
    if contact.user_id != message.from_user.id:
        await message.answer(
            "❌ <b>Xavfsizlik ogohlantirishi:</b> Begona shaxsning kontaktini tasdiqlash taqiqlanadi.\n"
            "Faqat o‘zingizning Telegram hisobingizga tegishli raqamni yuboring."
        )
        return

    phone = contact.phone_number.strip()
    if not phone.startswith("+"):
        phone = f"+{phone}"

    # Save phone to database
    await db.execute(
        "UPDATE users SET phone_number = $1 WHERE telegram_id = $2",
        phone, message.from_user.id
    )
    await db.execute(
        "UPDATE admins SET phone_number = $1 WHERE telegram_id = $2",
        phone, message.from_user.id
    )

    masked = mask_phone_number(phone)

    # Audit log (never log full phone number)
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, target_entity, target_id, new_values)
        VALUES ($1, $2, 'PHONE_VERIFIED', 'user', $3, $4)
    """, message.from_user.id, message.from_user.full_name, str(message.from_user.id), f"Telefon tasdiqlandi: {masked}")

    await message.answer(
        f"✅ <b>Telefon raqamingiz muvaffaqiyatli tasdiqlandi:</b> <code>{masked}</code>\n\n"
        "Hisobingiz muvaffaqiyatli himoyalandi.",
        reply_markup=ReplyKeyboardRemove()
    )

@router.message(Command("app"))
@router.message(Command("webapp"))
async def cmd_app(message: Message):
    """Mini App'ni ochish."""
    role = await get_user_role(message.from_user.id)
    if role in ("HEAD_ADMIN", "ADMIN"):
        kb = webapp_head_admin_keyboard() if role == "HEAD_ADMIN" else webapp_admin_keyboard()
        await message.answer("📦 Ombor va buxgalteriya tizimini ochish uchun bosing:", reply_markup=kb)
    else:
        await message.answer("🚗 Ehtiyot qismlar katalogini ochish uchun bosing:", reply_markup=webapp_customer_keyboard())

# Callback queries from user main menu
@router.callback_query(F.data == "cmd:info")
async def cb_info(query: CallbackQuery):
    await query.answer()
    await cmd_info(query.message)

@router.callback_query(F.data == "cmd:profile")
async def cb_profile(query: CallbackQuery):
    await query.answer()
    await cmd_profile(query.message)

@router.callback_query(F.data == "cmd:scanner")
async def cb_scanner(query: CallbackQuery):
    await query.answer()
    await cmd_scanner(query.message)

@router.callback_query(F.data == "cmd:ai_hint")
async def cb_ai_hint(query: CallbackQuery):
    await query.answer()
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    from app.config import WEBAPP_URL
    role = await get_user_role(query.from_user.id)
    url = f"{WEBAPP_URL}/?role={role.lower()}" if WEBAPP_URL else "http://localhost:8000"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎙️ AI Ovozli Yordamchini ochish", web_app=WebAppInfo(url=url))]
    ])
    await query.message.answer(
        "🤖 <b>Avto Sklad AI Ovozli Yordamchi</b>\n\n"
        "• <b>Ovoz orqali tovar qo'shish:</b> Mini App ichidagi 🎙️ Ovozli tugmasini bosing yoki ovozli xabar yuboring.\n"
        "• <b>Savollar berish:</b> Botda <code>/ai &lt;savolingiz&gt;</code> deb yozing.\n"
        "<i>Masalan: /ai BMW bamperdan nechta qoldi?</i>\n\n"
        "To'liq interaktiv ovozli suhbat uchun quyidagi tugmani bosing:",
        reply_markup=kb
    )

# ==============================================================================
# AI VOICE & SCANNER BOT EXTENSIONS
# ==============================================================================

@router.message(Command("scan"))
@router.message(Command("scanner"))
async def cmd_scanner(message: Message):
    """Skaner yo'riqnomasi va WebApp orqali kamerani ochish."""
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    from app.config import WEBAPP_URL
    role = await get_user_role(message.from_user.id)
    url = f"{WEBAPP_URL}/?role={role.lower()}" if WEBAPP_URL else "http://localhost:8000"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📷 Skanerni ochish (Kamera)", web_app=WebAppInfo(url=url))]
    ])
    await message.answer(
        "📷 <b>QR va Shtrix-kod Skaneri</b>\n\n"
        "Mahsulot shtrix-kodini yoki QR kodini tezkor skanerlash orqali uning qoldig'i, "
        "narxi va ombordagi joylashuvini aniqlashingiz mumkin.\n\n"
        "Skanerni ochish uchun quyidagi tugmani bosing:",
        reply_markup=kb
    )

@router.message(Command("ai"))
async def cmd_ai_assistant(message: Message, command: CommandObject):
    """Telegram bot orqali AI Yordamchiga savol berish."""
    query = command.args or ""
    if not query.strip():
        await message.answer(
            "🤖 <b>Avto Sklad AI Ovozli Yordamchi</b>\n\n"
            "Savolingizni /ai buyrug'idan so'ng yozing yoki to'g'ridan-to'g'ri ovozli xabar (Voice) yuboring.\n\n"
            "Masalan:\n"
            "• <code>/ai BMW bamperdan nechta qoldi?</code>\n"
            "• <code>/ai Bugun nechta mahsulot sotildi?</code>\n"
            "• <code>/ai Kam qolgan tovarlarni ko'rsat</code>"
        )
        return

    from app.services.ai_service import process_assistant_query
    from app.api.auth import CurrentUser

    role = await get_user_role(message.from_user.id)
    current_user = CurrentUser(
        id=message.from_user.id,
        telegram_id=message.from_user.id,
        full_name=message.from_user.full_name,
        username=message.from_user.username or "",
        role=role,
        is_admin=role in ("HEAD_ADMIN", "ADMIN"),
        is_super_admin=role == "HEAD_ADMIN"
    )

    res = await process_assistant_query(query, current_user)
    await message.answer(res["answer"])

@router.message(F.voice)
async def handle_bot_voice_message(message: Message):
    """Ovozli xabarlar uchun yo'riqnoma va WebApp AI yordamchisiga yo'naltirish."""
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    from app.config import WEBAPP_URL
    role = await get_user_role(message.from_user.id)
    url = f"{WEBAPP_URL}/?role={role.lower()}" if WEBAPP_URL else "http://localhost:8000"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎙️ AI Ovozli Yordamchini ochish", web_app=WebAppInfo(url=url))]
    ])
    await message.answer(
        "🎙️ <b>Ovozli xabar qabul qilindi!</b>\n\n"
        "Ovoz orqali mahsulot qo'shish va AI ovozli suhbatidan to'liq foydalanish uchun "
        "Avto Sklad Mini App'dagi ovozli yordamchini oching:",
        reply_markup=kb
    )

@router.message(F.text)
async def handle_user_quick_answer_text(message: Message):
    """
    Foydalanuvchi bot chatiga to'g'ridan-to'g'ri yozgan har qanday
    mahsulot savoli uchun avtomatik AI Quick Answer.
    Masalan: 'Spark oldi bamperi qancha?', 'Cobalt fara bormi?', 'BMW X5 bamperi bormi?'
    """
    text = (message.text or "").strip()
    if not text or text.startswith("/"):
        return

    from app.services.ai_service import process_assistant_query
    from app.api.auth import CurrentUser

    role = await get_user_role(message.from_user.id)
    current_user = CurrentUser(
        id=message.from_user.id,
        telegram_id=message.from_user.id,
        full_name=message.from_user.full_name,
        username=message.from_user.username or "",
        role=role,
        is_admin=role in ("HEAD_ADMIN", "ADMIN"),
        is_super_admin=role == "HEAD_ADMIN"
    )

    res = await process_assistant_query(text, current_user)
    await message.answer(res["answer"])

