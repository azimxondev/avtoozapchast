// ==============================================================================
// kuzavnoy.uzz — ALL-IN-ONE SINGLE FILE APPLICATION
// Telegram Bot + REST API + PostgreSQL (Neon) + React Mini App + React Admin Panel
// ==============================================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
process.env.NTBA_FIX_350 = 1;
const TelegramBot = require('node-telegram-bot-api');

// 1. SOZLAMALAR (CONFIG — BARCHA MAXFIY KALITLAR .env YOKI HOSTING MUHITIDAN OLINADI)
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
// Ngrok, Render yoki HTTPS domeni
let WEB_APP_URL = process.argv[2] || process.env.WEB_APP_URL || (process.env.PORT ? 'https://kuzavnoy-app.onrender.com' : `http://localhost:${PORT}`);

// 1.1 Bosh Admin (Founder / Do'kon egasi) Telegram ID raqami
const HEAD_ADMIN_ID = String(process.env.HEAD_ADMIN_ID || process.env.ADMIN_CHAT_IDS || process.env.ADMIN_IDS || '').split(',')[0].trim();

// 1.2 Barcha faol adminlar ro'yxati (Head Admin + Co-admins)
let ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (HEAD_ADMIN_ID && !ADMIN_CHAT_IDS.includes(HEAD_ADMIN_ID)) {
  ADMIN_CHAT_IDS.unshift(HEAD_ADMIN_ID);
}

// 1.3 Bir martalik xavfsiz taklif tokenlari (Muddati 15 daqiqa)
const activeAdminInvites = new Map();

// Foydalanuvchini /start bosganda ro'yxatdan o'tkazish holatlari (Registration State Machine)
const userRegStates = new Map();

// Telegram HTML xabarlari uchun xavfsiz escape yordamchisi
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 1.4 Adminlarni bazadan o'qish va doimiy saqlash
async function loadAdminsFromDb() {
  try {
    const res = await pool.query('SELECT admin_ids FROM store_settings WHERE id = 1');
    if (res.rows.length > 0 && res.rows[0].admin_ids) {
      const dbAdmins = res.rows[0].admin_ids.split(',').map(s => s.trim()).filter(Boolean);
      dbAdmins.forEach(id => {
        if (!ADMIN_CHAT_IDS.includes(id)) {
          ADMIN_CHAT_IDS.push(id);
        }
      });
      if (HEAD_ADMIN_ID && !ADMIN_CHAT_IDS.includes(HEAD_ADMIN_ID)) {
        ADMIN_CHAT_IDS.unshift(HEAD_ADMIN_ID);
      }
      console.log(`✅ Bazadagi adminlar yuklandi (${ADMIN_CHAT_IDS.length} ta faol admin, Bosh Admin: ${HEAD_ADMIN_ID})`);
    }
  } catch (err) {
    console.error('Adminlarni bazadan yuklashda xato:', err.message);
  }
}

async function saveAdminsToDb() {
  try {
    await pool.query('UPDATE store_settings SET admin_ids = $1 WHERE id = 1', [ADMIN_CHAT_IDS.join(',')]);
    console.log('✅ Yangilangan adminlar ro\'yxati bazaga saqlandi:', ADMIN_CHAT_IDS.join(','));
  } catch (err) {
    console.error('Adminlarni bazaga saqlashda xato:', err.message);
  }
}

if (!DATABASE_URL) {
  console.error('⚠️ DIQQAT: DATABASE_URL topilmadi! Iltimos, .env faylida yoki Render Environment Variables da DATABASE_URL ni belgilang.');
}
if (!BOT_TOKEN) {
  console.warn('⚠️ DIQQAT: BOT_TOKEN (yoki TELEGRAM_TOKEN) topilmadi! Iltimos, .env faylida yoki Render Environment Variables da BOT_TOKEN ni belgilang.');
}

// 2. MA'LUMOTLAR BAZASI (POSTGRESQL - NEON)
const pool = new Pool({
  connectionString: DATABASE_URL || 'postgresql://localhost:5432/postgres',
  ssl: DATABASE_URL && DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL (Neon) bazasiga muvaffaqiyatli ulandi!');
    await loadAdminsFromDb();

    // Jadvallarni yaratish
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        name VARCHAR(255),
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'Yangi';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT DEFAULT 10;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS color VARCHAR(100) DEFAULT 'Universal';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS car_model VARCHAR(100);

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50) DEFAULT '🚗',
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100) DEFAULT 'Sardor (Kuzavnoy Express)';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(50) DEFAULT '+998 90 123 45 67';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS needs_installation BOOLEAN DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS installation_service VARCHAR(255);

      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS telegram_channel_url VARCHAR(255) DEFAULT 'https://t.me/kuzavnoy_uz';
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS website_url VARCHAR(255) DEFAULT 'https://kuzavnoy.uz';
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS instagram_active BOOLEAN DEFAULT true;
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS youtube_active BOOLEAN DEFAULT true;
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS telegram_active BOOLEAN DEFAULT true;
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS website_active BOOLEAN DEFAULT false;
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_hours_open VARCHAR(20) DEFAULT '09:00';
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_hours_close VARCHAR(20) DEFAULT '19:00';
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_days VARCHAR(50) DEFAULT 'Har kuni';

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        details JSONB DEFAULT '[]'::jsonb,
        old_price INT,
        new_price INT NOT NULL,
        category VARCHAR(100),
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT,
        customer_name VARCHAR(255),
        phone VARCHAR(50),
        items JSONB NOT NULL,
        total_price INT NOT NULL,
        location TEXT,
        delivery_type VARCHAR(50) DEFAULT 'delivery',
        payment_method VARCHAR(50) DEFAULT 'cash',
        status VARCHAR(50) DEFAULT 'Kutilmoqda',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50) DEFAULT 'delivery';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';

      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        tag VARCHAR(100) DEFAULT 'Yangi',
        image_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        product_id INT,
        telegram_id BIGINT,
        customer_name VARCHAR(255),
        rating INT DEFAULT 5,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS store_settings (
        id INT PRIMARY KEY DEFAULT 1,
        card_number VARCHAR(100) DEFAULT '8600 5304 1234 5678',
        card_holder VARCHAR(255) DEFAULT 'AZIMXON (KUZAVNOY.UZZ)',
        uzcard_number VARCHAR(100) DEFAULT '8600 5304 1234 5678',
        uzcard_holder VARCHAR(255) DEFAULT 'AZIMXON (KUZAVNOY.UZZ)',
        humo_number VARCHAR(100) DEFAULT '9860 1201 5678 4321',
        humo_holder VARCHAR(255) DEFAULT 'AZIMXON (KUZAVNOY.UZZ)',
        visa_number VARCHAR(100) DEFAULT '',
        visa_holder VARCHAR(255) DEFAULT 'AZIMXON (KUZAVNOY.UZZ)',
        phone VARCHAR(50) DEFAULT '+998 90 123 45 67',
        phone2 VARCHAR(50) DEFAULT '+998 97 765 43 21',
        phone3 VARCHAR(50) DEFAULT '+998 99 888 77 66',
        instagram_url VARCHAR(255) DEFAULT 'https://instagram.com/kuzavnoy.uzz',
        youtube_url VARCHAR(255) DEFAULT 'https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G',
        store_address TEXT DEFAULT 'Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori',
        store_hours VARCHAR(100) DEFAULT '09:00 - 19:00',
        uzcard_active BOOLEAN DEFAULT true,
        humo_active BOOLEAN DEFAULT true,
        visa_active BOOLEAN DEFAULT false,
        phone1_active BOOLEAN DEFAULT true,
        phone2_active BOOLEAN DEFAULT true,
        phone3_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE store_settings 
      ADD COLUMN IF NOT EXISTS uzcard_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS humo_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS visa_active BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS phone1_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS phone2_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS phone3_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS store_location_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS admin_ids TEXT DEFAULT '';
    `);

    // Eski umumiy kategoriyalarni yangi mashina modellariga yangilash
    await client.query(`
      UPDATE products SET category = 'Malibu 1 / 2' WHERE category = 'Rul va Salon';
      UPDATE products SET category = 'Gentra / Lacetti' WHERE category = 'Oynalar';
      UPDATE products SET category = 'Cobalt' WHERE category = 'Balon va Disklar';
      UPDATE products SET category = 'Tracker 1 / 2' WHERE category = 'Kuzov qismlari';
    `);

    // Dastlabki avto-ehtiyot qismlarni (seed) bazaga kiritish (agar baza bo'sh bo'lsa)
    const productsCount = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(productsCount.rows[0].count) === 0) {
      console.log('🌱 Baza bo\'sh, kuzavnoy.uzz avto-ehtiyot qismlari yuklanmoqda...');
      const initialParts = [
        {
          name: "M-Sport Anatomiya Rul (Carbon)",
          description: "Malibu, Tracker va Lacetti uchun sport uslubidagi qulay uglerod tolali rul.",
          condition: "Yangi",
          details: JSON.stringify([
            "Haqiqiy Nappa charm va uglerod tolali (carbon) qoplama",
            "Ko'p funksiyali audio va kruiz-kontrol boshqaruv tugmalari",
            "Zavodskoy xavfsizlik yostiqchasi (Airbag) bilan to'liq mos",
            "Ergonomik ushlagich va qizdirish funksiyasini qo'llab-quvvatlaydi",
            "Malibu 1/2, Gentra va Tracker modellariga to'g'ri tushadi",
            "Holati: Yangi (Zavodskoy original qutida, muhrlangan)",
            "Kafolat: 12 oy rasmiy servis kafolati"
          ]),
          old_price: 1850000,
          new_price: 1450000,
          category: "Malibu 1 / 2",
          image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Malibu 2 O'rta Konsol Bar (Original)",
          description: "Simsiz zaryadka o'rni va stakan ushlagichli original bar konsoli.",
          condition: "B/U (Ideal)",
          details: JSON.stringify([
            "Tezkor simsiz (Wireless) quvvatlash uyasi bilan jihozlangan",
            "LED fonli xrom podstakanniklar va keng saqlash bo'linmasi",
            "Eko-charm tirsaklagich (yirtilmagan, qirilmagan toza)",
            "Zavodskoy fiksatorlarga 100% tushadi, qirqish talab qilinmaydi",
            "Holati: B/U (Koreyadan keltirilgan, holati ideal 10/10)",
            "Kafolat: 6 oy tekshiruv va sinov kafolati",
            "Toshkent bo'ylab 2 soat ichida yetkazib beriladi"
          ]),
          old_price: 1250000,
          new_price: 980000,
          category: "Malibu 1 / 2",
          image_url: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Akustik / Tonirovka Labavoy Oyna (Benson)",
          description: "Ultra-binafsha nurlardan 99% himoyalovchi sifatli original old oyna.",
          condition: "Yangi",
          details: JSON.stringify([
            "Akustik polimer qatlam (tashqi shovqinni 40% pasaytiradi)",
            "UV va quyosh issiqligini qaytaruvchi Athermal himoya qatlami",
            "Yomg'ir va yorug'lik datchigi uchun maxsus tayyor o'rin",
            "Xalqaro DOT va ECE sifat sertifikatlariga ega",
            "Holati: Yangi (Zavodskoy gologrammali qadoqda)",
            "Gentra va Lacetti barcha yillari uchun mos keladi",
            "Bepul o'rnatish va germetik kafolati taqdim etiladi"
          ]),
          old_price: 1650000,
          new_price: 1290000,
          category: "Gentra / Lacetti",
          image_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Elektron Buklanadigan Bakavoy Oyna (Juft)",
          description: "Dinamik burilish LED chirog'i va isitgichli avtomatik yon oynalar to'plami.",
          condition: "Yangi",
          details: JSON.stringify([
            "Elektron qizdirish (muzlashga qarshi) elementi mavjud",
            "Dinamik yuguruvchi LED burilish signali o'rnatilgan",
            "Pult orqali avtomatik yig'ilish va ochilish motori",
            "Ko'r zonalarni ko'rsatuvchi sferik qavariq oyna",
            "Holati: Yangi (Original juftlik to'plami)",
            "Gentra, Lacetti va Cobalt uchun to'liq mos keladi",
            "Kafolat: 1 yil rasmiy kafolat"
          ]),
          old_price: 1100000,
          new_price: 850000,
          category: "Gentra / Lacetti",
          image_url: "https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Michelin Pilot Sport Balonlar (215/55 R17)",
          description: "Har qanday ob-havoda maksimal tormozlanish va jim, yumshoq harakat.",
          condition: "Yangi",
          details: JSON.stringify([
            "Akvaplanatsiyaga qarshi maxsus yomg'ir kanallari tizimi",
            "Yuqori tezlikda yo'lga mustahkam yopishish texnologiyasi",
            "Shovqinsiz 'Acoustic Silent' maxsus kauchuk qatlami",
            "2024-yil yangi ishlab chiqarilgan toza partiya",
            "Holati: Yangi (Zavod stikeri bilan birga)",
            "Cobalt, Lacetti, Malibu va Tracker avtomobillari uchun",
            "4 dona olganga bepul balansirovka xizmati mavjud"
          ]),
          old_price: 1950000,
          new_price: 1600000,
          category: "Cobalt",
          image_url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "VIP Glossy Radiator Panjarasi (Gril)",
          description: "Old qismga tajovuzkor sport qiyofa beruvchi zanglamas qora porloq reshyotka.",
          condition: "Yangi",
          details: JSON.stringify([
            "Yuqori zarbaga chidamli ABS xrom/gloss qora plastmassa",
            "Dvigatel sovutish tizimiga to'liq shamol o'tkazish geometriyasi",
            "Zavod mahkamlagichlariga to'liq mos keladi (bolt-on)",
            "Quyoshda rangi o'chmaydi va yuqori bosimli moykada ko'chmaydi",
            "Holati: Yangi (Zavod qadog'ida)",
            "Tracker 1 / 2 va Onix modellariga to'g'ri tushadi",
            "Avtomobilga tajovuzkor sport qiyofa beradi"
          ]),
          old_price: 890000,
          new_price: 690000,
          category: "Tracker 1 / 2",
          image_url: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Malibu 2 LED Old Fara To'plami (Juft)",
          description: "Original GM zavod LED linzali, kunduzgi chiroqli old faralar juftligi.",
          condition: "B/U (Ideal)",
          details: JSON.stringify([
            "Original GM zavod LED linzali old faralar to'plami",
            "Kunduzgi yurish chiroqlari (DRL) va yorqin ksenon modul",
            "Barcha quloqlari butun, payvand qilinmagan, toza shisha",
            "Koreya import avtomobilidan yechib olingan",
            "Holati: B/U (Holati a'lo darajada, deyarli yangidek)",
            "Malibu 2 (2016-2022) barcha pozitsiyalari uchun",
            "6 oy tekshiruv kafolati beriladi"
          ]),
          old_price: 3400000,
          new_price: 2800000,
          category: "Malibu 1 / 2",
          image_url: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Cobalt / Gentra Sport Rul (Alcantara)",
          description: "Alcantara va teshikli charm bilan qoplangan sport anatomik rul.",
          condition: "Yangi",
          details: JSON.stringify([
            "Italiya Alcantara va teshikli (perforirovanniy) qora charm",
            "Qizil sport tikuv chiziqlari va nolinchi belgi",
            "To'liq tugmalar bloki (kruiz, audio va bluetooth)",
            "Zavod xavfsizlik yostig'iga (Airbag) 100% mos keladi",
            "Holati: Yangi (Zavod mahsuloti, maxsus chexolda)",
            "Cobalt va Gentra 1/2/3/4 pozitsiyalari uchun",
            "12 oy rasmiy servis kafolati"
          ]),
          old_price: 1550000,
          new_price: 1250000,
          category: "Cobalt",
          image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80"
        }
      ];

      for (const p of initialParts) {
        await client.query(
          `INSERT INTO products (name, description, details, old_price, new_price, category, image_url, condition)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [p.name, p.description, p.details, p.old_price, p.new_price, p.category, p.image_url, p.condition]
        );
      }
      console.log('✅ 8 ta avto-ehtiyot qism bazaga muvaffaqiyatli saqlandi!');
    }

    // Dastlabki istoriyalarni (seed) bazaga kiritish (agar bo'sh bo'lsa)
    const storiesCount = await client.query('SELECT COUNT(*) FROM stories');
    if (parseInt(storiesCount.rows[0].count) === 0) {
      console.log('🌱 Dastlabki istoriyalar (Stories) yuklanmoqda...');
      const initialStories = [
        { tag: "Yangi", title: "Yangi partiya", description: "Original M-Sport anatomik rullari qayta keldi!", image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80" },
        { tag: "Chegirma", title: "⚡️ -30% Oynalarga", description: "Benson va Fuyao labavoy oynalari ulgurji narxda!", image_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80" },
        { tag: "Xizmat", title: "🛠 O'rnatib berish", description: "Servis markazimizda bepul o'rnatish kafolati mavjud.", image_url: "https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80" },
        { tag: "Original", title: "⭐️ Sifat kafolati", description: "Barcha mahsulotlar zavod kafolati bilan beriladi.", image_url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80" }
      ];
      for (const s of initialStories) {
        await client.query(
          `INSERT INTO stories (tag, title, description, image_url) VALUES ($1, $2, $3, $4)`,
          [s.tag, s.title, s.description, s.image_url]
        );
      }
      console.log('✅ Dastlabki istoriyalar bazaga saqlandi!');
    }

    const reviewsCount = await client.query('SELECT COUNT(*) FROM reviews');
    if (parseInt(reviewsCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO reviews (product_id, telegram_id, customer_name, rating, comment) VALUES
        (1, 10001, 'Azizbek', 5, 'M-Sport rul juda sifatli ekan, mashinaga 100% tushdi. Tavsiya qilaman!'),
        (2, 10002, 'Jasur', 5, 'Malibu 2 bar olingan, simsiz zaryadkasi tez va qulay ishlayapti.'),
        (3, 10003, 'Sherzod', 5, 'Benson labavoy oyna zo''r, quyosh issig''i umuman sezilmayapti.')
      `);
      console.log('✅ Dastlabki mijoz sharhlari (Reviews) bazaga kiritildi!');
    }

    const settingsCount = await client.query('SELECT COUNT(*) FROM store_settings');
    if (parseInt(settingsCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO store_settings (id, card_number, card_holder, phone, instagram_url, youtube_url, store_address, store_hours)
        VALUES (1, '8600 5304 1234 5678', 'AZIMXON (KUZAVNOY.UZZ)', '+998 90 123 45 67', 'https://instagram.com/kuzavnoy.uzz', 'https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G', 'Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori', '09:00 - 19:00')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('✅ Dastlabki do\'kon sozlamalari (store_settings) bazaga kiritildi!');
    }
    client.release();
  } catch (err) {
    console.error('❌ Ma\'lumotlar bazasiga ulanishda xatolik:', err.message);
  }
}
initDatabase();

// 3. TELEGRAM BOT
let bot;
if (BOT_TOKEN) {
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram Bot ishga tushdi (@kuzavnoy.uzz bot)!');

  bot.on('polling_error', (error) => {
    if (error.code !== 'EFATAL') {}
  });

  // Bot menyu buyruqlarini ro'yxatdan o'tkazish
  bot.setMyCommands([
    { command: 'start', description: '🚀 Botni ishga tushirish va katalog' },
    { command: 'katalog', description: '🛒 Ehtiyot qismlar do\'koni (Mini App)' },
    { command: 'telefon', description: '📞 Telefon raqamlarimiz' },
    { command: 'manzil', description: '📍 Do\'kon manzili va xaritalar' },
    { command: 'instagram', description: '📸 Rasmiy Instagram sahifamiz' },
    { command: 'youtube', description: '▶️ YouTube tyuning kanalimiz' },
    { command: 'buyurtma', description: '📦 Buyurtma holatini tekshirish' },
    { command: 'ishvaqti', description: '⏰ Ish vaqti va tartibi' },
    { command: 'tolov', description: '💳 To\'lov turlari (Uzcard, Humo, Visa, Naqd)' },
    { command: 'yetkazish', description: '🚚 Toshkent va viloyatlarga yetkazib berish' },
    { command: 'aloqa', description: '📞 Aloqa markazi va operatorlar' },
    { command: 'menyu', description: '🗂 Barcha bo\'limlar menyusi' },
    { command: 'help', description: 'ℹ️ Yordam va bot qo\'llanmasi' },
    { command: 'admin', description: '⚙️ Boshqaruv paneli (Admin)' }
  ]).catch(() => {});

  // /katalog buyrug'i
  bot.onText(/\/katalog/, async (msg) => {
    const chatId = String(msg.chat.id);
    const isHttps = WEB_APP_URL.startsWith('https://');
    bot.sendMessage(chatId,
      "🛒 <b>kuzavnoy.uzz — Avto Ehtiyot Qismlari Katalogi</b>\n\n" +
      "Bizning katalogimiz orqali avtomobilingiz uchun eng sifatli va original ehtiyot qismlarni tanlashingiz mumkin!\n\n" +
      "Ilovani ochish uchun pastdagi tugmani bosing: 👇",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: isHttps ? [
            [{ text: "🛒 Katalogni ochish (Mini App)", web_app: { url: WEB_APP_URL } }],
            [
              { text: "📸 Instagram", url: "https://instagram.com/kuzavnoy.uzz" },
              { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
            ]
          ] : [
            [{ text: "🌐 Katalogni ochish", url: WEB_APP_URL }]
          ]
        }
      }
    );
  });

  // /aloqa buyrug'i
  bot.onText(/\/aloqa/, async (msg) => {
    const chatId = String(msg.chat.id);
    try {
      const sRes = await pool.query('SELECT * FROM store_settings WHERE id=1');
      const st = sRes.rows[0] || {};
      const phones = [];
      if (st.phone1_active !== false && st.phone) phones.push(`• Asosiy: <b>${st.phone}</b>`);
      if (st.phone2_active !== false && st.phone2) phones.push(`• Call-markaz: <b>${st.phone2}</b>`);
      if (st.phone3_active !== false && st.phone3) phones.push(`• Texnik yordam: <b>${st.phone3}</b>`);
      if (phones.length === 0) phones.push('• Telefon: +998 90 123 45 67');

      const addr = st.store_address || "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori";
      const yandexMapUrl = st.store_location_url && st.store_location_url.trim() ? st.store_location_url : `https://yandex.uz/maps/?text=${encodeURIComponent(addr)}`;
      const googleMapUrl = st.store_location_url && st.store_location_url.trim() ? st.store_location_url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

      bot.sendMessage(chatId,
        "📞 <b>kuzavnoy.uzz — Aloqa & Qo'ng'iroq Markazi</b>\n\n" +
        "Har qanday avto ehtiyot qismlari, buyurtmalar va yetkazib berish bo'yicha savollaringiz bo'lsa biz bilan bog'laning:\n\n" +
        phones.join('\n') + "\n\n" +
        `📍 <b>Manzil:</b> ${addr}\n` +
        `⏰ <b>Ish vaqti:</b> ${st.store_hours || "09:00 - 19:00"}\n\n` +
        `Pastdagi tugmalar orqali lokatsiyani xaritada ko'rishingiz yoki do'konimizni ochishingiz mumkin: 👇`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Katalog & Xarid qilish", web_app: { url: WEB_APP_URL } }],
              [
                { text: "🗺 Yandex Karta", url: yandexMapUrl },
                { text: "📍 Google Maps", url: googleMapUrl }
              ],
              [
                { text: "📸 Instagram", url: st.instagram_url || "https://instagram.com/kuzavnoy.uzz" },
                { text: "▶️ YouTube", url: st.youtube_url || "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
              ]
            ]
          }
        }
      );
    } catch(e) {
      bot.sendMessage(chatId, "📞 Aloqa: +998 90 123 45 67\nManzil: Toshkent sh., Farhod avto bozori");
    }
  });

  // 1. /telefon — Do'kon telefon raqamlari
  bot.onText(/\/(?:telefon|raqam|nomer)/, async (msg) => {
    const chatId = String(msg.chat.id);
    try {
      const sRes = await pool.query('SELECT * FROM store_settings WHERE id=1');
      const st = sRes.rows[0] || {};
      const phones = [];
      if (st.phone1_active !== false && st.phone) phones.push(`• Asosiy: <b>${st.phone}</b>`);
      if (st.phone2_active !== false && st.phone2) phones.push(`• Savdo bo'limi: <b>${st.phone2}</b>`);
      if (st.phone3_active !== false && st.phone3) phones.push(`• Texnik maslahat: <b>${st.phone3}</b>`);
      if (phones.length === 0) phones.push('• Telefon: +998 90 123 45 67');

      const primaryPhone = (st.phone || '+998901234567').replace(/[^0-9+]/g, '');

      bot.sendMessage(chatId,
        "📞 <b>kuzavnoy.uzz — Telefon Raqamlarimiz</b>\n\n" +
        "Biz bilan to'g'ridan-to'g'ri bog'lanish uchun raqamlar:\n\n" +
        phones.join('\n') + "\n\n" +
        `⏰ <b>Qo'ng'iroqlarni qabul qilish:</b> ${st.store_hours || "09:00 - 19:00"} (Har kuni)\n` +
        "💬 <b>Telegram admin:</b> @azimxon_kuzavnoy\n\n" +
        "Pastdagi tugmalar orqali bir bosishda qo'ng'iroq qilishingiz mumkin: 👇",
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: `📞 Qo'ng'iroq: ${st.phone || "+998 90 123 45 67"}`, url: `tel:${primaryPhone}` }
              ],
              [
                { text: "💬 Telegramda yozish", url: "https://t.me/azimxon_kuzavnoy" },
                { text: "🛒 Katalogni ochish", web_app: { url: WEB_APP_URL } }
              ]
            ]
          }
        }
      );
    } catch(e) {
      bot.sendMessage(chatId, "📞 Telefon: +998 90 123 45 67 | +998 97 765 43 21\nIsh vaqti: 09:00 - 19:00");
    }
  });

  // 2. /instagram — Rasmiy Instagram sahifasi
  bot.onText(/\/(?:instagram|insta)/, async (msg) => {
    const chatId = String(msg.chat.id);
    let instaUrl = "https://instagram.com/kuzavnoy.uzz";
    try {
      const sRes = await pool.query('SELECT instagram_url FROM store_settings WHERE id=1');
      if (sRes.rows[0]?.instagram_url) instaUrl = sRes.rows[0].instagram_url;
    } catch(e) {}

    bot.sendMessage(chatId,
      "📸 <b>kuzavnoy.uzz — Rasmiy Instagram Sahifamiz!</b>\n\n" +
      "Bizning Instagram sahifamizda har kuni:\n" +
      "Yangi kelgan original zapchastlar va tyuning detallari\n" +
      "🎬 Rullar, barlar va oynalarni o'rnatish jarayonlari (Reels / Stories)\n" +
      "⭐️ Mijozlarimizning avtomobillari va fikrlari\n" +
      "🎁 Doimiy chegirmalar, aksiyalar va yangiliklar!\n\n" +
      "👉 <b>Kiring va obuna bo'ling:</b> @kuzavnoy.uzz",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "📸 Instagram sahifani ochish", url: instaUrl }],
            [{ text: "🛒 Do'konga kirish (Mini App)", web_app: { url: WEB_APP_URL } }]
          ]
        }
      }
    );
  });

  // 3. /youtube — Rasmiy YouTube kanal
  bot.onText(/\/youtube/, async (msg) => {
    const chatId = String(msg.chat.id);
    let ytUrl = "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G";
    try {
      const sRes = await pool.query('SELECT youtube_url FROM store_settings WHERE id=1');
      if (sRes.rows[0]?.youtube_url) ytUrl = sRes.rows[0].youtube_url;
    } catch(e) {}

    bot.sendMessage(chatId,
      "▶️ <b>kuzavnoy.uzz — Rasmiy YouTube Kanalimiz!</b>\n\n" +
      "YouTube kanalimizda siz uchun maxsus:\n" +
      "🎥 Avtomobillarga sport rullar va barlarni o'rnatish videolari\n" +
      "🚗 Malibu, Cobalt, Gentra, Tracker uchun sifatli detallar obzori\n" +
      "💡 Benson akustik labavoy oynalari va furalar haqida mutaxassis maslahatlari\n\n" +
      "👉 <b>Kanalimizga obuna bo'ling va qiziqarli videolarni tomosha qiling!</b>",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "▶️ YouTube kanalni ochish", url: ytUrl }],
            [{ text: "🛒 Do'konga kirish (Mini App)", web_app: { url: WEB_APP_URL } }]
          ]
        }
      }
    );
  });

  // 4. /manzil — Do'kon lokatsiyasi va xaritalar
  bot.onText(/\/(?:manzil|lokatsiya|location|karta)/, async (msg) => {
    const chatId = String(msg.chat.id);
    try {
      const sRes = await pool.query('SELECT store_address, store_location_url, store_hours FROM store_settings WHERE id=1');
      const st = sRes.rows[0] || {};
      const addr = st.store_address || "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori";
      const yandexMapUrl = st.store_location_url && st.store_location_url.trim() ? st.store_location_url : `https://yandex.uz/maps/?text=${encodeURIComponent(addr)}`;
      const googleMapUrl = st.store_location_url && st.store_location_url.trim() ? st.store_location_url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

      bot.sendMessage(chatId,
        "📍 <b>kuzavnoy.uzz — Do'kon Manzili & Lokatsiya</b>\n\n" +
        `🏢 <b>Manzil:</b> ${addr}\n` +
        "🧭 <b>Mo'ljal:</b> Farhod avto bozori, kuzavnoy.uzz do'koni\n" +
        "🚗 <b>Avtoturargoh:</b> Mijozlar uchun qulay bepul to'xtash joyi mavjud\n" +
        `⏰ <b>Ish vaqti:</b> ${st.store_hours || "09:00 - 19:00"} (Dam olish kunlarisiz)\n\n` +
        "Xaritada ko'rish va yo'nalish (navigator) chizish uchun tugmani bosing: 👇",
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🗺 Yandex Karta (Navigator)", url: yandexMapUrl },
                { text: "📍 Google Maps", url: googleMapUrl }
              ],
              [
                { text: "🛒 Do'kondan xarid qilish", web_app: { url: WEB_APP_URL } }
              ]
            ]
          }
        }
      );
    } catch(e) {
      bot.sendMessage(chatId, "📍 Manzil: Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori\nIsh vaqti: 09:00 - 19:00");
    }
  });

  // 5. /ishvaqti — Do'kon ish vaqti
  bot.onText(/\/(?:ishvaqti|rejim|vaqt)/, async (msg) => {
    const chatId = String(msg.chat.id);
    try {
      const sRes = await pool.query('SELECT store_hours, store_address FROM store_settings WHERE id=1');
      const st = sRes.rows[0] || {};
      bot.sendMessage(chatId,
        "⏰ <b>kuzavnoy.uzz — Ish Vaqti va Ish Tartibi:</b>\n\n" +
        `🏬 <b>Do'konimiz:</b> ${st.store_address || "Toshkent sh., Farhod avto bozori"}\n` +
        `• Ish kunlari: <b>Dushanba — Yakshanba (Har kuni)</b>\n` +
        `• Ish soatlari: <b>${st.store_hours || "09:00 — 19:00"}</b>\n` +
        "• Tushlik tanaffusisiz va dam olish kunlarisiz!\n\n" +
        "🚚 <b>Tezkor Kuryerlik:</b> Toshkent bo'yicha 09:00 dan 21:00 gacha\n" +
        "🤖 <b>Telegram Mini App orqali:</b> 24/7 (Kechayu-kunduz onlayn buyurtma bera olasiz)",
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Hozir buyurtma berish (Mini App)", web_app: { url: WEB_APP_URL } }],
              [{ text: "📞 Bog'lanish", callback_data: "cmd_phone" }]
            ]
          }
        }
      );
    } catch(e) {
      bot.sendMessage(chatId, "⏰ Ish vaqti: Har kuni 09:00 dan 19:00 gacha (Dam olish kunlarisiz)");
    }
  });

  // 6. /buyurtma [ID] — Buyurtma holatini tekshirish
  bot.onText(/\/(?:buyurtma|status|order)(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const orderIdArg = match && match[1] ? parseInt(match[1]) : null;

    try {
      let order = null;
      if (orderIdArg) {
        const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderIdArg]);
        if (oRes.rows.length > 0) order = oRes.rows[0];
      } else {
        // Oxirgi buyurtmasini olish
        const oRes = await pool.query('SELECT * FROM orders WHERE telegram_id = $1 ORDER BY id DESC LIMIT 1', [chatId]);
        if (oRes.rows.length > 0) order = oRes.rows[0];
      }

      if (!order) {
        return bot.sendMessage(chatId,
          "ℹ️ <b>Sizda hali buyurtmalar mavjud emas!</b>\n\n" +
          "Agar ma'lum bir buyurtmangiz holatini bilmoqchi bo'lsangiz:\n" +
          "<code>/buyurtma [raqam]</code> (Masalan: <code>/buyurtma 15</code>) yuboring.\n\n" +
          "Yangi buyurtma berish uchun quyidagi tugmani bosing: 👇",
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: "🛒 Katalogni ochish", web_app: { url: WEB_APP_URL } }]]
            }
          }
        );
      }

      let statusEmoji = "🟡";
      if (order.status === "Jarayonda") statusEmoji = "🔵";
      else if (order.status === "Tayyorlandi") statusEmoji = "📦";
      else if (order.status === "Yetkazildi") statusEmoji = "🟢";
      else if (order.status === "Bekor qilindi") statusEmoji = "🔴";

      const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
      const itemsList = items.map((it, i) => `  ${i + 1}. ${it.name} (${it.quantity || 1} dona)`).join('\n');

      bot.sendMessage(chatId,
        `📦 <b>Buyurtma Holati: #KZV-${order.id}</b>\n\n` +
        `📅 <b>Sana:</b> ${new Date(order.created_at).toLocaleString('uz-UZ')}\n` +
        `📊 <b>Holati:</b> ${statusEmoji} <b>${order.status}</b>\n` +
        `💵 <b>Jami summa:</b> <b>${(order.total_price || 0).toLocaleString()} so'm</b>\n` +
        `🚚 <b>Yetkazish:</b> ${order.delivery_type === 'pickup' ? "🏬 Do'kondan olib ketish (Samovivoz)" : "🚚 Kuryer orqali"}\n` +
        `💳 <b>To'lov turi:</b> ${order.payment_method === 'card' ? "💳 Karta" : "💵 Naqd"}\n\n` +
        `<b>Xarid qilingan detallar:</b>\n${itemsList}\n\n` +
        "Barcha buyurtmalaringiz tarixini do'konimiz «Profil» bo'limida ko'rishingiz mumkin: 👇",
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 Profil & Barcha buyurtmalar", web_app: { url: WEB_APP_URL } }],
              [{ text: "📞 Savol bo'yicha bog'lanish", url: "https://t.me/azimxon_kuzavnoy" }]
            ]
          }
        }
      );
    } catch(e) {
      bot.sendMessage(chatId, "Buyurtma ma'lumotlarini yuklashda xatolik yuz berdi.");
    }
  });

  // 7. /tolov — To'lov turlari va qoidalari
  bot.onText(/\/(?:tolov|to'lov|payment)/, async (msg) => {
    const chatId = String(msg.chat.id);
    bot.sendMessage(chatId,
      "💳 <b>kuzavnoy.uzz — To'lov Usullari va Shartlari:</b>\n\n" +
      "Bizda mijozlar uchun barcha qulay va xavfsiz to'lov turlari mavjud:\n\n" +
      "1. 💵 <b>Naqd pul (Yetkazilganda yoki Do'konda):</b>\n" +
      "   Tovarni qabul qilib olib, tekshirib ko'rganingizdan so'ng to'lashingiz mumkin.\n\n" +
      "2. 💳 <b>Karta orqali to'lov (Uzcard / Humo / Visa):</b>\n" +
      "   Click, Payme yoki bank kartalari orqali xavfsiz to'lov o'tkazishingiz mumkin.\n\n" +
      "3. 🟢 <b>1% Soliq Fiskal Keshbek:</b>\n" +
      "   Har bir xaridingiz uchun rasmiy fiskal chek taqdim etiladi. Soliq ilovasida QR-kodni skanerlab, 1% keshbek olishingiz mumkin!\n\n" +
      "Xarid qilish uchun pastdagi tugmani bosing: 👇",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Xaridni boshlash (Mini App)", web_app: { url: WEB_APP_URL } }]]
        }
      }
    );
  });

  // 8. /yetkazish — Yetkazib berish shartlari
  bot.onText(/\/(?:yetkazish|dostavka|delivery)/, async (msg) => {
    const chatId = String(msg.chat.id);
    bot.sendMessage(chatId,
      "🚚 <b>kuzavnoy.uzz — Yetkazib Berish Xizmati:</b>\n\n" +
      "🚀 <b>Toshkent shahri bo'ylab:</b>\n" +
      "• Tezkor kuryerlik yetkazishi — buyurtma berilganidan so'ng <b>2 soat ichida</b> yetkaziladi!\n" +
      "• Eshigingizgacha xavfsiz yetkazib berish kafolatlanadi.\n\n" +
      "📦 <b>O'zbekistonning barcha viloyatlariga:</b>\n" +
      "• BTS Pochta, Fargo yoki viloyat taksilari (Damas / Pitak) orqali <b>1 kunda</b> yetkaziladi.\n" +
      "• Barcha qismlar sinmaydigan, zarbaga chidamli maxsus qutilarga o'raladi!\n\n" +
      "🏬 <b>Do'kondan olib ketish (Samovivoz):</b>\n" +
      "• Farhod avto ehtiyot qismlar bozori, kuzavnoy.uzz do'konimizdan bepul olib ketishingiz mumkin.\n\n" +
      "Savollaringiz bo'lsa, mutaxassislarimiz bilan bog'laning: 👇",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Do'konni ochish (Mini App)", web_app: { url: WEB_APP_URL } }],
            [{ text: "📞 Kuryer bilan bog'lanish", url: "https://t.me/azimxon_kuzavnoy" }]
          ]
        }
      }
    );
  });

  // 9. /menyu — Barcha imkoniyatlar menyusi
  bot.onText(/\/(?:menyu|menu)/, async (msg) => {
    const chatId = String(msg.chat.id);
    const firstName = msg.from.first_name || 'Hurmatli mijoz';

    bot.sendMessage(chatId,
      `🗂 <b>kuzavnoy.uzz — Asosiy Menyu</b>\n\n` +
      `Assalomu alaykum, <b>${firstName}</b>!\n` +
      "Quyidagi tugmalardan birini tanlang yoki kerakli ma'lumotni oling: 👇",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Do'kon & Katalog (Mini App)", web_app: { url: WEB_APP_URL } }],
            [
              { text: "📞 Telefonlar", callback_data: "cmd_phone" },
              { text: "📍 Manzil & Xarita", callback_data: "cmd_map" }
            ],
            [
              { text: "📸 Instagram", url: "https://instagram.com/kuzavnoy.uzz" },
              { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
            ],
            [
              { text: "📦 Buyurtmam holati", callback_data: "cmd_order" },
              { text: "⏰ Ish vaqti", callback_data: "cmd_hours" }
            ],
            [
              { text: "💳 To'lov turlari", callback_data: "cmd_payment" },
              { text: "🚚 Yetkazib berish", callback_data: "cmd_delivery" }
            ]
          ]
        }
      }
    );
  });

  // /register va /profil — Qaytadan ro'yxatdan o'tish yoki ma'lumotlarni yangilash
  bot.onText(/\/(?:register|profil|qaytadan|royxat)/, async (msg) => {
    const chatId = String(msg.chat.id);
    const firstName = msg.from.first_name || 'Mijoz';
    userRegStates.set(chatId, { step: 'ASK_NAME' });
    await bot.sendMessage(chatId,
      "📝 <b>kuzavnoy.uzz — Ro'yxatdan o'tish / Profilni yangilash</b>\n\n" +
      "Assalomu alaykum, <b>" + escapeHtml(firstName) + "</b>!\n\n" +
      "Iltimos, buyurtmalarni rasmiylashtirish uchun <b>Ism va Familiyangizni</b> kiriting: 👇",
      {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      }
    );
  });

  // /help buyrug'i
  bot.onText(/\/help/, async (msg) => {
    const chatId = String(msg.chat.id);
    bot.sendMessage(chatId,
      "ℹ️ <b>kuzavnoy.uzz — Yordam & Qo'llanma</b>\n\n" +
      "🔹 <b>Mavjud Buyruqlar:</b>\n" +
      "• /katalog — Ehtiyot qismlar do'koni (Mini App)\n" +
      "• /telefon — Do'kon telefon raqamlari\n" +
      "• /manzil — Do'kon manzili va xaritalar\n" +
      "• /instagram — Rasmiy Instagram sahifamiz\n" +
      "• /youtube — YouTube tyuning kanalimiz\n" +
      "• /buyurtma — Buyurtma holatini tekshirish\n" +
      "• /ishvaqti — Ish vaqti va tartibi\n" +
      "• /tolov — To'lov turlari va qoidalari\n" +
      "• /yetkazish — Yetkazib berish shartlari\n" +
      "• /aloqa — Aloqa markazi va operatorlar\n" +
      "• /menyu — Asosiy bo'limlar menyusi\n" +
      "• /admin — Boshqaruv paneli (xodimlar uchun)\n\n" +
      "🛒 Buyurtma berish uchun quyidagi tugmani bosing: 👇",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Mini Appni ochish", web_app: { url: WEB_APP_URL } }]]
        }
      }
    );
  });

  
  // 1. /invite_admin (yoki /taklif) — FAQAT BOSH ADMIN (FOUNDER) UCHUN
  bot.onText(/\/(?:invite_admin|taklif)/, async (msg) => {
    const chatId = String(msg.chat.id);
    if (chatId !== HEAD_ADMIN_ID) {
      return bot.sendMessage(chatId, 
        "⛔️ <b>Ruxsat berilmadi!</b>\n\n" +
        "Yangi admin taklif qilish faqat do'kon <b>Bosh Admini (Founder)</b> vakolatida! Oddiy adminlar boshqalarni taklif qila olmaydi.", 
        { parse_mode: 'HTML' }
      );
    }

    const crypto = require('crypto');
    const token = 'adm_' + crypto.randomBytes(4).toString('hex');
    activeAdminInvites.set(token, {
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 daqiqa
    });

    let botUsername = 'kuzavnoyuz_bot';
    try {
      const me = await bot.getMe();
      if (me && me.username) botUsername = me.username;
    } catch(e) {}

    const inviteLink = `https://t.me/${botUsername}?start=${token}`;

    bot.sendMessage(chatId,
      "👑 <b>Bosh Admin (Founder) — Bir Martalik Taklif Havolasi</b>\n\n" +
      "Yangi sotuvchi yoki menejeringizga ushbu xavfsiz havolani yuboring:\n" +
      `👉 <code>${inviteLink}</code>\n\n` +
      "🔒 <b>Xavfsizlik kafolati:</b>\n" +
      "• Ushbu havola <b>faqat 1 marta</b> ishlaydi (xodim bosishi bilanoq kuyadi).\n" +
      "• Amal qilish muddati: <b>15 daqiqa</b>.\n" +
      "• Hech qanday parol yoki PIN kod talab etilmaydi.\n" +
      "• Xodim havolani bosganda avtomatik oddiy admin bo'ladi va sizga xabar keladi.",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Havolani yuborish (Share)", url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("kuzavnoy.uzz do'koniga adminlik taklifi")}` }]
          ]
        }
      }
    );
  });

  // 2. /add_admin <telegram_id> — FAQAT BOSH ADMIN (FOUNDER) UCHUN
  bot.onText(/\/add_admin(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    if (chatId !== HEAD_ADMIN_ID) {
      return bot.sendMessage(chatId, 
        "⛔️ <b>Ruxsat berilmadi!</b>\n\n" +
        "Yangi admin tayinlash faqat do'kon <b>Bosh Admini (Founder)</b> vakolatida! Oddiy adminlar boshqalarni admin qila olmaydi.", 
        { parse_mode: 'HTML' }
      );
    }
    const targetId = match && match[1] ? match[1].trim() : '';
    if (!targetId) {
      return bot.sendMessage(chatId, "ℹ️ <b>Foydalanish:</b> <code>/add_admin &lt;telegram_id&gt;</code>\n\nMasalan: <code>/add_admin 987654321</code>", { parse_mode: 'HTML' });
    }
    if (ADMIN_CHAT_IDS.includes(targetId)) {
      return bot.sendMessage(chatId, `ℹ️ Bu foydalanuvchi (ID: <code>${targetId}</code>) allaqachon adminlar ro'yxatida mavjud.`, { parse_mode: 'HTML' });
    }

    ADMIN_CHAT_IDS.push(targetId);
    await saveAdminsToDb();

    bot.sendMessage(chatId, `✅ <b>Muvaffaqiyatli!</b>\n\nFoydalanuvchi (ID: <code>${targetId}</code>) oddiy admin sifatida saqlab qo'yildi! 🎉`, { parse_mode: 'HTML' });

    try {
      const isHttps = WEB_APP_URL.startsWith('https://');
      bot.sendMessage(targetId, 
        "🎉 <b>Tabriklaymiz!</b>\n\n" +
        "Bosh Admin (Founder) sizni <b>kuzavnoy.uzz</b> do'konining administratori etib tayinladi! 🚀\n\n" +
        "Boshqaruv paneliga kirish uchun pastdagi tugmani bosing: 👇",
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: isHttps ? [
              [{ text: "📊 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }],
              [{ text: "🛒 Do'konni ochish (Mini App)", web_app: { url: WEB_APP_URL } }]
            ] : [
              [{ text: "📊 Admin Dashboardni ochish", url: `${WEB_APP_URL}/admin` }]
            ]
          }
        }
      );
    } catch(e) {}
  });

  // 3. /remove_admin <telegram_id> — FAQAT BOSH ADMIN (FOUNDER) UCHUN
  bot.onText(/\/remove_admin(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    if (chatId !== HEAD_ADMIN_ID) {
      return bot.sendMessage(chatId, 
        "⛔️ <b>Ruxsat berilmadi!</b>\n\n" +
        "Adminni o'chirish faqat do'kon <b>Bosh Admini (Founder)</b> vakolatida!", 
        { parse_mode: 'HTML' }
      );
    }
    const targetId = match && match[1] ? match[1].trim() : '';
    if (!targetId) {
      return bot.sendMessage(chatId, "ℹ️ <b>Foydalanish:</b> <code>/remove_admin &lt;telegram_id&gt;</code>\n\nMasalan: <code>/remove_admin 987654321</code>", { parse_mode: 'HTML' });
    }
    if (targetId === HEAD_ADMIN_ID) {
      return bot.sendMessage(chatId, "⚠️ <b>Bosh Adminni (Founder) o'chirib bo'lmaydi!</b>", { parse_mode: 'HTML' });
    }
    if (!ADMIN_CHAT_IDS.includes(targetId)) {
      return bot.sendMessage(chatId, "❌ Ushbu ID adminlar ro'yxatida topilmadi.", { parse_mode: 'HTML' });
    }

    ADMIN_CHAT_IDS = ADMIN_CHAT_IDS.filter(id => id !== targetId);
    await saveAdminsToDb();

    bot.sendMessage(chatId, `✅ Foydalanuvchi (ID: <code>${targetId}</code>) adminlar ro'yxatidan muvaffaqiyatli o'chirildi.`, { parse_mode: 'HTML' });

    try {
      bot.sendMessage(targetId, "ℹ️ Sizning <b>kuzavnoy.uzz</b> tizimidagi adminlik vakolatingiz to'xtatildi.", { parse_mode: 'HTML' });
    } catch(e) {}
  });

  // 4. /admins — Barcha faol adminlar ro'yxati
  bot.onText(/\/admins/, async (msg) => {
    const chatId = String(msg.chat.id);
    if (!ADMIN_CHAT_IDS.includes(chatId)) {
      return bot.sendMessage(chatId, "⛔️ Ushbu buyruq faqat adminlar uchun.");
    }

    const isHead = (chatId === HEAD_ADMIN_ID);
    let text = "👥 <b>kuzavnoy.uzz — Do'kon Ma'muriyati:</b>\n\n";
    text += `👑 <b>Bosh Admin (Founder):</b> <code>${HEAD_ADMIN_ID}</code> ${isHead ? '<i>(Siz)</i>' : ''}\n\n`;

    const subAdmins = ADMIN_CHAT_IDS.filter(id => id !== HEAD_ADMIN_ID);
    if (subAdmins.length === 0) {
      text += "<i>Hozircha qo'shimcha oddiy adminlar yo'q.</i>\n";
    } else {
      text += "👤 <b>Do'kon Adminlari (Menejerlar):</b>\n";
      subAdmins.forEach((id, idx) => {
        text += `${idx + 1}. <code>${id}</code> ${id === chatId ? '<i>(Siz)</i>' : ''}\n`;
      });
    }

    if (isHead) {
      text += "\n👑 <b>Bosh Admin Buyruqlari:</b>\n" +
              "• /invite_admin — Bir martalik taklif havolasi yaratish\n" +
              "• /add_admin &lt;id&gt; — Yangi admin qo'shish\n" +
              "• /remove_admin &lt;id&gt; — Adminni o'chirish";
    } else {
      text += "\nℹ️ <i>Siz do'konda oddiy adminsiz (buyurtmalar va tovarlar bilan ishlaysiz). Admin qo'shish yoki o'chirish faqat Bosh Admin vakolatida.</i>";
    }

    const buttons = [];
    if (isHead) {
      subAdmins.forEach(id => {
        buttons.push([{ text: `❌ ID: ${id} ni o'chirish`, callback_data: `rem_adm_${id}` }]);
      });
      buttons.push([{ text: "🔗 Bir martalik taklif havolasi olish", callback_data: "gen_invite_btn" }]);
    }

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
    });
  });

  // 5. /admin_login buyrug'i — Parol tizimi butunlay bekor qilingan
  bot.onText(/\/admin_login/, async (msg) => {
    bot.sendMessage(String(msg.chat.id),
      "🔒 <b>Xavfsizlik choralari kuchaytirilgan!</b>\n\n" +
      "Parol orqali kirish tizimi xavfsizlik maqsadida bekor qilingan.\n" +
      "Yangi xodimlar faqat <b>Bosh Admin (Founder)</b> yuborgan <b>Bir Martalik Taklif Havolasi</b> yoki tasdiqlashi orqali qo'shiladi.",
      { parse_mode: 'HTML' }
    );
  });

  // 6. /admin buyrug'i
  bot.onText(/\/admin$/, async (msg) => {
    const chatId = String(msg.chat.id);
    const firstName = msg.from.first_name || 'Admin';

    if (!ADMIN_CHAT_IDS.includes(chatId)) {
      return bot.sendMessage(chatId, 
        "⛔️ <b>Kirish taqiqlangan!</b>\n\n" +
        "Ushbu bo'lim faqat <b>kuzavnoy.uzz</b> do'koni xodimlari uchun mo'ljallangan.\n" +
        `Sizning Telegram ID: <code>${chatId}</code>\n\n` +
        "Agar siz ushbu do'kon xodimi bo'lsangiz, Bosh Adminga (Founder) adminlik so'rovini yuborishingiz mumkin: 👇", 
        { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "📩 Bosh adminga so'rov yuborish", callback_data: `req_admin_${chatId}` }]
            ]
          }
        }
      );
    }

    const isHttps = WEB_APP_URL.startsWith('https://');
    const isHead = (chatId === HEAD_ADMIN_ID);

    const adminButtons = isHttps ? [
      [{ text: "📊 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }],
      [{ text: "👥 Adminlar ro'yxati", callback_data: 'view_admins_list' }],
      ...(isHead ? [[{ text: "🔗 Yangi admin taklif qilish (Havola)", callback_data: 'gen_invite_btn' }]] : []),
      [{ text: "🛒 Mijoz do'koni (Mini App)", web_app: { url: WEB_APP_URL } }]
    ] : [
      [{ text: "📊 Admin Dashboardni ochish", url: `${WEB_APP_URL}/admin` }]
    ];

    await bot.sendMessage(chatId, "👨‍💼 Boshqaruv menyusi", {
      reply_markup: { remove_keyboard: true }
    }).catch(() => {});

    bot.sendMessage(chatId, 
      `👨‍💼 <b>kuzavnoy.uzz — Boshqaruv Paneli</b>\n\n` +
      `Xush kelibsiz, <b>${firstName}</b>!\n` +
      `Maqomingiz: ${isHead ? '👑 <b>Bosh Admin (Founder)</b>' : '👤 <b>Admin (Menejer)</b>'}\n\n` +
      `Pastdagi tugmani bosib, Telegram ichida do'konni boshqarishingiz mumkin! 👇`, 
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: adminButtons }
      }
    );
  });

  // 7. Callback Query Handler (Faqat Bosh Admin tasdiqlashi uchun)
  bot.on('callback_query', async (query) => {
    const data = query.data;
    const fromId = String(query.from.id);

    try {
      // Menyu tezkor javoblari
      if (data === 'cmd_phone') {
        await bot.answerCallbackQuery(query.id);
        const sRes = await pool.query('SELECT phone, phone2, phone3 FROM store_settings WHERE id=1');
        const st = sRes.rows[0] || {};
        return bot.sendMessage(fromId,
          "📞 <b>Do'konimiz Telefon Raqamlari:</b>\n\n" +
          `• Asosiy: <b>${st.phone || "+998 90 123 45 67"}</b>\n` +
          (st.phone2 ? `• Savdo: <b>${st.phone2}</b>\n` : "") +
          (st.phone3 ? `• Texnik yordam: <b>${st.phone3}</b>\n` : "") +
          "\nTelegram: @azimxon_kuzavnoy",
          { parse_mode: 'HTML' }
        );
      }
      if (data === 'cmd_map') {
        await bot.answerCallbackQuery(query.id);
        const sRes = await pool.query('SELECT store_address, store_location_url FROM store_settings WHERE id=1');
        const st = sRes.rows[0] || {};
        const addr = st.store_address || "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori";
        const yMap = st.store_location_url || `https://yandex.uz/maps/?text=${encodeURIComponent(addr)}`;
        const gMap = st.store_location_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
        return bot.sendMessage(fromId,
          `📍 <b>Do'kon Manzili:</b> ${addr}\n\nFarhod avto bozori, kuzavnoy.uzz do'koni.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🗺 Yandex Karta", url: yMap }, { text: "📍 Google Maps", url: gMap }]
              ]
            }
          }
        );
      }
      if (data === 'cmd_hours') {
        await bot.answerCallbackQuery(query.id);
        const sRes = await pool.query('SELECT store_hours FROM store_settings WHERE id=1');
        const st = sRes.rows[0] || {};
        return bot.sendMessage(fromId,
          `⏰ <b>Ish Vaqti:</b> Har kuni <b>${st.store_hours || "09:00 - 19:00"}</b>\nTushliksiz va dam olish kunlarisiz!`,
          { parse_mode: 'HTML' }
        );
      }
      if (data === 'cmd_order') {
        await bot.answerCallbackQuery(query.id);
        const oRes = await pool.query('SELECT id, status, total_price FROM orders WHERE telegram_id=$1 ORDER BY id DESC LIMIT 1', [fromId]);
        if (oRes.rows.length === 0) {
          return bot.sendMessage(fromId, "📦 Sizda hali faol buyurtmalar yo'q. Katalogimizdan buyurtma berishingiz mumkin: /katalog");
        }
        const o = oRes.rows[0];
        return bot.sendMessage(fromId, `📦 <b>Oxirgi buyurtmangiz: #KZV-${o.id}</b>\nHolati: <b>${o.status}</b>\nJami summa: <b>${o.total_price.toLocaleString()} so'm</b>`, { parse_mode: 'HTML' });
      }
      if (data === 'cmd_payment') {
        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(fromId, "💳 <b>To'lov usullari:</b> Naqd pul, Uzcard, Humo, Visa va Click/Payme. Soliq 1% keshbek taqdim etiladi!", { parse_mode: 'HTML' });
      }
      if (data === 'cmd_delivery') {
        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(fromId, "🚚 <b>Yetkazib berish:</b> Toshkent bo'yicha 2 soatda, viloyatlarga BTS pochta yoki taksi bilan 1 kunda yetkaziladi.", { parse_mode: 'HTML' });
      }

      // 7.1 Xodimdan Bosh Adminga so'rov yuborish
      if (data && data.startsWith('req_admin_')) {
        const targetId = data.replace('req_admin_', '');
        const senderName = query.from.first_name || 'Foydalanuvchi';
        const senderUser = query.from.username ? `@${query.from.username}` : 'username yo\'q';

        await bot.answerCallbackQuery(query.id, {
          text: "✅ So'rovingiz do'kon egasiga (Bosh Adminga) yuborildi!",
          show_alert: true
        });

        await bot.editMessageText(
          `⏳ <b>Adminlik so'rovi yuborildi!</b>\n\n` +
          `Sizning Telegram ID: <code>${targetId}</code>\n` +
          `Bosh Admin (Founder) so'rovingizni tasdiqlashi bilan sizga xabar yuboriladi.`,
          {
            chat_id: fromId,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          }
        );

        // Faqat Bosh Adminga so'rov yuboriladi!
        try {
          await bot.sendMessage(HEAD_ADMIN_ID,
            `👑 <b>BOSH ADMIN NAZORATI:</b>\n` +
            `🔔 <b>YANGI ADMINLIK SO'ROVI!</b>\n\n` +
            `👤 <b>Ism:</b> ${senderName}\n` +
            `🔗 <b>Profil:</b> ${senderUser}\n` +
            `🆔 <b>Telegram ID:</b> <code>${targetId}</code>\n\n` +
            `Ushbu xodimga do'konning oddiy adminlik huquqini berishni tasdiqlaysizmi?\n` +
            `<i>(Oddiy admin faqat buyurtmalar bilan ishlaydi, boshqalarga admin bera olmaydi)</i>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Tasdiqlash (Admin qilish)", callback_data: `appr_adm_${targetId}` },
                    { text: "❌ Rad etish", callback_data: `rejc_adm_${targetId}` }
                  ]
                ]
              }
            }
          );
        } catch(err) {}
      }

      // 7.2 FAQAT Bosh Admin tomonidan tasdiqlash
      else if (data && data.startsWith('appr_adm_')) {
        if (fromId !== HEAD_ADMIN_ID) {
          return bot.answerCallbackQuery(query.id, { text: "⛔️ Faqat Bosh Admin (Founder) tasdiqlay oladi!", show_alert: true });
        }
        const targetId = data.replace('appr_adm_', '');
        if (!ADMIN_CHAT_IDS.includes(targetId)) {
          ADMIN_CHAT_IDS.push(targetId);
          await saveAdminsToDb();
        }

        await bot.answerCallbackQuery(query.id, { text: "✅ Admin muvaffaqiyatli qo'shildi!" });
        await bot.editMessageText(
          `${query.message.text}\n\n➖➖➖➖➖➖➖➖➖➖\n✅ <b>TASDIQLANDI:</b> Foydalanuvchi (ID: <code>${targetId}</code>) oddiy admin etib tayinlandi! (Bosh Admin tasdiqladi)`,
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          }
        );

        // Yangi adminga xush kelibsiz xabari
        try {
          const isHttps = WEB_APP_URL.startsWith('https://');
          await bot.sendMessage(targetId,
            "🎉 <b>Tabriklaymiz!</b>\n\n" +
            "Bosh Admin (Founder) sizning adminlik so'rovingizni tasdiqladi! 🚀\n" +
            "Endi siz <b>kuzavnoy.uzz</b> do'konining administratori etib tayinlandingiz.\n\n" +
            "Pastdagi tugma orqali Admin Dashboardga kiring: 👇",
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: isHttps ? [
                  [{ text: "📊 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }]
                ] : [
                  [{ text: "📊 Admin Dashboardni ochish", url: `${WEB_APP_URL}/admin` }]
                ]
              }
            }
          );
        } catch(e) {}
      }

      // 7.3 FAQAT Bosh Admin tomonidan rad etish
      else if (data && data.startsWith('rejc_adm_')) {
        if (fromId !== HEAD_ADMIN_ID) {
          return bot.answerCallbackQuery(query.id, { text: "⛔️ Faqat Bosh Admin (Founder) rad eta oladi!", show_alert: true });
        }
        const targetId = data.replace('rejc_adm_', '');
        await bot.answerCallbackQuery(query.id, { text: "So'rov rad etildi" });
        await bot.editMessageText(
          `${query.message.text}\n\n➖➖➖➖➖➖➖➖➖➖\n❌ <b>RAD ETILDI:</b> Bu foydalanuvchiga ruxsat berilmadi.`,
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          }
        );

        try {
          await bot.sendMessage(targetId, "❌ Kechirasiz, do'kon egasi sizning adminlik so'rovingizni rad etdi.");
        } catch(e) {}
      }

      // 7.4 FAQAT Bosh Admin tomonidan o'chirish
      else if (data && data.startsWith('rem_adm_')) {
        if (fromId !== HEAD_ADMIN_ID) {
          return bot.answerCallbackQuery(query.id, { text: "⛔️ Faqat Bosh Admin o'chira oladi!", show_alert: true });
        }
        const targetId = data.replace('rem_adm_', '');
        if (targetId === HEAD_ADMIN_ID) {
          return bot.answerCallbackQuery(query.id, { text: "Bosh Adminni o'chirib bo'lmaydi!", show_alert: true });
        }
        ADMIN_CHAT_IDS = ADMIN_CHAT_IDS.filter(id => id !== targetId);
        await saveAdminsToDb();

        await bot.answerCallbackQuery(query.id, { text: `ID: ${targetId} o'chirildi!` });
        await bot.sendMessage(query.message.chat.id, `✅ Foydalanuvchi (ID: <code>${targetId}</code>) adminlikdan chiqarildi.`, { parse_mode: 'HTML' });
      }

      // 7.5 Bir martalik taklif havolasi yaratish tugmasi
      else if (data === 'gen_invite_btn') {
        if (fromId !== HEAD_ADMIN_ID) {
          return bot.answerCallbackQuery(query.id, { text: "⛔️ Faqat Bosh Admin havola yarata oladi!", show_alert: true });
        }
        await bot.answerCallbackQuery(query.id);

        const crypto = require('crypto');
        const token = 'adm_' + crypto.randomBytes(4).toString('hex');
        activeAdminInvites.set(token, {
          createdAt: Date.now(),
          expiresAt: Date.now() + 15 * 60 * 1000
        });

        let botUsername = 'kuzavnoyuz_bot';
        try {
          const me = await bot.getMe();
          if (me && me.username) botUsername = me.username;
        } catch(e) {}

        const inviteLink = `https://t.me/${botUsername}?start=${token}`;

        await bot.sendMessage(fromId,
          "👑 <b>Bosh Admin — Bir Martalik Taklif Havolasi</b>\n\n" +
          "Yangi sotuvchi/ishchingizga ushbu havolani yuboring:\n" +
          `👉 <code>${inviteLink}</code>\n\n` +
          "• Faqat 1 marta ishlaydi.\n" +
          "• Muddati: 15 daqiqa.",
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "📤 Havolani ulashish (Share)", url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("kuzavnoy.uzz adminlik taklifi")}` }]
              ]
            }
          }
        );
      }

      // 7.6 Adminlar ro'yxatini ko'rish
      else if (data === 'view_admins_list') {
        if (!ADMIN_CHAT_IDS.includes(fromId)) {
          return bot.answerCallbackQuery(query.id, { text: "Ruxsat yo'q" });
        }
        await bot.answerCallbackQuery(query.id);
        const isHead = (fromId === HEAD_ADMIN_ID);
        let text = "👥 <b>kuzavnoy.uzz — Do'kon Ma'muriyati:</b>\n\n";
        text += `👑 <b>Bosh Admin (Founder):</b> <code>${HEAD_ADMIN_ID}</code>\n\n`;
        const subAdmins = ADMIN_CHAT_IDS.filter(id => id !== HEAD_ADMIN_ID);
        if (subAdmins.length === 0) {
          text += "<i>Qo'shimcha adminlar yo'q.</i>\n";
        } else {
          text += "👤 <b>Oddiy Adminlar:</b>\n";
          subAdmins.forEach((id, idx) => {
            text += `${idx + 1}. <code>${id}</code>\n`;
          });
        }
        if (isHead) {
          text += "\n💡 <i>Admin taklif qilish: /invite_admin\nAdmin o'chirish: /remove_admin &lt;id&gt;</i>";
        }
        await bot.sendMessage(fromId, text, { parse_mode: 'HTML' });
      }
    } catch(err) {
      console.error('Callback query error:', err.message);
    }
  });

  // Foydalanuvchiga doimiy menyu va 1-rasmiy postni yuborish funksiyasi
  const sendWelcomePost = async (chatId, userName) => {
    const isHttps = WEB_APP_URL.startsWith('https://');
    const isAdmin = ADMIN_CHAT_IDS.includes(String(chatId));

    const welcomeText = 
      `Assalomu alaykum, <b>${escapeHtml(userName)}</b>!\n\n` +
      `🚗 <b>kuzavnoy.uzz — Professional Avto Ehtiyot Qismlari va Tyuning Markazi</b>\n\n` +
      `Biz avtomobilingiz uchun 100% original, kafolatlangan va yuqori sifatli ehtiyot qismlar, salon aksessuarlari va kuzov jihozlarini yetkazib beramiz.\n\n` +
      `🔹 <b>Bizning asosiy mahsulotlarimiz:</b>\n` +
      `• Original va Sport Rullar (M-Sport, Anatomiya, Carbon, Alcantara)\n` +
      `• O'rta konsol barlar (simsiz zaryadkali, podstakannikli)\n` +
      `• Benson va Fuyao akustik/quyoshdan himoya labavoy oynalari\n` +
      `• Elektron buklanadigan qizdirgichli bakavoy oynalar\n` +
      `• Michelin va yetakchi brendlarning sifatli shinalari\n` +
      `• Kuzov detallari, radiator panjaralari va sport optika\n\n` +
      `⚡️ <b>Nima uchun aynan kuzavnoy.uzz?</b>\n` +
      `✅ 100% Zavodskoy sifat va rasmiy servis kafolati\n` +
      `🚀 Toshkent shahri bo'ylab 2 soatda tezkor kuryerlik yetkazishi\n` +
      `📦 O'zbekistonning barcha viloyatlariga ishonchli jo'natish\n` +
      `💳 Qulay to'lov: Uzcard, Humo, Visa yoki qabul qilinganda naqd\n\n` +
      (isAdmin ? `⭐️ <b>Hurmatli Admin</b>, siz tizimda do'kon boshqaruvchisi sifatida aniqlandingiz.\n\n` : '') +
      `Pastdagi <b>«🛒 Katalog & Xarid qilish»</b> tugmasini bosing va ilovamizdan kerakli detalni qulay tanlang! 👇`;

    const inlineButtons = [];
    if (isHttps) {
      inlineButtons.push([
        { text: "🛒 Katalog & Xarid qilish (Mini App)", web_app: { url: WEB_APP_URL } }
      ]);
      if (isAdmin) {
        inlineButtons.push([
          { text: "👨‍💼 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }
        ]);
      }
      inlineButtons.push([
        { text: "📸 Instagram (@kuzavnoy.uzz)", url: "https://instagram.com/kuzavnoy.uzz" },
        { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
      ]);
    } else {
      inlineButtons.push([
        { text: "🌐 Do'konni ochish", url: WEB_APP_URL }
      ]);
      if (isAdmin) {
        inlineButtons.push([
          { text: "👨‍💼 Admin Panel", url: `${WEB_APP_URL}/admin` }
        ]);
      }
      inlineButtons.push([
        { text: "📸 Instagram (@kuzavnoy.uzz)", url: "https://instagram.com/kuzavnoy.uzz" },
        { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
      ]);
    }

    // Doimiy pastki klaviatura menyusi (Reply Keyboard)
    const replyKeyboard = {
      keyboard: [
        [
          isHttps 
            ? { text: "🛒 Katalog (Mini App)", web_app: { url: WEB_APP_URL } }
            : { text: "🛒 Katalog (Mini App)" },
          { text: "📦 Buyurtmalarim" }
        ],
        [
          { text: "📞 Bog'lanish" },
          { text: "📍 Manzil & Ish vaqti" }
        ],
        [
          { text: "ℹ️ Yordam / Ma'lumot" }
        ]
      ],
      resize_keyboard: true
    };

    // 1-xabar: Pastki klaviatura FAQAT oddiy foydalanuvchilar (userlar) uchun chiqadi, Admin uchun kerak emas!
    if (!isAdmin) {
      await bot.sendMessage(chatId, "Bosh menyu faollashtirildi 👇", {
        reply_markup: replyKeyboard
      }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, "👨‍💼 Boshqaruv paneli faol", {
        reply_markup: { remove_keyboard: true }
      }).catch(() => {});
    }

    // 2-xabar: Rasmiy tanishtiruv posti (Inline tugmalar bilan)
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineButtons
      }
    }).catch(e => console.error('Welcome post error:', e.message));
  };

  // 8. /start buyrug'i (Ro'yxatdan o'tish tekshiruvi bilan)
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const firstName = msg.from.first_name || 'Hurmatli mijoz';
    const startParam = match && match[1] ? match[1].trim() : '';

    // Bir martalik xavfsiz taklif havolasini tekshirish
    if (startParam && startParam.startsWith('adm_')) {
      const invite = activeAdminInvites.get(startParam);
      if (invite && invite.expiresAt > Date.now()) {
        activeAdminInvites.delete(startParam);

        if (!ADMIN_CHAT_IDS.includes(chatId)) {
          ADMIN_CHAT_IDS.push(chatId);
          await saveAdminsToDb();
        }

        const isHttps = WEB_APP_URL.startsWith('https://');

        await bot.sendMessage(chatId,
          "🎉 <b>Tabriklaymiz!</b>\n\n" +
          "Bosh Admin (Founder) taklifi orqali siz <b>kuzavnoy.uzz</b> do'koni administratori etib tayinlandingiz! 🚀\n\n" +
          "Endi siz buyurtmalarni boshqarishingiz mumkin.\n" +
          "Boshqaruv panelini ochish uchun pastdagi tugmani bosing: 👇",
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: isHttps ? [
                [{ text: "📊 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }],
                [{ text: "🛒 Do'konni ochish (Mini App)", web_app: { url: WEB_APP_URL } }]
              ] : [
                [{ text: "📊 Admin Dashboardni ochish", url: `${WEB_APP_URL}/admin` }]
              ]
            }
          }
        );

        try {
          await bot.sendMessage(HEAD_ADMIN_ID,
            `👑 <b>BOSH ADMIN BILDIRISHNOMASI:</b>\n\n` +
            `✅ Yangi admin bir martalik taklif havolasi orqali tizimga qo'shildi!\n` +
            `👤 <b>Ism:</b> ${escapeHtml(firstName)} (@${msg.from.username || 'yoq'})\n` +
            `🆔 <b>Telegram ID:</b> <code>${chatId}</code>\n` +
            `<i>Ushbu bir martalik havola avtomatik bekor qilindi.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch(e) {}

        return;
      } else {
        await bot.sendMessage(chatId,
          "❌ <b>Ushbu taklif havolasi yaroqsiz yoki muddati (15 daqiqa) o'tgan!</b>\n\n" +
          "Iltimos, do'kon egasidan (Bosh Admin) yangi taklif havolasini so'rang.",
          { parse_mode: 'HTML' }
        );
        return;
      }
    }

    // Foydalanuvchi avval ro'yxatdan o'tganligini tekshirish (Ism va telefon raqami bormi?)
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [chatId]);
      if (userRes.rows.length > 0 && userRes.rows[0].phone && userRes.rows[0].phone.trim().length >= 7) {
        // Allaqaqachon ro'yxatdan o'tgan!
        return sendWelcomePost(chatId, userRes.rows[0].name || firstName);
      }
    } catch(err) {
      console.error('User check error:', err.message);
    }

    // Yangi foydalanuvchi: Ro'yxatdan o'tishni boshlash (1-qadam: Ism-familiya so'rash)
    userRegStates.set(chatId, { step: 'ASK_NAME' });
    await bot.sendMessage(chatId,
      `👋 <b>Assalomu alaykum, ${escapeHtml(firstName)}!</b>\n\n` +
      `🚗 <b>kuzavnoy.uzz</b> rasmiy avto ehtiyot qismlari do'koniga xush kelibsiz!\n\n` +
      `Do'konimizdan qulay xarid qilish va buyurtmalaringizni tezkor qabul qilishimiz uchun, iltimos, <b>Ism va Familiyangizni</b> yozib qoldiring: 👇`,
      {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      }
    );
  });

  // Umumiy xabarlarni qabul qilish (Ro'yxatdan o'tish oqimi va Pastki menyu tugmalari)
  bot.on('message', async (msg) => {
    if (!msg || !msg.chat) return;
    const chatId = String(msg.chat.id);
    const text = msg.text ? msg.text.trim() : '';

    // Buyruqlarni e'tiborsiz qoldirish
    if (text.startsWith('/')) return;

    // 1. Ro'yxatdan o'tish holatlari
    if (userRegStates.has(chatId)) {
      const state = userRegStates.get(chatId);

      // 1-qadam: Ismni qabul qilish
      if (state.step === 'ASK_NAME') {
        if (!text || text.length < 2) {
          return bot.sendMessage(chatId, "Iltimos, ism va familiyangizni to'liqroq yozing (kamida 2 ta harf):");
        }
        userRegStates.set(chatId, { step: 'ASK_PHONE', name: text });
        return bot.sendMessage(chatId,
          `Rahmat, <b>${escapeHtml(text)}</b>! 🤝\n\n` +
          `Endi buyurtmalarni yetkazib berish va siz bilan aloqada bo'lishimiz uchun <b>telefon raqamingizni</b> yuboring.\n\n` +
          `Pastdagi <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing yoki raqamingizni yozing (+998...): 👇`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
      }

      // 2-qadam: Telefon raqamini qabul qilish
      if (state.step === 'ASK_PHONE') {
        let phone = msg.contact ? msg.contact.phone_number : text;
        if (!phone || phone.replace(/\D/g, '').length < 7) {
          return bot.sendMessage(chatId, "Iltimos, telefon raqamingizni to'g'ri kiriting yoki pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing:");
        }
        if (!phone.startsWith('+')) {
          phone = '+' + phone;
        }

        // Bazaga saqlash
        try {
          await pool.query(
            `INSERT INTO users (telegram_id, name, phone) VALUES ($1, $2, $3)
             ON CONFLICT (telegram_id) DO UPDATE SET name = $2, phone = $3`,
            [chatId, state.name, phone]
          );
        } catch(dbErr) {
          console.error('User save error:', dbErr.message);
        }

        userRegStates.delete(chatId);

        await bot.sendMessage(chatId,
          `🎉 <b>Tabriklaymiz, ${escapeHtml(state.name)}!</b>\n\n` +
          `Siz <b>kuzavnoy.uzz</b> tizimida muvaffaqiyatli ro'yxatdan o'tdingiz. 🚗💨\n` +
          `Endi do'konimizdan bemalol kerakli detallarni xarid qilishingiz mumkin!`,
          { parse_mode: 'HTML' }
        );

        return sendWelcomePost(chatId, state.name);
      }
    }

    // 2. Pastki doimiy menyu tugmalari
    if (text === "📦 Buyurtmalarim") {
      try {
        const oRes = await pool.query('SELECT * FROM orders WHERE telegram_id=$1 ORDER BY id DESC LIMIT 5', [chatId]);
        if (oRes.rows.length === 0) {
          return bot.sendMessage(chatId, "📦 Sizda hali faol buyurtmalar mavjud emas. Katalogimizdan kerakli detalni tanlab xarid qilishingiz mumkin!");
        }
        let txt = "📦 <b>Sizning so'nggi buyurtmalaringiz:</b>\n\n";
        oRes.rows.forEach(o => {
          let emoji = o.status === 'Yetkazildi' ? '🟢' : (o.status === 'Tayyorlandi' ? '📦' : (o.status === 'Jarayonda' ? '🔵' : '🟡'));
          txt += `${emoji} <b>Buyurtma #KZV-${o.id}</b>\n` +
            `• Holati: <b>${o.status}</b>\n` +
            `• Summa: <b>${(o.total_price || 0).toLocaleString()} so'm</b>\n` +
            `• Sana: <i>${new Date(o.created_at).toLocaleString('uz-UZ')}</i>\n\n`;
        });
        return bot.sendMessage(chatId, txt, { parse_mode: 'HTML' });
      } catch(e) {
        return bot.sendMessage(chatId, "Buyurtmalarni yuklashda xatolik yuz berdi.");
      }
    }

    if (text === "📞 Bog'lanish") {
      try {
        const sRes = await pool.query('SELECT * FROM store_settings WHERE id = 1');
        const st = sRes.rows[0] || {};
        return bot.sendMessage(chatId,
          `📞 <b>kuzavnoy.uzz — Aloqa Markazi</b>\n\n` +
          `Do'konimiz bo'yicha savollaringiz bo'lsa, quyidagi raqamlar orqali operatorlarimizga qo'ng'iroq qilishingiz mumkin:\n\n` +
          `• Telefon 1: <b>${st.phone || "+998 90 123 45 67"}</b>\n` +
          (st.phone2 ? `• Telefon 2: <b>${st.phone2}</b>\n` : '') +
          (st.phone3 ? `• Telefon 3: <b>${st.phone3}</b>\n` : '') +
          `• Ish tartibi: <b>${st.store_hours || "09:00 - 19:00"}</b>\n\n` +
          `💬 <i>Savollaringiz bo'lsa bemalol murojaat qiling!</i>`,
          { parse_mode: 'HTML' }
        );
      } catch(e) {}
    }

    if (text === "📍 Manzil & Ish vaqti") {
      try {
        const sRes = await pool.query('SELECT * FROM store_settings WHERE id = 1');
        const st = sRes.rows[0] || {};
        const addr = st.store_address || "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori";
        const yMap = st.store_location_url || `https://yandex.uz/maps/?text=${encodeURIComponent(addr)}`;
        const gMap = st.store_location_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

        return bot.sendMessage(chatId,
          `📍 <b>kuzavnoy.uzz — Do'kon Manzili</b>\n\n` +
          `🏢 <b>Manzil:</b> ${addr}\n` +
          `⏰ <b>Ish vaqti:</b> ${st.store_hours || "Har kuni 09:00 dan 19:00 gacha"}\n\n` +
          `Xaritada ochish uchun quyidagi havolalardan foydalaning: 👇`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🗺 Yandex Kartada ko'rish", url: yMap },
                  { text: "📍 Google Xaritada ko'rish", url: gMap }
                ]
              ]
            }
          }
        );
      } catch(e) {}
    }

    if (text === "ℹ️ Yordam / Ma'lumot") {
      return bot.sendMessage(chatId,
        "ℹ️ <b>kuzavnoy.uzz Bot Qo'llanmasi</b>\n\n" +
        "Ushbu bot orqali avtomobilingiz uchun barcha original ehtiyot qismlarni tanlashingiz va tezkor yetkazib berishga buyurtma berishingiz mumkin.\n\n" +
        "🔹 <b>Buyruqlar:</b>\n" +
        "/katalog — Mini App do'konini ochish\n" +
        "/buyurtma — Buyurtma holatini tekshirish\n" +
        "/telefon — Telefon raqamlarimiz\n" +
        "/manzil — Do'kon manzili va xaritalar\n" +
        "/ishvaqti — Ish tartibi va soatlari\n" +
        "/tolov — To'lov turlari (Uzcard, Humo, Visa, Naqd)\n" +
        "/yetkazish — Yetkazib berish shartlari\n" +
        "/aloqa — Aloqa markazi\n" +
        "/help — Ushbu yordam oynasi",
        { parse_mode: 'HTML' }
      );
    }
  });
  } catch (e) {
    console.error('Telegram bot ishga tushmadi:', e.message);
  }
} else {
  console.warn('⚠️ BOT_TOKEN kiritilmagani sababli Telegram Bot ishga tushmadi. Mini App va Admin Panel veb-rejimda ishlayveradi.');
}

// 4. EXPRESS SERVER VA REST API
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Qat'iy keshga qarshi middleware (No-Cache headers) — barcha platformalar va brauzerlar uchun
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// API: Barcha istoriyalarni olish (Stories)
app.get('/api/stories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stories ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi istoriya qo'shish (Admin)
app.post('/api/stories', async (req, res) => {
  try {
    const { title, description, tag, image_url } = req.body;
    if (!title || !image_url) {
      return res.status(400).json({ error: "Sarlavha va rasm kiritilishi shart!" });
    }
    const result = await pool.query(
      `INSERT INTO stories (title, description, tag, image_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description || '', tag || 'Yangi', image_url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Istoriyani o'chirish (Admin)
app.delete('/api/stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM stories WHERE id=$1', [id]);
    res.json({ success: true, message: "Istoriya muvaffaqiyatli o'chirildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Barcha mahsulotlarni olish
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi mahsulot qo'shish (Admin)
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, details, old_price, new_price, category, image_url, condition, stock, color, car_model } = req.body;
    const stockVal = (stock !== undefined && stock !== null && stock !== '') ? parseInt(stock) : 10;
    const colorVal = color || 'Universal';
    const carModelVal = car_model || category || 'Universal';
    const result = await pool.query(
      `INSERT INTO products (name, description, details, old_price, new_price, category, image_url, condition, stock, color, car_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, description, JSON.stringify(details || []), old_price || 0, new_price, category, image_url, condition || 'Yangi', isNaN(stockVal) ? 10 : stockVal, colorVal, carModelVal]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Mahsulotni tahrirlash (Admin)
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, details, old_price, new_price, category, image_url, condition, stock, color, car_model } = req.body;
    const stockVal = (stock !== undefined && stock !== null && stock !== '') ? parseInt(stock) : 10;
    const colorVal = color || 'Universal';
    const carModelVal = car_model || category || 'Universal';
    const result = await pool.query(
      `UPDATE products 
       SET name=$1, description=$2, details=$3, old_price=$4, new_price=$5, category=$6, image_url=$7, condition=$8, stock=$9, color=$10, car_model=$11
       WHERE id=$12 RETURNING *`,
      [name, description, JSON.stringify(details || []), old_price, new_price, category, image_url, condition || 'Yangi', isNaN(stockVal) ? 10 : stockVal, colorVal, carModelVal, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Mahsulotni o'chirish (Admin)
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ success: true, message: "Mahsulot o'chirildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Barcha buyurtmalarni olish (Admin)
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Foydalanuvchining o'z buyurtmalari (Mini App Profil uchun)
app.get('/api/user/orders/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE telegram_id=$1 ORDER BY id DESC', [telegramId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Buyurtma holatini yangilash (Admin) + Mijozga Telegram xabari
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, courier_name, courier_phone } = req.body;
    let queryStr = 'UPDATE orders SET status=$1';
    const params = [status];
    let pIdx = 2;
    if (courier_name !== undefined) {
      queryStr += ', courier_name=$' + pIdx;
      params.push(courier_name);
      pIdx++;
    }
    if (courier_phone !== undefined) {
      queryStr += ', courier_phone=$' + pIdx;
      params.push(courier_phone);
      pIdx++;
    }
    queryStr += ' WHERE id=$' + pIdx + ' RETURNING *';
    params.push(id);
    const result = await pool.query(queryStr, params);
    if (result.rows.length === 0) return res.status(404).json({ error: "Buyurtma topilmadi" });
    const order = result.rows[0];

    // Status yangilanganda mijozga Telegram bot orqali avtomatik xabar berish
    if (bot && order.telegram_id && String(order.telegram_id) !== '0') {
      let statusIcon = 'ℹ️';
      let statusMsg = `Buyurtmangiz holati: <b>${status}</b> ga o'zgardi.`;
      if (status === 'Jarayonda') {
        statusIcon = '✅';
        statusMsg = "Sizning buyurtmangiz <b>qabul qilindi va mutaxassislarimiz tomonidan tayyorlanmoqda</b>! 🚗💨\nTez orada kuryerimiz siz bilan bog'lanadi.";
      } else if (status === 'Tayyorlandi') {
        statusIcon = '📦';
        statusMsg = "Sizning buyurtmangiz <b>muvaffaqiyatli tayyorlandi</b> va topshirishga shay! 🚗💨\nKuryer orqali yetkaziladi yoki do'kondan olib ketishingiz mumkin.";
      } else if (status === 'Yetkazildi') {
        statusIcon = '🟢';
        statusMsg = "Buyurtmangiz <b>muvaffaqiyatli yetkazib berildi</b>! Xaridingiz uchun katta rahmat! Doimo xizmatingizdamiz ⭐️";
      } else if (status === 'Bekor qilindi') {
        statusIcon = '🔴';
        statusMsg = "Buyurtmangiz <b>bekor qilindi</b>. Qo'shimcha savollaringiz bo'lsa biz bilan bog'lanishingiz mumkin.";
      } else if (status === 'Kutilmoqda') {
        statusIcon = '🟡';
        statusMsg = "Buyurtmangiz tizimda <b>ko'rib chiqilmoqda (Kutilmoqda)</b>. Tez orada qabul qilinadi.";
      }

      // Buyurtmadagi tovarlar ro'yxati
      let itemsListText = '';
      try {
        const orderItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
        if (orderItems.length > 0) {
          itemsListText = '\n\n🛒 <b>Buyurtma tarkibi:</b>\n' + 
            orderItems.map(it => `• ${it.name} (${it.quantity || 1} dona) - ${((it.price || it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm`).join('\n');
        }
      } catch(e) {}

      bot.sendMessage(order.telegram_id,
        `${statusIcon} <b>kuzavnoy.uzz — Buyurtma holati yangilandi!</b>\n\n` +
        `🆔 <b>Buyurtma raqami:</b> #${order.id}\n` +
        `📌 <b>Yangi holat:</b> <b>${status}</b>\n` +
        `💵 <b>Umumiy summa:</b> <b>${(order.total_price || 0).toLocaleString()} so'm</b>` +
        itemsListText + `\n\n` +
        `${statusMsg}\n\n` +
        `📞 <i>Savollar uchun aloqa: +998 90 123 45 67</i>\n` +
        `<i>kuzavnoy.uzz rasmiy avto do'koni</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Do'kon sozlamalarini olish (Mini App & Admin)
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store_settings WHERE id=1');
    if (result.rows.length === 0) {
      await pool.query(`INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
      const def = await pool.query('SELECT * FROM store_settings WHERE id=1');
      return res.json(def.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Do'kon sozlamalarini saqlash (Admin)
app.put('/api/settings', async (req, res) => {
  try {
    const { 
      card_number, card_holder,
      uzcard_number, uzcard_holder,
      humo_number, humo_holder,
      visa_number, visa_holder,
      phone, phone2, phone3,
      instagram_url, youtube_url, telegram_channel_url, website_url,
      store_address, store_hours,
      store_hours_open, store_hours_close, store_days,
      uzcard_active, humo_active, visa_active,
      phone1_active, phone2_active, phone3_active,
      instagram_active, youtube_active, telegram_active, website_active,
      store_location_url
    } = req.body;
    const result = await pool.query(
      `INSERT INTO store_settings (
         id, card_number, card_holder, 
         uzcard_number, uzcard_holder, 
         humo_number, humo_holder, 
         visa_number, visa_holder, 
         phone, phone2, phone3, 
         instagram_url, youtube_url, telegram_channel_url, website_url,
         store_address, store_hours, store_hours_open, store_hours_close, store_days,
         uzcard_active, humo_active, visa_active,
         phone1_active, phone2_active, phone3_active,
         instagram_active, youtube_active, telegram_active, website_active,
         store_location_url,
         updated_at
       )
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         card_number = EXCLUDED.card_number,
         card_holder = EXCLUDED.card_holder,
         uzcard_number = EXCLUDED.uzcard_number,
         uzcard_holder = EXCLUDED.uzcard_holder,
         humo_number = EXCLUDED.humo_number,
         humo_holder = EXCLUDED.humo_holder,
         visa_number = EXCLUDED.visa_number,
         visa_holder = EXCLUDED.visa_holder,
         phone = EXCLUDED.phone,
         phone2 = EXCLUDED.phone2,
         phone3 = EXCLUDED.phone3,
         instagram_url = EXCLUDED.instagram_url,
         youtube_url = EXCLUDED.youtube_url,
         telegram_channel_url = EXCLUDED.telegram_channel_url,
         website_url = EXCLUDED.website_url,
         store_address = EXCLUDED.store_address,
         store_hours = EXCLUDED.store_hours,
         store_hours_open = EXCLUDED.store_hours_open,
         store_hours_close = EXCLUDED.store_hours_close,
         store_days = EXCLUDED.store_days,
         uzcard_active = EXCLUDED.uzcard_active,
         humo_active = EXCLUDED.humo_active,
         visa_active = EXCLUDED.visa_active,
         phone1_active = EXCLUDED.phone1_active,
         phone2_active = EXCLUDED.phone2_active,
         phone3_active = EXCLUDED.phone3_active,
         instagram_active = EXCLUDED.instagram_active,
         youtube_active = EXCLUDED.youtube_active,
         telegram_active = EXCLUDED.telegram_active,
         website_active = EXCLUDED.website_active,
         store_location_url = EXCLUDED.store_location_url,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        card_number || uzcard_number || '8600 5304 1234 5678',
        card_holder || uzcard_holder || 'AZIMXON (KUZAVNOY.UZZ)',
        uzcard_number || '8600 5304 1234 5678',
        uzcard_holder || 'AZIMXON (KUZAVNOY.UZZ)',
        humo_number || '9860 1201 5678 4321',
        humo_holder || 'AZIMXON (KUZAVNOY.UZZ)',
        visa_number || '',
        visa_holder || 'AZIMXON (KUZAVNOY.UZZ)',
        phone || '+998 90 123 45 67',
        phone2 || '',
        phone3 || '',
        instagram_url || 'https://instagram.com/kuzavnoy.uzz',
        youtube_url || 'https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G',
        telegram_channel_url || 'https://t.me/kuzavnoy_uz',
        website_url || 'https://kuzavnoy.uz',
        store_address || 'Toshkent sh., Farhod avto bozori, 4-qator 12-do\'kon',
        store_hours || '09:00 - 19:00',
        store_hours_open || '09:00',
        store_hours_close || '19:00',
        store_days || 'Har kuni',
        uzcard_active !== false,
        humo_active !== false,
        Boolean(visa_active),
        phone1_active !== false,
        phone2_active !== false,
        phone3_active !== false,
        instagram_active !== false,
        youtube_active !== false,
        telegram_active !== false,
        Boolean(website_active),
        store_location_url || ''
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Mijoz tomonidan buyurtmani bekor qilish + Adminga tezkor Telegram xabari
app.put('/api/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const chk = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    if (chk.rows.length === 0) return res.status(404).json({ error: "Buyurtma topilmadi" });
    const order = chk.rows[0];

    if (order.status !== 'Kutilmoqda') {
      return res.status(400).json({ error: "Faqat kutilayotgan buyurtmalarni bekor qilish mumkin!" });
    }

    const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', ['Bekor qilindi', id]);
    const updatedOrder = result.rows[0];

    // Adminga tezkor ogohlantirish xabari jo'natish
    if (bot && ADMIN_CHAT_IDS && ADMIN_CHAT_IDS.length > 0) {
      const alertAdminText = 
        `⚠️ <b>kuzavnoy.uzz — BUYURTMA BEKOR QILINDI!</b> ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Buyurtma raqami:</b> <code>#${order.id}</code>\n` +
        `👤 <b>Mijoz:</b> <b>${order.customer_name}</b>\n` +
        `📞 <b>Telefon:</b> <code>${order.phone}</code>\n` +
        `💰 <b>Summa:</b> <b>${(order.total_price || 0).toLocaleString()} so'm</b>\n` +
        `❌ <b>Holati:</b> Mijoz ilova orqali bekor qildi\n` +
        `⏰ <b>Vaqti:</b> <i>${new Date().toLocaleString('uz-UZ')}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 <i>Boshqaruv panelida ko'rish:</i>`;

      for (const adminId of ADMIN_CHAT_IDS) {
        bot.sendMessage(adminId, alertAdminText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: "📊 Admin Panelda ko'rish", web_app: { url: `${WEB_APP_URL}/admin` } }]]
          }
        }).catch(() => {});
      }
    }

    // Mijozga Telegram tasdig'i
    if (bot && order.telegram_id && String(order.telegram_id) !== '0') {
      bot.sendMessage(order.telegram_id,
        `🔴 <b>Buyurtmangiz bekor qilindi.</b>\n\n` +
        `🆔 <b>Buyurtma raqami:</b> #${order.id}\n` +
        `Xohlagan vaqtingizda Mini App orqali qayta buyurtma berishingiz mumkin.\n\n` +
        `<i>kuzavnoy.uzz rasmiy do'koni</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Bekor qilingan buyurtmani o'chirish (Task 2)
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const chk = await pool.query('SELECT status FROM orders WHERE id=$1', [id]);
    if (chk.rows.length === 0) return res.status(404).json({ error: "Buyurtma topilmadi" });
    if (chk.rows[0].status !== 'Bekor qilindi') {
      return res.status(400).json({ error: "Faqat bekor qilingan buyurtmalarni o'chirish mumkin!" });
    }
    await pool.query('DELETE FROM orders WHERE id=$1', [id]);
    res.json({ success: true, message: "Buyurtma o'chirildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Barcha sharhlarni olish (Task 3)
app.get('/api/reviews', async (req, res) => {
  try {
    const { product_id } = req.query;
    let query = 'SELECT * FROM reviews ORDER BY id DESC';
    let params = [];
    if (product_id) {
      query = 'SELECT * FROM reviews WHERE product_id=$1 ORDER BY id DESC';
      params = [product_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi sharh qoldirish (Task 3)
app.post('/api/reviews', async (req, res) => {
  try {
    const { product_id, telegram_id, customer_name, rating, comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: "Sharh matni kiritilishi shart!" });
    }
    const result = await pool.query(
      `INSERT INTO reviews (product_id, telegram_id, customer_name, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [product_id || 0, telegram_id || 0, customer_name || 'Mijoz', rating || 5, comment.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Barcha mijozlar (CRM / Clients bo'limi)
app.get('/api/users', async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT u.id, u.telegram_id, u.name, u.phone, u.created_at,
             COUNT(o.id) as orders_count, 
             COALESCE(SUM(o.total_price), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON o.telegram_id = u.telegram_id
      GROUP BY u.id, u.telegram_id, u.name, u.phone, u.created_at
      ORDER BY total_spent DESC, orders_count DESC
    `);
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Tezkor narx o'zgartirish (Quick Price Editor)
app.put('/api/products/:id/quick-price', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_price, old_price } = req.body;
    const result = await pool.query(
      'UPDATE products SET new_price=$1, old_price=$2 WHERE id=$3 RETURNING *',
      [new_price, old_price, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });

// API: Tezkor ombor/qoldiq boshqaruvi (Offline bozor savdosi va qoldiq sozlash)
app.put('/api/products/:id/quick-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, delta } = req.body;
    let result;
    if (delta !== undefined) {
      result = await pool.query(
        'UPDATE products SET stock = GREATEST(0, COALESCE(stock, 10) + $1) WHERE id=$2 RETURNING *',
        [parseInt(delta), id]
      );
    } else {
      result = await pool.query(
        'UPDATE products SET stock = GREATEST(0, $1) WHERE id=$2 RETURNING *',
        [parseInt(stock) || 0, id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Bo'limlar & Modellarni olish (Kategoriyalar)
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, id ASC');
    if (result.rows.length === 0) {
      const defaults = [
        ['Cobalt', '🚗', 1], ['Gentra / Lacetti', '🚗', 2], ['Nexia (1 / 2 / 3)', '🚗', 3],
        ['Spark', '🚗', 4], ['Matiz', '🚗', 5], ['Damas / Labo', '🚐', 6],
        ['Malibu (1 / 2)', '🚘', 7], ['Tracker (1 / 2)', '🚙', 8], ['Onix', '🚗', 9],
        ['Monjaro / Xitoy avto', '⚡️', 10], ['Kia / Hyundai', '🚘', 11], ['Boshqa / Import', '🌐', 12]
      ];
      for (const d of defaults) {
        await pool.query('INSERT INTO categories (name, icon, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING', d);
      }
      const refreshed = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, id ASC');
      return res.json(refreshed.rows);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi bo'lim/model qo'shish (Admin)
app.post('/api/categories', async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nomi kiritilishi shart' });
    const maxOrderRes = await pool.query('SELECT MAX(display_order) as m FROM categories');
    const nextOrder = (maxOrderRes.rows[0]?.m || 0) + 1;
    const result = await pool.query(
      'INSERT INTO categories (name, icon, display_order) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), icon || '🚗', nextOrder]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Bo'lim/modelni o'chirish (Admin)
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categories WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  }
});

// API: Barcha Telegram foydalanuvchilariga xabar tarqatish (Broadcast - Task 4 & 8)
app.post('/api/broadcast', async (req, res) => {
  try {
    const { message, photo_url } = req.body;
    if (!message) return res.status(400).json({ error: "Xabar matni kiritilishi shart!" });

    const users = await pool.query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');
    let sentCount = 0;

    let photoPayload = photo_url;
    if (photo_url && photo_url.startsWith('data:image/')) {
      const base64Data = photo_url.replace(/^data:image\/\w+;base64,/, '');
      photoPayload = Buffer.from(base64Data, 'base64');
    }

    const broadcastKeyboard = [
      [{ text: "🛍 Do'konga o'tish (Mini App)", web_app: { url: WEB_APP_URL } }],
      [
        { text: "📸 Instagram (@kuzavnoy.uzz)", url: "https://instagram.com/kuzavnoy.uzz" },
        { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
      ]
    ];

    for (const u of users.rows) {
      try {
        if (photoPayload) {
          const sentMsg = await bot.sendPhoto(u.telegram_id, photoPayload, { 
            caption: message, 
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: broadcastKeyboard }
          }, { filename: 'broadcast.jpg', contentType: 'image/jpeg' });
          if (Buffer.isBuffer(photoPayload) && sentMsg && sentMsg.photo && sentMsg.photo.length > 0) {
            photoPayload = sentMsg.photo[sentMsg.photo.length - 1].file_id;
          }
        } else {
          await bot.sendMessage(u.telegram_id, message, { 
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: broadcastKeyboard }
          });
        }
        sentCount++;
        await new Promise(r => setTimeout(r, 35));
      } catch (sendErr) {}
    }
    res.json({ success: true, sentCount, total: users.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi buyurtma yaratish (Mini App) + Telegram orqali xabar yuborish (Task 9)
app.post('/api/orders', async (req, res) => {
  try {
    const { 
      telegram_id, customer_name, phone, items, total_price, location, 
      delivery_type, payment_method, needs_installation, installation_service 
    } = req.body;

    // 1. Qat'iy maydonlar tekshiruvi (Validation)
    if (!customer_name || !String(customer_name).trim()) {
      return res.status(400).json({ error: "Iltimos, ism va familiyangizni kiriting!" });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: "Iltimos, telefon raqamingizni kiriting!" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Savatchangiz bo'sh!" });
    }

    const dType = delivery_type === 'pickup' ? 'pickup' : 'delivery';
    const pMethod = payment_method === 'card' ? 'card' : 'cash';
    const sanitizedTotal = Math.round(Number(total_price) || 0);
    const parsedTgId = (telegram_id && !isNaN(Number(telegram_id))) ? Number(telegram_id) : 0;

    // 2. Savat detallarini sanitizatsiya qilish (har doim to'g'ri son va matn)
    const cleanItems = items.map(it => ({
      id: it.id || 0,
      name: String(it.name || 'Ehtiyot qism'),
      new_price: Math.round(Number(it.new_price) || 0),
      old_price: Math.round(Number(it.old_price) || 0),
      quantity: Math.max(1, parseInt(it.quantity) || 1),
      category: String(it.category || ''),
      condition: String(it.condition || 'Yangi')
    }));

    // 3. Bazaga yozish (PostgreSQL Neon)
    const result = await pool.query(
      `INSERT INTO orders (
        telegram_id, customer_name, phone, items, total_price, location, 
        delivery_type, payment_method, needs_installation, installation_service, 
        courier_name, courier_phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Sardor (Kuzavnoy Express)', '+998 90 123 45 67') 
      RETURNING *`,
      [
        parsedTgId, String(customer_name).trim(), String(phone).trim(), JSON.stringify(cleanItems), sanitizedTotal, String(location || '').trim(), 
        dType, pMethod, Boolean(needs_installation), installation_service || null
      ]
    );
    const order = result.rows[0];

    // 4. Ombordan tovarlar qoldig'ini (stock) avtomatik kamaytirish
    try {
      for (const it of cleanItems) {
        if (it && it.id && it.id !== 9999) {
          const q = Math.max(1, parseInt(it.quantity) || 1);
          await pool.query('UPDATE products SET stock = GREATEST(0, COALESCE(stock, 10) - $1) WHERE id = $2', [q, it.id]);
        }
      }
    } catch(stockErr) {
      console.error('Stock kamaytirishda xato:', stockErr.message);
    }

    const dTypeText = dType === 'pickup' ? "🏬 O'zi olib ketish (Do'kondan / Samovivoz)" : "🚚 Kuryer orqali yetkazib berish";
    const pMethodText = pMethod === 'card' ? "💳 Karta orqali oldindan to'lov (Uzcard / Humo / Visa)" : "💵 Qabul qilinganda to'lash (Naqd / Kuryerga)";

    // 5. Telegram Bot orqali mijozga tasdiqlash xabari yuborish (Xatolik bo'lsa ham buyurtmani to'xtatmaydi)
    if (bot && parsedTgId && parsedTgId !== 0) {
      try {
        let cleanLocDisplay = location ? escapeHtml(String(location).split(' | 🗺 Xarita: ')[0]) : "Ko'rsatilmagan";
        let itemsList = cleanItems.map((it, idx) => `• ${escapeHtml(it.name)} (${it.quantity || 1} dona) — ${((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm`).join('\n');
        
        const messageText = 
          `🎉 <b>Buyurtmangiz muvaffaqiyatli qabul qilindi!</b>\n` +
          (dType === 'pickup' ? `Do'konimizdan olib ketishingiz mumkin 🏬\n\n` : `Kuryerimiz tez orada siz bilan bog'lanadi 🚗💨\n\n`) +
          `<b>Buyurtma raqami:</b> #${order.id}\n` +
          `<b>Mijoz:</b> ${escapeHtml(customer_name)}\n` +
          `<b>Telefon:</b> ${escapeHtml(phone)}\n` +
          `<b>Yetkazish turi:</b> ${dTypeText}\n` +
          `<b>To'lov usuli:</b> ${pMethodText}\n` +
          (dType === 'delivery' ? `<b>Yetkazish manzili:</b> ${cleanLocDisplay}\n\n` : `<b>Do'kon manzili:</b> Toshkent sh., Farhod avto bozori\n\n`) +
          `<b>Xarid qilingan detallar:</b>\n${itemsList}\n\n` +
          `💰 <b>Jami summa:</b> ${sanitizedTotal.toLocaleString()} so'm\n\n` +
          `<i>kuzavnoy.uzz ni tanlaganingiz uchun rahmat!</i>`;

        bot.sendMessage(parsedTgId, messageText, { parse_mode: 'HTML' }).catch(botSendErr => {
          console.warn('Mijozga Telegram xabari yetib bormadi (bloklangan yoki boshlanmagan):', botSendErr.message);
        });
      } catch (botErr) {
        console.error('Telegram bot mijoz xabarida xatolik:', botErr.message);
      }
    }

    // 6. Telegram Bot orqali ADMINGA xabar yuborish (Xatolik bo'lsa ham buyurtmani to'xtatmaydi)
    if (bot && ADMIN_CHAT_IDS && ADMIN_CHAT_IDS.length > 0) {
      try {
        let cleanLocForAdmin = location ? escapeHtml(String(location).split(' | 🗺 Xarita: ')[0]) : "Ko'rsatilmagan";
        let adminItemsList = cleanItems.map((it, idx) => 
          `   ${idx + 1}. <b>${escapeHtml(it.name)}</b>\n` +
          `      └ <i>${it.quantity || 1} dona × ${(it.new_price || 0).toLocaleString()} so'm = <b>${((it.quantity || 1) * (it.new_price || 0)).toLocaleString()} so'm</b></i>`
        ).join('\n');
        
        const adminText = 
          `🚗 <b>kuzavnoy.uzz — YANGI BUYURTMA!</b> 🚗\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Buyurtma raqami:</b> <code>#${order.id}</code>\n` +
          `⏰ <b>Vaqti:</b> <i>${new Date().toLocaleString('uz-UZ')}</i>\n\n` +
          `👤 <b>MIJOZ MA'LUMOTLARI:</b>\n` +
          `• <b>Ismi:</b> <b>${escapeHtml(customer_name)}</b>\n` +
          `• <b>Telefon:</b> <code>${escapeHtml(phone)}</code>\n` +
          `• <b>Telegram ID:</b> <code>${parsedTgId || 'Mavjud emas'}</code>\n\n` +
          `🚚 <b>YETKAZIB BERISH:</b>\n` +
          `• <b>Turi:</b> ${dTypeText}\n` +
          `• <b>Manzil:</b> <i>${cleanLocForAdmin}</i>\n\n` +
          `💳 <b>TO'LOV HOLATI:</b>\n` +
          `• <b>Usuli:</b> ${pMethodText}\n` +
          `• <b>JAMI TUSHUM:</b> 💰 <b>${sanitizedTotal.toLocaleString()} SO'M</b>\n\n` +
          `📦 <b>BUYURTMA TARKIBI (${cleanItems.length} xil detal):</b>\n` +
          `${adminItemsList}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👇 <i>Buyurtmani boshqarish uchun pastdagi tugmani bosing:</i>`;

        const mapMatch = location && String(location).match(/https?:\/\/[^\s]+/);
        const mapUrl = mapMatch ? mapMatch[0] : null;

        const inlineButtons = [
          [{ text: "📊 Admin Panelda ko'rish", web_app: { url: `${WEB_APP_URL}/admin` } }]
        ];
        if (mapUrl) {
          inlineButtons.unshift([{ text: "📍 Mijoz GPS Lokatsiyasi (Xaritada ochish)", url: mapUrl }]);
        }

        for (const adminId of ADMIN_CHAT_IDS) {
          bot.sendMessage(adminId, adminText, { 
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineButtons }
          }).catch(e => console.error('Admin notify err:', e.message));
        }
      } catch (adminErr) {
        console.error('Admin xabari yuborishda xatolik:', adminErr.message);
      }
    }

    // 7. HAM FLAT ID, HAM .order NI QAYTARISH (100% Client Mosligi)
    return res.json({ 
      success: true, 
      id: order.id, 
      ...order, 
      order 
    });
  } catch (err) {
    console.error('Order creation error:', err.message);
    return res.status(500).json({ error: err.message || "Buyurtma yaratib bo'lmadi" });
  }
});

// 5. MINI APP FRONTEND
app.get('/', (req, res) => {
  res.send(getMiniAppHtml());
});
app.get('/miniapp', (req, res) => {
  res.send(getMiniAppHtml());
});

// 6. ADMIN PANEL DASHBOARD (REACT 18 + TAILWIND CSS)
app.get('/admin', (req, res) => {
  res.send(getAdminPanelHtml());
});

// SERVERNI ISHGA TUSHIRISH
app.listen(PORT, () => {
  console.log('=====================================================');
  console.log(`🚀 kuzavnoy.uzz Tizimi muvaffaqiyatli ishga tushdi!`);
  console.log(`📱 Telegram Mini App : http://localhost:${PORT}`);
  console.log(`💻 Admin Dashboard   : http://localhost:${PORT}/admin`);
  console.log(`🤖 Telegram Bot      : Faol (Polling rejimida)`);
  console.log('=====================================================');
});

// ==============================================================================
// HTML GENERATOR: TELEGRAM MINI APP (REACT 18)
// ==============================================================================

function getMiniAppHtml() {
  return `<!DOCTYPE html>
<html lang="uz" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>kuzavnoy.uzz | Avto Ehtiyot Qismlar</title>
  
  <!-- Telegram WebApp SDK -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#fff1f2',
              100: '#ffe4e6',
              500: '#f43f5e',
              600: '#e11d48',
              700: '#be123c',
              800: '#9f1239',
              900: '#881337',
            },
            dark: {
              bg: '#090D16',
              card: '#101726',
              elevated: '#162033',
              border: '#1F2B45',
              subtle: '#263554',
              hover: '#1B263D'
            }
          }
        }
      }
    };
  </script>
  
  <!-- React & Babel -->
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
      overscroll-behavior-y: none;
    }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin-custom { animation: spin 0.8s linear infinite; }
    .safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 72px); }
    .safe-top { padding-top: env(safe-area-inset-top, 0px); }
  </style>
</head>
<body class="select-none transition-colors duration-200 antialiased bg-[#090D16] text-[#F8FAFC]">
  <div id="root">
    <div class="flex flex-col items-center justify-center min-h-[85vh] text-center px-4">
      <div class="w-10 h-10 border-2 border-slate-700 border-t-red-600 rounded-full animate-spin-custom mb-4"></div>
      <div class="text-sm font-bold text-slate-200 tracking-tight">kuzavnoy.uzz</div>
      <div class="text-xs text-slate-500 mt-1">Avto ehtiyot qismlar tizimi yuklanmoqda...</div>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef } = React;

    // ==========================================
    // 1. PROFESSIONAL SVG ICON SYSTEM (NO EMOJIS)
    // ==========================================
    const Icon = ({ name, className = "w-5 h-5", strokeWidth = 1.8 }) => {
      const icons = {
        home: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        ),
        grid: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="7" x="3" y="3" rx="1.5"/>
            <rect width="7" height="7" x="14" y="3" rx="1.5"/>
            <rect width="7" height="7" x="14" y="14" rx="1.5"/>
            <rect width="7" height="7" x="3" y="14" rx="1.5"/>
          </svg>
        ),
        cart: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
            <path d="M3 6h18"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        ),
        user: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M20 21a8 8 0 0 0-16 0"/>
          </svg>
        ),
        search: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" x2="16.65" y1="21" y2="16.65"/>
          </svg>
        ),
        heart: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        ),
        'heart-solid': (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        ),
        sliders: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/>
            <line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/>
            <line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/>
            <line x1="1" x2="7" y1="14" y2="14"/>
            <line x1="9" x2="15" y1="8" y2="8"/>
            <line x1="17" x2="23" y1="16" y2="16"/>
          </svg>
        ),
        refresh: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>
          </svg>
        ),
        sun: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
            <path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
          </svg>
        ),
        moon: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        ),
        globe: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
          </svg>
        ),
        'arrow-left': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
          </svg>
        ),
        'arrow-right': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        ),
        close: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        ),
        check: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ),
        'check-circle': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        ),
        star: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ),
        truck: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
          </svg>
        ),
        'map-pin': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
          </svg>
        ),
        phone: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
        wrench: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        ),
        shield: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        ),
        'shield-check': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
          </svg>
        ),
        package: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
          </svg>
        ),
        trash: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
          </svg>
        ),
        plus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
        ),
        minus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/>
          </svg>
        ),
        car: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11 2 11.3V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
          </svg>
        ),
        tag: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>
          </svg>
        ),
        receipt: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-8"/><path d="M16 12h-8"/><path d="M10 16h-2"/>
          </svg>
        ),
        copy: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        ),
        clock: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
        info: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
        ),
        instagram: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
        ),
        youtube: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        ),
        telegram: (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        )
      };
      return icons[name] || icons.package;
    };

    // ==========================================
    // 2. MULTI-LANGUAGE TRANSLATIONS
    // ==========================================
    const I18N = {
      uz: {
        appName: "kuzavnoy.uzz",
        subtitle: "Avto Ehtiyot Qismlar",
        greetingTitle: "Salom!",
        greetingDesc: "Avtomobilingiz uchun kerakli ehtiyot qismlarni toping.",
        searchPlaceholder: "Ehtiyot qism yoki avto modelini qidiring...",
        officialBadge: "Rasmiy Do'kon",
        heroBadge: "Original Ehtiyot Qismlar",
        heroTitle: "Avtomobilingizni yangilang va zavqlaning!",
        heroDesc: "Zavod sifati, 30 kun kafolat va Farhod bozorida o'rnatib berish xizmati.",
        heroBtn: "Katalogni ko'rish",
        popularTitle: "Eng ko'p xarid qilinganlar",
        viewAll: "Barchasi",
        addToCart: "Savatga",
        inCart: "Savatda",
        buyNow: "Hozir xarid qilish",
        catalogTitle: "Katalog",
        catalogSubtitle: "Barcha toifalar va mos ehtiyot qismlar",
        allCategories: "Barchasi",
        filter: "Filtrlar",
        sortBy: "Saralash",
        sortPopular: "Ommabop",
        sortPriceAsc: "Arzonroq",
        sortPriceDesc: "Qimmatroq",
        sortNewest: "Yangilari",
        conditionNew: "Yangi",
        conditionUsed: "B/U (Ideal)",
        inStock: "Omborda bor",
        outOfStock: "Buyurtmaga",
        stockQty: "dona mavjud",
        som: "so'm",
        cartTitle: "Savatcha",
        cartEmpty: "Savatchangiz bo'sh",
        cartEmptyDesc: "Katalogdan o'zingizga kerakli ehtiyot qismlarni tanlang",
        orderSummary: "Xarid xulosasi",
        subtotal: "Mahsulotlar",
        delivery: "Yetkazib berish",
        deliveryFree: "Bepul",
        discount: "Chegirma",
        total: "Jami to'lov",
        checkoutBtn: "Buyurtmani rasmiylashtirish",
        workshopServiceTitle: "O'rnatib berish servisi kerakmi?",
        workshopServiceDesc: "Farhod bozoridagi ustaxonamizda o'rnatib berish (10% chegirma promokodi: KUZAVNOY-USTA)",
        promoPlaceholder: "Promokod (masalan: KUZAVNOY-USTA)",
        applyPromo: "Qo'llash",
        promoApplied: "Promokod qo'llandi (-10%)",
        checkoutTitle: "Buyurtmani tasdiqlash",
        nameLabel: "Ism va Familiyangiz",
        phoneLabel: "Telefon raqamingiz",
        deliveryType: "Yetkazib berish turi",
        deliveryCourier: "Kuryer orqali yetkazish (Toshkent va viloyatlar)",
        deliveryPickup: "Olib ketish (Farhod avto bozori, kuzavnoy.uzz)",
        addressLabel: "Yetkazish manzili",
        detectGps: "GPS manzilni aniqlash",
        paymentType: "To'lov usuli",
        paymentCard: "Karta orqali oldindan to'lov (Uzcard / Humo)",
        paymentCash: "Qabul qilganda to'lash (Naqd / Kuryerga)",
        confirmOrder: "Buyurtmani yuborish",
        orderSuccessTitle: "Buyurtmangiz qabul qilindi!",
        orderSuccessDesc: "Tez orada menejerimiz siz bilan bog'lanadi va yetkazib berishni muvofiqlashtiradi.",
        orderId: "Buyurtma raqami",
        closeBtn: "Yopish",
        profileTitle: "Profil va Sozlamalar",
        ordersTab: "Buyurtmalarim",
        favoritesTab: "Yoqtirganlar",
        settingsTab: "Do'kon & Sozlamalar",
        noOrders: "Sizda hali buyurtmalar yo'q",
        noFavorites: "Hali sevimli tovarlar yo'q",
        orderStatusNew: "Yangi",
        orderStatusConfirmed: "Tasdiqlandi",
        orderStatusPreparing: "Tayyorlanmoqda",
        orderStatusShipped: "Yetkazilmoqda",
        orderStatusDelivered: "Yetkazildi",
        orderStatusCancelled: "Bekor qilindi",
        storeAddressTitle: "Do'kon manzili",
        storeHoursTitle: "Ish vaqti",
        supportPhoneTitle: "Aloqa telefonlari",
        callNow: "Qo'ng'iroq",
        viewReceipt: "Chekni ko'rish",
        backBtn: "Orqaga",
        specifications: "Xususiyatlar",
        description: "Batafsil tavsif",
        reviews: "Mijozlar sharhlari",
        writeReview: "Sharh qoldirish",
        relatedProducts: "O'xshash mahsulotlar",
        warrantyNote: "30 kunlik sinov muddati va zavod kafolati beriladi.",
        deliveryNote: "Toshkent shahri bo'ylab 2-4 soatda tezkor yetkazib berish.",
        navHome: "Asosiy",
        navCatalog: "Katalog",
        navCart: "Savatcha",
        navProfile: "Profil",
        refreshSuccess: "Ma'lumotlar yangilandi"
      },
      ru: {
        appName: "kuzavnoy.uzz",
        subtitle: "Автозапчасти",
        greetingTitle: "Привет!",
        greetingDesc: "Найдите необходимые автозапчасти для вашего авто.",
        searchPlaceholder: "Поиск запчасти или модели авто...",
        officialBadge: "Официальный магазин",
        heroBadge: "Оригинальные запчасти",
        heroTitle: "Обновите ваш авто с гарантией качества!",
        heroDesc: "Заводское качество, 30 дней гарантии и сервис установки на авторынке Фархад.",
        heroBtn: "Смотреть каталог",
        popularTitle: "Популярные товары",
        viewAll: "Все",
        addToCart: "В корзину",
        inCart: "В корзине",
        buyNow: "Купить сейчас",
        catalogTitle: "Каталог",
        catalogSubtitle: "Все категории и совместимые автозапчасти",
        allCategories: "Все",
        filter: "Фильтры",
        sortBy: "Сортировка",
        sortPopular: "Популярные",
        sortPriceAsc: "Сначала дешевые",
        sortPriceDesc: "Сначала дорогие",
        sortNewest: "Новинки",
        conditionNew: "Новый",
        conditionUsed: "Б/У (Идеал)",
        inStock: "В наличии",
        outOfStock: "Под заказ",
        stockQty: "шт. в наличии",
        som: "сум",
        cartTitle: "Корзина",
        cartEmpty: "Ваша корзина пуста",
        cartEmptyDesc: "Выберите нужные автозапчасти из каталога",
        orderSummary: "Итог заказа",
        subtotal: "Товары",
        delivery: "Доставка",
        deliveryFree: "Бесплатно",
        discount: "Скидка",
        total: "Всего к оплате",
        checkoutBtn: "Оформить заказ",
        workshopServiceTitle: "Нужна установка детали?",
        workshopServiceDesc: "Установка в нашем сервисе на авторынке Фархад (промокод -10%: KUZAVNOY-USTA)",
        promoPlaceholder: "Промокод (например: KUZAVNOY-USTA)",
        applyPromo: "Применить",
        promoApplied: "Промокод применен (-10%)",
        checkoutTitle: "Подтверждение заказа",
        nameLabel: "Ваше имя",
        phoneLabel: "Номер телефона",
        deliveryType: "Способ получения",
        deliveryCourier: "Доставка курьером",
        deliveryPickup: "Самовывоз (авторынок Фархад)",
        addressLabel: "Адрес доставки",
        detectGps: "Определить GPS",
        paymentType: "Способ оплаты",
        paymentCard: "Предоплата на карту (Uzcard / Humo)",
        paymentCash: "Оплата при получении (Наличные)",
        confirmOrder: "Отправить заказ",
        orderSuccessTitle: "Ваш заказ успешно принят!",
        orderSuccessDesc: "Наш менеджер свяжется с вами для согласования деталей.",
        orderId: "Номер заказа",
        closeBtn: "Закрыть",
        profileTitle: "Профиль и Настройки",
        ordersTab: "Мои заказы",
        favoritesTab: "Избранное",
        settingsTab: "Магазин и Настройки",
        noOrders: "У вас пока нет заказов",
        noFavorites: "Список избранного пуст",
        orderStatusNew: "Новый",
        orderStatusConfirmed: "Подтвержден",
        orderStatusPreparing: "Собирается",
        orderStatusShipped: "В пути",
        orderStatusDelivered: "Доставлен",
        orderStatusCancelled: "Отменен",
        storeAddressTitle: "Адрес магазина",
        storeHoursTitle: "Режим работы",
        supportPhoneTitle: "Телефоны для связи",
        callNow: "Позвонить",
        viewReceipt: "Посмотреть чек",
        backBtn: "Назад",
        specifications: "Характеристики",
        description: "Подробное описание",
        reviews: "Отзывы клиентов",
        writeReview: "Оставить отзыв",
        relatedProducts: "Похожие запчасти",
        warrantyNote: "Гарантия качества и 30 дней на проверку.",
        deliveryNote: "Быстрая доставка по Ташкенту за 2-4 часа.",
        navHome: "Главная",
        navCatalog: "Каталог",
        navCart: "Корзина",
        navProfile: "Профиль",
        refreshSuccess: "Данные обновлены"
      },
      en: {
        appName: "kuzavnoy.uzz",
        subtitle: "Auto Spare Parts",
        greetingTitle: "Hello!",
        greetingDesc: "Find premium spare parts and accessories for your car.",
        searchPlaceholder: "Search parts or car models...",
        officialBadge: "Official Store",
        heroBadge: "Original Spare Parts",
        heroTitle: "Upgrade your vehicle with guaranteed quality!",
        heroDesc: "Factory quality, 30 days warranty, and installation at Farhod auto market.",
        heroBtn: "Browse catalog",
        popularTitle: "Popular Products",
        viewAll: "All",
        addToCart: "Add to cart",
        inCart: "In cart",
        buyNow: "Buy now",
        catalogTitle: "Catalog",
        catalogSubtitle: "All categories and vehicle spare parts",
        allCategories: "All",
        filter: "Filters",
        sortBy: "Sort by",
        sortPopular: "Popular",
        sortPriceAsc: "Price: Low to High",
        sortPriceDesc: "Price: High to Low",
        sortNewest: "Newest",
        conditionNew: "New",
        conditionUsed: "Used (Mint)",
        inStock: "In Stock",
        outOfStock: "On Order",
        stockQty: "items left",
        som: "UZS",
        cartTitle: "Cart",
        cartEmpty: "Your cart is empty",
        cartEmptyDesc: "Browse the catalog and add items you need",
        orderSummary: "Order summary",
        subtotal: "Products",
        delivery: "Delivery",
        deliveryFree: "Free",
        discount: "Discount",
        total: "Total",
        checkoutBtn: "Proceed to Checkout",
        workshopServiceTitle: "Need part installation?",
        workshopServiceDesc: "Professional installation at Farhod market workshop (-10% code: KUZAVNOY-USTA)",
        promoPlaceholder: "Promo code (e.g. KUZAVNOY-USTA)",
        applyPromo: "Apply",
        promoApplied: "Promo code applied (-10%)",
        checkoutTitle: "Order Confirmation",
        nameLabel: "Your Name",
        phoneLabel: "Phone Number",
        deliveryType: "Fulfillment",
        deliveryCourier: "Courier Delivery",
        deliveryPickup: "Self Pickup (Farhod auto market)",
        addressLabel: "Delivery Address",
        detectGps: "Detect GPS",
        paymentType: "Payment Method",
        paymentCard: "Card prepayment (Uzcard / Humo)",
        paymentCash: "Cash on delivery",
        confirmOrder: "Place Order",
        orderSuccessTitle: "Order Placed Successfully!",
        orderSuccessDesc: "Our team will contact you shortly to coordinate delivery.",
        orderId: "Order ID",
        closeBtn: "Close",
        profileTitle: "Profile & Settings",
        ordersTab: "My Orders",
        favoritesTab: "Favorites",
        settingsTab: "Store & Settings",
        noOrders: "No orders placed yet",
        noFavorites: "No saved favorites yet",
        orderStatusNew: "New",
        orderStatusConfirmed: "Confirmed",
        orderStatusPreparing: "Preparing",
        orderStatusShipped: "Out for delivery",
        orderStatusDelivered: "Delivered",
        orderStatusCancelled: "Cancelled",
        storeAddressTitle: "Store Address",
        storeHoursTitle: "Working Hours",
        supportPhoneTitle: "Support Contacts",
        callNow: "Call",
        viewReceipt: "View receipt",
        backBtn: "Back",
        specifications: "Specifications",
        description: "Description",
        reviews: "Customer Reviews",
        writeReview: "Write Review",
        relatedProducts: "Related Parts",
        warrantyNote: "30-day testing period and factory warranty included.",
        deliveryNote: "Express 2-4 hour delivery across Tashkent city.",
        navHome: "Home",
        navCatalog: "Catalog",
        navCart: "Cart",
        navProfile: "Profile",
        refreshSuccess: "Data updated"
      }
    };

    // ==========================================
    // 3. MAIN REACT APPLICATION COMPONENT
    // ==========================================
    function App() {
      // Global Theme & Localization
      const [lang, setLang] = useState(localStorage.getItem('kuzavnoy_lang') || 'uz');
      const [theme, setTheme] = useState(localStorage.getItem('kuzavnoy_theme') || 'dark');
      const isDark = theme === 'dark';

      const t = (key) => (I18N[lang] && I18N[lang][key]) || (I18N['uz'] && I18N['uz'][key]) || key;

      const changeLang = (l) => {
        setLang(l);
        localStorage.setItem('kuzavnoy_lang', l);
      };

      const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('kuzavnoy_theme', next);
      };

      useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }, [isDark]);

      // Telegram User Context
      const tg = window.Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;

      useEffect(() => {
        if (tg) {
          tg.ready();
          tg.expand();
          if (tg.setHeaderColor) tg.setHeaderColor(isDark ? '#090D16' : '#F8FAFC');
          if (tg.setBackgroundColor) tg.setBackgroundColor(isDark ? '#090D16' : '#F8FAFC');
        }
      }, [isDark]);

      // Navigation & Views
      const [activeTab, setActiveTab] = useState('home'); // 'home' | 'catalog' | 'cart' | 'profile'
      const [selectedProduct, setSelectedProduct] = useState(null); // Full Product Detail Page when set!

      // Data States
      const [products, setProducts] = useState([]);
      const [categories, setCategories] = useState([]);
      const [stories, setStories] = useState([]);
      const [reviews, setReviews] = useState([]);
      const [userOrders, setUserOrders] = useState([]);
      const [settings, setSettings] = useState({
        store_address: "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori",
        store_hours: "09:00 - 19:00",
        phone: "+998 90 123 45 67",
        phone2: "+998 97 765 43 21",
        card_number: "8600 5304 1234 5678",
        card_holder: "AZIMXON (KUZAVNOY.UZZ)",
        uzcard_number: "8600 5304 1234 5678",
        humo_number: "9860 1201 5678 4321",
        instagram_url: "https://instagram.com/kuzavnoy.uzz",
        youtube_url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G",
        telegram_channel: "https://t.me/kuzavnoyuz_bot"
      });

      // Cart State (Persisted)
      const [cart, setCart] = useState(() => {
        try {
          const saved = localStorage.getItem('kuzavnoy_cart');
          return saved ? JSON.parse(saved) : [];
        } catch(e) {
          return [];
        }
      });

      useEffect(() => {
        try {
          localStorage.setItem('kuzavnoy_cart', JSON.stringify(cart));
        } catch(e) {}
      }, [cart]);

      // Favorites State (Persisted)
      const [favorites, setFavorites] = useState(() => {
        try {
          const saved = localStorage.getItem('kuzavnoy_favorites');
          return saved ? JSON.parse(saved) : [];
        } catch(e) {
          return [];
        }
      });

      useEffect(() => {
        try {
          localStorage.setItem('kuzavnoy_favorites', JSON.stringify(favorites));
        } catch(e) {}
      }, [favorites]);

      const toggleFavorite = (prodId, e) => {
        if (e) e.stopPropagation();
        setFavorites(prev => {
          const next = prev.includes(prodId) ? prev.filter(id => id !== prodId) : [...prev, prodId];
          return next;
        });
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      };

      // Search & Filters
      const [searchQuery, setSearchQuery] = useState('');
      const [selectedCategory, setSelectedCategory] = useState('Barchasi');
      const [selectedCondition, setSelectedCondition] = useState('all'); // 'all' | 'new' | 'used'
      const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'price_asc' | 'price_desc' | 'newest'
      const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

      // Cart & Checkout
      const [needsInstallation, setNeedsInstallation] = useState(false);
      const [promoInput, setPromoInput] = useState('');
      const [appliedPromo, setAppliedPromo] = useState(null);
      const [checkoutStep, setCheckoutStep] = useState(0); // 0: not checking out, 1: form, 2: success
      const [custName, setCustName] = useState(tgUser ? ((tgUser.first_name || '') + ' ' + (tgUser.last_name || '')).trim() : '');
      const [custPhone, setCustPhone] = useState('+998 ');
      const [custAddress, setCustAddress] = useState('');
      const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' | 'pickup'
      const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'cash'
      const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
      const [createdOrder, setCreatedOrder] = useState(null);
      const [isLocating, setIsLocating] = useState(false);

      // Profile Subtab & Receipts
      const [profileTab, setProfileTab] = useState('orders'); // 'orders' | 'favorites' | 'settings'
      const [selectedReceipt, setSelectedReceipt] = useState(null);

      // Refresh & Feedback
      const [isRefreshing, setIsRefreshing] = useState(false);
      const [toastMessage, setToastMessage] = useState('');

      const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 2500);
      };

      // Fetch Data
      const loadData = async (forceTimestamp = false) => {
        try {
          const t = forceTimestamp ? Date.now() : 0;
          const opts = { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } };
          
          const [catRes, prodRes, storyRes, settRes, revRes] = await Promise.all([
            fetch('/api/categories' + (t ? '?_t=' + t : ''), opts).then(r => r.json()).catch(() => []),
            fetch('/api/products' + (t ? '?_t=' + t : ''), opts).then(r => r.json()).catch(() => []),
            fetch('/api/stories' + (t ? '?_t=' + t : ''), opts).then(r => r.json()).catch(() => []),
            fetch('/api/settings' + (t ? '?_t=' + t : ''), opts).then(r => r.json()).catch(() => null),
            fetch('/api/reviews' + (t ? '?_t=' + t : ''), opts).then(r => r.json()).catch(() => [])
          ]);

          if (Array.isArray(catRes)) setCategories(catRes);
          if (Array.isArray(prodRes)) setProducts(prodRes);
          if (Array.isArray(storyRes)) setStories(storyRes);
          if (settRes && settRes.card_number) setSettings(settRes);
          if (Array.isArray(revRes)) setReviews(revRes);

          if (tgUser?.id) {
            const ordRes = await fetch('/api/user/orders/' + tgUser.id + (t ? '?_t=' + t : ''), opts).then(r => r.json()).catch(() => []);
            if (Array.isArray(ordRes)) setUserOrders(ordRes);
          }
        } catch(e) {
          console.error("Data load error:", e);
        }
      };

      useEffect(() => {
        loadData(false);
      }, []);

      const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData(true);
        setIsRefreshing(false);
        showToast(t('refreshSuccess'));
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      };

      // Cart Actions
      const addToCart = (product, e) => {
        if (e) e.stopPropagation();
        setCart(prev => {
          const exists = prev.find(item => item.id === product.id);
          if (exists) {
            return prev.map(item => item.id === product.id ? { ...item, quantity: (item.quantity || 1) + 1 } : item);
          }
          return [...prev, {
            id: product.id,
            name: product.name,
            new_price: product.new_price,
            old_price: product.old_price,
            image_url: product.image_url,
            category: product.category,
            condition: product.condition || 'Yangi',
            quantity: 1
          }];
        });
        showToast(product.name + " savatchaga qo'shildi");
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      };

      const updateCartQty = (id, delta) => {
        setCart(prev => prev.map(item => {
          if (item.id === id) {
            const nextQty = (item.quantity || 1) + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        }).filter(Boolean));
      };

      const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
      };

      // Cart calculations
      const cartCount = useMemo(() => cart.reduce((acc, it) => acc + (it.quantity || 1), 0), [cart]);
      const cartSubtotal = useMemo(() => cart.reduce((acc, it) => acc + (it.new_price * (it.quantity || 1)), 0), [cart]);
      
      const cartDiscount = useMemo(() => {
        if (appliedPromo) {
          return Math.round(cartSubtotal * 0.10);
        }
        return 0;
      }, [cartSubtotal, appliedPromo]);

      const cartTotal = useMemo(() => {
        const del = deliveryType === 'delivery' ? 0 : 0; // Free delivery promo
        return Math.max(0, cartSubtotal - cartDiscount + del);
      }, [cartSubtotal, cartDiscount, deliveryType]);

      const handleApplyPromo = () => {
        const clean = promoInput.trim().toUpperCase();
        if (clean === 'KUZAVNOY-USTA' || clean === 'KUZAVNOY' || clean === 'DISCOUNT10') {
          setAppliedPromo({ code: clean, discountPercent: 10 });
          showToast(t('promoApplied'));
        } else {
          alert("Promokod yaroqsiz yoki muddati o'tgan.");
        }
      };

      // GPS Geolocation Detection
      const handleDetectGps = () => {
        if (!navigator.geolocation) {
          alert("Qurilmangizda geolokatsiya qo'llab-quvvatlanmaydi.");
          return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocating(false);
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const gpsStr = "GPS: " + lat.toFixed(5) + ", " + lng.toFixed(5);
            setCustAddress(prev => prev ? prev + " (" + gpsStr + ")" : gpsStr);
            showToast("GPS manzil aniqlandi");
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          },
          () => {
            setIsLocating(false);
            alert("Geolokatsiyani aniqlashga ruxsat berilmadi.");
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      };

      // Submit Order (Xatoliklar bartaraf etilgan & Double-click himoyasi)
      const handleSubmitOrder = async (e) => {
        if (e) e.preventDefault();
        if (isSubmittingOrder) return;
        if (cart.length === 0) {
          alert("Savatchangiz bo'sh!");
          return;
        }
        if (!custName.trim()) {
          alert("Iltimos, ism va familiyangizni kiriting!");
          return;
        }
        const digitsOnly = custPhone.replace(/\D/g, '');
        if (digitsOnly.length < 9) {
          alert("Iltimos, to'g'ri telefon raqamingizni kiriting (+998...)!");
          return;
        }

        setIsSubmittingOrder(true);
        try {
          const payload = {
            telegram_id: tgUser?.id || 0,
            customer_name: custName.trim(),
            phone: custPhone.trim(),
            items: cart,
            total_price: cartTotal,
            location: deliveryType === 'pickup' ? "Farhod bozori kuzavnoy.uzz do'konidan olib ketish" : (custAddress.trim() || "Manzil kiritilmagan"),
            delivery_type: deliveryType,
            payment_method: paymentMethod,
            needs_installation: needsInstallation,
            installation_service: needsInstallation ? "Farhod bozori kuzavnoy.uzz ustaxonasi" : null
          };

          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          const orderObj = data.order || (data.id ? data : null);

          if (res.ok && orderObj && orderObj.id) {
            setCreatedOrder(orderObj);
            setCart([]);
            setCheckoutStep(2);
            if (tgUser?.id) {
              fetch('/api/user/orders/' + tgUser.id + '?_t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUserOrders(d); });
            }
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          } else {
            throw new Error(data.error || "Buyurtma yaratib bo'lmadi");
          }
        } catch(err) {
          alert("Xatolik: " + (err.message || "Buyurtma yaratib bo'lmadi"));
        } finally {
          setIsSubmittingOrder(false);
        }
      };

      // Filtered & Sorted Catalog Products
      const filteredProducts = useMemo(() => {
        return products.filter(p => {
          // Search query filter
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesName = (p.name || '').toLowerCase().includes(q);
            const matchesCat = (p.category || '').toLowerCase().includes(q);
            const matchesModel = (p.car_model || '').toLowerCase().includes(q);
            const matchesDesc = (p.description || '').toLowerCase().includes(q);
            if (!matchesName && !matchesCat && !matchesModel && !matchesDesc) return false;
          }
          // Category filter
          if (selectedCategory !== 'Barchasi') {
            if ((p.category || '') !== selectedCategory && (p.car_model || '') !== selectedCategory) {
              return false;
            }
          }
          // Condition filter
          if (selectedCondition === 'new' && p.condition === 'B/U (Ideal)') return false;
          if (selectedCondition === 'used' && p.condition !== 'B/U (Ideal)') return false;

          return true;
        }).sort((a, b) => {
          if (sortBy === 'price_asc') return a.new_price - b.new_price;
          if (sortBy === 'price_desc') return b.new_price - a.new_price;
          if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
          return 0; // 'popular' maintains server order
        });
      }, [products, searchQuery, selectedCategory, selectedCondition, sortBy]);

      // All unique category names from DB + Popular presets
      const allCategoryPills = useMemo(() => {
        const set = new Set();
        categories.forEach(c => set.add(c.name));
        products.forEach(p => { if (p.category) set.add(p.category); });
        // Ensure popular car models exist
        ['Cobalt', 'Gentra', 'Spark', 'Nexia', 'Malibu', 'Tracker', 'Onix', 'Monjaro'].forEach(m => set.add(m));
        return ['Barchasi', ...Array.from(set)];
      }, [categories, products]);

      // ====================================================
      // RENDER: FULL PRODUCT DETAIL PAGE (NOT A TINY MODAL!)
      // ====================================================
      if (selectedProduct) {
        const isFav = favorites.includes(selectedProduct.id);
        const inCartItem = cart.find(it => it.id === selectedProduct.id);
        const prodReviews = reviews.filter(r => r.product_id === selectedProduct.id);
        const avgRating = prodReviews.length > 0 ? (prodReviews.reduce((s, r) => s + r.rating, 0) / prodReviews.length).toFixed(1) : "5.0";
        const related = products.filter(p => p.id !== selectedProduct.id && (p.category === selectedProduct.category || p.car_model === selectedProduct.car_model)).slice(0, 4);

        return (
          <div className={'min-h-screen flex flex-col ' + (isDark ? 'bg-[#090D16] text-[#F8FAFC]' : 'bg-[#F8FAFC] text-[#0F172A]')}>
            {/* Top Sticky App Bar */}
            <div className={'sticky top-0 z-40 px-4 py-3 border-b flex items-center justify-between backdrop-blur-md ' + 
              (isDark ? 'bg-[#090D16]/90 border-[#1F2B45]' : 'bg-white/90 border-[#E2E8F0]')}>
              <button 
                onClick={() => setSelectedProduct(null)}
                className={'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 ' + 
                  (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700')}
              >
                <Icon name="arrow-left" className="w-4 h-4" />
                <span>{t('backBtn')}</span>
              </button>

              <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                <Icon name="car" className="w-4 h-4 text-rose-500" />
                <span>{selectedProduct.category || selectedProduct.car_model || "Universal"}</span>
              </div>

              <button 
                onClick={(e) => toggleFavorite(selectedProduct.id, e)}
                className={'w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                  (isFav 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                    : (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-400' : 'bg-white border-slate-200 text-slate-600'))}
              >
                <Icon name={isFav ? "heart-solid" : "heart"} className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Product Details Content */}
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="max-w-3xl mx-auto px-4 pt-4 space-y-6">
                {/* Large Product Gallery Image */}
                <div className={'aspect-[4/3] w-full rounded-2xl overflow-hidden border relative flex items-center justify-center ' + 
                  (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                  {selectedProduct.image_url ? (
                    <img 
                      src={selectedProduct.image_url} 
                      alt={selectedProduct.name} 
                      className="w-full h-full object-cover object-center" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Icon name="package" className="w-16 h-16 stroke-[1.2] mb-2" />
                      <span className="text-xs">Rasm mavjud emas</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={'text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg tracking-wider ' + 
                      (selectedProduct.condition === 'B/U (Ideal)' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')}>
                      {selectedProduct.condition === 'B/U (Ideal)' ? t('conditionUsed') : t('conditionNew')}
                    </span>
                    {selectedProduct.old_price > selectedProduct.new_price && (
                      <span className="text-[10px] font-extrabold bg-rose-600 text-white px-2 py-0.5 rounded-lg">
                        -{Math.round(((selectedProduct.old_price - selectedProduct.new_price) / selectedProduct.old_price) * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Product Title, Rating & Stock Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                      <Icon name="star" className="w-4 h-4 text-amber-400" />
                      <span>{avgRating}</span>
                      <span className="text-slate-500 font-normal">({prodReviews.length || 18} ta sharh)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className={'w-2 h-2 rounded-full ' + ((selectedProduct.stock === undefined || selectedProduct.stock > 0) ? 'bg-emerald-500' : 'bg-rose-500')}></span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                        {(selectedProduct.stock === undefined || selectedProduct.stock > 0) 
                          ? ((selectedProduct.stock !== undefined ? selectedProduct.stock : 10) + ' ' + t('stockQty')) 
                          : t('outOfStock')}
                      </span>
                    </div>
                  </div>

                  <h1 className="text-xl font-extrabold tracking-tight leading-snug">
                    {selectedProduct.name}
                  </h1>

                  {/* Price Block */}
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-2xl font-black text-rose-500 tracking-tight">
                      {selectedProduct.new_price?.toLocaleString()} {t('som')}
                    </span>
                    {selectedProduct.old_price > selectedProduct.new_price && (
                      <span className="text-sm font-semibold line-through text-slate-500">
                        {selectedProduct.old_price?.toLocaleString()} {t('som')}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Key Highlights Cards */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={'p-3 rounded-xl border flex flex-col items-center justify-center ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <Icon name="shield-check" className="w-5 h-5 text-emerald-500 mb-1" />
                    <span className="text-[11px] font-bold">30 Kun</span>
                    <span className="text-[9px] text-slate-500">Sinov kafolati</span>
                  </div>
                  <div className={'p-3 rounded-xl border flex flex-col items-center justify-center ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <Icon name="truck" className="w-5 h-5 text-blue-500 mb-1" />
                    <span className="text-[11px] font-bold">2-4 Soat</span>
                    <span className="text-[9px] text-slate-500">Tezkor yetkazish</span>
                  </div>
                  <div className={'p-3 rounded-xl border flex flex-col items-center justify-center ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <Icon name="wrench" className="w-5 h-5 text-rose-500 mb-1" />
                    <span className="text-[11px] font-bold">Farhod Bozori</span>
                    <span className="text-[9px] text-slate-500">O'rnatish servisi</span>
                  </div>
                </div>

                {/* Specifications Table */}
                <div className={'rounded-2xl border p-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Icon name="sliders" className="w-4 h-4 text-rose-500" />
                    <span>{t('specifications')}</span>
                  </h3>
                  <div className="divide-y divide-slate-800/40 text-xs">
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500">Mos model</span>
                      <span className="font-bold">{selectedProduct.car_model || selectedProduct.category || "Universal"}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500">Holati</span>
                      <span className="font-bold">{selectedProduct.condition || t('conditionNew')}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500">Rangi</span>
                      <span className="font-bold">{selectedProduct.color || "Standart"}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500">Omborda</span>
                      <span className="font-bold text-emerald-500">{selectedProduct.stock !== undefined ? selectedProduct.stock : 10} dona</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500">Kafolat</span>
                      <span className="font-bold">30 kun rasmiy kafolat</span>
                    </div>
                  </div>
                </div>

                {/* Description & Features */}
                <div className={'rounded-2xl border p-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Icon name="info" className="w-4 h-4 text-rose-500" />
                    <span>{t('description')}</span>
                  </h3>
                  <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                    {selectedProduct.description || "Ushbu ehtiyot qism zavod standartlariga to'liq mos keladi. Original materiallardan tayyorlangan bo'lib, avtomobilingiz xavfsizligi va qulayligini kafolatlaydi."}
                  </p>

                  {/* Bullet points */}
                  {selectedProduct.details && (
                    <div className="mt-3 space-y-1.5">
                      {(Array.isArray(selectedProduct.details) ? selectedProduct.details : []).map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                          <Icon name="check" className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Workshop Installation Partner Card */}
                <div className={'rounded-2xl border p-4 flex items-start gap-3.5 border-rose-500/30 ' + 
                  (isDark ? 'bg-gradient-to-br from-rose-950/30 to-[#101726]' : 'bg-rose-50/50')}>
                  <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-500 flex items-center justify-center shrink-0">
                    <Icon name="wrench" className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-rose-500 uppercase tracking-wide">Hamkor Servis</div>
                    <div className="text-sm font-extrabold mt-0.5">O'rnatib berish xizmati mavjud</div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozoridagi ustaxonamizda o'rnatib beramiz.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-rose-600/10 border border-rose-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-400">
                      <Icon name="tag" className="w-3.5 h-3.5" />
                      <span>Promokod: KUZAVNOY-USTA (-10%)</span>
                    </div>
                  </div>
                </div>

                {/* Related Products */}
                {related.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black tracking-tight mb-3 flex items-center gap-2">
                      <Icon name="grid" className="w-4 h-4 text-rose-500" />
                      <span>{t('relatedProducts')}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {related.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => { setSelectedProduct(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className={'p-3 rounded-2xl border cursor-pointer transition active:scale-95 ' + 
                            (isDark ? 'bg-[#101726] border-[#1F2B45] hover:border-slate-700' : 'bg-white border-slate-200')}
                        >
                          <div className="aspect-video rounded-xl overflow-hidden mb-2 bg-slate-800/10">
                            {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                          </div>
                          <div className="text-xs font-bold line-clamp-1">{p.name}</div>
                          <div className="text-xs font-black text-rose-500 mt-1">{p.new_price?.toLocaleString()} {t('som')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Bottom Purchase Bar */}
            <div className={'fixed bottom-0 left-0 right-0 z-50 p-3 border-t backdrop-blur-xl ' + 
              (isDark ? 'bg-[#090D16]/95 border-[#1F2B45]' : 'bg-white/95 border-slate-200')}>
              <div className="max-w-3xl mx-auto flex items-center gap-3">
                <div className="shrink-0 px-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">{t('total')}</div>
                  <div className="text-base font-black text-rose-500 leading-tight">
                    {selectedProduct.new_price?.toLocaleString()} {t('som')}
                  </div>
                </div>

                <div className="flex-1 flex items-center gap-2">
                  <button 
                    onClick={(e) => addToCart(selectedProduct, e)}
                    className={'flex-1 py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 ' + 
                      (inCartItem 
                        ? 'bg-emerald-600 text-white' 
                        : (isDark ? 'bg-[#162033] border border-[#1F2B45] text-slate-200 hover:bg-[#1C2942]' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'))}
                  >
                    <Icon name={inCartItem ? "check" : "cart"} className="w-4 h-4" />
                    <span>{inCartItem ? t('inCart') + ' (' + inCartItem.quantity + ')' : t('addToCart')}</span>
                  </button>

                  <button 
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                      setActiveTab('cart');
                    }}
                    className="flex-1 py-3 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-rose-950/40"
                  >
                    <span>{t('buyNow')}</span>
                    <Icon name="arrow-right" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // ====================================================
      // RENDER: MAIN APPLICATION VIEWS (HOME / CATALOG / CART / PROFILE)
      // ====================================================
      return (
        <div className={'min-h-screen flex flex-col safe-bottom transition-colors duration-200 ' + 
          (isDark ? 'bg-[#090D16] text-[#F8FAFC]' : 'bg-[#F8FAFC] text-[#0F172A]')}>

          {/* Floating Live Toast Notification */}
          {toastMessage && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-400/40 animate-bounce pointer-events-none">
              <Icon name="check-circle" className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* TOP HEADER (COMPACT, SLEEK SAAS HEADER) */}
          <header className={'sticky top-0 z-30 px-4 py-3 border-b flex items-center justify-between backdrop-blur-md ' + 
            (isDark ? 'bg-[#090D16]/90 border-[#1F2B45]' : 'bg-white/90 border-slate-200')}>
            
            {/* Brand Logo & Name */}
            <div 
              onClick={() => { setActiveTab('home'); setSelectedCategory('Barchasi'); }}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center font-black shadow-md shadow-rose-950/30">
                <Icon name="car" className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight leading-none">{t('appName')}</div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{t('subtitle')}</div>
              </div>
            </div>

            {/* Controls: Refresh, Language, Theme */}
            <div className="flex items-center gap-1.5">
              {/* Refresh Button */}
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Yangilash"
                className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                  (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600')}
              >
                <span className={isRefreshing ? 'animate-spin-custom text-rose-500' : ''}>
                  <Icon name="refresh" className="w-4 h-4" />
                </span>
              </button>

              {/* Language Switcher */}
              <div className={'flex items-center p-0.5 rounded-xl border text-[10px] font-bold ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                {['uz', 'ru', 'en'].map(code => (
                  <button
                    key={code}
                    onClick={() => changeLang(code)}
                    className={'px-1.5 py-0.5 rounded-lg uppercase transition ' + 
                      (lang === code 
                        ? 'bg-rose-600 text-white font-extrabold shadow-sm' 
                        : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                title="Mavzuni almashtirish"
                className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                  (isDark ? 'bg-[#101726] border-[#1F2B45] text-amber-400' : 'bg-white border-slate-200 text-slate-700')}
              >
                <Icon name={isDark ? "sun" : "moon"} className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ==================================================== */}
          {/* TAB 1: ASOSIY (HOME PAGE) */}
          {/* ==================================================== */}
          {activeTab === 'home' && (
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-3.5 space-y-4">
              {/* 1. Personalized Greeting Section */}
              <div className={'rounded-2xl border p-4 flex flex-col justify-between ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">
                    <Icon name="shield-check" className="w-3.5 h-3.5" />
                    <span>{t('officialBadge')}</span>
                  </div>
                  <h2 className="text-base font-extrabold tracking-tight">
                    {t('greetingTitle')} {tgUser ? (tgUser.first_name || '') : ''}
                  </h2>
                  <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {t('greetingDesc')}
                  </p>
                </div>

                {/* Quick Search Launcher */}
                <div 
                  onClick={() => setActiveTab('catalog')}
                  className={'mt-3.5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ' + 
                    (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500')}
                >
                  <Icon name="search" className="w-4 h-4 text-rose-500" />
                  <span className="text-xs">{t('searchPlaceholder')}</span>
                </div>
              </div>

              {/* 2. Official Social Channels Card (Clean, SVG-based) */}
              <div className={'rounded-2xl border p-3.5 flex items-center justify-between gap-2 ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Rasmiy sahifalar:</span>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={settings.instagram_url || "https://instagram.com/kuzavnoy.uzz"} 
                    target="_blank" 
                    rel="noreferrer"
                    className={'p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition active:scale-95 ' + 
                      (isDark ? 'bg-[#162033] border-[#1F2B45] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700')}
                  >
                    <Icon name="instagram" className="w-4 h-4 text-pink-500" />
                    <span className="hidden sm:inline">Instagram</span>
                  </a>

                  <a 
                    href={settings.youtube_url || "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"} 
                    target="_blank" 
                    rel="noreferrer"
                    className={'p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition active:scale-95 ' + 
                      (isDark ? 'bg-[#162033] border-[#1F2B45] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700')}
                  >
                    <Icon name="youtube" className="w-4 h-4 text-red-500" />
                    <span className="hidden sm:inline">YouTube</span>
                  </a>

                  <a 
                    href="https://t.me/kuzavnoyuz_bot" 
                    target="_blank" 
                    rel="noreferrer"
                    className={'p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition active:scale-95 ' + 
                      (isDark ? 'bg-[#162033] border-[#1F2B45] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700')}
                  >
                    <Icon name="telegram" className="w-4 h-4 text-sky-400" />
                    <span className="hidden sm:inline">Telegram</span>
                  </a>
                </div>
              </div>

              {/* 3. Category Shortcuts (Horizontally Scrollable Chips) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Toifalar & Modellar</span>
                  <button 
                    onClick={() => setActiveTab('catalog')} 
                    className="text-xs font-bold text-rose-500 hover:underline"
                  >
                    {t('viewAll')} →
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {allCategoryPills.slice(0, 12).map((catName) => {
                    const isSelected = selectedCategory === catName;
                    return (
                      <button
                        key={catName}
                        onClick={() => {
                          setSelectedCategory(catName);
                          setActiveTab('catalog');
                        }}
                        className={'px-3.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ' + 
                          (isSelected 
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/40' 
                            : (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-300 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-700'))}
                      >
                        <Icon name={catName === 'Barchasi' ? 'grid' : 'car'} className="w-3.5 h-3.5 opacity-80" />
                        <span>{catName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Premium Hero Promotional Banner */}
              <div className={'rounded-3xl border p-5 relative overflow-hidden shadow-xl ' + 
                (isDark 
                  ? 'bg-gradient-to-br from-[#162033] via-[#101726] to-[#090D16] border-[#1F2B45]' 
                  : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-800')}>
                {/* Background automotive motif */}
                <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
                  <Icon name="car" className="w-48 h-48" />
                </div>

                <div className="relative z-10 max-w-sm">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/20 border border-rose-500/30 text-[10px] font-extrabold text-rose-400 uppercase tracking-wider mb-2.5">
                    <Icon name="tag" className="w-3 h-3" />
                    <span>{t('heroBadge')}</span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight leading-snug">
                    {t('heroTitle')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {t('heroDesc')}
                  </p>
                  <button 
                    onClick={() => setActiveTab('catalog')}
                    className="mt-4 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition active:scale-95 shadow-lg shadow-rose-950/40 flex items-center gap-2"
                  >
                    <span>{t('heroBtn')}</span>
                    <Icon name="arrow-right" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 5. Featured / Popular Products Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="tag" className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-black tracking-tight">{t('popularTitle')}</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('catalog')} 
                    className="text-xs font-bold text-rose-500 hover:underline"
                  >
                    {t('viewAll')} ({products.length})
                  </button>
                </div>

                {/* 2-Column Responsive Product Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {products.slice(0, 8).map(prod => {
                    const isFav = favorites.includes(prod.id);
                    const inCartItem = cart.find(it => it.id === prod.id);

                    return (
                      <div 
                        key={prod.id}
                        onClick={() => setSelectedProduct(prod)}
                        className={'rounded-2xl border p-3 flex flex-col justify-between cursor-pointer transition-all active:scale-[0.98] hover:border-rose-500/50 group ' + 
                          (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}
                      >
                        {/* Image Container with Badges */}
                        <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-slate-800/10 flex items-center justify-center">
                          {prod.image_url ? (
                            <img 
                              src={prod.image_url} 
                              alt={prod.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                            />
                          ) : (
                            <Icon name="package" className="w-10 h-10 text-slate-500 stroke-[1.2]" />
                          )}

                          {/* Top Condition Badge */}
                          <span className={'absolute top-2 left-2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ' + 
                            (prod.condition === 'B/U (Ideal)' ? 'bg-amber-500/80 text-white' : 'bg-black/60 text-white backdrop-blur')}>
                            {prod.condition === 'B/U (Ideal)' ? t('conditionUsed') : t('conditionNew')}
                          </span>

                          {/* Favorite Heart Button */}
                          <button 
                            onClick={(e) => toggleFavorite(prod.id, e)}
                            className={'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur transition active:scale-90 ' + 
                              (isFav ? 'bg-rose-600 text-white' : 'bg-black/40 text-white hover:bg-black/60')}
                          >
                            <Icon name={isFav ? "heart-solid" : "heart"} className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider line-clamp-1">
                              {prod.car_model || prod.category || "Universal"}
                            </div>
                            <h4 className="text-xs font-bold mt-0.5 line-clamp-2 leading-tight">
                              {prod.name}
                            </h4>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between gap-1">
                            <div>
                              <div className="text-xs font-black text-rose-500">
                                {prod.new_price?.toLocaleString()} {t('som')}
                              </div>
                              {prod.old_price > prod.new_price && (
                                <div className="text-[10px] line-through text-slate-500">
                                  {prod.old_price?.toLocaleString()}
                                </div>
                              )}
                            </div>

                            <button 
                              onClick={(e) => addToCart(prod, e)}
                              className={'w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90 ' + 
                                (inCartItem ? 'bg-emerald-600 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/30')}
                            >
                              <Icon name={inCartItem ? "check" : "plus"} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </main>
          )}

          {/* ==================================================== */}
          {/* TAB 2: KATALOG (CATALOG & SEARCH PAGE) */}
          {/* ==================================================== */}
          {activeTab === 'catalog' && (
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-3.5 space-y-3.5">
              {/* Search Bar with Instant Clear */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-500">
                  <Icon name="search" className="w-4 h-4" />
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className={'w-full pl-10 pr-10 py-2.5 rounded-2xl border text-xs font-medium focus:outline-none focus:border-rose-500 transition ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45] text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                  >
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Pills Bar */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {allCategoryPills.map(catName => {
                  const isSel = selectedCategory === catName;
                  return (
                    <button
                      key={catName}
                      onClick={() => setSelectedCategory(catName)}
                      className={'px-3.5 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition active:scale-95 ' + 
                        (isSel 
                          ? 'bg-rose-600 text-white border-rose-500 shadow-sm' 
                          : (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-300' : 'bg-white border-slate-200 text-slate-700'))}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>

              {/* Sorting & Filter Controls Bar */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-xs text-slate-400 font-semibold">
                  Topildi: <span className="text-rose-500 font-bold">{filteredProducts.length}</span> ta mahsulot
                </div>

                <div className="flex items-center gap-2">
                  {/* Sorting Select */}
                  <select 
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className={'text-xs font-bold py-1.5 px-2.5 rounded-xl border focus:outline-none ' + 
                      (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-300' : 'bg-white border-slate-200 text-slate-700')}
                  >
                    <option value="popular">{t('sortPopular')}</option>
                    <option value="price_asc">{t('sortPriceAsc')}</option>
                    <option value="price_desc">{t('sortPriceDesc')}</option>
                    <option value="newest">{t('sortNewest')}</option>
                  </select>

                  {/* Condition Filter Toggle */}
                  <button 
                    onClick={() => setSelectedCondition(prev => prev === 'all' ? 'new' : prev === 'new' ? 'used' : 'all')}
                    className={'px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 ' + 
                      (selectedCondition !== 'all' ? 'bg-rose-600 text-white border-rose-500' : (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-400' : 'bg-white border-slate-200 text-slate-600'))}
                  >
                    <Icon name="sliders" className="w-3.5 h-3.5" />
                    <span>{selectedCondition === 'all' ? 'Barchasi' : selectedCondition === 'new' ? t('conditionNew') : t('conditionUsed')}</span>
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/40 text-slate-500 mx-auto flex items-center justify-center mb-3">
                    <Icon name="search" className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <h4 className="text-sm font-bold">Mahsulot topilmadi</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Kiritilgan so'rov yoki filtrlar bo'yicha ehtiyot qism mavjud emas. Filtrlarni tozalab ko'ring.
                  </p>
                  <button 
                    onClick={() => { setSearchQuery(''); setSelectedCategory('Barchasi'); setSelectedCondition('all'); }}
                    className="mt-4 px-4 py-2 bg-rose-600/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold"
                  >
                    Filtrlarni tiklash
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredProducts.map(prod => {
                    const isFav = favorites.includes(prod.id);
                    const inCartItem = cart.find(it => it.id === prod.id);

                    return (
                      <div 
                        key={prod.id}
                        onClick={() => setSelectedProduct(prod)}
                        className={'rounded-2xl border p-3 flex flex-col justify-between cursor-pointer transition active:scale-[0.98] hover:border-rose-500/50 ' + 
                          (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-slate-800/10 flex items-center justify-center">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="package" className="w-10 h-10 text-slate-500 stroke-[1.2]" />
                          )}
                          <span className={'absolute top-2 left-2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ' + 
                            (prod.condition === 'B/U (Ideal)' ? 'bg-amber-500/80 text-white' : 'bg-black/60 text-white backdrop-blur')}>
                            {prod.condition === 'B/U (Ideal)' ? t('conditionUsed') : t('conditionNew')}
                          </span>
                          <button 
                            onClick={(e) => toggleFavorite(prod.id, e)}
                            className={'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur transition active:scale-90 ' + 
                              (isFav ? 'bg-rose-600 text-white' : 'bg-black/40 text-white')}
                          >
                            <Icon name={isFav ? "heart-solid" : "heart"} className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider line-clamp-1">
                              {prod.car_model || prod.category || "Universal"}
                            </div>
                            <h4 className="text-xs font-bold mt-0.5 line-clamp-2 leading-tight">
                              {prod.name}
                            </h4>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between gap-1">
                            <div>
                              <div className="text-xs font-black text-rose-500">
                                {prod.new_price?.toLocaleString()} {t('som')}
                              </div>
                              {prod.old_price > prod.new_price && (
                                <div className="text-[10px] line-through text-slate-500">
                                  {prod.old_price?.toLocaleString()}
                                </div>
                              )}
                            </div>

                            <button 
                              onClick={(e) => addToCart(prod, e)}
                              className={'w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90 ' + 
                                (inCartItem ? 'bg-emerald-600 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/30')}
                            >
                              <Icon name={inCartItem ? "check" : "plus"} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          )}

          {/* ==================================================== */}
          {/* TAB 3: SAVATCHA & BUYURTMA (CART & CHECKOUT) */}
          {/* ==================================================== */}
          {activeTab === 'cart' && (
            <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-3.5 space-y-4">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Icon name="cart" className="w-5 h-5 text-rose-500" />
                <span>{t('cartTitle')}</span>
                {cartCount > 0 && <span className="text-xs font-bold text-slate-400">({cartCount} ta)</span>}
              </h2>

              {cart.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/30 text-slate-500 mx-auto flex items-center justify-center mb-3">
                    <Icon name="cart" className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <h3 className="text-base font-bold">{t('cartEmpty')}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {t('cartEmptyDesc')}
                  </p>
                  <button 
                    onClick={() => setActiveTab('catalog')}
                    className="mt-5 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition active:scale-95 shadow-lg shadow-rose-950/40"
                  >
                    Katalogga o'tish →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items List */}
                  <div className="space-y-2.5">
                    {cart.map(item => (
                      <div 
                        key={item.id}
                        className={'p-3 rounded-2xl border flex items-center gap-3 ' + 
                          (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800/20 shrink-0 flex items-center justify-center">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="package" className="w-6 h-6 text-slate-500 stroke-[1.5]" />
                          )}
                        </div>

                        {/* Title & Price */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-rose-500 uppercase">{item.category}</div>
                          <h4 className="text-xs font-bold truncate leading-tight mt-0.5">{item.name}</h4>
                          <div className="text-xs font-black text-rose-500 mt-1">
                            {item.new_price?.toLocaleString()} {t('som')}
                          </div>
                        </div>

                        {/* Quantity Controls & Remove */}
                        <div className="flex items-center gap-2">
                          <div className={'flex items-center rounded-xl border text-xs font-bold ' + 
                            (isDark ? 'bg-[#162033] border-[#1F2B45]' : 'bg-slate-50 border-slate-200')}>
                            <button 
                              onClick={() => updateCartQty(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center hover:text-rose-500 active:scale-90"
                            >
                              <Icon name="minus" className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-extrabold">{item.quantity}</span>
                            <button 
                              onClick={() => updateCartQty(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center hover:text-rose-500 active:scale-90"
                            >
                              <Icon name="plus" className="w-3 h-3" />
                            </button>
                          </div>

                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-500 transition"
                            title="O'chirish"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Workshop Installation Service Checkbox */}
                  <div 
                    onClick={() => setNeedsInstallation(!needsInstallation)}
                    className={'p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ' + 
                      (needsInstallation 
                        ? 'bg-rose-600/10 border-rose-500/40' 
                        : (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200'))}
                  >
                    <div className={'w-5 h-5 rounded-lg border flex items-center justify-center mt-0.5 transition ' + 
                      (needsInstallation ? 'bg-rose-600 border-rose-500 text-white' : 'border-slate-600')}>
                      {needsInstallation && <Icon name="check" className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Icon name="wrench" className="w-3.5 h-3.5 text-rose-500" />
                        <span>{t('workshopServiceTitle')}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {t('workshopServiceDesc')}
                      </p>
                    </div>
                  </div>

                  {/* Promo Code Input */}
                  <div className={'p-3 rounded-2xl border flex gap-2 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <input 
                      type="text" 
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value)}
                      placeholder={t('promoPlaceholder')}
                      className={'flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none uppercase font-bold ' + 
                        (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                    <button 
                      onClick={handleApplyPromo}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition active:scale-95"
                    >
                      {t('applyPromo')}
                    </button>
                  </div>

                  {/* Order Pricing Breakdown */}
                  <div className={'p-4 rounded-2xl border space-y-2 text-xs ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="flex justify-between text-slate-400">
                      <span>{t('subtotal')}</span>
                      <span className="font-bold text-slate-200">{cartSubtotal.toLocaleString()} {t('som')}</span>
                    </div>

                    {cartDiscount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>{t('discount')} (-10%)</span>
                        <span>-{cartDiscount.toLocaleString()} {t('som')}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-400">
                      <span>{t('delivery')}</span>
                      <span className="text-emerald-400 font-bold">{t('deliveryFree')}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/40 flex justify-between items-baseline">
                      <span className="text-sm font-extrabold">{t('total')}</span>
                      <span className="text-lg font-black text-rose-500">{cartTotal.toLocaleString()} {t('som')}</span>
                    </div>
                  </div>

                  {/* Checkout CTA Button */}
                  <button 
                    onClick={() => setCheckoutStep(1)}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-sm transition active:scale-95 shadow-xl shadow-rose-950/40 flex items-center justify-center gap-2"
                  >
                    <span>{t('checkoutBtn')}</span>
                    <Icon name="arrow-right" className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ========================================= */}
              {/* CHECKOUT MODAL / STEPPER */}
              {/* ========================================= */}
              {checkoutStep === 1 && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-3 sm:p-4 flex items-center justify-center min-h-screen">
                  <div className={'w-full max-w-lg my-auto rounded-3xl border shadow-2xl p-5 space-y-4 max-h-[92vh] flex flex-col overflow-hidden ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-white border-slate-200 text-slate-900')}>
                    
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
                      <h3 className="text-base font-black flex items-center gap-2">
                        <Icon name="truck" className="w-5 h-5 text-rose-500" />
                        <span>{t('checkoutTitle')}</span>
                      </h3>
                      <button 
                        onClick={() => setCheckoutStep(0)}
                        className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold"
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto space-y-3.5 text-xs pr-1">
                      {/* Name & Phone */}
                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">{t('nameLabel')} *</label>
                        <input 
                          type="text" 
                          required
                          value={custName}
                          onChange={e => setCustName(e.target.value)}
                          placeholder="Azizbek Rahimov"
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">{t('phoneLabel')} *</label>
                        <input 
                          type="tel" 
                          required
                          value={custPhone}
                          onChange={e => setCustPhone(e.target.value)}
                          placeholder="+998 90 123 45 67"
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      {/* Delivery Mode Choice */}
                      <div>
                        <label className="block mb-1.5 font-semibold text-slate-400">{t('deliveryType')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDeliveryType('delivery')}
                            className={'p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ' + 
                              (deliveryType === 'delivery' ? 'bg-rose-600/10 border-rose-500 text-rose-400' : 'bg-[#090D16] border-[#1F2B45] text-slate-400')}
                          >
                            <Icon name="truck" className="w-4 h-4" />
                            <span>Yetkazib berish</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeliveryType('pickup')}
                            className={'p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ' + 
                              (deliveryType === 'pickup' ? 'bg-rose-600/10 border-rose-500 text-rose-400' : 'bg-[#090D16] border-[#1F2B45] text-slate-400')}
                          >
                            <Icon name="package" className="w-4 h-4" />
                            <span>Olib ketish (Farhod)</span>
                          </button>
                        </div>
                      </div>

                      {/* Address / GPS */}
                      {deliveryType === 'delivery' && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-semibold text-slate-400">{t('addressLabel')} *</label>
                            <button 
                              type="button"
                              onClick={handleDetectGps}
                              disabled={isLocating}
                              className="text-[11px] font-bold text-rose-500 flex items-center gap-1 hover:underline"
                            >
                              <Icon name="map-pin" className="w-3.5 h-3.5" />
                              <span>{isLocating ? "Aniqlanmoqda..." : t('detectGps')}</span>
                            </button>
                          </div>
                          <textarea 
                            rows="2"
                            required
                            value={custAddress}
                            onChange={e => setCustAddress(e.target.value)}
                            placeholder="Toshkent sh., Chilonzor tumani, 9-mavze, 12-uy"
                            className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                              (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                          />
                        </div>
                      )}

                      {/* Payment Method */}
                      <div>
                        <label className="block mb-1.5 font-semibold text-slate-400">{t('paymentType')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('card')}
                            className={'p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ' + 
                              (paymentMethod === 'card' ? 'bg-rose-600/10 border-rose-500 text-rose-400' : 'bg-[#090D16] border-[#1F2B45] text-slate-400')}
                          >
                            <Icon name="tag" className="w-4 h-4" />
                            <span>Karta (Uzcard / Humo)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={'p-2.5 rounded-xl border text-left font-bold transition flex items-center gap-2 ' + 
                              (paymentMethod === 'cash' ? 'bg-rose-600/10 border-rose-500 text-rose-400' : 'bg-[#090D16] border-[#1F2B45] text-slate-400')}
                          >
                            <Icon name="shield-check" className="w-4 h-4" />
                            <span>Qabulda (Naqd)</span>
                          </button>
                        </div>
                      </div>

                      {/* Card Information Box if Card selected */}
                      {paymentMethod === 'card' && (
                        <div className="p-3 rounded-xl border border-dashed border-rose-500/30 bg-rose-950/10 space-y-1.5 text-[11px]">
                          <div className="font-bold text-rose-400">Do'kon karta raqami:</div>
                          <div className="flex items-center justify-between font-mono font-bold text-xs bg-black/40 p-2 rounded-lg">
                            <span>{settings.card_number || "8600 5304 1234 5678"}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(settings.card_number || "8600530412345678");
                                showToast("Karta raqami nusxalandi");
                              }}
                              className="text-rose-400 hover:text-white"
                            >
                              <Icon name="copy" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-slate-400">{settings.card_holder || "AZIMXON (KUZAVNOY.UZZ)"}</div>
                        </div>
                      )}

                      {/* Total to pay */}
                      <div className="pt-2 flex justify-between items-baseline font-black text-sm">
                        <span>To'lov summasi:</span>
                        <span className="text-rose-500 text-base">{cartTotal.toLocaleString()} {t('som')}</span>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSubmittingOrder}
                        className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs transition active:scale-95 shadow-lg shadow-rose-950/40"
                      >
                        {isSubmittingOrder ? "Yuborilmoqda..." : t('confirmOrder')}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Order Placed Success Modal */}
              {checkoutStep === 2 && createdOrder && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                  <div className={'w-full max-w-sm rounded-3xl border shadow-2xl p-6 text-center space-y-4 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-white border-slate-200 text-slate-900')}>
                    <div className="w-14 h-14 rounded-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center mx-auto">
                      <Icon name="check-circle" className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{t('orderSuccessTitle')}</h3>
                      <p className="text-xs text-slate-400 mt-1">{t('orderSuccessDesc')}</p>
                      <div className="mt-3 p-2.5 rounded-xl bg-black/40 font-mono text-xs font-bold text-rose-400">
                        {t('orderId')}: #{createdOrder.id}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setCheckoutStep(0);
                        setCreatedOrder(null);
                        setActiveTab('profile');
                        setProfileTab('orders');
                      }}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs transition active:scale-95"
                    >
                      Buyurtmani ko'rish →
                    </button>
                  </div>
                </div>
              )}
            </main>
          )}

          {/* ==================================================== */}
          {/* TAB 4: PROFIL & SOZLAMALAR (PROFILE DASHBOARD) */}
          {/* ==================================================== */}
          {activeTab === 'profile' && (
            <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-3.5 space-y-4">
              {/* User Identity Card */}
              <div className={'rounded-2xl border p-4 flex items-center justify-between ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center font-black text-lg shadow-md shadow-rose-950/30">
                    {tgUser?.first_name ? tgUser.first_name[0].toUpperCase() : 'K'}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight">
                      {tgUser ? ((tgUser.first_name || '') + ' ' + (tgUser.last_name || '')).trim() : "Mijoz (Telegram)"}
                    </h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {tgUser?.username ? '@' + tgUser.username : "ID: " + (tgUser?.id || "Kuzavnoy Mijoz")}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-rose-600/10 text-rose-400 border border-rose-500/20">
                  Faol Mijoz
                </span>
              </div>

              {/* Subtabs: Buyurtmalarim | Yoqtirganlar | Sozlamalar */}
              <div className={'p-1 rounded-2xl border flex text-xs font-bold ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                <button 
                  onClick={() => setProfileTab('orders')}
                  className={'flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ' + 
                    (profileTab === 'orders' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
                >
                  <Icon name="truck" className="w-3.5 h-3.5" />
                  <span>{t('ordersTab')}</span>
                </button>

                <button 
                  onClick={() => setProfileTab('favorites')}
                  className={'flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ' + 
                    (profileTab === 'favorites' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
                >
                  <Icon name="heart" className="w-3.5 h-3.5" />
                  <span>{t('favoritesTab')}</span>
                </button>

                <button 
                  onClick={() => setProfileTab('settings')}
                  className={'flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ' + 
                    (profileTab === 'settings' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
                >
                  <Icon name="sliders" className="w-3.5 h-3.5" />
                  <span>{t('settingsTab')}</span>
                </button>
              </div>

              {/* Subtab 1: Orders */}
              {profileTab === 'orders' && (
                <div className="space-y-3">
                  {userOrders.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      <Icon name="package" className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-[1.5]" />
                      <p>{t('noOrders')}</p>
                    </div>
                  ) : (
                    userOrders.map(order => {
                      const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
                      const statusColor = order.status === 'Yetkazildi' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

                      return (
                        <div 
                          key={order.id}
                          className={'p-4 rounded-2xl border space-y-3 ' + 
                            (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-black">Buyurtma #{order.id}</div>
                            <span className={'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg border ' + statusColor}>
                              {order.status || t('orderStatusNew')}
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 space-y-1">
                            {items.map((it, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="truncate max-w-[200px]">{it.name} (x{it.quantity || 1})</span>
                                <span className="font-bold text-slate-300">{((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} {t('som')}</span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between text-xs">
                            <div className="font-black text-rose-500">
                              Jami: {order.total_price?.toLocaleString()} {t('som')}
                            </div>

                            <button 
                              onClick={() => setSelectedReceipt(order)}
                              className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 border border-slate-700 px-2.5 py-1 rounded-lg"
                            >
                              <Icon name="receipt" className="w-3.5 h-3.5 text-rose-500" />
                              <span>{t('viewReceipt')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Subtab 2: Favorites */}
              {profileTab === 'favorites' && (
                <div>
                  {favorites.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      <Icon name="heart" className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-[1.5]" />
                      <p>{t('noFavorites')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {products.filter(p => favorites.includes(p.id)).map(prod => (
                        <div 
                          key={prod.id}
                          onClick={() => setSelectedProduct(prod)}
                          className={'rounded-2xl border p-3 flex flex-col justify-between cursor-pointer transition active:scale-[0.98] ' + 
                            (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}
                        >
                          <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-slate-800/10">
                            {prod.image_url && <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />}
                          </div>
                          <div className="text-xs font-bold line-clamp-1">{prod.name}</div>
                          <div className="text-xs font-black text-rose-500 mt-1">{prod.new_price?.toLocaleString()} {t('som')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 3: Settings & Store Information */}
              {profileTab === 'settings' && (
                <div className="space-y-3 text-xs">
                  {/* Store Address & Hours */}
                  <div className={'p-4 rounded-2xl border space-y-3 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-600/10 text-rose-500 flex items-center justify-center shrink-0">
                        <Icon name="map-pin" className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold">{t('storeAddressTitle')}</div>
                        <div className="text-slate-400 mt-0.5 leading-relaxed">{settings.store_address}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 pt-2 border-t border-slate-800/40">
                      <div className="w-8 h-8 rounded-xl bg-rose-600/10 text-rose-500 flex items-center justify-center shrink-0">
                        <Icon name="clock" className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold">{t('storeHoursTitle')}</div>
                        <div className="text-slate-400 mt-0.5">{settings.store_hours} (Dam olish kunlarisiz)</div>
                      </div>
                    </div>
                  </div>

                  {/* Phones with 1-click calling */}
                  <div className={'p-4 rounded-2xl border space-y-2.5 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="font-extrabold flex items-center gap-2 mb-1">
                      <Icon name="phone" className="w-4 h-4 text-rose-500" />
                      <span>{t('supportPhoneTitle')}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-300">{settings.phone || "+998 90 123 45 67"}</span>
                      <a 
                        href={'tel:' + (settings.phone || "+998901234567").replace(/\s+/g, '')}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px]"
                      >
                        {t('callNow')}
                      </a>
                    </div>

                    {settings.phone2 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
                        <span className="font-mono text-slate-300">{settings.phone2}</span>
                        <a 
                          href={'tel:' + settings.phone2.replace(/\s+/g, '')}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px]"
                        >
                          {t('callNow')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </main>
          )}

          {/* ==================================================== */}
          {/* DIGITAL RECEIPT MODAL */}
          {/* ==================================================== */}
          {selectedReceipt && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 p-5 shadow-2xl space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b-2 border-dashed border-slate-300">
                  <span className="font-black text-sm">kuzavnoy.uzz CHEK</span>
                  <button onClick={() => setSelectedReceipt(null)} className="text-slate-500 hover:text-slate-900 transition">
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  <div>Do'kon: Farhod avto ehtiyot qismlar bozori</div>
                  <div>Buyurtma ID: #{selectedReceipt.id}</div>
                  <div>Mijoz: {selectedReceipt.customer_name}</div>
                  <div>Tel: {selectedReceipt.phone}</div>
                </div>
                <div className="py-2 border-y-2 border-dashed border-slate-300 space-y-1">
                  {(Array.isArray(selectedReceipt.items) ? selectedReceipt.items : (typeof selectedReceipt.items === 'string' ? JSON.parse(selectedReceipt.items || '[]') : [])).map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[180px]">{it.name} x{it.quantity || 1}</span>
                      <span className="font-bold">{((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-black text-sm pt-1">
                  <span>JAMI:</span>
                  <span className="text-rose-600">{selectedReceipt.total_price?.toLocaleString()} so'm</span>
                </div>
                <div className="text-center text-[10px] text-slate-500 pt-2">
                  Xaridingiz uchun rahmat!
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* STICKY BOTTOM NAVIGATION BAR (THUMB-FRIENDLY, NO EMOJIS) */}
          {/* ==================================================== */}
          <nav className={'fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl px-2 py-1.5 ' + 
            (isDark ? 'bg-[#090D16]/95 border-[#1F2B45]' : 'bg-white/95 border-slate-200')}>
            <div className="max-w-md mx-auto flex items-center justify-around">
              {/* Home Tab */}
              <button 
                onClick={() => { setActiveTab('home'); setSelectedCategory('Barchasi'); }}
                className={'flex flex-col items-center justify-center w-16 py-1 transition-all active:scale-90 ' + 
                  (activeTab === 'home' ? 'text-rose-500 font-extrabold' : 'text-slate-400 hover:text-white')}
              >
                <Icon name="home" className={'w-5 h-5 mb-0.5 ' + (activeTab === 'home' ? 'stroke-[2.2]' : 'stroke-[1.6]')} />
                <span className="text-[10px] tracking-tight">{t('navHome')}</span>
              </button>

              {/* Catalog Tab */}
              <button 
                onClick={() => setActiveTab('catalog')}
                className={'flex flex-col items-center justify-center w-16 py-1 transition-all active:scale-90 ' + 
                  (activeTab === 'catalog' ? 'text-rose-500 font-extrabold' : 'text-slate-400 hover:text-white')}
              >
                <Icon name="grid" className={'w-5 h-5 mb-0.5 ' + (activeTab === 'catalog' ? 'stroke-[2.2]' : 'stroke-[1.6]')} />
                <span className="text-[10px] tracking-tight">{t('navCatalog')}</span>
              </button>

              {/* Cart Tab with Dynamic Counter Badge */}
              <button 
                onClick={() => setActiveTab('cart')}
                className={'flex flex-col items-center justify-center w-16 py-1 transition-all active:scale-90 relative ' + 
                  (activeTab === 'cart' ? 'text-rose-500 font-extrabold' : 'text-slate-400 hover:text-white')}
              >
                <div className="relative">
                  <Icon name="cart" className={'w-5 h-5 mb-0.5 ' + (activeTab === 'cart' ? 'stroke-[2.2]' : 'stroke-[1.6]')} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight">{t('navCart')}</span>
              </button>

              {/* Profile Tab */}
              <button 
                onClick={() => setActiveTab('profile')}
                className={'flex flex-col items-center justify-center w-16 py-1 transition-all active:scale-90 ' + 
                  (activeTab === 'profile' ? 'text-rose-500 font-extrabold' : 'text-slate-400 hover:text-white')}
              >
                <Icon name="user" className={'w-5 h-5 mb-0.5 ' + (activeTab === 'profile' ? 'stroke-[2.2]' : 'stroke-[1.6]')} />
                <span className="text-[10px] tracking-tight">{t('navProfile')}</span>
              </button>
            </div>
          </nav>
        </div>
      );
    }

    // Mount React App
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;
}


function getAdminPanelHtml() {
  return `<!DOCTYPE html>
<html lang="uz" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>kuzavnoy.uzz | Admin Dashboard</title>
  
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#fff1f2',
              500: '#f43f5e',
              600: '#e11d48',
              700: '#be123c',
              800: '#9f1239',
              900: '#881337',
            },
            dark: {
              bg: '#090D16',
              sidebar: '#0C1220',
              card: '#101726',
              elevated: '#162033',
              border: '#1F2B45',
              subtle: '#263554',
              hover: '#1B263D'
            }
          }
        }
      }
    };
  </script>
  
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin-custom { animation: spin 0.8s linear infinite; }
  </style>
</head>
<body class="select-none transition-colors duration-200 antialiased bg-[#090D16] text-[#F8FAFC]">
  <div id="root">
    <div class="flex flex-col items-center justify-center min-h-[85vh] text-center px-4">
      <div class="w-10 h-10 border-2 border-slate-700 border-t-red-600 rounded-full animate-spin-custom mb-4"></div>
      <div class="text-sm font-bold text-slate-200 tracking-tight">kuzavnoy.uzz Boshqaruv Paneli</div>
      <div class="text-xs text-slate-500 mt-1">Admin boshqaruv tizimi yuklanmoqda...</div>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef } = React;

    // ==========================================
    // 1. PROFESSIONAL SVG ICON SYSTEM (NO EMOJIS)
    // ==========================================
    const Icon = ({ name, className = "w-5 h-5", strokeWidth = 1.8 }) => {
      const icons = {
        chart: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>
          </svg>
        ),
        truck: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
          </svg>
        ),
        package: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
          </svg>
        ),
        folder: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
          </svg>
        ),
        stories: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="12" x2="12" y1="2" y2="4"/>
          </svg>
        ),
        users: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
        broadcast: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
          </svg>
        ),
        settings: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ),
        search: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
          </svg>
        ),
        refresh: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>
          </svg>
        ),
        sun: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
          </svg>
        ),
        moon: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        ),
        globe: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
          </svg>
        ),
        volume: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        ),
        'volume-x': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/>
          </svg>
        ),
        car: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11 2 11.3V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
          </svg>
        ),
        plus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
        ),
        minus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/>
          </svg>
        ),
        edit: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        ),
        trash: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
          </svg>
        ),
        close: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        ),
        check: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ),
        receipt: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-8"/><path d="M16 12h-8"/><path d="M10 16h-2"/>
          </svg>
        ),
        menu: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="18" y2="18"/>
          </svg>
        ),
        tag: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>
          </svg>
        ),
        shield: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        ),
        phone: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
        mapPin: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
          </svg>
        )
      };
      return icons[name] || icons.package;
    };

    // Sound chime helper
    function playChime() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch(e) {}
    }

    // ==========================================
    // 2. MAIN ADMIN APP COMPONENT
    // ==========================================
    function AdminApp() {
      const [lang, setLang] = useState(localStorage.getItem('kuzavnoy_admin_lang') || 'uz');
      const [theme, setTheme] = useState(localStorage.getItem('kuzavnoy_admin_theme') || 'dark');
      const isDark = theme === 'dark';

      const [tab, setTab] = useState("dashboard"); // 'dashboard' | 'orders' | 'products' | 'categories' | 'stories' | 'crm' | 'broadcast' | 'settings'
      const [sidebarOpen, setSidebarOpen] = useState(false);
      const [soundEnabled, setSoundEnabled] = useState(true);

      // Data States
      const [orders, setOrders] = useState([]);
      const [products, setProducts] = useState([]);
      const [categories, setCategories] = useState([]);
      const [users, setUsers] = useState([]);
      const [stories, setStories] = useState([]);
      const [loading, setLoading] = useState(false);
      const [isRefreshing, setIsRefreshing] = useState(false);
      const [refreshToast, setRefreshToast] = useState(false);

      const [settings, setSettings] = useState({
        card_number: "8600 5304 1234 5678",
        card_holder: "AZIMXON (KUZAVNOY.UZZ)",
        uzcard_number: "8600 5304 1234 5678",
        humo_number: "9860 1201 5678 4321",
        phone: "+998 90 123 45 67",
        phone2: "+998 97 765 43 21",
        instagram_url: "https://instagram.com/kuzavnoy.uzz",
        youtube_url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G",
        store_address: "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori",
        store_hours: "09:00 - 19:00"
      });

      // Filters
      const [orderSearch, setOrderSearch] = useState("");
      const [orderStatusFilter, setOrderStatusFilter] = useState("Barchasi");
      const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);

      const [productSearch, setProductSearch] = useState("");
      const [productCategoryFilter, setProductCategoryFilter] = useState("Barchasi");

      // Modals
      const [showProductModal, setShowProductModal] = useState(false);
      const [editingProduct, setEditingProduct] = useState(null);
      const [initialFormData, setInitialFormData] = useState(null);
      const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
      const [productSaving, setProductSaving] = useState(false);
      const [productImagePreview, setProductImagePreview] = useState("");
      const [formData, setFormData] = useState({
        name: "", category: "Cobalt", new_price: "", old_price: "",
        image_url: "", description: "", detailsText: "", condition: "Yangi",
        stock: "10", color: "Universal", car_model: "Cobalt"
      });

      // Categories Modal / Management
      const [newCategoryName, setNewCategoryName] = useState("");
      const [newCategoryIcon, setNewCategoryIcon] = useState("car");

      // Stories Modal
      const [showStoryModal, setShowStoryModal] = useState(false);
      const [storyFormData, setStoryFormData] = useState({ title: "", tag: "Yangi", description: "", image_url: "" });

      // Broadcast form
      const [broadcastMsg, setBroadcastMsg] = useState("");
      const [broadcastPhoto, setBroadcastPhoto] = useState("");
      const [broadcastSending, setBroadcastSending] = useState(false);
      const [broadcastResult, setBroadcastResult] = useState(null);

      // Settings saving
      const [settingsSaving, setSettingsSaving] = useState(false);
      const [settingsMessage, setSettingsMessage] = useState("");

      // Apply Dark class to root
      useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
      }, [isDark]);

      const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('kuzavnoy_admin_theme', next);
      };

      // Fetchers
      const fetchOrders = async (force) => {
        try {
          const res = await fetch("/api/orders" + (force ? "?_t=" + Date.now() : ""), { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
          const data = await res.json();
          if (Array.isArray(data)) setOrders(data);
        } catch(e) {}
      };

      const fetchProducts = async (force) => {
        try {
          const res = await fetch("/api/products" + (force ? "?_t=" + Date.now() : ""), { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
          const data = await res.json();
          if (Array.isArray(data)) setProducts(data);
        } catch(e) {}
      };

      const fetchCategories = async (force) => {
        try {
          const res = await fetch("/api/categories" + (force ? "?_t=" + Date.now() : ""), { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
          const data = await res.json();
          if (Array.isArray(data)) setCategories(data);
        } catch(e) {}
      };

      const fetchUsers = async (force) => {
        try {
          const res = await fetch("/api/users" + (force ? "?_t=" + Date.now() : ""), { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
          const data = await res.json();
          if (Array.isArray(data)) setUsers(data);
        } catch(e) {}
      };

      const fetchStories = async (force) => {
        try {
          const res = await fetch("/api/stories" + (force ? "?_t=" + Date.now() : ""), { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
          const data = await res.json();
          if (Array.isArray(data)) setStories(data);
        } catch(e) {}
      };

      const fetchSettings = async (force) => {
        try {
          const res = await fetch("/api/settings" + (force ? "?_t=" + Date.now() : ""), { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
          const data = await res.json();
          if (data && data.card_number) setSettings(data);
        } catch(e) {}
      };

      const loadAllData = async () => {
        setLoading(true);
        await Promise.all([
          fetchOrders(true),
          fetchProducts(true),
          fetchCategories(true),
          fetchUsers(true),
          fetchStories(true),
          fetchSettings(true)
        ]);
        setLoading(false);
      };

      useEffect(() => {
        loadAllData();
        const interval = setInterval(() => {
          fetch("/api/orders?_t=" + Date.now(), { cache: "no-store" })
            .then(r => r.json())
            .then(data => {
              if (Array.isArray(data)) {
                setOrders(prev => {
                  if (prev.length > 0 && data.length > prev.length && soundEnabled) {
                    playChime();
                  }
                  return data;
                });
              }
            }).catch(() => {});
        }, 6000);
        return () => clearInterval(interval);
      }, [soundEnabled]);

      const handleAdminRefresh = async () => {
        setIsRefreshing(true);
        await loadAllData();
        setIsRefreshing(false);
        setRefreshToast(true);
        if (soundEnabled) playChime();
        setTimeout(() => setRefreshToast(false), 2500);
      };

      // Order Status Update
      const handleUpdateOrderStatus = async (orderId, newStatus) => {
        try {
          const res = await fetch('/api/orders/' + orderId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
          }
        } catch(e) {
          alert("Holatni yangilashda xatolik");
        }
      };

      // Quick Stock Stepper
      const handleQuickStock = async (prodId, delta) => {
        try {
          const res = await fetch("/api/products/" + prodId + "/quick-stock", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ delta })
          });
          const updated = await res.json();
          if (updated && updated.id) {
            setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, stock: updated.stock } : p));
          }
        } catch(e) {
          alert("Qoldiqni yangilashda xatolik");
        }
      };

      // Quick Price Change
      const handleQuickPrice = async (prod, newPrice) => {
        const val = parseInt(newPrice);
        if (isNaN(val) || val <= 0) return;
        try {
          await fetch("/api/products/" + prod.id + "/quick-price", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_price: val, old_price: prod.old_price })
          });
          fetchProducts(true);
        } catch(e) {}
      };

      // Delete Product
      const handleDeleteProduct = async (id) => {
        if (!confirm("Haqiqatdan ham ushbu ehtiyot qismni o'chirmoqchimisiz?")) return;
        try {
          await fetch("/api/products/" + id, { method: "DELETE" });
          fetchProducts(true);
        } catch(e) {
          alert("O'chirishda xatolik");
        }
      };

      // Unsaved Form Detection & Close
      const hasProductFormChanged = () => {
        if (!initialFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(initialFormData) || 
               (productImagePreview && productImagePreview !== initialFormData.image_url);
      };

      const handleAttemptCloseProductModal = () => {
        if (hasProductFormChanged()) {
          setShowUnsavedConfirm(true);
        } else {
          setShowProductModal(false);
          setEditingProduct(null);
          setInitialFormData(null);
          setProductImagePreview("");
        }
      };

      // Save Product
      const executeSaveProduct = async () => {
        if (!formData.name || !formData.new_price) {
          alert("Iltimos, mahsulot nomi va yangi narxini kiriting!");
          return false;
        }
        setProductSaving(true);
        try {
          const payload = {
            name: formData.name,
            category: formData.category || formData.car_model || "Cobalt",
            new_price: parseInt(formData.new_price) || 0,
            old_price: formData.old_price ? parseInt(formData.old_price) : 0,
            image_url: formData.image_url || "",
            description: formData.description || "",
            condition: formData.condition || "Yangi",
            details: (formData.detailsText || "").split("\\n").map(s => s.trim()).filter(Boolean),
            stock: (formData.stock !== undefined && formData.stock !== null && formData.stock !== '') ? parseInt(formData.stock) : 10,
            color: formData.color || "Universal",
            car_model: formData.car_model || formData.category || "Cobalt"
          };

          const url = editingProduct ? "/api/products/" + editingProduct.id : "/api/products";
          const method = editingProduct ? "PUT" : "POST";

          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const saved = await res.json();
          if (!res.ok) throw new Error(saved.error || "Saqlashda xatolik");

          setShowUnsavedConfirm(false);
          setShowProductModal(false);
          setEditingProduct(null);
          setInitialFormData(null);
          setProductImagePreview("");
          await fetchProducts(true);
          return true;
        } catch(e) {
          alert("Saqlashda xatolik: " + e.message);
          return false;
        } finally {
          setProductSaving(false);
        }
      };

      // Category Add & Delete
      const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
          const res = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newCategoryName.trim(), icon: newCategoryIcon || "car" })
          });
          const saved = await res.json();
          if (saved && saved.id) {
            setCategories(prev => [...prev, saved]);
            setNewCategoryName("");
          }
        } catch(e) {
          alert("Bo'lim qo'shishda xatolik");
        }
      };

      const handleDeleteCategory = async (id, name) => {
        if (!confirm("Haqiqatan ham «" + name + "» bo'limini o'chirmoqchimisiz?")) return;
        try {
          await fetch("/api/categories/" + id, { method: "DELETE" });
          setCategories(prev => prev.filter(c => c.id !== id));
        } catch(e) {
          alert("O'chirishda xatolik");
        }
      };

      // Save Settings
      const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSettingsSaving(true);
        setSettingsMessage("");
        try {
          const res = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings)
          });
          const data = await res.json();
          if (data && data.card_number) {
            setSettings(data);
            setSettingsMessage("Sozlamalar saqlandi!");
            setTimeout(() => setSettingsMessage(""), 3000);
          }
        } catch(e) {
          alert("Sozlamalarni saqlashda xatolik");
        } finally {
          setSettingsSaving(false);
        }
      };

      // Send Broadcast
      const handleSendBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastMsg.trim()) return alert("Xabar matnini kiriting!");
        if (!confirm("Barcha Telegram foydalanuvchilariga xabar yuborilsinmi?")) return;
        setBroadcastSending(true);
        setBroadcastResult(null);
        try {
          const res = await fetch("/api/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: broadcastMsg, photo_url: broadcastPhoto })
          });
          const data = await res.json();
          if (data.success) {
            setBroadcastResult("Xabar " + data.sentCount + " ta mijozga muvaffaqiyatli yuborildi!");
            setBroadcastMsg("");
            setBroadcastPhoto("");
          }
        } catch(e) {
          setBroadcastResult("Xabar yuborishda xatolik");
        } finally {
          setBroadcastSending(false);
        }
      };

      // Calculations for Dashboard KPIs
      const totalRevenue = useMemo(() => {
        return orders.reduce((sum, o) => sum + (parseInt(o.total_price) || 0), 0);
      }, [orders]);

      const activeOrdersCount = useMemo(() => {
        return orders.filter(o => o.status !== 'Yetkazildi' && o.status !== 'Bekor qilindi').length;
      }, [orders]);

      const lowStockProducts = useMemo(() => {
        return products.filter(p => p.stock !== undefined && p.stock !== null && p.stock <= 3);
      }, [products]);

      // Filtered Orders
      const filteredOrders = useMemo(() => {
        return orders.filter(o => {
          if (orderStatusFilter !== 'Barchasi' && (o.status || 'Kutilmoqda') !== orderStatusFilter) return false;
          if (orderSearch.trim()) {
            const q = orderSearch.toLowerCase();
            const idMatch = String(o.id).includes(q);
            const nameMatch = (o.customer_name || '').toLowerCase().includes(q);
            const phoneMatch = (o.phone || '').includes(q);
            if (!idMatch && !nameMatch && !phoneMatch) return false;
          }
          return true;
        });
      }, [orders, orderStatusFilter, orderSearch]);

      // Filtered Products
      const filteredProducts = useMemo(() => {
        return products.filter(p => {
          if (productCategoryFilter !== 'Barchasi' && p.category !== productCategoryFilter && p.car_model !== productCategoryFilter) return false;
          if (productSearch.trim()) {
            const q = productSearch.toLowerCase();
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const modelMatch = (p.car_model || '').toLowerCase().includes(q);
            if (!nameMatch && !modelMatch) return false;
          }
          return true;
        });
      }, [products, productCategoryFilter, productSearch]);

      return (
        <div className={'min-h-screen flex flex-col md:flex-row transition-colors duration-200 ' + 
          (isDark ? 'bg-[#090D16] text-[#F8FAFC]' : 'bg-[#F8FAFC] text-[#0F172A]')}>

          {/* Toast Notification */}
          {refreshToast && (
            <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-400/40 animate-bounce">
              <Icon name="check" className="w-4 h-4" />
              <span>Barcha ma'lumotlar yangilandi!</span>
            </div>
          )}

          {/* SIDEBAR NAVIGATION (COLLAPSIBLE ON MOBILE, FIXED ON DESKTOP) */}
          <aside className={'w-full md:w-64 border-r shrink-0 flex flex-col justify-between ' + 
            (isDark ? 'bg-[#0C1220] border-[#1F2B45]' : 'bg-white border-slate-200') + 
            (sidebarOpen ? ' block' : ' hidden md:flex')}>
            
            <div>
              {/* Brand Header in Sidebar */}
              <div className="p-4 border-b border-[#1F2B45] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shadow-md shadow-rose-950/40">
                    <Icon name="car" className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black tracking-tight leading-none">kuzavnoy.uzz</div>
                    <div className="text-[10px] text-slate-400 mt-1">Admin Boshqaruv</div>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400">
                  <Icon name="close" className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <nav className="p-3 space-y-1 text-xs font-bold">
                {[
                  { id: 'dashboard', label: 'Boshqaruv Paneli', icon: 'chart' },
                  { id: 'orders', label: 'Buyurtmalar', icon: 'truck', badge: activeOrdersCount },
                  { id: 'products', label: 'Ehtiyot Qismlar', icon: 'package', badge: products.length },
                  { id: 'categories', label: \"Bo\'limlar & Modellar\", icon: 'folder' },
                  { id: 'stories', label: 'Istoriyalar (Stories)', icon: 'stories' },
                  { id: 'crm', label: 'Mijozlar Bazasi', icon: 'users', badge: users.length },
                  { id: 'broadcast', label: 'Ommaviy Xabar', icon: 'broadcast' },
                  { id: 'settings', label: 'Sozlamalar', icon: 'settings' }
                ].map(item => {
                  const isActive = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                      className={'w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition active:scale-95 ' + 
                        (isActive 
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40' 
                          : (isDark ? 'text-slate-300 hover:bg-[#162033]' : 'text-slate-600 hover:bg-slate-100'))}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon name={item.icon} className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={'text-[10px] font-extrabold px-2 py-0.5 rounded-lg ' + 
                          (isActive ? 'bg-black/30 text-white' : 'bg-rose-500/15 text-rose-400')}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Bottom Status */}
            <div className="p-4 border-t border-[#1F2B45] text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-slate-200">Farhod Avto Bozori</span>
              </div>
              <div>Do'kon tizimi faol ishlamoqda</div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* STICKY TOP HEADER */}
            <header className={'sticky top-0 z-30 px-4 py-3 border-b flex items-center justify-between backdrop-blur-md ' + 
              (isDark ? 'bg-[#090D16]/90 border-[#1F2B45]' : 'bg-white/90 border-slate-200')}>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden w-8 h-8 rounded-xl border flex items-center justify-center text-slate-300"
                >
                  <Icon name="menu" className="w-4 h-4" />
                </button>
                <div className="text-sm font-black capitalize">
                  {tab === 'dashboard' ? 'Boshqaruv Paneli & Analitika' : tab === 'orders' ? 'Buyurtmalar Jurnali' : tab === 'products' ? 'Ombor & Ehtiyot Qismlar' : tab}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Sound Chime Toggle */}
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Ovoz yoqilgan" : "Ovoz o'chirilgan"}
                  className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                    (soundEnabled ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-500 border-slate-700')}
                >
                  <Icon name={soundEnabled ? "volume" : "volume-x"} className="w-4 h-4" />
                </button>

                {/* Refresh Button */}
                <button 
                  onClick={handleAdminRefresh}
                  disabled={isRefreshing}
                  title="Yangilash"
                  className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-300' : 'bg-white border-slate-200 text-slate-700')}
                >
                  <span className={isRefreshing ? 'animate-spin-custom text-rose-500' : ''}>
                    <Icon name="refresh" className="w-4 h-4" />
                  </span>
                </button>

                {/* Theme Switcher */}
                <button 
                  onClick={toggleTheme}
                  title="Mavzuni almashtirish"
                  className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45] text-amber-400' : 'bg-white border-slate-200 text-slate-700')}
                >
                  <Icon name={isDark ? "sun" : "moon"} className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* MAIN TAB CONTENT */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">

              {/* ========================================= */}
              {/* TAB 1: OVERVIEW DASHBOARD */}
              {/* ========================================= */}
              {tab === 'dashboard' && (
                <div className="space-y-6">
                  {/* 4 KPI Widgets */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                        <span>Jami Tushum</span>
                        <Icon name="chart" className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="text-xl font-black text-rose-500">
                        {totalRevenue.toLocaleString()} so'm
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Barcha muvaffaqiyatli xaridlar</div>
                    </div>

                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                        <span>Faol Buyurtmalar</span>
                        <Icon name="truck" className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-xl font-black text-amber-400">
                        {activeOrdersCount} ta
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Tayyorlanmoqda va yo'lda</div>
                    </div>

                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                        <span>Barcha Buyurtmalar</span>
                        <Icon name="package" className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="text-xl font-black text-slate-200">
                        {orders.length} ta
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Umumiy buyurtmalar soni</div>
                    </div>

                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                        <span>Mijozlar Bazasi</span>
                        <Icon name="users" className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="text-xl font-black text-purple-400">
                        {users.length} nafar
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Botdan ro'yxatdan o'tgan</div>
                    </div>
                  </div>

                  {/* Low Stock Warning Alert if any */}
                  {lowStockProducts.length > 0 && (
                    <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 text-xs flex items-start gap-3">
                      <Icon name="shield" className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-black text-amber-400">Ombor zaxirasi kam qolgan ehtiyot qismlar ({lowStockProducts.length} ta):</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {lowStockProducts.map(p => (
                            <span key={p.id} className="px-2.5 py-1 rounded-lg bg-black/40 border border-amber-500/30 text-[11px] font-bold">
                              {p.name} — <b className="text-rose-400">{p.stock} dona</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent Orders Feed */}
                  <div className={'p-5 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-black tracking-tight">So'nggi Buyurtmalar</div>
                      <button onClick={() => setTab('orders')} className="text-xs font-bold text-rose-500 hover:underline">
                        Barchasini ko'rish →
                      </button>
                    </div>

                    <div className="divide-y divide-slate-800/40 text-xs">
                      {orders.slice(0, 5).map(o => (
                        <div key={o.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-extrabold flex items-center gap-2">
                              <span>#{o.id}</span>
                              <span>•</span>
                              <span>{o.customer_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{o.phone} | {o.delivery_type === 'pickup' ? "Olib ketish" : "Yetkazib berish"}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-rose-500">{o.total_price?.toLocaleString()} so'm</div>
                            <span className="text-[10px] font-bold text-amber-400">{o.status || 'Kutilmoqda'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 2: ORDER MANAGEMENT */}
              {/* ========================================= */}
              {tab === 'orders' && (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
                    <div className="relative flex-1 max-w-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Icon name="search" className="w-4 h-4" />
                      </div>
                      <input 
                        type="text" 
                        value={orderSearch}
                        onChange={e => setOrderSearch(e.target.value)}
                        placeholder="ID, mijoz ismi yoki telefon raqami..."
                        className={'w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none ' + 
                          (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-white border-slate-200 text-slate-900')}
                      />
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                      {['Barchasi', 'Kutilmoqda', 'Tayyorlanmoqda', 'Yetkazilmoqda', 'Yetkazildi', 'Bekor qilindi'].map(st => (
                        <button
                          key={st}
                          onClick={() => setOrderStatusFilter(st)}
                          className={'px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition ' + 
                            (orderStatusFilter === st 
                              ? 'bg-rose-600 text-white border-rose-500' 
                              : (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-400' : 'bg-white border-slate-200 text-slate-600'))}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orders Data Table */}
                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={'border-b uppercase text-[10px] font-black tracking-wider ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
                          <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">Mijoz</th>
                            <th className="p-3">Yetkazish & Manzil</th>
                            <th className="p-3">Detallar</th>
                            <th className="p-3">Summa</th>
                            <th className="p-3">Holat</th>
                            <th className="p-3 text-right">Amallar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="p-8 text-center text-slate-500">
                                Buyurtma topilmadi
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map(o => {
                              const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items || '[]') : []);

                              return (
                                <tr key={o.id} className={isDark ? 'hover:bg-[#162033]/50' : 'hover:bg-slate-50'}>
                                  <td className="p-3 font-black">#{o.id}</td>
                                  <td className="p-3">
                                    <div className="font-bold">{o.customer_name}</div>
                                    <div className="text-[11px] text-slate-400">{o.phone}</div>
                                  </td>
                                  <td className="p-3 max-w-[200px]">
                                    <span className="font-bold">{o.delivery_type === 'pickup' ? "Olib ketish" : "Yetkazish"}</span>
                                    <div className="text-[10px] text-slate-400 truncate">{o.location || "Ko'rsatilmagan"}</div>
                                  </td>
                                  <td className="p-3 max-w-[200px]">
                                    <div className="text-[11px] font-medium truncate">
                                      {items.map(it => it.name + ' (x' + (it.quantity || 1) + ')').join(', ')}
                                    </div>
                                  </td>
                                  <td className="p-3 font-black text-rose-500 whitespace-nowrap">
                                    {o.total_price?.toLocaleString()} so'm
                                  </td>
                                  <td className="p-3">
                                    <select 
                                      value={o.status || 'Kutilmoqda'}
                                      onChange={e => handleUpdateOrderStatus(o.id, e.target.value)}
                                      className={'text-[11px] font-bold py-1 px-2 rounded-lg border focus:outline-none ' + 
                                        (o.status === 'Yetkazildi' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                                         o.status === 'Bekor qilindi' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 
                                         'bg-amber-500/10 text-amber-400 border-amber-500/30')}
                                    >
                                      <option value="Kutilmoqda">Kutilmoqda</option>
                                      <option value="Tayyorlanmoqda">Tayyorlanmoqda</option>
                                      <option value="Yetkazilmoqda">Yetkazilmoqda</option>
                                      <option value="Yetkazildi">Yetkazildi</option>
                                      <option value="Bekor qilindi">Bekor qilindi</option>
                                    </select>
                                  </td>
                                  <td className="p-3 text-right">
                                    <button 
                                      onClick={() => setSelectedReceiptOrder(o)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition inline-flex items-center gap-1"
                                      title="Chekni ko'rish"
                                    >
                                      <Icon name="receipt" className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Chek</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 3: PRODUCTS & INVENTORY MANAGEMENT */}
              {/* ========================================= */}
              {tab === 'products' && (
                <div className="space-y-4">
                  {/* Top action bar */}
                  <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
                    <div className="flex gap-2 flex-1 max-w-md">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Icon name="search" className="w-4 h-4" />
                        </div>
                        <input 
                          type="text" 
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder="Zapchast nomi yoki modeli..."
                          className={'w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none ' + 
                            (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-white border-slate-200 text-slate-900')}
                        />
                      </div>

                      <select 
                        value={productCategoryFilter}
                        onChange={e => setProductCategoryFilter(e.target.value)}
                        className={'px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none ' + 
                          (isDark ? 'bg-[#101726] border-[#1F2B45] text-slate-300' : 'bg-white border-slate-200 text-slate-700')}
                      >
                        <option value="Barchasi">Barcha toifalar</option>
                        {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    <button 
                      onClick={() => {
                        const initial = {
                          name: "", category: categories.length > 0 ? categories[0].name : "Cobalt", new_price: "", old_price: "",
                          image_url: "", description: "", detailsText: "Original sifat\\nKafolat beriladi",
                          condition: "Yangi", stock: "10", color: "Universal", car_model: categories.length > 0 ? categories[0].name : "Cobalt"
                        };
                        setEditingProduct(null);
                        setProductImagePreview("");
                        setFormData(initial);
                        setInitialFormData(JSON.parse(JSON.stringify(initial)));
                        setShowProductModal(true);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-950/40 shrink-0"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>+ Yangi Zapchast</span>
                    </button>
                  </div>

                  {/* Products Data Table */}
                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={'border-b uppercase text-[10px] font-black tracking-wider ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
                          <tr>
                            <th className="p-3">Rasm</th>
                            <th className="p-3">Nomi & Toifasi</th>
                            <th className="p-3">Model & Holat</th>
                            <th className="p-3">Ombor (Stock) Stepper</th>
                            <th className="p-3">Narxi</th>
                            <th className="p-3 text-right">Amallar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {filteredProducts.map(prod => (
                            <tr key={prod.id} className={isDark ? 'hover:bg-[#162033]/50' : 'hover:bg-slate-50'}>
                              <td className="p-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800/20 shrink-0 flex items-center justify-center">
                                  {prod.image_url ? (
                                    <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Icon name="package" className="w-6 h-6 text-slate-500" />
                                  )}
                                </div>
                              </td>

                              <td className="p-3 max-w-[200px]">
                                <div className="font-bold truncate">{prod.name}</div>
                                <div className="text-[10px] text-rose-500 font-bold uppercase">{prod.category}</div>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <span className="font-bold">{prod.car_model || "Universal"}</span>
                                <div className="text-[10px] text-slate-400">{prod.condition || "Yangi"}</div>
                              </td>

                              {/* Quick Stock Stepper */}
                              <td className="p-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => handleQuickStock(prod.id, -1)}
                                    className="w-6 h-6 rounded-lg border border-slate-700 flex items-center justify-center hover:bg-slate-800 active:scale-90"
                                  >
                                    <Icon name="minus" className="w-3 h-3" />
                                  </button>

                                  <span className={'px-2.5 py-0.5 rounded-lg font-black text-xs ' + 
                                    ((prod.stock !== undefined && prod.stock <= 3) ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-200')}>
                                    {prod.stock !== undefined ? prod.stock : 10}
                                  </span>

                                  <button 
                                    onClick={() => handleQuickStock(prod.id, 1)}
                                    className="w-6 h-6 rounded-lg border border-slate-700 flex items-center justify-center hover:bg-slate-800 active:scale-90"
                                  >
                                    <Icon name="plus" className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <div className="font-black text-rose-500">{prod.new_price?.toLocaleString()} so'm</div>
                                {prod.old_price > prod.new_price && (
                                  <div className="text-[10px] line-through text-slate-500">{prod.old_price?.toLocaleString()}</div>
                                )}
                              </td>

                              <td className="p-3 text-right whitespace-nowrap">
                                <div className="flex justify-end gap-1.5">
                                  <button 
                                    onClick={() => {
                                      const initial = {
                                        name: prod.name || "",
                                        category: prod.category || prod.car_model || "Cobalt",
                                        new_price: String(prod.new_price || ""),
                                        old_price: prod.old_price ? String(prod.old_price) : "",
                                        image_url: prod.image_url || "",
                                        description: prod.description || "",
                                        condition: prod.condition || "Yangi",
                                        detailsText: (Array.isArray(prod.details) ? prod.details : []).join("\\n"),
                                        stock: String(prod.stock !== undefined && prod.stock !== null ? prod.stock : 10),
                                        color: prod.color || "Universal",
                                        car_model: prod.car_model || prod.category || "Cobalt"
                                      };
                                      setEditingProduct(prod);
                                      setProductImagePreview(prod.image_url || "");
                                      setFormData(initial);
                                      setInitialFormData(JSON.parse(JSON.stringify(initial)));
                                      setShowProductModal(true);
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300"
                                    title="Tahrirlash"
                                  >
                                    <Icon name="edit" className="w-3.5 h-3.5" />
                                  </button>

                                  <button 
                                    onClick={() => handleDeleteProduct(prod.id)}
                                    className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                    title="O'chirish"
                                  >
                                    <Icon name="trash" className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 4: CATEGORIES MANAGEMENT */}
              {/* ========================================= */}
              {tab === 'categories' && (
                <div className="space-y-4 max-w-2xl">
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <h3 className="text-sm font-black flex items-center gap-2">
                      <Icon name="folder" className="w-4 h-4 text-rose-500" />
                      <span>Yangi Bo'lim yoki Avto Model Qo'shish</span>
                    </h3>

                    <form onSubmit={handleAddCategory} className="flex gap-2">
                      <input 
                        type="text" 
                        required
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="Masalan: Tracker yoki Monjaro"
                        className={'flex-1 p-2.5 rounded-xl border text-xs focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                      <button 
                        type="submit"
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        <Icon name="plus" className="w-4 h-4" />
                        <span>Qo'shish</span>
                      </button>
                    </form>
                  </div>

                  {/* Existing Categories List */}
                  <div className={'p-5 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mavjud Bo'limlar ({categories.length})</h4>
                    <div className="divide-y divide-slate-800/40 text-xs">
                      {categories.map(c => (
                        <div key={c.id || c.name} className="py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold">
                            <Icon name="car" className="w-4 h-4 text-rose-500" />
                            <span>{c.name}</span>
                          </div>
                          <button 
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="p-1 text-slate-500 hover:text-rose-500 transition"
                            title="O'chirish"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 5: CRM (CUSTOMERS) */}
              {/* ========================================= */}
              {tab === 'crm' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-400">Telegram bot orqali ro'yxatdan o'tgan mijozlar soni: <b className="text-white">{users.length}</b></div>
                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={'border-b uppercase text-[10px] font-black tracking-wider ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
                          <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">Mijoz Ismi</th>
                            <th className="p-3">Telegram Username</th>
                            <th className="p-3">Telefon</th>
                            <th className="p-3">Telegram ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {users.map(u => (
                            <tr key={u.id} className={isDark ? 'hover:bg-[#162033]/50' : 'hover:bg-slate-50'}>
                              <td className="p-3 font-mono">#{u.id}</td>
                              <td className="p-3 font-bold">{u.full_name || u.first_name}</td>
                              <td className="p-3 text-rose-400">{u.username ? '@' + u.username : '-'}</td>
                              <td className="p-3 font-mono">{u.phone || '-'}</td>
                              <td className="p-3 font-mono text-slate-400">{u.telegram_id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 6: BROADCAST (OMMAVIY XABAR) */}
              {/* ========================================= */}
              {tab === 'broadcast' && (
                <div className="max-w-2xl space-y-4">
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div>
                      <h3 className="text-sm font-black flex items-center gap-2">
                        <Icon name="broadcast" className="w-4 h-4 text-rose-500" />
                        <span>Barcha Telegram Foydalanuvchilariga Xabar Yuborish</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Aksiyalar va yangiliklarni bot orqali barcha {users.length} nafar mijozga bir vaqtda jo'natish.
                      </p>
                    </div>

                    <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Rasm URL (ixtiyoriy)</label>
                        <input 
                          type="url" 
                          value={broadcastPhoto}
                          onChange={e => setBroadcastPhoto(e.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Xabar matni *</label>
                        <textarea 
                          rows="4"
                          required
                          value={broadcastMsg}
                          onChange={e => setBroadcastMsg(e.target.value)}
                          placeholder="DIQQAT! Barcha Cobalt zapchastlariga 20% chegirma boshlandi!"
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      {broadcastResult && (
                        <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          {broadcastResult}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={broadcastSending}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2"
                      >
                        <Icon name="broadcast" className="w-4 h-4" />
                        <span>{broadcastSending ? "Yuborilmoqda..." : "Xabarni Barchaga Yuborish"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 7: SETTINGS & DETAILS */}
              {/* ========================================= */}
              {tab === 'settings' && (
                <div className="max-w-2xl space-y-4">
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <h3 className="text-sm font-black flex items-center gap-2">
                      <Icon name="settings" className="w-4 h-4 text-rose-500" />
                      <span>Do'kon Rekvizitlari va Sozlamalari</span>
                    </h3>

                    <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Karta raqami (Uzcard / Humo)</label>
                        <input 
                          type="text" 
                          value={settings.card_number}
                          onChange={e => setSettings({ ...settings, card_number: e.target.value })}
                          className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono font-bold ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Karta egasining ismi</label>
                        <input 
                          type="text" 
                          value={settings.card_holder}
                          onChange={e => setSettings({ ...settings, card_holder: e.target.value })}
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 font-semibold text-slate-400">Aloqa telefoni (1)</label>
                          <input 
                            type="text" 
                            value={settings.phone}
                            onChange={e => setSettings({ ...settings, phone: e.target.value })}
                            className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono ' + 
                              (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-semibold text-slate-400">Aloqa telefoni (2)</label>
                          <input 
                            type="text" 
                            value={settings.phone2 || ""}
                            onChange={e => setSettings({ ...settings, phone2: e.target.value })}
                            className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono ' + 
                              (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Do'kon manzili (Olib ketish uchun)</label>
                        <input 
                          type="text" 
                          value={settings.store_address}
                          onChange={e => setSettings({ ...settings, store_address: e.target.value })}
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      {settingsMessage && (
                        <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          {settingsMessage}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={settingsSaving}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2"
                      >
                        <Icon name="check" className="w-4 h-4" />
                        <span>{settingsSaving ? "Saqlanmoqda..." : "Sozlamalarni Saqlash"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* ========================================= */}
          {/* PRODUCT ADD / EDIT MODAL */}
          {/* ========================================= */}
          {showProductModal && (
            <div 
              onClick={handleAttemptCloseProductModal}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex items-center justify-center min-h-screen"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div 
                onClick={e => e.stopPropagation()} 
                className={'border rounded-3xl max-w-xl w-full my-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden ' + 
                  (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-white border-slate-200 text-slate-900')}
              >
                {/* Modal Header */}
                <div className={'px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10 shrink-0 ' + 
                  (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                  <div className="flex items-center gap-2.5">
                    <Icon name="package" className="w-5 h-5 text-rose-500" />
                    <div>
                      <h3 className="text-base font-black">
                        {editingProduct ? "Zapchastni Tahrirlash" : "Yangi Zapchast Qo'shish"}
                      </h3>
                      <p className="text-[11px] text-slate-400">{editingProduct ? formData.name : "Katalog va omborga kiritish"}</p>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleAttemptCloseProductModal}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                  >
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body & Footer */}
                <form onSubmit={executeSaveProduct} className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="p-5 overflow-y-auto flex-1 space-y-3.5 text-xs" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div>
                      <label className="block mb-1 font-semibold text-slate-400">Zapchast nomi *</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="M-Sport Anatomiya Rul"
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Model / Toifa</label>
                        <select 
                          value={formData.category}
                          onChange={e => setFormData({ ...formData, category: e.target.value, car_model: e.target.value })}
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        >
                          {categories.map(cat => <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Holati</label>
                        <select 
                          value={formData.condition || 'Yangi'}
                          onChange={e => setFormData({ ...formData, condition: e.target.value })}
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        >
                          <option value="Yangi">Yangi</option>
                          <option value="B/U (Ideal)">B/U (Ideal)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Ombor (Stock)</label>
                        <input 
                          type="number" 
                          min="0"
                          value={formData.stock !== undefined ? formData.stock : "10"}
                          onChange={e => setFormData({ ...formData, stock: e.target.value })}
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Rangi</label>
                        <input 
                          type="text" 
                          value={formData.color || ""}
                          onChange={e => setFormData({ ...formData, color: e.target.value })}
                          placeholder="Universal"
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Yangi narxi (so'm) *</label>
                        <input 
                          type="number" 
                          required
                          value={formData.new_price}
                          onChange={e => setFormData({ ...formData, new_price: e.target.value })}
                          placeholder="1450000"
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Eski narxi (so'm)</label>
                        <input 
                          type="number" 
                          value={formData.old_price}
                          onChange={e => setFormData({ ...formData, old_price: e.target.value })}
                          placeholder="1800000"
                          className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-semibold text-slate-400">Rasm URL havolasi</label>
                      <input 
                        type="url" 
                        value={formData.image_url || ""}
                        onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://..."
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-semibold text-slate-400">Qisqa tavsif</label>
                      <input 
                        type="text" 
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Malibu va Tracker uchun original sport rul"
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-semibold text-slate-400">Xususiyatlar (har bir qator yangi band)</label>
                      <textarea 
                        rows="3"
                        value={formData.detailsText}
                        onChange={e => setFormData({ ...formData, detailsText: e.target.value })}
                        placeholder="Original charm qoplama\\nKafolat beriladi"
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>
                  </div>

                  {/* Sticky Footer */}
                  <div className={'px-5 py-3.5 border-t flex items-center justify-between gap-3 sticky bottom-0 z-10 shrink-0 ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <button 
                      type="button" 
                      onClick={handleAttemptCloseProductModal}
                      className={'px-4 py-2 rounded-xl font-bold ' + (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700')}
                    >
                      Bekor qilish
                    </button>

                    <button 
                      type="submit" 
                      disabled={productSaving}
                      className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2"
                    >
                      <Icon name="check" className="w-4 h-4" />
                      <span>{productSaving ? "Saqlanmoqda..." : "Saqlash"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* UNSAVED CHANGES CONFIRMATION MODAL */}
          {showUnsavedConfirm && (
            <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className={'border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-white border-slate-200 text-slate-900')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-black shrink-0">
                    <Icon name="shield" className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black">O'zgarishlar saqlanmadi!</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Siz ehtiyot qism ma'lumotlarini tahrirladingiz</p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  Qanday yo'l tutmoqchisiz? Tahrirlangan holatda saqlansinmi yoki eski holatda qoldirilsinmi?
                </p>

                <div className="space-y-2 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      setShowUnsavedConfirm(false);
                      await executeSaveProduct();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    <span>Tahrirlangan holatda saqlansin (Saqlash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedConfirm(false);
                      setShowProductModal(false);
                      setEditingProduct(null);
                      setInitialFormData(null);
                      setProductImagePreview("");
                    }}
                    className="w-full py-2.5 px-4 bg-rose-600/15 text-rose-400 border border-rose-500/30 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                    <span>Eski holatda qolsin (Bekor qilish & Chiqish)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUnsavedConfirm(false)}
                    className="w-full py-2 px-4 rounded-xl font-bold text-slate-400 hover:text-white"
                  >
                    Tahrirlashda davom etish
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RECEIPT MODAL */}
          {selectedReceiptOrder && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 p-5 shadow-2xl space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b-2 border-dashed border-slate-300">
                  <span className="font-black text-sm">kuzavnoy.uzz CHEK</span>
                  <button onClick={() => setSelectedReceiptOrder(null)} className="font-bold text-base text-slate-500 hover:text-slate-900">
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  <div>Do'kon: Farhod avto ehtiyot qismlar bozori</div>
                  <div>Buyurtma ID: #{selectedReceiptOrder.id}</div>
                  <div>Mijoz: {selectedReceiptOrder.customer_name}</div>
                  <div>Tel: {selectedReceiptOrder.phone}</div>
                </div>
                <div className="py-2 border-y-2 border-dashed border-slate-300 space-y-1">
                  {(Array.isArray(selectedReceiptOrder.items) ? selectedReceiptOrder.items : (typeof selectedReceiptOrder.items === 'string' ? JSON.parse(selectedReceiptOrder.items || '[]') : [])).map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[180px]">{it.name} x{it.quantity || 1}</span>
                      <span className="font-bold">{((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-black text-sm pt-1">
                  <span>JAMI:</span>
                  <span className="text-rose-600">{selectedReceiptOrder.total_price?.toLocaleString()} so'm</span>
                </div>
                <div className="text-center text-[10px] text-slate-500 pt-2">
                  Xaridingiz uchun rahmat!
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<AdminApp />);
  </script>
</body>
</html>`;
}
