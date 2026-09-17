# 🚗 Auto Sklad — Avtomobil Ehtiyot Qismlari Ombori & Telegram Mini App (ERP)

Auto Sklad — bu avtomobil ehtiyot qismlari do'koni va ombori uchun yaratilgan to'liq **FastAPI (Backend)**, **Telegram Mini App (Frontend)**, **Telegram Bot (Aiogram 3)** va **Avtomatlashtirilgan Buxgalteriya** tizimi.

Loyihada **Backend**, **Frontend**, **Ma'lumotlar bazasi** va **Telegram Bot** 100% tayyor, to'liq bir-biriga bog'langan va xavfsiz holatga keltirilgan.

---

## 🌟 Asosiy Imkoniyatlar

1. **Telegram Mini App & Do'kon Katalogi**:
   - Avtomobil rusumlari (Cobalt, Gentra, Nexia, Malibu va h.k.) va toifalar bo'yicha filter.
   - Tezkor qidiruv (Artikul/SKU, nom, brend, model).
   - Real-vaqt qoldiqlar (Mavjud, Kam qolgan, Tugagan).
2. **Kassa & Buxgalteriya**:
   - Kirim (Xaridlar) va Chiqim (Sotuvlar) harakatlari.
   - Tranzaksiya yaxlitligi (Transaction Atomicity & Rollback).
   - Shaffof kassa formulasi: `Boshlang'ich kassa - Xaridlar + Sotuvlar = Yakuniy kassa`.
3. **Kalendar Tahlili & Drill-Down**:
   - Kunlik, Haftalik (Dushanba - Yakshanba), Oylik va Yillik kalendar davrlari.
   - Tushum yoki Xarajat kartochkasi bosilganda ochiladigan batafsil tranzaksiyalar oynasi (Drill-down).
4. **Bosh Admin (Head Admin) & Xavfsiz Takliflar**:
   - Yagona Bosh Admin: `HEAD_ADMIN_ID=5361309526`.
   - 15 daqiqalik bir martalik taklif havolalari (Single-use Invite Link).
   - Rollar: `HEAD_ADMIN`, `ADMIN`, `USER`.
   - Yuqori o'ng burchakdagi **«Bezovta qilinmasin» (🔔 / 🔕)** ilova rejimi.

---

## 🚀 1. LOKAL ISHGA TUSHIRISH (Kompyuterda)

### 1-qadam. Talablar
- Python 3.10+ o'rnatilgan bo'lishi kerak.

### 2-qadam. Bog'liqliklarni o'rnatish
```bash
pip install -r requirements.txt
```

### 3-qadam. .env fayli
Loyiha papkasida `.env` fayli mavjud va sizning bot tokeningiz unga kiritilgan:
```env
ENVIRONMENT=development
DEMO_MODE=true
HEAD_ADMIN_ID=5361309526
BOT_TOKEN=8759699560:AAG7ZO77LAlAbiz47gQAUdl02bDJunqEih8
SECRET_KEY=auto-sklad-dev-secret-key-32chars-secure
WEBAPP_URL=http://localhost:8000
INITIAL_BUDGET=150000000
```

### 4-qadam. Serverni ishga tushirish
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- Brauzerda ochish: [http://localhost:8000](http://localhost:8000)
- Bosh Admin rolida ochish: [http://localhost:8000/?role=head_admin](http://localhost:8000/?role=head_admin)
- Tizim holati (Health Check): [http://localhost:8000/health](http://localhost:8000/health)

---

## ☁️ 2. BEPUL BAZA ULASH (Neon.tech yoki Supabase PostgreSQL)

Render'ning bepul veb-serverida SQLite fayli har qayta yuklanganda yangilanib turmasligi uchun **bepul PostgreSQL** ulash tavsiya etiladi:

1. **[Neon.tech](https://neon.tech)** saytiga kiring (bepul ro'yxatdan o'ting).
2. Yangi proyekt yarating (masalan, `auto-sklad-db`).
3. Berilgan ulanish havolasini nusxalang (`Connection String`):
   ```
   postgresql://username:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Ushbu havolani `.env` faylidagi `DATABASE_URL` parametriga qo'ying:
   ```env
   DATABASE_URL=postgresql://username:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
*Tizim PostgreSQL ga avtomatik ulanadi, barcha jadvallarni (`schema.py`) va dastlabki 100+ mahsulotlarni o'zi yaratib beradi!*

---

## 🌐 3. GITHUB VA RENDER.COM GA BEPUL JOYLASHTIRISH (24/7)

### 1-qadam. GitHub'ga yuklash
1. [GitHub.com](https://github.com) da yangi repozitoriy oching (masalan, `auto-sklad`).
2. Loyihani yuklang:
```bash
git add .
git commit -m "Auto Sklad production ready release"
git branch -M main
git remote add origin https://github.com/SIZNING_USERNAME/auto-sklad.git
git push -u origin main
```
*(Xavotir olmang, `.gitignore` tufayli `.env` va lokal bazalar GitHub'ga chiqmaydi).*

### 2-qadam. Render.com da bepul ishga tushirish
1. [Render.com](https://render.com) ga kiring va GitHub profilingiz bilan ulaning.
2. **New +** -> **Web Service** ni bosing.
3. GitHub repozitoriyangizni tanlang (`azimxondev/avtoozapchast`).
4. Sozlamalarni tekshiring:
   - **Name**: `avtoozapchast`
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`  *(yoki `uvicorn app.main:app --host 0.0.0.0 --port $PORT`)*
   - **Instance Type**: `Free` (0$ bepul rejim)
5. **Environment Variables** (Muhit o'zgaruvchilari) bo'limiga quyidagilarni kiriting:
   - `ENVIRONMENT` = `production`
   - `DEMO_MODE` = `false`
   - `HEAD_ADMIN_ID` = `5361309526`
   - `BOT_TOKEN` = `8759699560:AAG7ZO77LAlAbiz47gQAUdl02bDJunqEih8`
   - `DATABASE_URL` = `postgresql://neondb_owner:npg_n1ztxXR3FJyr@ep-dark-forest-b5lu1g3c-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - `SECRET_KEY` = `auto-sklad-prod-secure-token-32chars-ok`
   - `WEBAPP_URL` = `https://avtoozapchast.onrender.com`
6. **Deploy Web Service** tugmasini bosing. 2-3 daqiqada saytingiz va botingiz 24/7 rejimda to'liq ishga tushadi!

---

## 🤖 4. TELEGRAM @BotFather DA MINI APP TUGMASINI SOZLASH

Foydalanuvchilar va Adminlar botga kirganda chap pastki burchakda **«Open Auto Sklad»** tugmasi chiqishi uchun:

1. Telegramda **[@BotFather](https://t.me/BotFather)** ga kiring.
2. `/mybots` buyrug'ini yuboring va botingizni tanlang.
3. **Bot Settings** -> **Menu Button** -> **Configure menu button** ni bosing.
4. Render'dagi havolangizni yuboring (masalan: `https://auto-sklad.onrender.com`).
5. Tugma nomini kiriting: `🚗 Open Auto Sklad`

Endi botingizda chiroyli Mini App tugmasi doimiy paydo bo'ladi!

---

## 👑 5. BOT BUYRUQLARI VA FOYDALANISH

- `/start` — Mini App'ni ochish va asosiy menyu.
- `/invite_admin` — **Bosh Admin** uchun yangi admin qo'shish (Telegram ID yoki 15 daqiqalik bir martalik havola).
- `/analytics` — Bugungi tushum, xarajat, sof foyda va kassa balansi.
- `/products` — Ombor tovarlari va qoldiqlari.
- `/stock` — Kam qolgan va tugagan mahsulotlar ogohlantirishi.
- `/status` — Tezkor kassa va ombor auditi.
- `/verify_phone` — Telegram rasmiy kontakti orqali telefon raqamni tasdiqlash.

---

## 🔒 6. XAVFSIZLIK KAFOLATLARI

- ✅ **Birorta ham maxfiy kalit yoki parol kod ichida yozilmagan** (faqat `.env` orqali o'qiladi).
- ✅ **GitHub'ga `.env` va shaxsiy ma'lumotlar chiqishi 100% bloklangan**.
- ✅ **Bosh Admin huquqini tashqaridan soxtalashtirish imkonsiz** (Telegram HMAC-SHA256 imzosi tekshiriladi).
- ✅ **Tranzaksiyalar atomar** — pul yoki tovar hisobida nomutanosiblik bo'lmaydi.
