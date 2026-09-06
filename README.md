# 🚗 kuzavnoy.uzz — E-Commerce Platform

> Telegram Mini App, Web Admin Panel va Telegram Bot yagona all-in-one arxitekturada.

[![Node.js](https://img.shields.io/badge/Node.js-18+-68a063?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169e1?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot_API-2ca5e0?style=flat-square&logo=telegram)](https://core.telegram.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#)

---

## ⚡️ Imkoniyatlar (Features)

* **🛍 Telegram Mini App (Mijozlar uchun)**:
  * Avto ehtiyot qismlar katalogi, qidiruv va mashina modellari filtri
  * Instagram uslubidagi avto-o'tuvchi Stories (Istoriyalar)
  * Qulay savatcha va buyurtma berish (Yetkazish / Olib ketish)
  * Ko'p kartali to'lov (Uzcard, Humo, Visa) va naqd to'lov
  * Buyurtma holatini real vaqtda kuzatuvchi 4 bosqichli treker
  * 3 ta til (UZ, RU, EN) va Tun/Kun (Dark/Light) rejimi

* **👨‍💼 Admin Dashboard (Do'kon egasi uchun)**:
  * Buyurtmalar jurnali va holatlarni boshqarish (`Kutilmoqda`, `Jarayonda`, `Tayyorlandi`, `Yetkazildi`, `Bekor qilindi`)
  * Aniq sanalar kesimidagi moliyaviy analitika (Bugun, Hafta, Oy, Yil)
  * QR-kodli va Soliq 1% keshbekli 80mm termal kassa chekini chiqarish
  * Zapchastlar va istoriyalarni boshqarish (CRUD)
  * Barcha mijozlarga bot orqali ommaviy xabar va rasm tarqatish (Broadcast)
  * Aloqa telefonlari va kartalar uchun faollik galchkalari (Sozlamalar)

* **🤖 Telegram Bot**:
  * Buyurtma tushganda admin va mijozga bir zumda avtomatik xabar
  * Holat o'zgarganda mijozga darhol SMS bildirishnoma
  * Doimiy menyu buyruqlari: `/start`, `/katalog`, `/aloqa`, `/admin`

---

## 🚀 Ishga tushirish (Quick Start)

### 1. Repozitoriyani yuklab olish va paketlarni o'rnatish
```bash
git clone https://github.com/azimxondev/kuzavnoy-app.git
cd kuzavnoy-app
npm install
```

### 2. Sozlamalar (.env)
`.env.example` faylidan nusxa olib, `.env` faylini yarating:
```bash
cp .env.example .env
```

Kerakli kalitlarni to'ldiring:
```env
PORT=3000
BOT_TOKEN=sizning_bot_tokeningiz
DATABASE_URL=sizning_postgres_baza_havolangiz
ADMIN_CHAT_IDS=sizning_telegram_idingiz
WEB_APP_URL=https://sizning-domen.onrender.com
```

### 3. Serverni yoqish
```bash
npm start
```

* **Mini App**: `http://localhost:3000`
* **Admin Panel**: `http://localhost:3000/admin`

---

## 📄 Litsenziya
Ushbu loyiha MIT litsenziyasi asosida tarqatiladi.
