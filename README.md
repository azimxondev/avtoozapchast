# 🚗 Avto Sklad — Telegram Mini App

> Avto ehtiyot qismlari do'koni va omborini (sklad) boshqarish tizimi.
> Telegram Mini App + FastAPI Backend + PostgreSQL (Neon).

[![Python](https://img.shields.io/badge/Python-3.12+-3776ab?style=flat-square&logo=python)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169e1?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Telegram](https://img.shields.io/badge/Telegram-Mini_App-2ca5e0?style=flat-square&logo=telegram)](https://core.telegram.org/)

---

## ⚡️ Imkoniyatlar

* **📦 Sklad boshqaruvi**: Mahsulot qo'shish, tahrirlash, o'chirish
* **➕➖ Kirim/Chiqim**: Omborga tovar kiritish va sotish (atomic transaction)
* **📊 Dashboard**: Sklad qiymati, jami qoldiq, sotuv hisobi
* **📈 Statistika**: Kunlik, haftalik, oylik, yillik sotuv va kirim
* **📜 Tarix**: Barcha kirim/chiqim operatsiyalari tarixi
* **📍 Manzil**: Do'kon manzili (Google Maps / Yandex Xarita)
* **🔐 Xavfsizlik**: Telegram initData HMAC-SHA256 tekshiruv
* **👨‍💼 Admin tizimi**: Head Admin + Co-admins
* **📢 Broadcast**: Head Admin barcha foydalanuvchilarga xabar yuborishi

---

## 🏗 Arxitektura

```
Telegram Bot (/start)
       ↓
Telegram Mini App (WebApp)
       ↓
FastAPI Backend (API)
       ↓
PostgreSQL (Neon Cloud)
```

---

## 🚀 Ishga tushirish

### 1. Repozitoriyani yuklab olish

```bash
git clone https://github.com/azimxondev/kuzavnoy-app.git
cd kuzavnoy-app
```

### 2. Python muhitini sozlash

```bash
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. .env faylini yaratish

```bash
cp .env.example .env
```

Kerakli kalitlarni to'ldiring:
```env
BOT_TOKEN=1234567890:ABCDefGhIjKlMnOpQrStUvWxYz
ADMIN_IDS=123456789
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
WEBAPP_URL=https://your-app.onrender.com
SHOP_ADDRESS=Toshkent sh., Farhod bozori
```

### 4. Ma'lumotlar bazasini sozlash

Neon Dashboard → SQL Editor da `sql/schema.sql` faylini ishga tushiring.

### 5. Serverni yoqish

```bash
uvicorn app.main:app --reload
```

* **Mini App**: `http://localhost:8000`
* **API Docs**: `http://localhost:8000/docs`

---

## 📡 API Endpointlar

| Method | Path | Vazifa |
|--------|------|--------|
| `GET` | `/api/products` | Barcha mahsulotlar |
| `GET` | `/api/products/{id}` | Bitta mahsulot |
| `POST` | `/api/products` | Yangi mahsulot qo'shish |
| `PATCH` | `/api/products/{id}` | Mahsulotni tahrirlash |
| `DELETE` | `/api/products/{id}` | Mahsulotni o'chirish |
| `POST` | `/api/products/{id}/in` | Kirim (+) |
| `POST` | `/api/products/{id}/out` | Chiqim (-) |
| `GET` | `/api/statistics` | Umumiy statistika |
| `GET` | `/api/statistics/{period}` | Davriy statistika |
| `GET` | `/api/transactions` | Transaction tarix |
| `GET` | `/api/shop` | Do'kon manzili |
| `GET` | `/health` | Health check |

---

## 🔐 Xavfsizlik

* Telegram `initData` HMAC-SHA256 bilan tekshiriladi
* Faqat `ADMIN_IDS` ichidagi userlar boshqaruv qila oladi
* `HEAD_ADMIN` (birinchi ID) — boshqa adminlarni boshqaradi
* SQL Injection himoyasi (parametrized queries)
* `quantity < 0` bo'lishining oldi olingan

---

## ☁️ Render ga deploy qilish

1. GitHub'ga push qiling
2. [Render.com](https://render.com) → **New Web Service**
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables** ga `.env` dagi barcha kalitlarni kiriting
6. `WEBAPP_URL` ni Render domen bilan yangilang

### UptimeRobot sozlash
* URL: `https://your-app.onrender.com/health`
* Interval: 5 daqiqa
* Type: HTTP(s)

---

## 🤖 Telegram Bot buyruqlari

| Buyruq | Vazifa | Kim uchun |
|--------|--------|-----------|
| `/start` | Skladni ochish | Hammaga |
| `/help` | Yordam | Adminlar |
| `/broadcast <xabar>` | Barcha userlarga xabar | Head Admin |

---

## 📄 Litsenziya

MIT
