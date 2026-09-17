"""
Avto Sklad — Head Admin Telegram Bot Handlers
Only HEAD_ADMIN can execute these commands:
/admins, /invite, /invites, /addadmin, /removeadmin, /broadcast
"""

import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command, CommandObject

from app.config import HEAD_ADMIN_ID, is_head_admin
from app.database.db import db
import hashlib
from app.bot.keyboards import (
    invite_created_keyboard,
    admin_action_keyboard,
    webapp_head_admin_keyboard,
    invite_admin_options_keyboard,
    users_pagination_keyboard,
)

router = Router()

async def check_head_admin(user_id: int | str | None) -> bool:
    if is_head_admin(user_id):
        return True
    try:
        uid = int(user_id) if user_id else 0
        row = await db.fetchrow("SELECT role, status FROM admins WHERE telegram_id = $1", uid)
        return bool(row and row["role"] == "HEAD_ADMIN" and row["status"] == "ACTIVE")
    except Exception:
        return False

async def show_admins_list(target_message: Message, user_id: int):
    """Barcha adminlar ro'yxatini chiqarish."""
    if not await check_head_admin(user_id):
        await target_message.answer("❌ Bu buyruq faqat Bosh Admin (Head Admin) uchun ruxsat etilgan.")
        return

    admins = await db.fetch("""
        SELECT telegram_id, username, first_name, last_name, role, status, created_at, last_login
        FROM admins
        WHERE status = 'ACTIVE'
        ORDER BY id ASC
    """)

    text = "👥 <b>TIZIM ADMINLARI RO'YXATI:</b>\n\n"
    text += f"🔑 <b>Bosh Admin (Head Admin):</b>\n• ID: <code>{HEAD_ADMIN_ID}</code> (Yagona egasi)\n\n"

    co_admins = [a for a in admins if a["telegram_id"] != HEAD_ADMIN_ID]

    if not co_admins:
        text += "<i>Hozircha qo'shimcha operatsion adminlar mavjud emas.</i>\n\n"
        text += "Yangi admin qo'shish uchun: <code>/invite_admin</code> yoki <code>/addadmin &lt;id&gt;</code>"
        await target_message.answer(text, reply_markup=webapp_head_admin_keyboard())
        return

    text += f"👨‍💼 <b>Operatsion Adminlar ({len(co_admins)} ta):</b>\n\n"
    await target_message.answer(text)

    for a in co_admins:
        name = f"{a['first_name']} {a['last_name']}".strip() or "Noma'lum"
        uname = f"@{a['username']}" if a['username'] else "username yo'q"
        card_text = (
            f"👤 <b>{name}</b> ({uname})\n"
            f"🆔 Telegram ID: <code>{a['telegram_id']}</code>\n"
            f"🟢 Status: Faol Admin"
        )
        await target_message.answer(card_text, reply_markup=admin_action_keyboard(a["telegram_id"]))

@router.message(Command("admins"))
async def cmd_admins(message: Message):
    """Barcha adminlar ro'yxati (Faqat Bosh Admin uchun)."""
    await show_admins_list(message, message.from_user.id)

async def show_invite_options(target_message: Message, user_id: int):
    """Admin qo'shish variantlarini ko'rsatish."""
    if not await check_head_admin(user_id):
        await target_message.answer("❌ Bu buyruq faqat Bosh Admin (Head Admin) uchun ruxsat etilgan.")
        return

    text = (
        "👑 <b>Admin qo‘shish</b>\n\n"
        "Qanday usulda yangi admin tayinlamoqchisiz?\n"
        "Quyidagi variantlardan birini tanlang:"
    )
    await target_message.answer(text, reply_markup=invite_admin_options_keyboard())

@router.message(Command("invite_admin"))
@router.message(Command("invite"))
@router.message(F.text.in_({"Admin qo‘shish", "Admin qo'shish", "/invite_admin", "/invite"}))
async def cmd_invite_admin(message: Message):
    """Admin qo'shish usullarini tanlash (Faqat Bosh Admin)."""
    await show_invite_options(message, message.from_user.id)

@router.callback_query(F.data == "invite_opt:by_id")
async def cb_invite_by_id(query: CallbackQuery):
    """Telegram ID orqali admin qo'shish yo'riqnomasi."""
    if not await check_head_admin(query.from_user.id):
        await query.answer("❌ Ruxsat berilmagan.", show_alert=True)
        return

    await query.answer()
    text = (
        "🆔 <b>Telegram ID orqali admin qo‘shish:</b>\n\n"
        "Quyidagi formatda buyruq yuboring:\n"
        "<code>/addadmin &lt;Telegram_ID&gt; &lt;Ism&gt; [Familiya]</code>\n\n"
        "Masalan:\n"
        "<code>/addadmin 999999001 Sardor Rahimov</code>"
    )
    await query.message.answer(text)

@router.callback_query(F.data == "invite_opt:by_link")
async def cb_invite_by_link(query: CallbackQuery):
    """15 daqiqalik bir martalik taklif havolasi generatsiya qilish."""
    if not check_head_admin(query.from_user.id):
        await query.answer("❌ Ruxsat berilmagan.", show_alert=True)
        return

    await query.answer()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=15)

    await db.execute("""
        INSERT INTO admin_invitations (token, token_hash, created_by, created_at, expires_at, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
    """, token, token_hash, query.from_user.id, now, expires_at)

    bot_info = await query.bot.get_me()
    bot_username = bot_info.username or "avtosklad_bot"
    invite_url = f"https://t.me/{bot_username}?start=admin_invite_{token}"

    text = (
        "🔐 <b>Admin qo‘shish — 15 daqiqalik Invite Link</b>\n\n"
        "⏳ Amal qilish muddati: <b>15:00</b> (faqat bir martalik)\n\n"
        f"🔗 <b>Havola:</b>\n<code>{invite_url}</code>\n\n"
        "• Foydalanuvchi havolani ochganda avtomatik Admin huquqiga ega bo‘ladi.\n"
        "• 15 daqiqadan so‘ng havola o‘z-o‘zidan bekor qilinadi."
    )
    await query.message.answer(text, reply_markup=invite_created_keyboard(invite_url, token))

async def show_invites_list(target_message: Message, user_id: int):
    """Faol taklif havolalari ro'yxati."""
    if not await check_head_admin(user_id):
        await target_message.answer("❌ Bu buyruq faqat Bosh Admin uchun.")
        return

    invites = await db.fetch("""
        SELECT token, created_at, expires_at, status, used_by
        FROM admin_invitations
        ORDER BY id DESC
        LIMIT 10
    """)

    if not invites:
        await target_message.answer("ℹ️ Hozircha yaratilgan taklif havolalari yo'q. Yaratish: <code>/invite</code>")
        return

    now = datetime.now(timezone.utc)
    text = "📋 <b>OXIRGI ADMIN TAKLIF HAVOLALARI:</b>\n\n"

    for inv in invites:
        status = inv["status"]
        exp = inv["expires_at"]
        if isinstance(exp, str):
            try:
                exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            except Exception:
                exp_dt = now
        else:
            exp_dt = exp

        if exp_dt and exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)

        if status == "ACTIVE" and now > exp_dt:
            status = "EXPIRED"

        status_badge = {
            "ACTIVE": "🟢 Faol (Kutilmoqda)",
            "USED": "✅ Ishlatilgan",
            "EXPIRED": "⏳ Muddati tugagan",
            "REVOKED": "❌ Bekor qilingan"
        }.get(status, status)

        rem_min = int((exp_dt - now).total_seconds() // 60) if exp_dt and now < exp_dt and status == "ACTIVE" else 0
        rem_str = f" (Qoldi: {rem_min} daqiqa)" if rem_min > 0 else ""

        text += (
            f"• <code>...{inv['token'][-10:]}</code>\n"
            f"  Holati: <b>{status_badge}</b>{rem_str}\n\n"
        )

    await target_message.answer(text)

@router.message(Command("invites"))
async def cmd_invites(message: Message):
    """Faol taklif havolalari ro'yxati."""
    await show_invites_list(message, message.from_user.id)

@router.message(Command("addadmin"))
async def cmd_addadmin(message: Message, command: CommandObject):
    """Telegram ID orqali to'g'ridan-to'g'ri admin qo'shish."""
    if not await check_head_admin(message.from_user.id):
        await message.answer("❌ Bu buyruq faqat Bosh Admin uchun.")
        return

    arg = (command.args or "").strip()
    if not arg or not arg.isdigit():
        await message.answer(
            "⚠️ <b>Foydalanish:</b> <code>/addadmin [Telegram_ID]</code>\n\n"
            "Misol: <code>/addadmin 123456789</code>\n\n"
            "Yoki 15 daqiqalik havola orqali qo'shish uchun: <code>/invite</code>"
        )
        return

    target_id = int(arg)
    if target_id == HEAD_ADMIN_ID:
        await message.answer("ℹ️ Bu foydalanuvchi allaqachon Bosh Admin hisoblanadi.")
        return

    existing = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", target_id)
    if existing:
        if existing["status"] == "ACTIVE":
            await message.answer("ℹ️ Bu foydalanuvchi allaqachon faol admin hisoblanadi.")
            return
        await db.execute("""
            UPDATE admins
            SET status = 'ACTIVE', role = 'ADMIN', revoked_at = NULL
            WHERE telegram_id = $1
        """, target_id)
    else:
        await db.execute("""
            INSERT INTO admins (telegram_id, role, status, created_by)
            VALUES ($1, 'ADMIN', 'ACTIVE', $2)
        """, target_id, message.from_user.id)

    # Users table
    await db.execute("""
        INSERT INTO users (telegram_id, full_name, username, role, is_active)
        VALUES ($1, $2, '', 'ADMIN', 1)
        ON CONFLICT(telegram_id) DO UPDATE SET role = 'ADMIN'
    """, target_id, f"Admin {target_id}")

    await message.answer(
        f"✅ <b>Admin muvaffaqiyatli qo'shildi!</b>\n\n"
        f"🆔 Telegram ID: <code>{target_id}</code>\n"
        f"🔑 Maqom: Operatsion Admin\n\n"
        "Foydalanuvchi endi bot va Mini App orqali omborni boshqara oladi."
    )

@router.message(Command("removeadmin"))
async def cmd_removeadmin(message: Message, command: CommandObject):
    """Adminlik huquqini bekor qilish."""
    if not await check_head_admin(message.from_user.id):
        await message.answer("❌ Bu buyruq faqat Bosh Admin uchun.")
        return

    arg = (command.args or "").strip()
    if not arg or not arg.isdigit():
        await message.answer(
            "⚠️ <b>Foydalanish:</b> <code>/removeadmin [Telegram_ID]</code>\n\n"
            "Misol: <code>/removeadmin 123456789</code>\n"
            "Adminlar ro'yxatini ko'rish: <code>/admins</code>"
        )
        return

    target_id = int(arg)
    if target_id == HEAD_ADMIN_ID:
        await message.answer("❌ <b>Xatolik:</b> Bosh Adminni o'chirish yoki huquqini bekor qilish mumkin emas.")
        return

    admin = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", target_id)
    if not admin:
        await message.answer("❌ Ushbu ID raqamli admin topilmadi.")
        return

    now_utc = datetime.now(timezone.utc)
    await db.execute("""
        UPDATE admins
        SET status = 'REVOKED', revoked_at = $1
        WHERE telegram_id = $2
    """, now_utc, target_id)

    await db.execute("UPDATE users SET role = 'USER' WHERE telegram_id = $1", target_id)

    await message.answer(
        f"✅ <b>Adminlik huquqi bekor qilindi!</b>\n\n"
        f"🆔 ID: <code>{target_id}</code>\n"
        "Foydalanuvchi oddiy xaridor (USER) maqomiga o'tkazildi."
    )

@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, command: CommandObject):
    """Barcha foydalanuvchilarga e'lon tarqatish."""
    if not await check_head_admin(message.from_user.id):
        await message.answer("❌ Bu buyruq faqat Bosh Admin uchun.")
        return

    text = (command.args or "").strip()
    if not text:
        await message.answer(
            "📢 <b>Barcha foydalanuvchilarga xabar yuborish:</b>\n\n"
            "Foydalanish: <code>/broadcast [Xabar matni]</code>\n\n"
            "Misol:\n"
            "<code>/broadcast 🚗 Do'konimizga yangi original Cobalt va Gentra bamperlari keldi!</code>"
        )
        return

    users = await db.fetch("SELECT telegram_id FROM users WHERE is_active = 1")
    sent = 0
    failed = 0

    broadcast_msg = f"📢 <b>DO'KON E'LONI:</b>\n\n{text}"

    for u in users:
        tid = u["telegram_id"]
        try:
            await message.bot.send_message(chat_id=tid, text=broadcast_msg, parse_mode="HTML")
            sent += 1
        except Exception:
            failed += 1

    await message.answer(
        f"✅ <b>Xabarnoma tarqatildi!</b>\n\n"
        f"📨 Yetkazildi: <b>{sent} ta</b>\n"
        f"❌ Yetib bormadi (bloklagan): <b>{failed} ta</b>"
    )

# Callback queries
@router.callback_query(F.data.startswith("revoke_invite:"))
async def cb_revoke_invite(query: CallbackQuery):
    if not await check_head_admin(query.from_user.id):
        await query.answer("❌ Ruxsat berilmagan.", show_alert=True)
        return

    token = query.data.split(":", 1)[1]
    await db.execute("UPDATE admin_invitations SET status = 'REVOKED' WHERE token = $1", token)
    await query.answer("✅ Taklif havolasi bekor qilindi!", show_alert=True)
    await query.message.edit_text(
        "❌ <b>Ushbu taklif havolasi Bosh Admin tomonidan bekor qilindi.</b>",
        reply_markup=None
    )

@router.callback_query(F.data.startswith("revoke_admin:"))
async def cb_revoke_admin(query: CallbackQuery):
    if not await check_head_admin(query.from_user.id):
        await query.answer("❌ Ruxsat berilmagan.", show_alert=True)
        return

    target_id = int(query.data.split(":", 1)[1])
    if target_id == HEAD_ADMIN_ID:
        await query.answer("❌ Bosh Adminni o'chirib bo'lmaydi!", show_alert=True)
        return

    now_utc = datetime.now(timezone.utc)
    await db.execute("""
        UPDATE admins SET status = 'REVOKED', revoked_at = $1 WHERE telegram_id = $2
    """, now_utc, target_id)
    await db.execute("UPDATE users SET role = 'USER' WHERE telegram_id = $1", target_id)

    await query.answer("✅ Adminlik huquqi bekor qilindi!", show_alert=True)
    await query.message.edit_text(
        f"🚫 <b>Admin (ID: {target_id}) huquqi bekor qilindi.</b>",
        reply_markup=None
    )

@router.callback_query(F.data == "cmd:admins")
async def cb_admins(query: CallbackQuery):
    await query.answer()
    await show_admins_list(query.message, query.from_user.id)

@router.callback_query(F.data == "cmd:invite")
async def cb_invite(query: CallbackQuery):
    await query.answer()
    await show_invite_options(query.message, query.from_user.id)

@router.callback_query(F.data == "cmd:invites")
async def cb_invites(query: CallbackQuery):
    await query.answer()
    await show_invites_list(query.message, query.from_user.id)

async def show_users_list(target_message: Message, user_id: int, page: int = 1, edit: bool = False):
    """Barcha bot foydalanuvchilari ro'yxati va umumiy statistikasi."""
    from app.bot.handlers.admin import is_user_admin
    if not await is_user_admin(user_id):
        await target_message.answer("❌ Bu buyruq faqat adminlar uchun ruxsat etilgan.")
        return

    limit = 10
    offset = (page - 1) * limit

    # Statistikani parallel ravishda tezkor chaqirish
    total_count, admins_count, customers_count = await asyncio.gather(
        db.fetchval("SELECT COUNT(*) FROM users"),
        db.fetchval("SELECT COUNT(*) FROM users WHERE role IN ('HEAD_ADMIN', 'ADMIN')"),
        db.fetchval("SELECT COUNT(*) FROM users WHERE role = 'USER' OR role IS NULL")
    )
    total_count = total_count or 0
    admins_count = admins_count or 0
    customers_count = customers_count or 0
    total_pages = max(1, (total_count + limit - 1) // limit)

    if page > total_pages:
        page = total_pages
    if page < 1:
        page = 1

    users = await db.fetch("""
        SELECT telegram_id, full_name, username, phone_number, role, is_active, created_at
        FROM users
        ORDER BY id DESC
        LIMIT $1 OFFSET $2
    """, limit, offset)

    text = "👥 <b>FOYDALANUVCHILAR RO‘YXATI VA STATISTIKA</b>\n\n"
    text += f"📊 <b>Jami foydalanuvchilar:</b> <code>{total_count} ta</code>\n"
    text += f"👑 <b>Adminlar:</b> <code>{admins_count} ta</code>\n"
    text += f"🛍️ <b>Mijozlar:</b> <code>{customers_count} ta</code>\n\n"

    if not users:
        text += "<i>Hozircha foydalanuvchilar ro'yxati bo'sh.</i>"
    else:
        text += f"📋 <b>Foydalanuvchilar ro'yxati (Sahifa {page}/{total_pages}):</b>\n\n"
        for i, u in enumerate(users, start=offset + 1):
            name = (u["full_name"] or "Noma'lum").strip()
            username = f"@{u['username']}" if u["username"] else "username yo'q"
            role_badge = "🔑 Bosh Admin" if u["role"] == "HEAD_ADMIN" else ("👨‍💼 Admin" if u["role"] == "ADMIN" else "🛍️ Mijoz")
            phone = f"\n   📞 Tel: {u['phone_number']}" if u.get("phone_number") else ""

            created = str(u.get("created_at", ""))[:16]
            created_str = f" | 📅 {created}" if created else ""

            text += (
                f"<b>{i}. {name}</b> ({username})\n"
                f"   🆔 ID: <code>{u['telegram_id']}</code> | {role_badge}{created_str}{phone}\n\n"
            )

    kb = users_pagination_keyboard(page, total_pages)
    if edit:
        try:
            await target_message.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target_message.answer(text, reply_markup=kb, parse_mode="HTML")

@router.message(Command("users"))
@router.message(F.text.in_({"Foydalanuvchilar", "Foydalanuvchilar ro‘yxati", "/users"}))
async def cmd_users(message: Message):
    """Foydalanuvchilar ro'yxatini chiqarish."""
    await show_users_list(message, message.from_user.id, page=1, edit=False)

@router.callback_query(F.data == "cmd:users")
async def cb_users(query: CallbackQuery):
    """Tugma orqali foydalanuvchilar ro'yxatini chiqarish."""
    await query.answer()
    await show_users_list(query.message, query.from_user.id, page=1, edit=True)

@router.callback_query(F.data.startswith("users_page:"))
async def cb_users_page(query: CallbackQuery):
    """Foydalanuvchilar sahifalarini varaqlash."""
    await query.answer()
    try:
        page_num = int(query.data.split(":", 1)[1])
    except (ValueError, IndexError):
        page_num = 1
    await show_users_list(query.message, query.from_user.id, page=page_num, edit=True)

@router.callback_query(F.data == "noop")
async def cb_noop(query: CallbackQuery):
    await query.answer()

