# kuzavnoy.uzz — Telegram Mini App & Admin Dashboard

Ushbu loyiha **kuzavnoy.uzz** avto-ehtiyot qismlari do'koni uchun to'liq tayyorlangan tizimdir.

## 🌟 Nimalar mavjud?
1. **Telegram Mini App (React 18 + Tailwind CSS)**:
   - 3 ta slaydli Onboarding
   - Instagram uslubidagi Stories
   - Mahsulotlar katalogi va kategoriyalar filtri
   - Bottom Sheet (detal rasmi, xususiyatlari, xarid tugmasi)
   - Savatcha + Cross-sell taklif (Aromatizator)
   - Foydalanuvchi profili va buyurtmalar tarixi

2. **Admin Web Dashboard (React 18)**:
   - Real vaqtda tushgan buyurtmalar ro'yxati
   - Buyurtma holatini o'zgartirish (Kutilmoqda, Yetkazildi...)
   - Zapchastlar CRUD (yangi qo'shish, narxini/rasmini o'zgartirish, o'chirish)
   - Statistika va umumiy tushum hisoblagich

3. **Telegram Bot & PostgreSQL (Neon)**:
   - Avtomatik jadvallarni yaratish va 6 ta ehtiyot qismni yuklash (Rul, Bar, Labavoy, Bakavoy, Balonlar, Gril)
   - Buyurtma berilganda mijozga Telegram orqali chek/xabar yuborish

---

## 🚀 Qanday ishga tushiriladi? (Juda oson!)

### 1-Usul: Eng osoni (Sichqoncha bilan 1 marta bosish)
Papka ichidagi **`start.bat`** fayli ustiga sichqoncha bilan 2 marta bosing. U avtomatik tarzda kerakli kutubxonalarni o'rnatadi va serverni yoqadi!

### 2-Usul: Terminal orqali
1. Terminalda (PowerShell yoki CMD) papkaga kiring:
```bash
npm install
node server.js
```

2. Brauzeringizda oching:
- **Telegram Mini App**: [http://localhost:3000](http://localhost:3000)
- **Admin Panel**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🌐 Telegram Botga Mini App sifatida ulash (ngrok)

Telegram ichida Mini App to'g'ridan-to'g'ri ochilishi uchun Telegram **HTTPS** havolani talab qiladi. Buning uchun `ngrok` ishlatiladi:

1. [ngrok.com](https://ngrok.com) saytidan ngrok dasturini yuklab oling.
2. Terminalda quyidagi buyruqni bering:
```bash
ngrok http 3000
```
3. ngrok sizga `https://tasodifiy-kod.ngrok-free.app` manzilini beradi.
4. Serverni ushbu manzil bilan yurgizing:
```bash
node server.js https://tasodifiy-kod.ngrok-free.app
```
5. Telegramda botingizga kiring va **/start** tugmasini bosing. Ekranda **Mini App** tugmasi paydo bo'ladi!
