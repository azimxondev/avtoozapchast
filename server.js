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


// API: Ehtiyot qism so'rovi (Menga topib bering)
app.post('/api/part-requests', async (req, res) => {
  try {
    const { telegram_id, customer_name, phone, car_model, part_name, note } = req.body;
    if (!customer_name || !phone || !part_name) {
      return res.status(400).json({ error: "Ism, telefon va detal nomi kiritilishi shart!" });
    }
    const result = await pool.query(
      `INSERT INTO part_requests (telegram_id, customer_name, phone, car_model, part_name, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [telegram_id || null, customer_name, phone, car_model || 'Boshqa', part_name, note || '']
    );
    const ticket = result.rows[0];

    if (bot && ADMIN_CHAT_IDS && ADMIN_CHAT_IDS.length > 0) {
      const adminMsg = "🔎 <b>Yangi Ehtiyot Qism So'rovi (#" + ticket.id + ")</b>\n\n" +
        "👤 <b>Mijoz:</b> " + customer_name + "\n" +
        "📞 <b>Telefon:</b> " + phone + "\n" +
        "🚗 <b>Avto rusumi:</b> " + (car_model || '—') + "\n" +
        "⚙️ <b>Qidirilayotgan detal:</b> " + part_name + "\n" +
        (note ? "📝 <b>Izoh:</b> " + note + "\n" : "") +
        "⏰ <b>Vaqt:</b> " + new Date().toLocaleString('uz-UZ');
      for (const adm of ADMIN_CHAT_IDS) {
        bot.sendMessage(adm, adminMsg, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
    res.json({ success: true, request: ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/part-requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM part_requests ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/part-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query('UPDATE part_requests SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Qaytarish va almashtirish so'rovi (Returns)
app.post('/api/returns', async (req, res) => {
  try {
    const { order_id, telegram_id, customer_name, phone, reason, note, photo_url } = req.body;
    if (!order_id || !phone || !reason) {
      return res.status(400).json({ error: "Buyurtma ID, telefon va sabab kiritilishi shart!" });
    }
    const result = await pool.query(
      `INSERT INTO return_requests (order_id, telegram_id, customer_name, phone, reason, note, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [order_id, telegram_id || null, customer_name || 'Mijoz', phone, reason, note || '', photo_url || '']
    );
    const ret = result.rows[0];

    if (bot && ADMIN_CHAT_IDS && ADMIN_CHAT_IDS.length > 0) {
      const adminMsg = "🔄 <b>Mahsulotni Qaytarish / Almashtirish (#" + ret.id + ")</b>\n\n" +
        "📦 <b>Buyurtma:</b> #" + order_id + "\n" +
        "👤 <b>Mijoz:</b> " + (customer_name || 'Mijoz') + "\n" +
        "📞 <b>Telefon:</b> " + phone + "\n" +
        "⚠️ <b>Sabab:</b> " + reason + "\n" +
        (note ? "📝 <b>Izoh:</b> " + note + "\n" : "") +
        "⏰ <b>Vaqt:</b> " + new Date().toLocaleString('uz-UZ');
      for (const adm of ADMIN_CHAT_IDS) {
        bot.sendMessage(adm, adminMsg, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
    res.json({ success: true, return_request: ret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/returns', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM return_requests ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/returns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query('UPDATE return_requests SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Admin analitika va grafik ma'lumotlari (Analytics)
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'DD/MM') as label,
        COUNT(*) as order_count,
        COALESCE(SUM(CASE WHEN status IN ('Yetkazildi', 'Tasdiqlandi') THEN total_price ELSE 0 END), 0) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY TO_CHAR(created_at, 'DD/MM'), DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    const ltvRes = await pool.query(`
      SELECT 
        COALESCE(SUM(total_price), 0) as total_ltv,
        COUNT(DISTINCT telegram_id) as active_customers
      FROM orders
      WHERE status IN ('Yetkazildi', 'Tasdiqlandi')
    `);

    res.json({
      daily: statsRes.rows,
      total_ltv: parseInt(ltvRes.rows[0]?.total_ltv || 0),
      active_customers: parseInt(ltvRes.rows[0]?.active_customers || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Foydalanuvchi hamyoni va sodiqlik dasturi (Wallet & VIP)
app.get('/api/user/wallet/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    const ordersRes = await pool.query(
      "SELECT total_price FROM orders WHERE telegram_id=$1 AND status IN ('Yetkazildi', 'Tasdiqlandi')",
      [telegram_id]
    );
    const totalSpent = ordersRes.rows.reduce((sum, r) => sum + (parseInt(r.total_price) || 0), 0);
    let vipTier = 'Kumush';
    let cashbackRate = 0.01;
    let autoDiscountPercent = 0;

    if (totalSpent >= 10000000) {
      vipTier = 'Platina';
      cashbackRate = 0.03;
      autoDiscountPercent = 5;
    } else if (totalSpent >= 2000000) {
      vipTier = 'Oltin';
      cashbackRate = 0.02;
      autoDiscountPercent = 3;
    }

    const cashbackBalance = Math.round(totalSpent * cashbackRate);

    res.json({
      telegram_id,
      total_spent: totalSpent,
      order_count: ordersRes.rows.length,
      vip_tier: vipTier,
      cashback_balance: cashbackBalance,
      auto_discount_percent: autoDiscountPercent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Garaj avtomobili va rolini yangilash
app.put('/api/user/garage', async (req, res) => {
  try {
    const { telegram_id, garage_car, role } = req.body;
    if (!telegram_id) return res.status(400).json({ error: "telegram_id talab qilinadi" });
    await pool.query(
      "UPDATE users SET garage_car = COALESCE($1, garage_car), role = COALESCE($2, role) WHERE telegram_id = $3",
      [garage_car, role, telegram_id]
    );
    res.json({ success: true, garage_car, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Mahsulot ombor holatini tezkor yoqish/o'chirish (In Stock / Out of Stock switch)
app.put('/api/products/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const prodRes = await pool.query('SELECT stock FROM products WHERE id=$1', [id]);
    if (prodRes.rows.length === 0) return res.status(404).json({ error: "Mahsulot topilmadi" });
    const curStock = prodRes.rows[0].stock || 0;
    const newStock = curStock > 0 ? 0 : 10;
    const result = await pool.query('UPDATE products SET stock=$1 WHERE id=$2 RETURNING *', [newStock, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi sharh qoldirish (Reviews)
app.post('/api/reviews', async (req, res) => {
  try {
    const { product_id, telegram_id, customer_name, rating, comment } = req.body;
    if (!customer_name || !comment) {
      return res.status(400).json({ error: "Ism va sharh matni kiritilishi shart!" });
    }
    const result = await pool.query(
      `INSERT INTO reviews (product_id, telegram_id, customer_name, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [product_id || 1, telegram_id || null, customer_name, parseInt(rating) || 5, comment]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    const { title, description, tag, image_url, product_id } = req.body;
    if (!title || !image_url) {
      return res.status(400).json({ error: "Sarlavha va rasm kiritilishi shart!" });
    }
    const result = await pool.query(
      `INSERT INTO stories (title, description, tag, image_url, product_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || '', tag || 'Yangi', image_url, product_id ? parseInt(product_id) : null]
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
    const result = await pool.query('SELECT *, COALESCE(new_price, old_price, 0) AS price FROM products ORDER BY id ASC');
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

// API: Standart modellarni tiklash (Admin)
app.post('/api/categories/seed', async (req, res) => {
  try {
    const defaults = [
      ['Cobalt', 'car', 1], ['Gentra / Lacetti', 'car', 2], ['Nexia (1 / 2 / 3)', 'car', 3],
      ['Spark', 'car', 4], ['Matiz', 'car', 5], ['Damas / Labo', 'van', 6],
      ['Malibu (1 / 2)', 'car', 7], ['Tracker (1 / 2)', 'car', 8], ['Onix', 'car', 9],
      ['Monjaro / Xitoy avto', 'zap', 10], ['Kia / Hyundai', 'car', 11], ['Boshqa / Import', 'globe', 12]
    ];
    for (const d of defaults) {
      await pool.query('INSERT INTO categories (name, icon, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING', d);
    }
    const refreshed = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, id ASC');
    res.json(refreshed.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  <title>kuzavnoy.uzz | Original Avto Ehtiyot Qismlari</title>
  
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
  
  <!-- React & Babel CDN -->
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>

  <!-- Leaflet Map CSS & JS for Visual Pin-Drop Address Selection -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  
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
    .safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 76px); }
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
    // 1. 100% SVG VECTOR SYSTEM (ZERO EMOJIS)
    // ==========================================
    const Icon = ({ name, className = "w-5 h-5", strokeWidth = 1.8 }) => {
      const icons = {
        home: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        ),
        grid: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>
          </svg>
        ),
        cart: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        ),
        user: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>
          </svg>
        ),
        search: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
          </svg>
        ),
        heart: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        ),
        "heart-solid": (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        ),
        sliders: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>
          </svg>
        ),
        refresh: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
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
        truck: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
          </svg>
        ),
        wrench: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        ),
        "shield-check": (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>
          </svg>
        ),
        clock: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
        phone: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
        "map-pin": (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        ),
        instagram: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
        ),
        youtube: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><polygon points="10 15 15 12 10 9 10 15"/>
          </svg>
        ),
        telegram: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
          </svg>
        ),
        check: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ),
        close: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
          </svg>
        ),
        tag: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>
          </svg>
        ),
        plus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
        ),
        minus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
        ),
        trash: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        ),
        copy: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        ),
        share: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
          </svg>
        ),
        wallet: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
          </svg>
        ),
        star: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ),
        "star-solid": (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ),
        car: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
          </svg>
        ),
        "credit-card": (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
          </svg>
        ),
        chat: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
        tool: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 3.26-4.6 4.6a6 6 0 0 0-8.48 8.48l4.6-4.6"/>
          </svg>
        ),
        package: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
          </svg>
        ),
        "arrow-left": (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        ),
        sparkles: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        ),
        compass: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
        ),
        "chevron-right": (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        ),
        crown: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>
          </svg>
        )
      };
      return icons[name] || icons.package;
    };

    // Automotive Car Models for My Garage
    const CAR_MODELS = [
      "Gentra",
      "Cobalt",
      "Nexia 3",
      "Malibu 2",
      "Tracker 2",
      "Onix",
      "Damas",
      "Spark",
      "Lacetti",
      "Matiz",
      "Captiva"
    ];

    // Bilingual automotive synonyms dictionary for Smart Search
    const SYNONYMS = {
      krilo: "qanot",
      qanot: "krilo",
      fara: "chiroq",
      chiroq: "fara",
      kapot: "kapot",
      bamper: "bamper",
      rul: "rul",
      oyna: "steklo",
      steklo: "oyna",
      bar: "konsol",
      konsol: "bar",
      balon: "shina",
      shina: "balon",
      diska: "balon",
      kolodka: "tormoz",
      tormoz: "kolodka",
      filtr: "moy",
      moy: "filtr",
      reshyotka: "panjara",
      panjara: "reshyotka",
      motor: "dvigatel",
      dvigatel: "motor"
    };

    function detectCardType(num) {
      const clean = (num || "").replace(/\D/g, "");
      if (clean.startsWith("4")) return "visa";
      if (/^(5[1-5]|2[2-7])/.test(clean)) return "mastercard";
      if (clean.startsWith("8600")) return "uzcard";
      if (clean.startsWith("9860")) return "humo";
      return null;
    }

    function formatCardNumber(val) {
      const v = (val || "").replace(/\s+/g, "").replace(/[^0-9]/gi, "").slice(0, 16);
      const parts = [];
      for (let i = 0; i < v.length; i += 4) {
        parts.push(v.substring(i, i + 4));
      }
      return parts.join(" ");
    }

    function formatPhoneNumber(val) {
      let digits = (val || "").replace(/\D/g, "");
      if (!digits.startsWith("998")) digits = "998" + digits;
      digits = digits.slice(0, 12);
      let res = "+998 ";
      if (digits.length > 3) res += digits.slice(3, 5);
      if (digits.length > 5) res += " " + digits.slice(5, 8);
      if (digits.length > 8) res += " " + digits.slice(8, 10);
      if (digits.length > 10) res += " " + digits.slice(10, 12);
      return res;
    }

    function formatPrice(num) {
      if (!num && num !== 0) return "0";
      return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    const I18N = {
      uz: {
        appName: "kuzavnoy.uzz",
        tagline: "Original avto ehtiyot qismlari",
        officialBadge: "Farhod Avto Bozori • Rasmiy Do'kon",
        greetingTitle: "Salom,",
        greetingDesc: "avtomobilingiz uchun original ehtiyot qismlar",
        myGarage: "Mening Garajim",
        chooseCar: "Avtomobilingizni tanlang",
        changeCar: "O'zgartirish",
        allCars: "Barcha modellar",
        searchPlaceholder: "Qism nomi, model yoki VIN kod...",
        categoriesTitle: "Modellar & Toifalar",
        popularTitle: "Eng Ko'p Xarid Qilinganlar",
        viewAll: "Barchasi →",
        addToCart: "Savatga qo'shish",
        buyNow: "Hozir xarid qilish",
        onlyLeft: "Faqat {n} ta qoldi",
        inStock: "Omborda bor",
        outOfStock: "Qolmagan",
        warrantyTag: "12 Oy Rasmiy Kafolat",
        deliverySpeedTag: "2-4 Soatda Tezkor Yetkazish",
        installServiceTag: "Farhod Bozorida O'rnatish",
        crossSellTitle: "Birga sotib olinadi",
        addBothToCart: "Ikkalasini Savatga Qo'shish",
        requestPartTitle: "Menga topib bering",
        requestPartDesc: "Qidirayotgan qismingiz topilmadimi? Ma'lumot qoldiring, topib beramiz!",
        reviewsTitle: "Xaridorlar Sharhlari",
        leaveReview: "Sharh Qoldirish",
        cartTitle: "Savatcha",
        cartEmpty: "Savatchangiz bo'sh",
        cartEmptyDesc: "Katalogimizdan kerakli ehtiyot qismlarni tanlang",
        exploreCatalog: "Katalogni ko'rish",
        checkout: "Rasmiylashtirish",
        deliveryAddress: "Yetkazib berish manzili",
        pinDropMap: "Xaritadan tanlash",
        paymentMethod: "To'lov usuli",
        cardPayment: "Karta orqali to'lov",
        cashPayment: "Qabul qilinganda to'lash",
        walletBalance: "Keshbek balansi",
        useCashback: "Keshbekni hisobdan chiqarish",
        mechanicWholesale: "Usta / Ulgurji rejim",
        orderSuccess: "Buyurtmangiz qabul qilindi!",
        orderSuccessDesc: "Operatorimiz tez orada tasdiqlash uchun bog'lanadi",
        viewOrder: "Buyurtmani ko'rish",
        ordersHistory: "Buyurtmalarim",
        savedFavorites: "Sevimlilar",
        storeInfo: "Do'kon Ma'lumotlari",
        reOrder: "Qayta buyurtma",
        requestReturn: "Qaytarish / Almashtirish",
        statusConfirmed: "Tasdiqlandi",
        statusProcessing: "Yig'ilmoqda",
        statusShipping: "Yo'lda",
        statusDelivered: "Yetkazildi",
        contactSupport: "Operator bilan bog'lanish",
        navHome: "Bosh sahifa",
        navCatalog: "Katalog",
        navCart: "Savat",
        navProfile: "Profil",
        vipTier: "VIP Daraja",
        serviceCheckbox: "O'rnatib berish servisi kerakmi? (Farhod bozori, -10% chegirma)",
        promoCode: "Promokod",
        apply: "Qo'llash",
        sum: "so'm",
        total: "Jami"
      },
      ru: {
        appName: "kuzavnoy.uzz",
        tagline: "Оригинальные автозапчасти",
        officialBadge: "Фархадский авторынок • Официальный магазин",
        greetingTitle: "Здравствуйте,",
        greetingDesc: "оригинальные запчасти для вашего авто",
        myGarage: "Мой Гараж",
        chooseCar: "Выберите ваш автомобиль",
        changeCar: "Изменить",
        allCars: "Все модели",
        searchPlaceholder: "Название детали, модель или VIN...",
        categoriesTitle: "Модели & Категории",
        popularTitle: "Хиты Продаж",
        viewAll: "Все →",
        addToCart: "В корзину",
        buyNow: "Купить сейчас",
        onlyLeft: "Осталось {n} шт",
        inStock: "В наличии",
        outOfStock: "Нет в наличии",
        warrantyTag: "Гарантия 12 месяцев",
        deliverySpeedTag: "Доставка за 2-4 часа",
        installServiceTag: "Установка на Фархадском",
        crossSellTitle: "Вместе дешевле",
        addBothToCart: "Добавить оба в корзину",
        requestPartTitle: "Найти для меня",
        requestPartDesc: "Не нашли нужную деталь? Оставьте заявку, найдем для вас!",
        reviewsTitle: "Отзывы покупателей",
        leaveReview: "Оставить отзыв",
        cartTitle: "Корзина",
        cartEmpty: "Ваша корзина пуста",
        cartEmptyDesc: "Выберите нужные автозапчасти из каталога",
        exploreCatalog: "Перейти в каталог",
        checkout: "Оформить заказ",
        deliveryAddress: "Адрес доставки",
        pinDropMap: "Выбрать на карте",
        paymentMethod: "Способ оплаты",
        cardPayment: "Оплата картой",
        cashPayment: "Оплата при получении",
        walletBalance: "Кэшбэк баланс",
        useCashback: "Списать кэшбэк",
        mechanicWholesale: "Режим мастера / Опт",
        orderSuccess: "Ваш заказ принят!",
        orderSuccessDesc: "Наш оператор свяжется с вами в ближайшее время",
        viewOrder: "Посмотреть заказ",
        ordersHistory: "Мои заказы",
        savedFavorites: "Избранное",
        storeInfo: "О магазине",
        reOrder: "Повторить заказ",
        requestReturn: "Возврат / Обмен",
        statusConfirmed: "Подтвержден",
        statusProcessing: "Сборка",
        statusShipping: "В пути",
        statusDelivered: "Доставлен",
        contactSupport: "Связаться с оператором",
        navHome: "Главная",
        navCatalog: "Каталог",
        navCart: "Корзина",
        navProfile: "Профиль",
        vipTier: "VIP Статус",
        serviceCheckbox: "Нужна установка? (Фархадский авторынок, скидка -10%)",
        promoCode: "Промокод",
        apply: "Применить",
        sum: "сум",
        total: "Итого"
      },
      en: {
        appName: "kuzavnoy.uzz",
        tagline: "Genuine Auto Spare Parts",
        officialBadge: "Farhod Car Market • Official Store",
        greetingTitle: "Hello,",
        greetingDesc: "genuine auto parts for your car",
        myGarage: "My Garage",
        chooseCar: "Select your vehicle",
        changeCar: "Change",
        allCars: "All models",
        searchPlaceholder: "Part name, model or VIN code...",
        categoriesTitle: "Models & Categories",
        popularTitle: "Most Popular Parts",
        viewAll: "View all →",
        addToCart: "Add to cart",
        buyNow: "Buy now",
        onlyLeft: "Only {n} left",
        inStock: "In stock",
        outOfStock: "Out of stock",
        warrantyTag: "12-Month Official Warranty",
        deliverySpeedTag: "Fast 2-4h Delivery",
        installServiceTag: "Farhod Market Installation",
        crossSellTitle: "Frequently bought together",
        addBothToCart: "Add Both to Cart",
        requestPartTitle: "Request a Part",
        requestPartDesc: "Can't find the part you need? Leave a request, we'll find it!",
        reviewsTitle: "Customer Reviews",
        leaveReview: "Leave Review",
        cartTitle: "Cart",
        cartEmpty: "Your cart is empty",
        cartEmptyDesc: "Browse our catalog to find matching car parts",
        exploreCatalog: "Explore Catalog",
        checkout: "Checkout",
        deliveryAddress: "Delivery address",
        pinDropMap: "Pick on map",
        paymentMethod: "Payment method",
        cardPayment: "Card payment",
        cashPayment: "Cash on delivery",
        walletBalance: "Cashback balance",
        useCashback: "Deduct cashback balance",
        mechanicWholesale: "Mechanic / Wholesale mode",
        orderSuccess: "Order received successfully!",
        orderSuccessDesc: "Our operator will contact you shortly to confirm",
        viewOrder: "View order",
        ordersHistory: "My Orders",
        savedFavorites: "Saved",
        storeInfo: "Store Information",
        reOrder: "Re-Order",
        requestReturn: "Return / Exchange",
        statusConfirmed: "Confirmed",
        statusProcessing: "Packing",
        statusShipping: "Shipping",
        statusDelivered: "Delivered",
        contactSupport: "Contact Support",
        navHome: "Home",
        navCatalog: "Catalog",
        navCart: "Cart",
        navProfile: "Profile",
        vipTier: "VIP Tier",
        serviceCheckbox: "Installation service needed? (Farhod Market, -10% promo)",
        promoCode: "Promo code",
        apply: "Apply",
        sum: "UZS",
        total: "Total"
      }
    };


    // ==========================================
    // 2. MODAL COMPONENTS
    // ==========================================

    // 2.1 My Garage Modal
    const GarageModal = ({ isOpen, onClose, selectedCar, onSelectCar, t }) => {
      if (!isOpen) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#101726] border border-[#1F2B45] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between pb-4 border-b border-[#1F2B45]">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-800/80 rounded-xl text-slate-300">
                  <Icon name="car" className="w-5 h-5 text-slate-200" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{t("myGarage")}</h3>
                  <p className="text-xs text-slate-400">{t("chooseCar")}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 my-4 max-h-[60vh] overflow-y-auto pr-1">
              <button
                onClick={() => { onSelectCar(""); onClose(); }}
                className={"p-3 rounded-xl text-left border transition-all " + (!selectedCar ? "border-slate-400 bg-slate-800 text-white font-bold" : "border-[#1F2B45] bg-[#162033]/50 text-slate-300 hover:border-slate-600")}
              >
                <div className="text-xs text-slate-400">Hammasi</div>
                <div className="text-sm font-semibold">{t("allCars")}</div>
              </button>
              {CAR_MODELS.map(car => (
                <button
                  key={car}
                  onClick={() => { onSelectCar(car); onClose(); }}
                  className={"p-3 rounded-xl text-left border transition-all " + (selectedCar === car ? "border-rose-500 bg-rose-950/30 text-rose-300 font-bold" : "border-[#1F2B45] bg-[#162033]/50 text-slate-300 hover:border-slate-600")}
                >
                  <div className="text-xs text-slate-400">Chevrolet / Ravon</div>
                  <div className="text-sm font-semibold">{car}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    };

    // 2.2 Leaflet Interactive Pin-Drop Map Modal
    const LeafletMapModal = ({ isOpen, onClose, onConfirmLocation, initialAddress }) => {
      const mapContainerRef = useRef(null);
      const mapInstanceRef = useRef(null);
      const markerRef = useRef(null);
      const [addressText, setAddressText] = useState(initialAddress || "Toshkent shahri");
      const [coords, setCoords] = useState({ lat: 41.311081, lng: 69.279737 });
      const [isLocating, setIsLocating] = useState(false);

      useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
          if (!mapContainerRef.current) return;
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
          }

          if (typeof L === "undefined") {
            console.error("Leaflet not loaded");
            return;
          }

          const map = L.map(mapContainerRef.current, {
            center: [coords.lat, coords.lng],
            zoom: 13,
            zoomControl: false
          });
          mapInstanceRef.current = map;

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap"
          }).addTo(map);

          const customIcon = L.divIcon({
            className: "custom-pin",
            html: '<div style="background:#e11d48;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const marker = L.marker([coords.lat, coords.lng], {
            draggable: true,
            icon: customIcon
          }).addTo(map);
          markerRef.current = marker;

          const updateAddressFromCoords = (lat, lng) => {
            setCoords({ lat, lng });
            setAddressText("Toshkent, koordinatalar: " + lat.toFixed(5) + ", " + lng.toFixed(5));
          };

          marker.on("dragend", (e) => {
            const pos = e.target.getLatLng();
            updateAddressFromCoords(pos.lat, pos.lng);
          });

          map.on("click", (e) => {
            marker.setLatLng(e.latlng);
            updateAddressFromCoords(e.latlng.lat, e.latlng.lng);
          });
        }, 150);

        return () => {
          clearTimeout(timer);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
          }
        };
      }, [isOpen]);

      const handleUseGPS = () => {
        if (!navigator.geolocation) {
          alert("GPS brauzeringiz tomonidan qo'llab-quvvatlanmaydi");
          return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocating(false);
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setCoords({ lat, lng });
            setAddressText("Mening joylashuvim: " + lat.toFixed(5) + ", " + lng.toFixed(5));
            if (mapInstanceRef.current && markerRef.current) {
              mapInstanceRef.current.setView([lat, lng], 16);
              markerRef.current.setLatLng([lat, lng]);
            }
          },
          (err) => {
            setIsLocating(false);
            alert("GPS aniqlanmadi: " + err.message);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      };

      if (!isOpen) return null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101726] border border-[#1F2B45] w-full h-full sm:h-[85vh] sm:max-w-xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 bg-[#162033] border-b border-[#1F2B45] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-rose-950/50 rounded-xl text-rose-400">
                  <Icon name="map-pin" className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Yetkazib berish xaritasi</h3>
                  <p className="text-xs text-slate-400">Xaritani bosing yoki pinni suring</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            {/* Map Canvas */}
            <div className="relative flex-1 w-full bg-slate-900 min-h-[300px]">
              <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "100%" }}></div>
              <button
                type="button"
                onClick={handleUseGPS}
                className="absolute bottom-4 right-4 z-20 flex items-center space-x-2 px-3.5 py-2.5 bg-[#101726]/95 border border-[#1F2B45] hover:border-slate-500 text-white rounded-xl shadow-lg backdrop-blur-sm text-xs font-semibold active:scale-95"
              >
                <Icon name="compass" className={"w-4 h-4 text-rose-500 " + (isLocating ? "animate-spin" : "")} />
                <span>{isLocating ? "Aniqlanmoqda..." : "GPS Joylashuvim"}</span>
              </button>
            </div>

            {/* Bottom Bar */}
            <div className="p-4 bg-[#162033] border-t border-[#1F2B45]">
              <div className="mb-3">
                <div className="text-[11px] text-slate-400 font-semibold mb-1">Tanlangan manzil:</div>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="Mo'ljal, ko'cha, uy raqami..."
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              <button
                onClick={() => { onConfirmLocation(addressText); onClose(); }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
              >
                <Icon name="check" className="w-4 h-4" />
                <span>Manzilni Tasdiqlash</span>
              </button>
            </div>
          </div>
        </div>
      );
    };

    // 2.3 "Menga topib bering" (Part Request) Modal
    const PartRequestModal = ({ isOpen, onClose, userCar, userPhone, showToast }) => {
      const [carModel, setCarModel] = useState(userCar || "Gentra");
      const [partName, setPartName] = useState("");
      const [phone, setPhone] = useState(userPhone || "+998 ");
      const [note, setNote] = useState("");
      const [isSending, setIsSending] = useState(false);

      if (!isOpen) return null;

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!partName.trim()) {
          showToast("Iltimos, so'ralayotgan qism nomini kiriting");
          return;
        }
        setIsSending(true);
        try {
          const res = await fetch("/api/part-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              car_model: carModel,
              part_name: partName,
              phone: phone,
              note: note,
              telegram_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null,
              customer_name: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Mijoz"
            })
          });
          const data = await res.json();
          if (data.ok) {
            showToast("Arizangiz qabul qilindi! Mutaxassislarimiz tezda qidirib bog'lanishadi.");
            onClose();
          } else {
            showToast("Xatolik: " + (data.error || "Arizani yuborib bo'lmadi"));
          }
        } catch (err) {
          showToast("Tarmoq xatosi");
        } finally {
          setIsSending(false);
        }
      };

      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101726] border border-[#1F2B45] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2B45]">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-800 rounded-xl text-slate-200">
                  <Icon name="search" className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Menga topib bering</h3>
                  <p className="text-xs text-slate-400">Kerakli detalni Farhod bozoridan topib beramiz</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Avtomobil modeli</label>
                <select
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  {CAR_MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="Boshqa">Boshqa avto model</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Kerakli qism nomi / kodi</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="Masalan: Gentra orqa bamper usilitel yoki OEM..."
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bog'lanish uchun telefon</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Qo'shimcha izoh yoki VIN</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Rangi, yili yoki qo'shimcha talablar..."
                  rows={2}
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                >
                  <Icon name="search" className="w-4 h-4" />
                  <span>{isSending ? "Yuborilmoqda..." : "Arizani Yuborish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    // 2.4 Return Request Modal ("Qaytarish / Almashtirish")
    const ReturnRequestModal = ({ isOpen, onClose, orderId, showToast }) => {
      const [reason, setReason] = useState("Noto'g'ri o'lcham / mos kelmadi");
      const [note, setNote] = useState("");
      const [phone, setPhone] = useState("+998 ");
      const [isSending, setIsSending] = useState(false);

      if (!isOpen) return null;

      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSending(true);
        try {
          const res = await fetch("/api/returns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: orderId,
              reason: reason,
              note: note,
              phone: phone,
              telegram_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null,
              customer_name: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Mijoz"
            })
          });
          const data = await res.json();
          if (data.ok) {
            showToast("Qaytarish arizangiz qabul qilindi! Operatorimiz ko'rib chiqadi.");
            onClose();
          } else {
            showToast("Xatolik: " + (data.error || "Yuborib bo'lmadi"));
          }
        } catch (err) {
          showToast("Tarmoq xatosi");
        } finally {
          setIsSending(false);
        }
      };

      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101726] border border-[#1F2B45] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2B45]">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-800 rounded-xl text-rose-400">
                  <Icon name="refresh" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Qaytarish / Almashtirish</h3>
                  <p className="text-xs text-slate-400">Buyurtma #{orderId}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Sababi</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Noto'g'ri o'lcham / mos kelmadi">Noto'g'ri o'lcham / mos kelmadi</option>
                  <option value="Sifatsiz yoki nuqsonli detal">Sifatsiz yoki nuqsonli detal</option>
                  <option value="Boshqa ehtiyot qismga almashtirish">Boshqa ehtiyot qismga almashtirish</option>
                  <option value="Boshqa sabab">Boshqa sabab</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bog'lanish uchun telefon</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Batafsil izoh</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Qanday muammo yuz berdi?"
                  rows={2}
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                >
                  <Icon name="check" className="w-4 h-4" />
                  <span>{isSending ? "Yuborilmoqda..." : "Arizani Rasmiylashtirish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    // 2.5 Customer Review Modal
    const ReviewModal = ({ isOpen, onClose, product, onReviewSubmitted, showToast }) => {
      const [rating, setRating] = useState(5);
      const [comment, setComment] = useState("");
      const [authorName, setAuthorName] = useState("");
      const [isSubmitting, setIsSubmitting] = useState(false);

      if (!isOpen || !product) return null;

      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
          const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: product.id,
              rating: rating,
              comment: comment,
              author_name: authorName.trim() || window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Mijoz"
            })
          });
          const data = await res.json();
          if (data.ok) {
            showToast("Sharhingiz uchun rahmat!");
            if (onReviewSubmitted) onReviewSubmitted();
            onClose();
          } else {
            showToast("Xatolik yuz berdi");
          }
        } catch (err) {
          showToast("Tarmoq xatosi");
        } finally {
          setIsSubmitting(false);
        }
      };

      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101726] border border-[#1F2B45] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2B45]">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-950/40 rounded-xl text-amber-400">
                  <Icon name="star-solid" className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Sharh qoldirish</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[220px]">{product.name}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Baho bering</label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-2 text-2xl transition-transform active:scale-125 focus:outline-none"
                    >
                      <Icon
                        name={rating >= star ? "star-solid" : "star"}
                        className={"w-7 h-7 " + (rating >= star ? "text-amber-400" : "text-slate-600")}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ismingiz</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Ismingiz (ixtiyoriy)"
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fikringiz</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Mahsulot sifati, o'rnatilishi haqida yozing..."
                  rows={3}
                  className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                >
                  <Icon name="check" className="w-4 h-4" />
                  <span>{isSubmitting ? "Yuborilmoqda..." : "Sharhni Chop Etish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    // 2.6 Shoppable Story Modal
    const StoryModal = ({ activeStory, onClose, onSelectProduct, products }) => {
      const [progress, setProgress] = useState(0);

      useEffect(() => {
        if (!activeStory) return;
        setProgress(0);
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              onClose();
              return 100;
            }
            return prev + 2;
          });
        }, 100);
        return () => clearInterval(interval);
      }, [activeStory]);

      if (!activeStory) return null;

      const linkedProduct = activeStory.product_id ? products.find(p => p.id === activeStory.product_id) : null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-fadeIn">
          {/* Progress Bar */}
          <div className="absolute top-4 left-4 right-4 z-20 flex space-x-1">
            <div className="h-1 bg-white/20 rounded-full flex-1 overflow-hidden">
              <div className="h-full bg-white transition-all duration-100" style={{ width: progress + "%" }}></div>
            </div>
          </div>

          {/* Header */}
          <div className="absolute top-8 left-4 right-4 z-20 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-full border border-rose-500 overflow-hidden bg-slate-800">
                <img src={activeStory.media_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=200"} className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-xs font-bold">{activeStory.title || "kuzavnoy.uzz"}</div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md">
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>

          {/* Media Content */}
          <div className="w-full h-full flex items-center justify-center relative">
            <img
              src={activeStory.media_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800"}
              className="w-full h-full object-contain max-h-screen"
            />
          </div>

          {/* Shoppable Product CTA Bar */}
          {linkedProduct && (
            <div className="absolute bottom-6 left-4 right-4 z-20">
              <div className="bg-[#101726]/95 border border-[#1F2B45] p-3 rounded-2xl backdrop-blur-md flex items-center justify-between shadow-2xl">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img src={linkedProduct.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=200"} className="w-12 h-12 rounded-xl object-cover border border-[#1F2B45]" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate">{linkedProduct.name}</div>
                    <div className="text-xs text-rose-400 font-extrabold">{formatPrice(linkedProduct.price)} so'm</div>
                  </div>
                </div>
                <button
                  onClick={() => { onClose(); onSelectProduct(linkedProduct); }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all whitespace-nowrap"
                >
                  Xarid Qilish
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    // 2.7 Fullscreen Product Detail Modal with Specs, 3 Trust Badges & Cross-Sell
    const ProductDetailModal = ({
      product,
      onClose,
      onAddToCart,
      onOpenReviewModal,
      reviews,
      allProducts,
      isMechanicMode,
      t,
      showToast
    }) => {
      if (!product) return null;

      const productReviews = reviews ? reviews.filter(r => r.product_id === product.id) : [];
      const avgRating = productReviews.length > 0 
        ? (productReviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / productReviews.length).toFixed(1)
        : "5.0";

      // Cross-sell item matching: either defined in cross_sell_ids or related by category
      const crossSellItem = useMemo(() => {
        if (!allProducts || allProducts.length < 2) return null;
        if (product.cross_sell_ids && product.cross_sell_ids.length > 0) {
          const match = allProducts.find(p => p.id === product.cross_sell_ids[0]);
          if (match && match.id !== product.id) return match;
        }
        return allProducts.find(p => p.id !== product.id && p.category_id === product.category_id) || null;
      }, [product, allProducts]);

      const effectivePrice = isMechanicMode ? Math.round(product.price * 0.9) : product.price;

      const handleShareToTelegram = () => {
        const shareMsg = encodeURIComponent(product.name + " - Original ehtiyot qism (kuzavnoy.uzz)") + "%0A" + encodeURIComponent("Narxi: " + formatPrice(effectivePrice) + " so'm") + "%0A" + encodeURIComponent("Farhod avto bozori rasmiy do'koni");
        const url = encodeURIComponent("https://t.me/kuzavnoy_bot");
        window.open("https://t.me/share/url?url=" + url + "&text=" + shareMsg, "_blank");
      };

      const handleAddBundle = () => {
        onAddToCart(product);
        if (crossSellItem) {
          onAddToCart(crossSellItem);
          showToast("Ikkala mahsulot ham savatga qo'shildi!");
        }
      };

      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#090D16] border border-[#1F2B45] w-full h-full sm:h-[90vh] sm:max-w-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Top Navigation */}
            <div className="p-4 bg-[#101726]/90 border-b border-[#1F2B45] flex items-center justify-between z-10 backdrop-blur-md">
              <button
                onClick={onClose}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white text-xs font-semibold"
              >
                <Icon name="arrow-left" className="w-4 h-4" />
                <span>Orqaga</span>
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleShareToTelegram}
                  className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white"
                  title="Telegram orqali ulashish"
                >
                  <Icon name="share" className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
              {/* Product Hero Image */}
              <div className="relative w-full h-72 bg-[#101726] flex items-center justify-center p-4 border-b border-[#1F2B45]">
                <img
                  src={product.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"}
                  alt={product.name}
                  className="w-full h-full object-contain max-h-64 rounded-xl"
                />
                <div className="absolute top-4 left-4 flex flex-col space-y-1">
                  <span className="px-2.5 py-1 bg-slate-900/90 text-slate-300 border border-[#1F2B45] text-[10px] font-bold rounded-lg uppercase tracking-wider backdrop-blur-md">
                    {product.condition === "new" ? "Yangi / Original" : "Ishlatilgan / Ideal"}
                  </span>
                  {product.stock <= 3 && product.stock > 0 ? (
                    <span className="px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/50 text-[10px] font-bold rounded-lg">
                      Faqat {product.stock} ta qoldi
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold rounded-lg">
                      Omborda bor
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Price Section */}
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                    <span>OEM Kodi:</span>
                    <span className="font-mono text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                      {product.oem_code || "OEM-KUZAVNOY"}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{product.name}</h1>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-2xl font-black text-white">{formatPrice(effectivePrice)} so'm</span>
                    {isMechanicMode && (
                      <span className="text-xs bg-rose-950/50 border border-rose-800/50 text-rose-400 px-2 py-0.5 rounded font-bold">
                        Usta narxi (-10%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Compatibility Badge */}
                <div className="p-3 bg-[#101726] border border-[#1F2B45] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Icon name="car" className="w-4 h-4 text-slate-400" />
                    <span>Mos keluvchi modellar:</span>
                  </div>
                  <div className="font-bold text-white">
                    {product.year_from ? (product.year_from + " - " + (product.year_to || "hozirgacha")) : "Universal / Barcha yillar"}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tavsif</h4>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#101726]/40 p-3.5 rounded-xl border border-[#1F2B45]/60">
                    {product.description || "Ushbu ehtiyot qism barcha zavod standartlariga to'liq javob beradi. Original materiallardan tayyorlangan bo'lib, o'rnatishda hech qanday muammo tug'dirmaydi."}
                  </p>
                </div>

                {/* 3 Enterprise Trust Badges */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Kafolat va Servis</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-[#101726] border border-[#1F2B45] rounded-xl flex items-center space-x-3">
                      <div className="p-2 bg-slate-800/80 rounded-lg text-emerald-400">
                        <Icon name="shield-check" className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">12 Oy Kafolat</div>
                        <div className="text-[10px] text-slate-400">Rasmiy do'kon kafolati</div>
                      </div>
                    </div>
                    <div className="p-3 bg-[#101726] border border-[#1F2B45] rounded-xl flex items-center space-x-3">
                      <div className="p-2 bg-slate-800/80 rounded-lg text-sky-400">
                        <Icon name="truck" className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">2-4 Soatda Yetkazish</div>
                        <div className="text-[10px] text-slate-400">Toshkent bo'ylab ekspress</div>
                      </div>
                    </div>
                    <div className="p-3 bg-[#101726] border border-[#1F2B45] rounded-xl flex items-center space-x-3">
                      <div className="p-2 bg-slate-800/80 rounded-lg text-amber-400">
                        <Icon name="wrench" className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Farhod Bozorida O'rnatish</div>
                        <div className="text-[10px] text-slate-400">Hamkor ustaxona servisi</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cross-Sell Bundle ("Birga sotib olinadi") */}
                {crossSellItem && (
                  <div className="p-4 bg-[#101726] border border-[#1F2B45] rounded-2xl mt-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Icon name="sparkles" className="w-4 h-4 text-rose-500" />
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Birga sotib olinadi</h4>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={crossSellItem.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=200"}
                          className="w-12 h-12 object-cover rounded-xl border border-[#1F2B45]"
                        />
                        <div>
                          <div className="text-xs font-bold text-white max-w-[170px] truncate">{crossSellItem.name}</div>
                          <div className="text-xs text-slate-400">{formatPrice(crossSellItem.price)} so'm</div>
                        </div>
                      </div>
                      <button
                        onClick={handleAddBundle}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-[#1F2B45] shadow transition-all active:scale-95"
                      >
                        + Ikkalasini Savatga
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer Reviews Section */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Xaridorlar Fikrlari</h4>
                      <div className="flex items-center space-x-1 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded text-[11px] text-amber-300 font-bold">
                        <Icon name="star-solid" className="w-3 h-3 text-amber-400" />
                        <span>{avgRating} ({productReviews.length})</span>
                      </div>
                    </div>
                    <button
                      onClick={onOpenReviewModal}
                      className="text-xs text-rose-400 font-bold hover:underline"
                    >
                      + Sharh qoldirish
                    </button>
                  </div>

                  {productReviews.length === 0 ? (
                    <div className="p-4 bg-[#101726]/40 border border-[#1F2B45]/60 rounded-xl text-center text-xs text-slate-500">
                      Hozircha sharhlar yo'q. Birinchi bo'lib o'z fikringizni bildiring!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {productReviews.map((rev, idx) => (
                        <div key={idx} className="p-3 bg-[#101726] border border-[#1F2B45] rounded-xl text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white">{rev.author_name || "Mijoz"}</span>
                            <div className="flex text-amber-400">
                              {[...Array(rev.rating || 5)].map((_, i) => (
                                <Icon key={i} name="star-solid" className="w-3 h-3 text-amber-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-slate-300 text-[11px]">{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="p-4 bg-[#101726] border-t border-[#1F2B45] fixed bottom-0 left-0 right-0 sm:static z-20 flex items-center space-x-3">
              <div className="flex-1">
                <div className="text-[10px] text-slate-400">Jami narx:</div>
                <div className="text-base font-black text-white">{formatPrice(effectivePrice)} so'm</div>
              </div>
              <button
                onClick={() => { onAddToCart(product); showToast("Savatga qo'shildi!"); }}
                className="flex-2 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
              >
                <Icon name="cart" className="w-4 h-4" />
                <span>Savatga qo'shish</span>
              </button>
            </div>
          </div>
        </div>
      );
    };

    // 2.8 Language Selection Modal
    const LanguageModal = ({ isOpen, onClose, currentLang, onSelectLang }) => {
      if (!isOpen) return null;
      const languages = [
        { code: "uz", label: "O'zbekcha", sub: "Lotin yozuvida", flag: "UZ" },
        { code: "ru", label: "Русский", sub: "Язык интерфейса", flag: "RU" },
        { code: "en", label: "English", sub: "International", flag: "EN" }
      ];

      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101726] border border-[#1F2B45] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slideUp space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2B45]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-slate-800 rounded-xl text-slate-300">
                  <Icon name="globe" className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Tilni tanlang / Select Language</h3>
                  <p className="text-[11px] text-slate-400">Interfeys tilini o'zgartirish</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {languages.map(item => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => { onSelectLang(item.code); onClose(); }}
                  className={"w-full p-3 rounded-xl border flex items-center justify-between transition-all " + (currentLang === item.code ? "border-rose-500 bg-rose-950/30 text-white font-bold" : "border-[#1F2B45] bg-[#090D16] text-slate-300 hover:border-slate-600")}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-800 text-xs font-black flex items-center justify-center text-slate-200 border border-[#1F2B45]">
                      {item.flag}
                    </span>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.sub}</div>
                    </div>
                  </div>
                  {currentLang === item.code && (
                    <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-white">
                      <Icon name="check" className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    };


    // ==========================================
    // 3. MAIN MINI-APP COMPONENT
    // ==========================================
    function App() {
      const [lang, setLang] = useState(() => localStorage.getItem("kuzavnoy_lang") || "uz");
      const [theme, setTheme] = useState("dark");
      const [activeTab, setActiveTab] = useState("home");
      const [selectedProduct, setSelectedProduct] = useState(null);
      const [products, setProducts] = useState([]);
      const [categories, setCategories] = useState([]);
      const [stories, setStories] = useState([]);
      const [reviews, setReviews] = useState([]);
      const [userOrders, setUserOrders] = useState([]);
      const [isLoading, setIsLoading] = useState(true);

      // Garage & Personalization
      const [garageCar, setGarageCar] = useState(() => localStorage.getItem("kuzavnoy_garage_car") || "");
      const [isGarageModalOpen, setIsGarageModalOpen] = useState(false);
      const [isLangModalOpen, setIsLangModalOpen] = useState(false);

      // Hero Carousel
      const [heroIndex, setHeroIndex] = useState(0);

      // Search & Filters
      const [searchQuery, setSearchQuery] = useState("");
      const [selectedCategory, setSelectedCategory] = useState("all");
      const [selectedCondition, setSelectedCondition] = useState("all");
      const [sortBy, setSortBy] = useState("popular");

      // Modals
      const [activeStory, setActiveStory] = useState(null);
      const [showPartRequestModal, setShowPartRequestModal] = useState(false);
      const [returnOrderId, setReturnOrderId] = useState(null);
      const [showReviewModal, setShowReviewModal] = useState(false);
      const [showMapModal, setShowMapModal] = useState(false);
      const [showSupportModal, setShowSupportModal] = useState(false);

      // Wallet, VIP & Mechanic Mode
      const [wallet, setWallet] = useState({ balance: 0, total_spent: 0, vip_tier: "Kumush" });
      const [isMechanicMode, setIsMechanicMode] = useState(() => localStorage.getItem("kuzavnoy_mechanic_mode") === "true");

      // Cart & Favorites
      const [cart, setCart] = useState(() => {
        try {
          return JSON.parse(localStorage.getItem("kuzavnoy_cart") || "[]");
        } catch { return []; }
      });
      const [favorites, setFavorites] = useState(() => {
        try {
          return JSON.parse(localStorage.getItem("kuzavnoy_favs") || "[]");
        } catch { return []; }
      });

      // Checkout & Order Form
      const [checkoutStep, setCheckoutStep] = useState("cart"); // 'cart' | 'shipping' | 'payment' | 'success'
      const [needsInstallation, setNeedsInstallation] = useState(false);
      const [promoInput, setPromoInput] = useState("");
      const [appliedPromo, setAppliedPromo] = useState(null);
      const [useCashback, setUseCashback] = useState(false);
      const [custName, setCustName] = useState("");
      const [custPhone, setCustPhone] = useState("+998 ");
      const [custAddress, setCustAddress] = useState("");
      const [deliveryType, setDeliveryType] = useState("standard");
      const [paymentMethod, setPaymentMethod] = useState("card");
      const [cardNumber, setCardNumber] = useState("");
      const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
      const [createdOrder, setCreatedOrder] = useState(null);

      // Profile View
      const [profileSubTab, setProfileSubTab] = useState("orders");

      // Toast feedback
      const [toastMsg, setToastMsg] = useState(null);

      const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3500);
      };

      const t = (key) => I18N[lang]?.[key] || I18N.uz[key] || key;

      // Persistence
      useEffect(() => {
        localStorage.setItem("kuzavnoy_cart", JSON.stringify(cart));
      }, [cart]);

      useEffect(() => {
        localStorage.setItem("kuzavnoy_favs", JSON.stringify(favorites));
      }, [favorites]);

      useEffect(() => {
        localStorage.setItem("kuzavnoy_lang", lang);
      }, [lang]);

      useEffect(() => {
        localStorage.setItem("kuzavnoy_garage_car", garageCar);
      }, [garageCar]);

      useEffect(() => {
        localStorage.setItem("kuzavnoy_mechanic_mode", isMechanicMode ? "true" : "false");
      }, [isMechanicMode]);

      // Hero Carousel auto advance
      useEffect(() => {
        const timer = setInterval(() => {
          setHeroIndex(prev => (prev + 1) % 3);
        }, 5000);
        return () => clearInterval(timer);
      }, []);

      // Fetch initial data
      const loadAllData = async () => {
        setIsLoading(true);
        try {
          const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          const tgId = tgUser?.id;

          const [pRes, cRes, sRes, rRes] = await Promise.all([
            fetch("/api/products").then(r => r.json()).catch(() => []),
            fetch("/api/categories").then(r => r.json()).catch(() => []),
            fetch("/api/stories").then(r => r.json()).catch(() => []),
            fetch("/api/reviews").then(r => r.json()).catch(() => ({ reviews: [] }))
          ]);

          const rawProds = Array.isArray(pRes) ? pRes : (pRes?.products || []);
          const normalizedProds = rawProds.map(p => ({
            ...p,
            price: Number(p.price || p.new_price || p.old_price || 0)
          }));
          setProducts(normalizedProds);

          const rawCats = Array.isArray(cRes) ? cRes : (cRes?.categories || []);
          setCategories(rawCats);

          const rawStories = Array.isArray(sRes) ? sRes : (sRes?.stories || []);
          setStories(rawStories);

          const rawReviews = Array.isArray(rRes) ? rRes : (rRes?.reviews || []);
          setReviews(rawReviews);

          if (tgId) {
            const [wRes, oRes] = await Promise.all([
              fetch("/api/user/wallet/" + tgId).then(r => r.json()).catch(() => ({})),
              fetch("/api/orders/my?telegram_id=" + tgId).then(r => r.json()).catch(() => ({}))
            ]);
            if (wRes.wallet) setWallet(wRes.wallet);
            if (oRes.orders) setUserOrders(oRes.orders);
          }
        } catch (err) {
          console.error("Data loading error:", err);
        } finally {
          setIsLoading(false);
        }
      };

      useEffect(() => {
        loadAllData();
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        }
      }, []);

      // Garage Car change handler
      const handleSelectGarageCar = async (car) => {
        setGarageCar(car);
        const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
        if (tgId) {
          try {
            await fetch("/api/user/garage", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ telegram_id: tgId, garage_car: car })
            });
          } catch (e) {}
        }
        showToast("Garajingiz yangilandi: " + (car || "Barcha modellar"));
      };

      // Toggle Favorites
      const toggleFavorite = (productId) => {
        setFavorites(prev => 
          prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
      };

      // Cart helpers
      const addToCart = (product) => {
        setCart(prev => {
          const existing = prev.find(item => item.product.id === product.id);
          if (existing) {
            return prev.map(item =>
              item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
          }
          return [...prev, { product, quantity: 1 }];
        });
      };

      const updateCartQuantity = (productId, delta) => {
        setCart(prev => {
          return prev.map(item => {
            if (item.product.id === productId) {
              const newQ = item.quantity + delta;
              return newQ > 0 ? { ...item, quantity: newQ } : null;
            }
            return item;
          }).filter(Boolean);
        });
      };

      const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
      };

      // 1-Click Re-Order
      const handleReorder = (order) => {
        if (!order || !order.items) return;
        const newItems = [];
        try {
          const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
          items.forEach(it => {
            const prod = products.find(p => p.id === it.product_id || p.id === it.id);
            if (prod) {
              newItems.push({ product: prod, quantity: it.quantity || 1 });
            }
          });
        } catch (e) {}

        if (newItems.length > 0) {
          setCart(newItems);
          setActiveTab("cart");
          setCheckoutStep("cart");
          showToast("Buyurtma mahsulotlari savatga joylandi!");
        } else {
          showToast("Mahsulotlar katalogdan topilmadi");
        }
      };

      // Smart Search Filtering with Bilingual Synonyms
      const filteredProducts = useMemo(() => {
        let list = [...products];

        // Garage filter (if garage car selected and not empty)
        if (garageCar && activeTab === "home") {
          const gLower = garageCar.toLowerCase();
          const matchGarage = list.filter(p => 
            (p.name && p.name.toLowerCase().includes(gLower)) ||
            (p.description && p.description.toLowerCase().includes(gLower)) ||
            (p.category && p.category.toLowerCase().includes(gLower))
          );
          if (matchGarage.length > 0) {
            const nonMatch = list.filter(p => !matchGarage.includes(p));
            list = [...matchGarage, ...nonMatch];
          }
        }

        // Search query with synonyms
        if (searchQuery.trim()) {
          const queryRaw = searchQuery.toLowerCase().trim();
          const words = queryRaw.split(/\s+/);
          // Expand words with synonyms
          const expandedWords = [...words];
          words.forEach(w => {
            if (SYNONYMS[w]) expandedWords.push(SYNONYMS[w]);
          });

          list = list.filter(p => {
            const nameLower = (p.name || "").toLowerCase();
            const descLower = (p.description || "").toLowerCase();
            const oemLower = (p.oem_code || "").toLowerCase();
            return expandedWords.some(term => 
              nameLower.includes(term) || descLower.includes(term) || oemLower.includes(term)
            );
          });
        }

        // Category filter
        if (selectedCategory && selectedCategory !== "all") {
          const matchedCat = categories.find(c => String(c.id) === String(selectedCategory));
          const catNameLower = matchedCat ? (matchedCat.name || "").toLowerCase() : "";
          list = list.filter(p => 
            String(p.category_id) === String(selectedCategory) ||
            (catNameLower && p.category && p.category.toLowerCase().includes(catNameLower)) ||
            (catNameLower && p.category_name && p.category_name.toLowerCase().includes(catNameLower))
          );
        }

        // Condition filter
        if (selectedCondition && selectedCondition !== "all") {
          list = list.filter(p => p.condition === selectedCondition);
        }

        // Sorting
        if (sortBy === "price_asc") {
          list.sort((a, b) => a.price - b.price);
        } else if (sortBy === "price_desc") {
          list.sort((a, b) => b.price - a.price);
        }

        return list;
      }, [products, garageCar, searchQuery, selectedCategory, selectedCondition, sortBy, activeTab]);

      // Cart Calculations
      const cartSubtotal = useMemo(() => {
        return cart.reduce((sum, item) => {
          const unitPrice = isMechanicMode ? Math.round(item.product.price * 0.9) : item.product.price;
          return sum + (unitPrice * item.quantity);
        }, 0);
      }, [cart, isMechanicMode]);

      const installationFee = needsInstallation ? 50000 : 0;
      const promoDiscount = appliedPromo ? appliedPromo.discount : 0;
      const cashbackDeduction = useCashback ? Math.min(wallet.balance || 0, cartSubtotal) : 0;
      const cartTotal = Math.max(0, cartSubtotal + installationFee - promoDiscount - cashbackDeduction);

      // Handle Promo Apply
      const handleApplyPromo = () => {
        const clean = promoInput.trim().toUpperCase();
        if (clean === "KUZAVNOY-USTA" || clean === "USTA10") {
          const discount = Math.round(cartSubtotal * 0.1);
          setAppliedPromo({ code: clean, discount });
          showToast("10% chegirma muvaffaqiyatli qo'llandi!");
        } else if (clean === "KUZAVNOY5") {
          const discount = Math.round(cartSubtotal * 0.05);
          setAppliedPromo({ code: clean, discount });
          showToast("5% chegirma qo'llandi!");
        } else {
          showToast("Yaroqsiz promokod");
        }
      };

      // Submit Order
      const handleSubmitOrder = async () => {
        if (!custPhone || custPhone.length < 9) {
          showToast("Iltimos, telefon raqamingizni to'liq kiriting");
          return;
        }
        if (!custAddress) {
          showToast("Iltimos, yetkazib berish manzilini kiriting");
          return;
        }

        setIsSubmittingOrder(true);
        try {
          const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          const payload = {
            telegram_id: tgUser?.id || null,
            customer_name: custName.trim() || tgUser?.first_name || "Mijoz",
            phone: custPhone,
            delivery_address: custAddress,
            delivery_type: deliveryType,
            payment_method: paymentMethod,
            card_type: paymentMethod === "card" ? (detectCardType(cardNumber) || "uzcard") : null,
            card_number: paymentMethod === "card" ? cardNumber : null,
            needs_installation: needsInstallation,
            cashback_used: cashbackDeduction,
            promo_code: appliedPromo?.code || null,
            total_amount: cartTotal,
            items: cart.map(i => ({
              product_id: i.product.id,
              name: i.product.name,
              price: isMechanicMode ? Math.round(i.product.price * 0.9) : i.product.price,
              quantity: i.quantity
            }))
          };

          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.ok) {
            setCreatedOrder(data.order);
            setCart([]);
            setCheckoutStep("success");
            showToast("Buyurtmangiz muvaffaqiyatli qabul qilindi!");
            // Refresh orders and wallet
            loadAllData();
          } else {
            showToast("Xatolik: " + (data.error || "Buyurtma berib bo'lmadi"));
          }
        } catch (e) {
          showToast("Tarmoq xatosi");
        } finally {
          setIsSubmittingOrder(false);
        }
      };

      // Detected card type for badge
      const activeCardType = useMemo(() => detectCardType(cardNumber), [cardNumber]);

      return (
        <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] pb-24 selection:bg-rose-500 selection:text-white">
          {/* Toast Notification */}
          {toastMsg && (
            <div className="fixed top-4 left-4 right-4 z-50 flex justify-center animate-slideDown pointer-events-none">
              <div className="px-4 py-2.5 bg-[#101726]/95 border border-[#1F2B45] text-white text-xs font-semibold rounded-2xl shadow-2xl backdrop-blur-md flex items-center space-x-2">
                <Icon name="sparkles" className="w-4 h-4 text-rose-500" />
                <span>{toastMsg}</span>
              </div>
            </div>
          )}

          {/* Top Bar Header */}
          <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-md border-b border-[#1F2B45] px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Brand & Garage Badge */}
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/40">
                  <Icon name="car" className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-black tracking-tight text-white flex items-center space-x-1">
                    <span>kuzavnoy.uzz</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  {/* Garage Vehicle Pill */}
                  <button
                    onClick={() => setIsGarageModalOpen(true)}
                    className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    <Icon name="car" className="w-3 h-3 text-rose-400" />
                    <span className="font-semibold">{garageCar || t("allCars")}</span>
                    <Icon name="chevron-right" className="w-2.5 h-2.5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center space-x-2">
                {/* VIP Tier Badge */}
                <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#101726] border border-[#1F2B45] text-[10px] font-bold text-amber-400">
                  <Icon name="crown" className="w-3 h-3 text-amber-400" />
                  <span>{wallet.vip_tier || "Kumush"}</span>
                </div>

                {/* Language Switcher */}
                <button
                  type="button"
                  onClick={() => setIsLangModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#101726] border border-[#1F2B45] text-[11px] font-bold text-slate-300 hover:text-white transition-colors flex items-center space-x-1"
                >
                  <Icon name="globe" className="w-3 h-3 text-slate-400" />
                  <span>{lang.toUpperCase()}</span>
                </button>

                {/* Refresh Data */}
                <button
                  onClick={() => { loadAllData(); showToast("Ma'lumotlar yangilandi"); }}
                  className="p-1.5 rounded-lg bg-[#101726] border border-[#1F2B45] text-slate-400 hover:text-white transition-colors"
                  title="Yangilash"
                >
                  <Icon name="refresh" className={"w-4 h-4 " + (isLoading ? "animate-spin" : "")} />
                </button>
              </div>
            </div>
          </header>

          {/* MAIN VIEW TABS */}
          <main className="max-w-md mx-auto sm:max-w-3xl px-4 pt-3">
            {/* ==================== TAB 1: HOME ==================== */}
            {activeTab === "home" && (
              <div className="space-y-4">
                {/* Shoppable Stories Carousel */}
                {stories.length > 0 && (
                  <div className="flex space-x-3 overflow-x-auto no-scrollbar py-1">
                    {stories.map(story => (
                      <button
                        key={story.id}
                        onClick={() => setActiveStory(story)}
                        className="flex flex-col items-center space-y-1 flex-shrink-0 group focus:outline-none"
                      >
                        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-rose-600 via-rose-400 to-amber-500 group-active:scale-95 transition-transform">
                          <img
                            src={story.media_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=200"}
                            className="w-full h-full rounded-full object-cover border-2 border-[#090D16]"
                          />
                        </div>
                        <span className="text-[10px] text-slate-300 font-medium max-w-[64px] truncate text-center">
                          {story.title || "Yangilik"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Personalized Greeting Card with Garage Car */}
                <div className="p-3.5 bg-[#101726] border border-[#1F2B45] rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">
                      {t("greetingTitle")} <span className="text-white font-bold">{window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Haydovchi"}</span>
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {garageCar ? (garageCar + " " + t("greetingDesc")) : t("officialBadge")}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGarageModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-[#1F2B45] transition-all"
                  >
                    {t("changeCar")}
                  </button>
                </div>

                {/* 3-Slide Interactive Hero Banner */}
                <div className="relative overflow-hidden rounded-2xl border border-[#1F2B45] bg-[#101726] h-40 sm:h-48 shadow-xl">
                  {/* Slide 1 */}
                  <div className={"absolute inset-0 transition-opacity duration-700 p-5 flex flex-col justify-between bg-gradient-to-r from-[#090D16] via-[#101726]/80 to-transparent " + (heroIndex === 0 ? "opacity-100 z-10" : "opacity-0 pointer-events-none")}>
                    <div className="max-w-[70%]">
                      <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-[10px] font-bold text-rose-400 uppercase">
                        Farhod Avto Bozori
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white mt-2 leading-tight">
                        Original Kuzov Ehtiyot Qismlari Kafolat Bilan
                      </h2>
                    </div>
                    <button
                      onClick={() => setActiveTab("catalog")}
                      className="w-max px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all"
                    >
                      Katalogni Ko'rish →
                    </button>
                  </div>

                  {/* Slide 2 */}
                  <div className={"absolute inset-0 transition-opacity duration-700 p-5 flex flex-col justify-between bg-gradient-to-r from-[#090D16] via-[#101726]/80 to-transparent " + (heroIndex === 1 ? "opacity-100 z-10" : "opacity-0 pointer-events-none")}>
                    <div className="max-w-[70%]">
                      <span className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-[10px] font-bold text-sky-400 uppercase">
                        Tezkor Yetkazish
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white mt-2 leading-tight">
                        Toshkent Bo'ylab 2-4 Soatda Eshigingizgacha
                      </h2>
                    </div>
                    <button
                      onClick={() => setActiveTab("catalog")}
                      className="w-max px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all"
                    >
                      Xarid Qilish →
                    </button>
                  </div>

                  {/* Slide 3 */}
                  <div className={"absolute inset-0 transition-opacity duration-700 p-5 flex flex-col justify-between bg-gradient-to-r from-[#090D16] via-[#101726]/80 to-transparent " + (heroIndex === 2 ? "opacity-100 z-10" : "opacity-0 pointer-events-none")}>
                    <div className="max-w-[75%]">
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-[10px] font-bold text-amber-400 uppercase">
                        Hamkor Servis
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white mt-2 leading-tight">
                        Farhod Bozorida O'rnatib Berish (-10% Chegirma)
                      </h2>
                    </div>
                    <button
                      onClick={() => { setActiveTab("cart"); setNeedsInstallation(true); }}
                      className="w-max px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all"
                    >
                      Xizmatni Ko'rish →
                    </button>
                  </div>

                  {/* Carousel Dots */}
                  <div className="absolute bottom-3 right-4 z-20 flex space-x-1.5">
                    {[0, 1, 2].map(idx => (
                      <button
                        key={idx}
                        onClick={() => setHeroIndex(idx)}
                        className={"h-1.5 rounded-full transition-all " + (heroIndex === idx ? "w-5 bg-rose-500" : "w-1.5 bg-slate-600")}
                      />
                    ))}
                  </div>
                </div>

                {/* Smart Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="w-full bg-[#101726] border border-[#1F2B45] rounded-2xl pl-11 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 shadow-inner"
                  />
                  <div className="absolute left-3.5 top-3.5 text-slate-500">
                    <Icon name="search" className="w-4 h-4" />
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white"
                    >
                      <Icon name="close" className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Categories Pills */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("categoriesTitle")}</h3>
                    <button onClick={() => setActiveTab("catalog")} className="text-xs text-rose-400 font-bold hover:underline">
                      {t("viewAll")}
                    </button>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto no-scrollbar py-1">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={"px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all " + (selectedCategory === "all" ? "bg-rose-600 text-white shadow-lg" : "bg-[#101726] border border-[#1F2B45] text-slate-300 hover:border-slate-600")}
                    >
                      Barchasi
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(String(cat.id))}
                        className={"px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all " + (String(selectedCategory) === String(cat.id) ? "bg-rose-600 text-white shadow-lg" : "bg-[#101726] border border-[#1F2B45] text-slate-300 hover:border-slate-600")}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Products Grid / 0 Results Part Request CTA */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("popularTitle")}</h3>
                    <span className="text-xs text-slate-500">{filteredProducts.length} ta mahsulot</span>
                  </div>

                  {isLoading ? (
                    /* Skeletons */
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} className="bg-[#101726] border border-[#1F2B45] rounded-2xl p-3 space-y-2 animate-pulse">
                          <div className="w-full h-32 bg-slate-800 rounded-xl"></div>
                          <div className="h-3 bg-slate-800 rounded w-3/4"></div>
                          <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    /* 0 Results "Menga topib bering" CTA Card */
                    <div className="p-6 bg-[#101726] border border-[#1F2B45] rounded-2xl text-center space-y-3 my-4 shadow-xl">
                      <div className="w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-800/40 text-rose-500 mx-auto flex items-center justify-center">
                        <Icon name="search" className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Hech narsa topilmadi</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                          Qidirayotgan qismingiz hozircha ro'yxatda yo'q. Farhod bozoridagi do'konimizdan topib beramiz!
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPartRequestModal(true)}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all inline-flex items-center space-x-2"
                      >
                        <Icon name="tool" className="w-4 h-4" />
                        <span>Menga Topib Bering</span>
                      </button>
                    </div>
                  ) : (
                    /* Products Grid */
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredProducts.map(p => {
                        const price = isMechanicMode ? Math.round(p.price * 0.9) : p.price;
                        const isFav = favorites.includes(p.id);

                        return (
                          <div
                            key={p.id}
                            className="bg-[#101726] border border-[#1F2B45] hover:border-slate-600 rounded-2xl p-3 flex flex-col justify-between transition-all group"
                          >
                            <div className="relative w-full h-32 bg-[#090D16] rounded-xl overflow-hidden mb-2 cursor-pointer flex items-center justify-center" onClick={() => setSelectedProduct(p)}>
                              <img
                                src={p.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400"}
                                alt={p.name}
                                className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-slate-300 hover:text-rose-500 backdrop-blur-sm"
                              >
                                <Icon name={isFav ? "heart-solid" : "heart"} className={"w-4 h-4 " + (isFav ? "text-rose-500" : "")} />
                              </button>
                              {p.stock <= 3 && p.stock > 0 && (
                                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-amber-950/80 border border-amber-800/50 text-amber-300 text-[9px] font-bold rounded">
                                  {p.stock} ta qoldi
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-500 font-mono">{p.oem_code || "OEM"}</div>
                              <h4
                                onClick={() => setSelectedProduct(p)}
                                className="text-xs font-bold text-white line-clamp-2 cursor-pointer hover:text-rose-400 mt-0.5"
                              >
                                {p.name}
                              </h4>
                              <div className="mt-2 flex items-baseline space-x-1">
                                <span className="text-sm font-black text-white">{formatPrice(price)}</span>
                                <span className="text-[10px] text-slate-400">so'm</span>
                              </div>
                            </div>

                            <button
                              onClick={() => { addToCart(p); showToast("Savatga qo'shildi!"); }}
                              className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-[#1F2B45] flex items-center justify-center space-x-1.5 active:scale-95 transition-all"
                            >
                              <Icon name="cart" className="w-3.5 h-3.5 text-rose-500" />
                              <span>+ Savatga</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== TAB 2: CATALOG ==================== */}
            {activeTab === "catalog" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-white">{t("navCatalog")}</h2>
                  <button
                    onClick={() => setShowPartRequestModal(true)}
                    className="text-xs text-rose-400 font-bold hover:underline flex items-center space-x-1"
                  >
                    <Icon name="search" className="w-3.5 h-3.5" />
                    <span>Menga topib bering</span>
                  </button>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="w-full bg-[#101726] border border-[#1F2B45] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="all">Barcha holatlar</option>
                    <option value="new">Faqat Yangi</option>
                    <option value="used">Ishlatilgan / Ideal</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-[#101726] border border-[#1F2B45] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="popular">Ommabop</option>
                    <option value="price_asc">Narx: arzonroq</option>
                    <option value="price_desc">Narx: qimmatroq</option>
                  </select>
                </div>

                {/* Catalog Products */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredProducts.map(p => {
                    const price = isMechanicMode ? Math.round(p.price * 0.9) : p.price;
                    return (
                      <div key={p.id} className="bg-[#101726] border border-[#1F2B45] rounded-2xl p-3 flex flex-col justify-between">
                        <div className="cursor-pointer" onClick={() => setSelectedProduct(p)}>
                          <div className="w-full h-28 bg-[#090D16] rounded-xl flex items-center justify-center p-2 mb-2">
                            <img src={p.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=300"} className="w-full h-full object-contain" />
                          </div>
                          <h4 className="text-xs font-bold text-white line-clamp-2">{p.name}</h4>
                          <div className="text-sm font-black text-white mt-1">{formatPrice(price)} so'm</div>
                        </div>
                        <button
                          onClick={() => { addToCart(p); showToast("Savatga qo'shildi!"); }}
                          className="mt-3 w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all"
                        >
                          Savatga
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== TAB 3: CART & CHECKOUT ==================== */}
            {activeTab === "cart" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-white">{t("cartTitle")}</h2>
                  {cart.length > 0 && checkoutStep === "cart" && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      Tozalash
                    </button>
                  )}
                </div>

                {cart.length === 0 && checkoutStep !== "success" ? (
                  <div className="p-8 bg-[#101726] border border-[#1F2B45] rounded-2xl text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <Icon name="cart" className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-white">{t("cartEmpty")}</div>
                    <p className="text-xs text-slate-400">{t("cartEmptyDesc")}</p>
                    <button
                      onClick={() => setActiveTab("catalog")}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow"
                    >
                      {t("exploreCatalog")}
                    </button>
                  </div>
                ) : checkoutStep === "cart" ? (
                  /* Step 1: Items, Installation & Summary */
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {cart.map(item => (
                        <div key={item.product.id} className="p-3 bg-[#101726] border border-[#1F2B45] rounded-2xl flex items-center justify-between">
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <img src={item.product.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=200"} className="w-14 h-14 rounded-xl object-contain bg-[#090D16] p-1 border border-[#1F2B45]" />
                            <div className="overflow-hidden">
                              <div className="text-xs font-bold text-white truncate max-w-[150px]">{item.product.name}</div>
                              <div className="text-xs text-rose-400 font-extrabold">{formatPrice(isMechanicMode ? Math.round(item.product.price * 0.9) : item.product.price)} so'm</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-[#1F2B45]">
                              <button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-1 text-slate-300 hover:text-white">
                                <Icon name="minus" className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-bold px-2">{item.quantity}</span>
                              <button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-1 text-slate-300 hover:text-white">
                                <Icon name="plus" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button onClick={() => removeFromCart(item.product.id)} className="p-1.5 text-slate-500 hover:text-rose-400">
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Hamkor Avtoservis / Usta Tavsiyasi Checkbox */}
                    <div className="p-3.5 bg-[#101726] border border-[#1F2B45] rounded-2xl">
                      <label className="flex items-start space-x-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={needsInstallation}
                          onChange={(e) => setNeedsInstallation(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700 focus:ring-0"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-white flex items-center space-x-1.5">
                            <Icon name="wrench" className="w-3.5 h-3.5 text-amber-400" />
                            <span>O'rnatib berish servisi kerakmi?</span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            Farhod bozoridagi do'konimiz tomonidan o'rnatib beriladi. Maxsus promokod: <span className="font-mono text-rose-400 font-bold">KUZAVNOY-USTA</span> (-10%)
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Promo Code Input */}
                    <div className="p-3.5 bg-[#101726] border border-[#1F2B45] rounded-2xl flex items-center space-x-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Promokod kiriting (masalan: KUZAVNOY-USTA)"
                        className="flex-1 bg-[#090D16] border border-[#1F2B45] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-rose-500"
                      />
                      <button
                        onClick={handleApplyPromo}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-[#1F2B45]"
                      >
                        Qo'llash
                      </button>
                    </div>

                    {/* Loyalty Cashback Deduction Toggle */}
                    {wallet.balance > 0 && (
                      <div className="p-3.5 bg-[#101726] border border-[#1F2B45] rounded-2xl flex items-center justify-between">
                        <label className="flex items-center space-x-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useCashback}
                            onChange={(e) => setUseCashback(e.target.checked)}
                            className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-white">Keshbek hamyondan to'lash</span>
                            <div className="text-[11px] text-slate-400">Mavjud: {formatPrice(wallet.balance)} so'm</div>
                          </div>
                        </label>
                        {useCashback && (
                          <span className="text-xs font-bold text-emerald-400">-{formatPrice(cashbackDeduction)} so'm</span>
                        )}
                      </div>
                    )}

                    {/* Cost Summary */}
                    <div className="p-4 bg-[#101726] border border-[#1F2B45] rounded-2xl space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Mahsulotlar:</span>
                        <span>{formatPrice(cartSubtotal)} so'm</span>
                      </div>
                      {needsInstallation && (
                        <div className="flex justify-between text-slate-400">
                          <span>O'rnatish servisi:</span>
                          <span>+50 000 so'm</span>
                        </div>
                      )}
                      {appliedPromo && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Promokod ({appliedPromo.code}):</span>
                          <span>-{formatPrice(appliedPromo.discount)} so'm</span>
                        </div>
                      )}
                      {useCashback && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Keshbek:</span>
                          <span>-{formatPrice(cashbackDeduction)} so'm</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#1F2B45] flex justify-between text-base font-black text-white">
                        <span>{t("total")}:</span>
                        <span>{formatPrice(cartTotal)} so'm</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setCheckoutStep("shipping")}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all"
                    >
                      Yetkazib Berishga O'tish →
                    </button>
                  </div>
                ) : checkoutStep === "shipping" ? (
                  /* Step 2: Shipping & Address with Leaflet Pin-drop */
                  <div className="space-y-4">
                    <div className="p-4 bg-[#101726] border border-[#1F2B45] rounded-2xl space-y-3.5">
                      <h3 className="font-bold text-white text-xs uppercase tracking-wider">Yetkazib berish ma'lumotlari</h3>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Ism sharifingiz</label>
                        <input
                          type="text"
                          value={custName}
                          onChange={(e) => setCustName(e.target.value)}
                          placeholder="Ismingizni kiriting"
                          className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Telefon raqamingiz</label>
                        <input
                          type="text"
                          value={custPhone}
                          onChange={(e) => setCustPhone(formatPhoneNumber(e.target.value))}
                          placeholder="+998 90 123 45 67"
                          className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-300">Yetkazib berish manzili</label>
                          <button
                            type="button"
                            onClick={() => setShowMapModal(true)}
                            className="text-xs font-bold text-rose-400 hover:underline flex items-center space-x-1"
                          >
                            <Icon name="map-pin" className="w-3.5 h-3.5" />
                            <span>Xaritadan tanlash</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={custAddress}
                          onChange={(e) => setCustAddress(e.target.value)}
                          placeholder="Toshkent shahri, tuman, ko'cha, uy raqami..."
                          className="w-full bg-[#090D16] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Yetkazish tezligi</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDeliveryType("standard")}
                            className={"p-2.5 rounded-xl border text-xs font-bold text-left transition-all " + (deliveryType === "standard" ? "border-rose-500 bg-rose-950/30 text-rose-300" : "border-[#1F2B45] bg-[#090D16] text-slate-300")}
                          >
                            <div>Standart</div>
                            <div className="text-[10px] text-slate-400">24 soat ichida</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryType("express")}
                            className={"p-2.5 rounded-xl border text-xs font-bold text-left transition-all " + (deliveryType === "express" ? "border-rose-500 bg-rose-950/30 text-rose-300" : "border-[#1F2B45] bg-[#090D16] text-slate-300")}
                          >
                            <div>Ekspress</div>
                            <div className="text-[10px] text-slate-400">2-4 soatda</div>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCheckoutStep("cart")}
                        className="py-3 px-4 bg-slate-800 text-white font-bold text-xs rounded-xl border border-[#1F2B45]"
                      >
                        ← Orqaga
                      </button>
                      <button
                        onClick={() => setCheckoutStep("payment")}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow active:scale-[0.98]"
                      >
                        To'lovga O'tish →
                      </button>
                    </div>
                  </div>
                ) : checkoutStep === "payment" ? (
                  /* Step 3: Payment Method with Live Card Detection */
                  <div className="space-y-4">
                    <div className="p-4 bg-[#101726] border border-[#1F2B45] rounded-2xl space-y-4">
                      <h3 className="font-bold text-white text-xs uppercase tracking-wider">To'lov Usuli</h3>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("card")}
                          className={"p-3 rounded-xl border text-xs font-bold text-left flex items-center space-x-2 transition-all " + (paymentMethod === "card" ? "border-rose-500 bg-rose-950/30 text-rose-300" : "border-[#1F2B45] bg-[#090D16] text-slate-300")}
                        >
                          <Icon name="credit-card" className="w-4 h-4" />
                          <span>Karta orqali</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={"p-3 rounded-xl border text-xs font-bold text-left flex items-center space-x-2 transition-all " + (paymentMethod === "cash" ? "border-rose-500 bg-rose-950/30 text-rose-300" : "border-[#1F2B45] bg-[#090D16] text-slate-300")}
                        >
                          <Icon name="wallet" className="w-4 h-4" />
                          <span>Qabul qilinganda</span>
                        </button>
                      </div>

                      {paymentMethod === "card" && (
                        <div className="p-3.5 bg-[#090D16] border border-[#1F2B45] rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-300">Karta raqami</label>
                            {activeCardType && (
                              <span className="px-2 py-0.5 bg-slate-800 text-rose-400 font-mono text-[10px] font-black rounded uppercase border border-[#1F2B45]">
                                {activeCardType}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="8600 0000 0000 0000"
                            className="w-full bg-[#101726] border border-[#1F2B45] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                          />
                          <p className="text-[10px] text-slate-500">
                            Uzcard, Humo, Visa yoki Mastercard qo'llab-quvvatlanadi
                          </p>
                        </div>
                      )}

                      <div className="p-3 bg-[#090D16] rounded-xl border border-[#1F2B45] flex justify-between items-center">
                        <span className="text-xs text-slate-400">To'lov summasi:</span>
                        <span className="text-base font-black text-white">{formatPrice(cartTotal)} so'm</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCheckoutStep("shipping")}
                        className="py-3 px-4 bg-slate-800 text-white font-bold text-xs rounded-xl border border-[#1F2B45]"
                      >
                        ← Orqaga
                      </button>
                      <button
                        onClick={handleSubmitOrder}
                        disabled={isSubmittingOrder}
                        className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                      >
                        <Icon name="check" className="w-4 h-4" />
                        <span>{isSubmittingOrder ? "Buyurtma berilmoqda..." : "Buyurtmani Tasdiqlash"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 4: Success Screen */
                  <div className="p-6 bg-[#101726] border border-[#1F2B45] rounded-2xl text-center space-y-4 shadow-2xl">
                    <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-800/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                      <Icon name="check" className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">{t("orderSuccess")}</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{t("orderSuccessDesc")}</p>
                    </div>
                    {createdOrder && (
                      <div className="p-3 bg-[#090D16] rounded-xl border border-[#1F2B45] text-xs text-slate-300">
                        Buyurtma raqami: <span className="font-bold text-white">#{createdOrder.id}</span>
                      </div>
                    )}
                    <button
                      onClick={() => { setActiveTab("profile"); setProfileSubTab("orders"); setCheckoutStep("cart"); }}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow"
                    >
                      Buyurtmani Kuzatish →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 4: PROFILE ==================== */}
            {activeTab === "profile" && (
              <div className="space-y-4">
                {/* Profile Header & VIP Card */}
                <div className="p-4 bg-gradient-to-br from-[#162033] to-[#101726] border border-[#1F2B45] rounded-2xl shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-rose-500/50 flex items-center justify-center text-white font-bold text-base">
                        {window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          {window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Foydalanuvchi"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {window.Telegram?.WebApp?.initDataUnsafe?.user?.username ? ("@" + window.Telegram.WebApp.initDataUnsafe.user.username) : "Farhod avto bozori mijozi"}
                        </div>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 bg-amber-950/60 border border-amber-800/50 text-amber-300 rounded-xl text-xs font-black flex items-center space-x-1">
                      <Icon name="crown" className="w-3.5 h-3.5 text-amber-400" />
                      <span>{wallet.vip_tier || "Kumush"}</span>
                    </div>
                  </div>

                  {/* Loyalty Cashback Balance */}
                  <div className="pt-2 border-t border-[#1F2B45] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">{t("walletBalance")}</div>
                      <div className="text-base font-black text-emerald-400">{formatPrice(wallet.balance)} so'm</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Jami xaridlar</div>
                      <div className="text-xs font-bold text-white">{formatPrice(wallet.total_spent)} so'm</div>
                    </div>
                  </div>
                </div>

                {/* Mechanic Mode Wholesale Toggle */}
                <div className="p-3.5 bg-[#101726] border border-[#1F2B45] rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-slate-800 rounded-xl text-rose-400">
                      <Icon name="wrench" className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t("mechanicWholesale")}</div>
                      <div className="text-[10px] text-slate-400">Barcha ehtiyot qismlarga -10% ulgurji narx</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMechanicMode(m => !m);
                      showToast(isMechanicMode ? "Oddiy xaridor rejimiga o'tildi" : "Usta / Ulgurji rejimi faollashdi (-10%)");
                    }}
                    className={"w-12 h-6 flex items-center rounded-full p-1 transition-colors " + (isMechanicMode ? "bg-red-600 justify-end" : "bg-slate-700 justify-start")}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                  </button>
                </div>

                {/* Sub-tabs: Orders / Favorites / Info */}
                <div className="flex space-x-2 border-b border-[#1F2B45] pb-2 text-xs">
                  <button
                    onClick={() => setProfileSubTab("orders")}
                    className={"pb-1 font-bold border-b-2 transition-all " + (profileSubTab === "orders" ? "border-rose-500 text-white" : "border-transparent text-slate-400 hover:text-white")}
                  >
                    {t("ordersHistory")} ({userOrders.length})
                  </button>
                  <button
                    onClick={() => setProfileSubTab("favorites")}
                    className={"pb-1 font-bold border-b-2 transition-all " + (profileSubTab === "favorites" ? "border-rose-500 text-white" : "border-transparent text-slate-400 hover:text-white")}
                  >
                    {t("savedFavorites")} ({favorites.length})
                  </button>
                  <button
                    onClick={() => setProfileSubTab("info")}
                    className={"pb-1 font-bold border-b-2 transition-all " + (profileSubTab === "info" ? "border-rose-500 text-white" : "border-transparent text-slate-400 hover:text-white")}
                  >
                    {t("storeInfo")}
                  </button>
                </div>

                {/* Sub-tab 1: Orders Timeline & 1-Click Reorder */}
                {profileSubTab === "orders" && (
                  <div className="space-y-3">
                    {userOrders.length === 0 ? (
                      <div className="p-6 bg-[#101726] border border-[#1F2B45] rounded-2xl text-center text-xs text-slate-400">
                        Hozircha buyurtmalar yo'q
                      </div>
                    ) : (
                      userOrders.map(order => {
                        const status = order.status || "tasdiqlandi";
                        const stepIndex = 
                          status === "yetkazildi" ? 4 :
                          status === "yolda" || status === "yo'lda" ? 3 :
                          status === "yigilmoqda" || status === "yig'ilmoqda" ? 2 : 1;

                        return (
                          <div key={order.id} className="p-4 bg-[#101726] border border-[#1F2B45] rounded-2xl space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">Buyurtma #{order.id}</span>
                              <span className="text-slate-400">{order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</span>
                            </div>

                            {/* 4-Step Visual Tracking Timeline */}
                            <div className="py-2">
                              <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                                <div className={stepIndex >= 1 ? "text-rose-400" : "text-slate-600"}>1. Tasdiqlandi</div>
                                <div className={stepIndex >= 2 ? "text-rose-400" : "text-slate-600"}>2. Yig'ilmoqda</div>
                                <div className={stepIndex >= 3 ? "text-rose-400" : "text-slate-600"}>3. Yo'lda</div>
                                <div className={stepIndex >= 4 ? "text-emerald-400" : "text-slate-600"}>4. Yetkazildi</div>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden flex">
                                <div
                                  className="h-full bg-gradient-to-r from-rose-600 to-emerald-500 transition-all duration-500"
                                  style={{ width: (stepIndex * 25) + "%" }}
                                ></div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#1F2B45] text-xs">
                              <span className="text-slate-400">Summa: <span className="text-white font-bold">{formatPrice(order.total_amount)} so'm</span></span>
                              <div className="flex space-x-2">
                                {stepIndex >= 4 && (
                                  <button
                                    onClick={() => setReturnOrderId(order.id)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px]"
                                  >
                                    Qaytarish
                                  </button>
                                )}
                                <button
                                  onClick={() => handleReorder(order)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] flex items-center space-x-1"
                                >
                                  <Icon name="refresh" className="w-3 h-3" />
                                  <span>Qayta Buyurtma</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Sub-tab 2: Favorites */}
                {profileSubTab === "favorites" && (
                  <div className="grid grid-cols-2 gap-3">
                    {favorites.length === 0 ? (
                      <div className="col-span-2 p-6 bg-[#101726] border border-[#1F2B45] rounded-2xl text-center text-xs text-slate-400">
                        Sevimlilar ro'yxati bo'sh
                      </div>
                    ) : (
                      products.filter(p => favorites.includes(p.id)).map(p => (
                        <div key={p.id} className="p-3 bg-[#101726] border border-[#1F2B45] rounded-2xl space-y-2">
                          <img src={p.image_url || "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=300"} className="w-full h-24 object-contain" />
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-xs font-black text-rose-400">{formatPrice(p.price)} so'm</div>
                          <button
                            onClick={() => { addToCart(p); showToast("Savatga qo'shildi!"); }}
                            className="w-full py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl"
                          >
                            Savatga
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Sub-tab 3: Store Info */}
                {profileSubTab === "info" && (
                  <div className="p-4 bg-[#101726] border border-[#1F2B45] rounded-2xl space-y-3 text-xs">
                    <div className="font-bold text-white text-sm">kuzavnoy.uzz Rasmiy Do'koni</div>
                    <div className="space-y-2 text-slate-300">
                      <div className="flex items-center space-x-1.5"><Icon name="map-pin" className="w-3.5 h-3.5 text-rose-500 shrink-0" /><span>Manzil:</span> <span className="text-white font-semibold">Toshkent sh., Farhod avto ehtiyot qismlar bozori</span></div>
                      <div className="flex items-center space-x-1.5"><Icon name="clock" className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>Ish vaqti:</span> <span className="text-white font-semibold">08:00 - 19:00 (Har kuni)</span></div>
                      <div className="flex items-center space-x-1.5"><Icon name="phone" className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span>Aloqa:</span> <span className="text-white font-semibold">+998 90 123 45 67</span></div>
                      <div className="flex items-center space-x-1.5"><Icon name="telegram" className="w-3.5 h-3.5 text-sky-400 shrink-0" /><span>Telegram:</span> <span className="text-rose-400 font-semibold">@kuzavnoy_admin</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Floating Support Button */}
          <div className="fixed bottom-20 right-4 z-40">
            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="flex items-center space-x-2 px-3.5 py-2.5 bg-[#101726]/95 hover:bg-[#162033] border border-[#1F2B45] hover:border-slate-500 rounded-full shadow-2xl backdrop-blur-md text-xs font-semibold text-white active:scale-95 transition-all"
            >
              <Icon name="telegram" className="w-4 h-4 text-sky-400" />
              <span>Yordam</span>
            </button>
          </div>

          {/* Support / Yordam Modal */}
          {showSupportModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
              <div className="bg-[#101726] border border-[#1F2B45] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slideUp space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1F2B45]">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-sky-950/50 rounded-xl text-sky-400 border border-sky-800/40">
                      <Icon name="chat" className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Yordam va Qo'llab-quvvatlash</h3>
                      <p className="text-[11px] text-slate-400">Biz har doim aloqadamiz</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSupportModal(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50"
                  >
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 bg-[#090D16] border border-[#1F2B45] rounded-xl text-xs space-y-1">
                  <div className="text-slate-400">Do'konimiz operatorlari:</div>
                  <div className="text-slate-200 font-semibold">Har kuni 08:00 dan 19:00 gacha xizmatingizda</div>
                </div>

                {/* Phone Numbers with 1-click call */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Telefon orqali bog'lanish:</div>
                  <a
                    href="tel:+998901234567"
                    onClick={() => showToast("Qo'ng'iroq amalga oshirilmoqda...")}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-[#1F2B45] hover:border-slate-500 rounded-xl flex items-center justify-between transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 bg-emerald-950/60 rounded-lg text-emerald-400 border border-emerald-800/40">
                        <Icon name="phone" className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-white">+998 90 123 45 67</div>
                        <div className="text-[10px] text-slate-400">Asosiy operator (Farhod bozori)</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">Qo'ng'iroq</span>
                  </a>

                  <a
                    href="tel:+998977654321"
                    onClick={() => showToast("Qo'ng'iroq amalga oshirilmoqda...")}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-[#1F2B45] hover:border-slate-500 rounded-xl flex items-center justify-between transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 bg-emerald-950/60 rounded-lg text-emerald-400 border border-emerald-800/40">
                        <Icon name="phone" className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-white">+998 97 765 43 21</div>
                        <div className="text-[10px] text-slate-400">Omborxona & Kuryerlik</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">Qo'ng'iroq</span>
                  </a>
                </div>

                {/* Telegram Chat Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      showToast("Xabaringiz operatorga yuborildi! Telegram ochilmoqda...");
                      setTimeout(() => {
                        window.open("https://t.me/kuzavnoy_admin", "_blank");
                        setShowSupportModal(false);
                      }, 900);
                    }}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                  >
                    <Icon name="telegram" className="w-4 h-4 text-white" />
                    <span>Telegramda Xabar Qoldirish</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Fixed Navigation Bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090D16]/95 border-t border-[#1F2B45] backdrop-blur-lg">
            <div className="max-w-md mx-auto flex items-center justify-around py-2">
              <button
                onClick={() => setActiveTab("home")}
                className={"flex flex-col items-center space-y-1 py-1 px-3 transition-colors " + (activeTab === "home" ? "text-rose-500 font-bold" : "text-slate-400 hover:text-white")}
              >
                <Icon name="home" className="w-5 h-5" />
                <span className="text-[10px]">{t("navHome")}</span>
              </button>

              <button
                onClick={() => setActiveTab("catalog")}
                className={"flex flex-col items-center space-y-1 py-1 px-3 transition-colors " + (activeTab === "catalog" ? "text-rose-500 font-bold" : "text-slate-400 hover:text-white")}
              >
                <Icon name="grid" className="w-5 h-5" />
                <span className="text-[10px]">{t("navCatalog")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("cart"); setCheckoutStep("cart"); }}
                className={"relative flex flex-col items-center space-y-1 py-1 px-3 transition-colors " + (activeTab === "cart" ? "text-rose-500 font-bold" : "text-slate-400 hover:text-white")}
              >
                <Icon name="cart" className="w-5 h-5" />
                <span className="text-[10px]">{t("navCart")}</span>
                {cart.length > 0 && (
                  <span className="absolute top-0 right-2 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("profile")}
                className={"flex flex-col items-center space-y-1 py-1 px-3 transition-colors " + (activeTab === "profile" ? "text-rose-500 font-bold" : "text-slate-400 hover:text-white")}
              >
                <Icon name="user" className="w-5 h-5" />
                <span className="text-[10px]">{t("navProfile")}</span>
              </button>
            </div>
          </nav>

          {/* ALL INTERACTIVE MODALS */}
          <GarageModal
            isOpen={isGarageModalOpen}
            onClose={() => setIsGarageModalOpen(false)}
            selectedCar={garageCar}
            onSelectCar={handleSelectGarageCar}
            t={t}
          />

          <LeafletMapModal
            isOpen={showMapModal}
            onClose={() => setShowMapModal(false)}
            initialAddress={custAddress}
            onConfirmLocation={(addr) => setCustAddress(addr)}
          />

          <PartRequestModal
            isOpen={showPartRequestModal}
            onClose={() => setShowPartRequestModal(false)}
            userCar={garageCar}
            userPhone={custPhone}
            showToast={showToast}
          />

          <ReturnRequestModal
            isOpen={returnOrderId !== null}
            onClose={() => setReturnOrderId(null)}
            orderId={returnOrderId}
            showToast={showToast}
          />

          <ReviewModal
            isOpen={showReviewModal}
            onClose={() => setShowReviewModal(false)}
            product={selectedProduct}
            onReviewSubmitted={loadAllData}
            showToast={showToast}
          />

          <StoryModal
            activeStory={activeStory}
            onClose={() => setActiveStory(null)}
            onSelectProduct={(p) => setSelectedProduct(p)}
            products={products}
          />

          <LanguageModal
            isOpen={isLangModalOpen}
            onClose={() => setIsLangModalOpen(false)}
            currentLang={lang}
            onSelectLang={(newLang) => {
              setLang(newLang);
              localStorage.setItem("kuzavnoy_lang", newLang);
              setIsLangModalOpen(false);
              showToast(newLang === "uz" ? "Til tanlandi: O'zbekcha" : newLang === "ru" ? "Язык выбран: Русский" : "Language selected: English");
            }}
          />

          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={addToCart}
            onOpenReviewModal={() => setShowReviewModal(true)}
            reviews={reviews}
            allProducts={products}
            isMechanicMode={isMechanicMode}
            t={t}
            showToast={showToast}
          />
        </div>
      );
    }

    // Mount React App to DOM
    const root = ReactDOM.createRoot(document.getElementById("root"));
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
        download: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
          </svg>
        ),
        printer: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>
          </svg>
        ),
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
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
          </svg>
        ),
        stories: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" x2="12.01" y1="3" y2="3"/><line x1="12" x2="12.01" y1="21" y2="21"/>
          </svg>
        ),
        users: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
        broadcast: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
          </svg>
        ),
        settings: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        ),
        menu: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        ),
        close: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
          </svg>
        ),
        refresh: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
          </svg>
        ),
        plus: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
        ),
        edit: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        ),
        trash: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        ),
        eye: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        ),
        check: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ),
        alert: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
        ),
        dollar: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
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
        volume: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        ),
        'volume-x': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>
          </svg>
        ),
        car: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
          </svg>
        ),
        search: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
          </svg>
        ),
        tag: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>
          </svg>
        ),
        phone: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
        'credit-card': (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
          </svg>
        ),
        shield: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        ),
        zap: (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        )
      };
      return icons[name] || icons.package;
    };

    // Audio chime helper
    const playChime = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch(e) {}
    };

    function AdminDashboard() {
      // Theme State
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
      const [partRequests, setPartRequests] = useState([]);
      const [returnRequests, setReturnRequests] = useState([]);
      const [broadcastAudience, setBroadcastAudience] = useState("all");
      const [loading, setLoading] = useState(false);
      const [isRefreshing, setIsRefreshing] = useState(false);
      const [refreshToast, setRefreshToast] = useState(false);

      const [settings, setSettings] = useState({
        card_number: "8600 5304 1234 5678",
        card_holder: "AZIMXON (KUZAVNOY.UZZ)",
        uzcard_number: "8600 5304 1234 5678",
        uzcard_holder: "AZIMXON (KUZAVNOY.UZZ)",
        uzcard_active: true,
        humo_number: "9860 1201 5678 4321",
        humo_holder: "AZIMXON (KUZAVNOY.UZZ)",
        humo_active: true,
        visa_number: "",
        visa_holder: "AZIMXON (KUZAVNOY.UZZ)",
        visa_active: true,
        phone: "+998 90 123 45 67",
        phone2: "+998 97 765 43 21",
        phone3: "",
        instagram_url: "https://instagram.com/kuzavnoy.uzz",
        youtube_url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G",
        telegram_channel_url: "https://t.me/kuzavnoy_uz",
        store_address: "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori",
        store_hours: "09:00 - 19:00"
      });

      // Filters
      const [orderSearch, setOrderSearch] = useState("");
      const [orderStatusFilter, setOrderStatusFilter] = useState("all");
      const [productSearch, setProductSearch] = useState("");
      const [productCategoryFilter, setProductCategoryFilter] = useState("Barchasi");

      // Modals & Forms
      const [selectedOrder, setSelectedOrder] = useState(null);
      const [editingProduct, setEditingProduct] = useState(null);
      const [productSaving, setProductSaving] = useState(false);
      const [newCategoryName, setNewCategoryName] = useState("");
      const [settingsSaving, setSettingsSaving] = useState(false);
      const [settingsMessage, setSettingsMessage] = useState("");

      // Stories State & Form
      const [storyTitle, setStoryTitle] = useState("");
      const [storyDescription, setStoryDescription] = useState("");
      const [storyTag, setStoryTag] = useState("Yangi");
      const [storyImageUrl, setStoryImageUrl] = useState("");
      const [storySaving, setStorySaving] = useState(false);

      // Broadcast State
      const [broadcastText, setBroadcastText] = useState("");
      const [broadcastImage, setBroadcastImage] = useState("");
      const [broadcastSending, setBroadcastSending] = useState(false);
      const [broadcastStatus, setBroadcastStatus] = useState("");

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
          const prods = Array.isArray(data) ? data : (data?.products || []);
          setProducts(prods.map(p => ({
            ...p,
            price: Number(p.price || p.new_price || p.old_price || 0)
          })));
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
          if (data && (data.card_number || data.uzcard_number)) {
            setSettings(prev => ({ ...prev, ...data }));
          }
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
          fetchSettings(true),
          fetchPartRequests(),
          fetchReturns()
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
            if (selectedOrder && selectedOrder.id === orderId) {
              setSelectedOrder(prev => ({ ...prev, status: newStatus }));
            }
          }
        } catch(e) {
          alert("Statusni o'zgartirishda xatolik");
        }
      };

      // Quick Stock Adjust (+1 / -1)
      const handleQuickStock = async (prodId, change) => {
        const prod = products.find(p => p.id === prodId);
        if (!prod) return;
        const newStock = Math.max(0, (prod.stock || 0) + change);
        try {
          const res = await fetch('/api/products/' + prodId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: newStock })
          });
          if (res.ok) {
            setProducts(prev => prev.map(p => p.id === prodId ? { ...p, stock: newStock } : p));
          }
        } catch(e) {}
      };

      // Save Edited Product
      const handleSaveProduct = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;
        setProductSaving(true);
        try {
          const res = await fetch('/api/products/' + editingProduct.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct)
          });
          if (res.ok) {
            setProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
            setEditingProduct(null);
          } else {
            alert("Mahsulotni saqlashda xatolik");
          }
        } catch(e) {
          alert("Server bilan aloqada xatolik");
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
            body: JSON.stringify({ name: newCategoryName.trim(), icon: "car" })
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

      const handleSeedCategories = async () => {
        try {
          const res = await fetch("/api/categories/seed", { method: "POST" });
          const seeded = await res.json();
          if (Array.isArray(seeded)) {
            setCategories(seeded);
            alert("12 ta standart avto modellar muvaffaqiyatli tiklandi!");
          }
        } catch(e) {
          alert("Tiklashda xatolik yuz berdi");
        }
      };

      // Story Add & Delete
      const handleAddStory = async (e) => {
        e.preventDefault();
        if (!storyTitle.trim() || !storyImageUrl.trim()) {
          alert("Sarlavha va rasm havolasini kiriting!");
          return;
        }
        setStorySaving(true);
        try {
          const res = await fetch("/api/stories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: storyTitle.trim(),
              description: storyDescription.trim(),
              tag: storyTag || "Yangi",
              image_url: storyImageUrl.trim()
            })
          });
          const newStory = await res.json();
          if (newStory && newStory.id) {
            setStories(prev => [newStory, ...prev]);
            setStoryTitle("");
            setStoryDescription("");
            setStoryImageUrl("");
            setRefreshToast(true);
            setTimeout(() => setRefreshToast(false), 2000);
          } else {
            alert(newStory?.error || "Istoriya qo'shishda xatolik yuz berdi");
          }
        } catch(err) {
          alert("Server bilan aloqada xatolik");
        } finally {
          setStorySaving(false);
        }
      };

      const handleDeleteStory = async (id, title) => {
        if (!confirm("Haqiqatan ham «" + (title || "ushbu") + "» storiyani o'chirmoqchimisiz?")) return;
        try {
          const res = await fetch("/api/stories/" + id, { method: "DELETE" });
          if (res.ok) {
            setStories(prev => prev.filter(s => s.id !== id));
          } else {
            alert("O'chirishda xatolik yuz berdi");
          }
        } catch(err) {
          alert("Server bilan aloqada xatolik");
        }
      };

      // Settings Save
      const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSettingsSaving(true);
        try {
          // Keep card_number synced with uzcard_number for backward compatibility
          const payload = {
            ...settings,
            card_number: settings.uzcard_number || settings.card_number,
            card_holder: settings.uzcard_holder || settings.card_holder
          };
          const res = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const saved = await res.json();
          if (saved) {
            setSettings(prev => ({ ...prev, ...saved }));
            setSettingsMessage("Sozlamalar (Uzcard, Humo, Visa va do'kon ma'lumotlari) muvaffaqiyatli saqlandi!");
            setTimeout(() => setSettingsMessage(""), 3500);
          }
        } catch(e) {
          alert("Saqlashda xatolik yuz berdi");
        } finally {
          setSettingsSaving(false);
        }
      };

      // Broadcast Send
      const handleSendBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastText.trim()) return;
        if (!confirm("Barcha " + users.length + " ta ro'yxatdan o'tgan foydalanuvchiga xabar yuborilsinmi?")) return;
        setBroadcastSending(true);
        setBroadcastStatus("Xabarlar yuborilmoqda...");
        try {
          const res = await fetch("/api/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: broadcastText, image_url: broadcastImage })
          });
          const data = await res.json();
          if (data && data.success) {
            setBroadcastStatus("Xabar muvaffaqiyatli yuborildi! Yetkazildi: " + (data.delivered || users.length) + " ta");
            setBroadcastText("");
            setBroadcastImage("");
          } else {
            setBroadcastStatus("Yuborishda xatolik: " + (data.error || "Noma'lum xato"));
          }
        } catch(e) {
          setBroadcastStatus("Aloqa xatosi yuz berdi");
        } finally {
          setBroadcastSending(false);
        }
      };

      // Metrics & Analytics
      const totalRevenue = useMemo(() => {
        return orders.filter(o => o.status === 'Yetkazildi' || o.status === 'Tasdiqlandi')
          .reduce((acc, o) => acc + (parseInt(o.total_price) || 0), 0);
      }, [orders]);

      const activeOrdersCount = useMemo(() => {
        return orders.filter(o => o.status !== 'Yetkazildi' && o.status !== 'Bekor qilindi').length;
      }, [orders]);

      const outOfStockCount = useMemo(() => {
        return products.filter(p => (p.stock || 0) <= 2).length;
      }, [products]);

      // Filtered Orders
      const filteredOrders = useMemo(() => {
        return orders.filter(o => {
          if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
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
            <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-400/40">
              <Icon name="check" className="w-4 h-4" />
              <span>Barcha ma'lumotlar yangilandi!</span>
            </div>
          )}

          {/* BACKDROP FOR MOBILE SIDEBAR */}
          {sidebarOpen && (
            <div 
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden"
            />
          )}

          {/* SIDEBAR NAVIGATION (FIXED SLIDE-OVER DRAWER ON MOBILE, STATIC ON DESKTOP) */}
          <aside className={'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:static md:w-64 md:z-auto border-r shrink-0 flex flex-col justify-between transition-transform duration-300 ease-in-out ' + 
            (isDark ? 'bg-[#0C1220] border-[#1F2B45]' : 'bg-white border-slate-200') + 
            (sidebarOpen ? ' translate-x-0 shadow-2xl' : ' -translate-x-full md:translate-x-0')}>
            
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
                <button 
                  onClick={() => setSidebarOpen(false)} 
                  className="md:hidden p-1.5 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white"
                >
                  <Icon name="close" className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <nav className="p-3 space-y-1 text-xs font-bold">
                {[
                  { id: 'dashboard', label: 'Boshqaruv Paneli', icon: 'chart' },
                  { id: 'orders', label: 'Buyurtmalar', icon: 'truck', badge: activeOrdersCount },
                  { id: 'products', label: 'Ehtiyot Qismlar', icon: 'package', badge: products.length },
                  { id: 'categories', label: "Bo'limlar & Modellar", icon: 'folder' },
                  { id: 'stories', label: 'Istoriyalar (Stories)', icon: 'stories', badge: stories.length },
                  { id: 'part_requests', label: "So'ralgan Qismlar", icon: 'search', badge: partRequests.filter(r => r.status === 'yangi').length },
                  { id: 'returns', label: 'Qaytarish / Almashtirish', icon: 'refresh', badge: returnRequests.filter(r => r.status === 'yangi').length },
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
                  onClick={() => setSidebarOpen(prev => !prev)}
                  className={'md:hidden w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                    (isDark ? 'border-[#1F2B45] text-slate-200 bg-[#101726]' : 'border-slate-200 text-slate-700 bg-slate-100')}
                  aria-label="Menyu"
                >
                  <Icon name="menu" className="w-4 h-4" />
                </button>
                <div className="text-sm font-black capitalize">
                  {tab === 'dashboard' ? "Boshqaruv Paneli & Analitika" : 
                   tab === 'orders' ? "Buyurtmalar Jurnali" : 
                   tab === 'products' ? "Ombor & Ehtiyot Qismlar" : 
                   tab === 'categories' ? "Bo'limlar & Modellar" :
                   tab === 'stories' ? "Istoriyalar (Stories)" :
                   tab === 'crm' ? "Mijozlar Bazasi" :
                   tab === 'broadcast' ? "Ommaviy Xabar" :
                   tab === 'settings' ? "Sozlamalar (To'lov & Do'kon)" : tab}
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
                    (isDark ? 'border-[#1F2B45] text-slate-300 hover:bg-[#162033]' : 'border-slate-200 text-slate-600 hover:bg-slate-100')}
                >
                  <Icon name="refresh" className={'w-4 h-4 ' + (isRefreshing ? 'animate-spin' : '')} />
                </button>

                {/* Theme Toggle */}
                <button 
                  onClick={toggleTheme}
                  title="Mavzu"
                  className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                    (isDark ? 'border-[#1F2B45] text-amber-400 bg-amber-500/10' : 'border-slate-200 text-slate-700 bg-slate-100')}
                >
                  <Icon name={isDark ? "sun" : "moon"} className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* TAB CONTENTS */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
              {/* ========================================= */}
              {/* TAB 1: DASHBOARD & METRICS */}
              {/* ========================================= */}
              {tab === 'dashboard' && (
                <div className="space-y-6">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                      <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                        <span>Jami Tushum</span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <Icon name="dollar" className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-emerald-400">
                        {totalRevenue.toLocaleString()} <span className="text-xs font-bold text-slate-400">UZS</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Muvaffaqiyatli buyurtmalar bo'yicha</div>
                    </div>

                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                      <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                        <span>Faol Buyurtmalar</span>
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                          <Icon name="truck" className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-rose-400">
                        {activeOrdersCount} <span className="text-xs font-bold text-slate-400">ta</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Yetkazilishi kerak bo'lganlar</div>
                    </div>

                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                      <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                        <span>Ehtiyot Qismlar</span>
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                          <Icon name="package" className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-blue-400">
                        {products.length} <span className="text-xs font-bold text-slate-400">turda</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Barcha mavjud modellar bo'yicha</div>
                    </div>

                    <div className={'p-4 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                      <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                        <span>Kam Qolganlar</span>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                          <Icon name="alert" className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-amber-400">
                        {outOfStockCount} <span className="text-xs font-bold text-slate-400">detal</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Omborda soni 2 yoki undan kam</div>
                    </div>
                  </div>

                  {/* Recent Orders Overview */}
                  <div className={'p-5 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-black tracking-tight">So'nggi Buyurtmalar</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Real vaqt rejimida qabul qilingan yangi buyurtmalar</p>
                      </div>
                      <button 
                        onClick={() => setTab('orders')} 
                        className="text-xs font-bold text-rose-500 hover:text-rose-400 transition"
                      >
                        Barchasini ko'rish →
                      </button>
                    </div>

                    <div className="divide-y divide-slate-800/40 text-xs">
                      {orders.slice(0, 5).map(o => (
                        <div key={o.id} className="py-3 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="font-bold flex items-center gap-2">
                              <span>#{o.id}</span>
                              <span className="text-slate-300">{o.customer_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>{o.phone}</span>
                              <span>•</span>
                              <span>{o.created_at ? new Date(o.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="font-mono font-bold text-rose-400">
                              {parseInt(o.total_price || 0).toLocaleString()} UZS
                            </div>
                            <span className={'inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ' + 
                              (o.status === 'Yetkazildi' ? 'bg-emerald-500/15 text-emerald-400' : 
                               o.status === 'Bekor qilindi' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                              {o.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {orders.length === 0 && (
                        <div className="py-8 text-center text-slate-500 text-xs">Hozircha buyurtmalar yo'q</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 2: ORDERS MANAGEMENT */}
              {/* ========================================= */}
              {tab === 'orders' && (
                <div className="space-y-4">
                  {/* Filters Bar */}
                  <div className={'p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    
                    {/* Search */}
                    <div className="relative w-full md:w-72">
                      <Icon name="search" className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text"
                        value={orderSearch}
                        onChange={e => setOrderSearch(e.target.value)}
                        placeholder="Mijoz ismi yoki telefoni..."
                        className={'w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar text-xs font-bold">
                      {['all', 'Yangi', 'Tasdiqlandi', 'Tayyorlanmoqda', 'Yetkazilmoqda', 'Yetkazildi', 'Bekor qilindi'].map(st => (
                        <button
                          key={st}
                          onClick={() => setOrderStatusFilter(st)}
                          className={'px-3 py-1.5 rounded-xl transition whitespace-nowrap ' + 
                            (orderStatusFilter === st 
                              ? 'bg-rose-600 text-white' 
                              : (isDark ? 'text-slate-400 hover:bg-[#162033]' : 'text-slate-600 hover:bg-slate-100'))}
                        >
                          {st === 'all' ? "Barchasi" : st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orders Data Table */}
                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={'border-b font-bold uppercase tracking-wider text-[10px] ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
                          <tr>
                            <th className="p-3.5">ID</th>
                            <th className="p-3.5">Mijoz & Aloqa</th>
                            <th className="p-3.5">Yetkazish Turi</th>
                            <th className="p-3.5">Summa</th>
                            <th className="p-3.5">Holat</th>
                            <th className="p-3.5 text-right">Amallar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {filteredOrders.map(o => (
                            <tr key={o.id} className="hover:bg-slate-800/20 transition">
                              <td className="p-3.5 font-bold font-mono">#{o.id}</td>
                              <td className="p-3.5">
                                <div className="font-bold text-slate-200">{o.customer_name}</div>
                                <div className="text-[11px] text-slate-400">{o.phone}</div>
                              </td>
                              <td className="p-3.5">
                                <span className={'inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg ' + 
                                  (o.delivery_type === 'pickup' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400')}>
                                  {o.delivery_type === 'pickup' ? "Farhod bozoridan olib ketish" : "Kuryer orqali yetkazish"}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-rose-400">
                                {parseInt(o.total_price || 0).toLocaleString()} UZS
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={o.status}
                                  onChange={e => handleUpdateOrderStatus(o.id, e.target.value)}
                                  className={'px-2.5 py-1 rounded-lg text-xs font-bold border focus:outline-none ' + 
                                    (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800')}
                                >
                                  {['Yangi', 'Tasdiqlandi', 'Tayyorlanmoqda', 'Yetkazilmoqda', 'Yetkazildi', 'Bekor qilindi'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3.5 text-right">
                                <button 
                                  onClick={() => setSelectedOrder(o)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600/15 text-rose-400 hover:bg-rose-600/25 font-bold text-xs"
                                >
                                  Ko'rish
                                </button>
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
              {/* TAB 3: PRODUCTS & INVENTORY */}
              {/* ========================================= */}
              {tab === 'products' && (
                <div className="space-y-4">
                  {/* Product Filters */}
                  <div className={'p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between ' + 
                    (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    
                    <div className="relative w-full md:w-72">
                      <Icon name="search" className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="Ehtiyot qism nomi yoki modeli..."
                        className={'w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar text-xs">
                      <select 
                        value={productCategoryFilter}
                        onChange={e => setProductCategoryFilter(e.target.value)}
                        className={'px-3 py-2 rounded-xl border font-bold text-xs focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      >
                        <option value="Barchasi">Barcha Avto Modellar</option>
                        {categories.map(c => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200 shadow-sm')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={'border-b font-bold uppercase tracking-wider text-[10px] ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
                          <tr>
                            <th className="p-3.5">Mahsulot</th>
                            <th className="p-3.5">Model & Kategoriya</th>
                            <th className="p-3.5">Narx</th>
                            <th className="p-3.5">Ombor Qoldig'i (Dinamik)</th>
                            <th className="p-3.5 text-right">Tahrirlash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {filteredProducts.map(p => (
                            <tr key={p.id} className="hover:bg-slate-800/20 transition">
                              <td className="p-3.5">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={p.image_url || "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=150&q=80"} 
                                    alt={p.name} 
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-700/50 shrink-0" 
                                  />
                                  <div>
                                    <div className="font-bold text-slate-200 line-clamp-1">{p.name}</div>
                                    <div className="text-[10px] text-slate-400">{p.condition === 'new' ? "Yangi (Zavod)" : "Ideal B/U"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold text-[11px]">
                                  {p.car_model || p.category}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-rose-400">
                                {parseInt(p.price || 0).toLocaleString()} UZS
                              </td>
                              <td className="p-3.5">
                                {/* Quick Stepper (- / +) for instant offline store stock changes */}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleQuickStock(p.id, -1)}
                                    className="w-6 h-6 rounded-lg border border-slate-700 hover:bg-slate-700/50 flex items-center justify-center font-bold text-slate-300 active:scale-95"
                                  >
                                    -
                                  </button>
                                  <span className={'font-mono font-bold px-2 py-0.5 rounded-lg text-xs ' + 
                                    (p.stock <= 2 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-200')}>
                                    {p.stock || 0} ta
                                  </span>
                                  <button
                                    onClick={() => handleQuickStock(p.id, 1)}
                                    className="w-6 h-6 rounded-lg border border-slate-700 hover:bg-slate-700/50 flex items-center justify-center font-bold text-slate-300 active:scale-95"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="p-3.5 text-right">
                                <button 
                                  onClick={() => setEditingProduct({ ...p })}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                  title="Tahrirlash"
                                >
                                  <Icon name="edit" className="w-4 h-4" />
                                </button>
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
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Mavjud Bo'limlar ({categories.length})
                      </h4>
                      {categories.length === 0 && (
                        <button
                          onClick={handleSeedCategories}
                          className="px-3 py-1 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Icon name="refresh" className="w-3.5 h-3.5" />
                          <span>Standart Modellarni Tiklash (12 ta)</span>
                        </button>
                      )}
                    </div>

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
                      {categories.length === 0 && (
                        <div className="py-6 text-center text-slate-500 space-y-2">
                          <div>Hozircha bo'limlar yo'q</div>
                          <button
                            onClick={handleSeedCategories}
                            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
                          >
                            Standart 12 ta Avto Modellarni Tiklash
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 5: STORIES MANAGEMENT (ISTORIYALAR) */}
              {/* ========================================= */}
              {tab === 'stories' && (
                <div className="space-y-6 max-w-4xl">
                  {/* Create New Story Form */}
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div>
                      <h3 className="text-sm font-black flex items-center gap-2">
                        <Icon name="stories" className="w-4 h-4 text-rose-500" />
                        <span>Yangi Istoriya (Story) Joylash</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Mijozlar Mini App bosh sahifasida ko'radigan qisqa fotoxabarlar va aksiyalar.
                      </p>
                    </div>

                    <form onSubmit={handleAddStory} className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 font-semibold text-slate-400">Sarlavha *</label>
                          <input 
                            type="text" 
                            required
                            value={storyTitle}
                            onChange={e => setStoryTitle(e.target.value)}
                            placeholder="Masalan: Cobalt yangi eshik va bamperlar"
                            className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                              (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                          />
                        </div>

                        <div>
                          <label className="block mb-1 font-semibold text-slate-400">Teg / Kategoriya</label>
                          <select 
                            value={storyTag}
                            onChange={e => setStoryTag(e.target.value)}
                            className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                              (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                          >
                            <option value="Yangi">Yangi</option>
                            <option value="Chegirma">Chegirma</option>
                            <option value="Original">Original</option>
                            <option value="Xizmat">Xizmat</option>
                            <option value="Aksiya">Aksiya</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Qisqacha Tavsif</label>
                        <input 
                          type="text" 
                          value={storyDescription}
                          onChange={e => setStoryDescription(e.target.value)}
                          placeholder="Masalan: Zavod GM detallari keldi, Farhod bozorida o'rnatib beramiz"
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Rasm Havolasi (URL) *</label>
                        <input 
                          type="url" 
                          required
                          value={storyImageUrl}
                          onChange={e => setStoryImageUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/photo-..."
                          className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono text-[11px] ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      {/* Quick Image Presets */}
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1.5">Tezkor tayyor rasmlar:</span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { name: "Avto qismlar", url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80" },
                            { name: "-30% Chegirma", url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80" },
                            { name: "Usta xizmati", url: "https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80" },
                            { name: "Kafolat", url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80" }
                          ].map(item => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => setStoryImageUrl(item.url)}
                              className="px-2.5 py-1 rounded-lg border border-slate-700/60 hover:border-rose-500/60 bg-slate-800/40 text-slate-300 text-[11px] transition active:scale-95"
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Preview If URL Entered */}
                      {storyImageUrl && (
                        <div className="p-3 rounded-xl border border-slate-800 bg-[#090D16] flex items-center gap-3">
                          <img 
                            src={storyImageUrl} 
                            alt="Preview" 
                            className="w-16 h-16 rounded-xl object-cover border border-slate-700" 
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                          <div>
                            <span className="px-2 py-0.5 rounded-md bg-rose-600/20 text-rose-400 font-bold text-[10px] uppercase">
                              {storyTag}
                            </span>
                            <div className="font-bold text-slate-200 mt-1">{storyTitle || "Sarlavha oldindan ko'rinishi"}</div>
                            <div className="text-[11px] text-slate-400">{storyDescription || "Tavsif oldindan ko'rinishi"}</div>
                          </div>
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={storySaving}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2"
                      >
                        <Icon name="plus" className="w-4 h-4" />
                        <span>{storySaving ? "Joylanmoqda..." : "Yangi Istoriya Joylash"}</span>
                      </button>
                    </form>
                  </div>

                  {/* Active Stories Grid */}
                  <div className={'p-5 rounded-2xl border ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                      Faol Istoriyalar ({stories.length})
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {stories.map(s => (
                        <div 
                          key={s.id} 
                          className="rounded-2xl border border-slate-800 bg-[#090D16] overflow-hidden flex flex-col justify-between group relative"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                            <img 
                              src={s.image_url} 
                              alt={s.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-rose-400 text-[10px] font-extrabold uppercase border border-rose-500/30">
                              {s.tag || "Yangi"}
                            </span>
                          </div>

                          <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                            <div>
                              <div className="font-bold text-slate-100 text-xs line-clamp-1">{s.title}</div>
                              {s.description && (
                                <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{s.description}</div>
                              )}
                            </div>

                            <button 
                              onClick={() => handleDeleteStory(s.id, s.title)}
                              className="w-full py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-bold transition flex items-center justify-center gap-1"
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" />
                              <span>O'chirish</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      {stories.length === 0 && (
                        <div className="col-span-full py-10 text-center text-slate-500 text-xs">
                          Hozircha faol istoriyalar yo'q. Yuqoridagi formadan yangi istoriya qo'shing.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 6: CRM (CUSTOMERS) */}
              {/* ========================================= */}
              {tab === 'crm' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-400">Telegram bot orqali ro'yxatdan o'tgan mijozlar soni: <b className="text-white">{users.length}</b></div>
                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={'border-b font-bold uppercase tracking-wider text-[10px] ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
                          <tr>
                            <th className="p-3.5">Telegram ID</th>
                            <th className="p-3.5">Ism-Sharif</th>
                            <th className="p-3.5">Telefon Raqami</th>
                            <th className="p-3.5">Ro'yxatdan O'tgan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {users.map(u => (
                            <tr key={u.id || u.telegram_id} className="hover:bg-slate-800/20 transition">
                              <td className="p-3.5 font-mono text-slate-400 font-bold">{u.telegram_id}</td>
                              <td className="p-3.5 font-bold text-slate-200">{u.first_name || u.username || "Mijoz"}</td>
                              <td className="p-3.5 font-mono font-bold text-slate-300">{u.phone || "—"}</td>
                              <td className="p-3.5 text-slate-400">
                                {u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : "—"}
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
              {/* TAB 7: BROADCAST */}
              {/* ========================================= */}
              {tab === 'broadcast' && (
                <div className="space-y-4 max-w-2xl">
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div>
                      <h3 className="text-sm font-black flex items-center gap-2">
                        <Icon name="broadcast" className="w-4 h-4 text-rose-500" />
                        <span>Ommaviy Xabar Tarqatish</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Barcha {users.length} ta ro'yxatdan o'tgan bot mijozlariga birdaniga e'lon yoki chegirma xabari yuborish.
                      </p>
                    </div>

                    <form onSubmit={handleSendBroadcast} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Auditoriya guruhi</label>
                      <select
                        value={broadcastAudience}
                        onChange={(e) => setBroadcastAudience(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border bg-[#090D16] border-[#1F2B45] text-xs text-white focus:outline-none focus:border-rose-500 mb-3"
                      >
                        <option value="all">Barchaga (Barcha foydalanuvchilar)</option>
                        <option value="vip">Faqat Oltin va Platina VIP mijozlarga</option>
                        <option value="mechanics">Faqat Usta / Ulgurji xaridorlarga</option>
                      </select>
                      <label className="block mb-1 font-semibold text-slate-400">Xabar matni *</label>
                        <textarea 
                          rows={4}
                          required
                          value={broadcastText}
                          onChange={e => setBroadcastText(e.target.value)}
                          placeholder="DIQQAT! Barcha Cobalt zapchastlariga 20% chegirma boshlandi!"
                          className={'w-full p-3 rounded-xl border focus:outline-none resize-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Rasm havolasi (ixtiyoriy)</label>
                        <input 
                          type="url"
                          value={broadcastImage}
                          onChange={e => setBroadcastImage(e.target.value)}
                          placeholder="https://..."
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      {broadcastStatus && (
                        <div className="p-3 rounded-xl bg-slate-800 text-xs font-bold text-rose-400">
                          {broadcastStatus}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={broadcastSending}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2"
                      >
                        <Icon name="broadcast" className="w-4 h-4" />
                        <span>{broadcastSending ? "Yuborilmoqda..." : "Barchaga Yuborish"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB 8: SETTINGS (UZCARD, HUMO, VISA & STORE) */}
              {/* ========================================= */}
              {/* ========================================= */}
              {/* TAB: PART REQUESTS ("Menga topib bering") */}
              {/* ========================================= */}
              {tab === 'part_requests' && (
                <div className="space-y-4">
                  <div className={'p-4 rounded-2xl border flex items-center justify-between ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div>
                      <h3 className="text-sm font-bold text-white">Mijozlar Tomonidan So'ralgan Qismlar</h3>
                      <p className="text-xs text-slate-400">Mini Appdagi "Menga topib bering" formasi orqali kelgan arizalar</p>
                    </div>
                    <span className="px-3 py-1 bg-rose-950/50 border border-rose-800/40 text-rose-400 text-xs font-bold rounded-xl">
                      {partRequests.length} ta ariza
                    </span>
                  </div>

                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-[#162033] text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#1F2B45]">
                          <tr>
                            <th className="p-3.5">Mijoz</th>
                            <th className="p-3.5">Telefon</th>
                            <th className="p-3.5">Avto Model</th>
                            <th className="p-3.5">Qism Nomi</th>
                            <th className="p-3.5">Izoh</th>
                            <th className="p-3.5">Sana</th>
                            <th className="p-3.5">Holat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1F2B45]/50">
                          {partRequests.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="p-6 text-center text-slate-500">Hozircha arizalar yo'q</td>
                            </tr>
                          ) : (
                            partRequests.map(req => (
                              <tr key={req.id} className="hover:bg-slate-800/30 transition">
                                <td className="p-3.5 font-bold text-white">{req.customer_name || "Mijoz"}</td>
                                <td className="p-3.5">
                                  <a href={"tel:" + req.phone} className="text-rose-400 hover:underline font-mono">
                                    {req.phone}
                                  </a>
                                </td>
                                <td className="p-3.5 font-semibold text-slate-200">{req.car_model}</td>
                                <td className="p-3.5 text-white font-bold">{req.part_name}</td>
                                <td className="p-3.5 text-slate-400 max-w-xs truncate">{req.note || "—"}</td>
                                <td className="p-3.5 text-slate-500 text-[11px]">{req.created_at ? new Date(req.created_at).toLocaleDateString() : ""}</td>
                                <td className="p-3.5">
                                  <select
                                    value={req.status || "yangi"}
                                    onChange={(e) => handleUpdatePartRequestStatus(req.id, e.target.value)}
                                    className="bg-[#090D16] border border-[#1F2B45] text-xs text-white rounded-lg px-2 py-1 focus:outline-none focus:border-rose-500"
                                  >
                                    <option value="yangi">Yangi</option>
                                    <option value="topildi">Topildi</option>
                                    <option value="yetkazildi">Yetkazildi</option>
                                    <option value="topilmadi">Topilmadi</option>
                                  </select>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* TAB: RETURNS & EXCHANGES */}
              {/* ========================================= */}
              {tab === 'returns' && (
                <div className="space-y-4">
                  <div className={'p-4 rounded-2xl border flex items-center justify-between ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div>
                      <h3 className="text-sm font-bold text-white">Qaytarish va Almashtirish Arizalari</h3>
                      <p className="text-xs text-slate-400">Yetkazilgan buyurtmalar bo'yicha mijozlar arizalari</p>
                    </div>
                    <span className="px-3 py-1 bg-rose-950/50 border border-rose-800/40 text-rose-400 text-xs font-bold rounded-xl">
                      {returnRequests.length} ta ariza
                    </span>
                  </div>

                  <div className={'rounded-2xl border overflow-hidden ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-[#162033] text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#1F2B45]">
                          <tr>
                            <th className="p-3.5">Buyurtma</th>
                            <th className="p-3.5">Mijoz</th>
                            <th className="p-3.5">Telefon</th>
                            <th className="p-3.5">Sabab</th>
                            <th className="p-3.5">Izoh</th>
                            <th className="p-3.5">Sana</th>
                            <th className="p-3.5">Holat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1F2B45]/50">
                          {returnRequests.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="p-6 text-center text-slate-500">Hozircha qaytarish arizalari yo'q</td>
                            </tr>
                          ) : (
                            returnRequests.map(ret => (
                              <tr key={ret.id} className="hover:bg-slate-800/30 transition">
                                <td className="p-3.5 font-bold text-rose-400">#{ret.order_id}</td>
                                <td className="p-3.5 font-bold text-white">{ret.customer_name || "Mijoz"}</td>
                                <td className="p-3.5">
                                  <a href={"tel:" + ret.phone} className="text-rose-400 hover:underline font-mono">
                                    {ret.phone}
                                  </a>
                                </td>
                                <td className="p-3.5 font-semibold text-slate-200">{ret.reason}</td>
                                <td className="p-3.5 text-slate-400 max-w-xs truncate">{ret.note || "—"}</td>
                                <td className="p-3.5 text-slate-500 text-[11px]">{ret.created_at ? new Date(ret.created_at).toLocaleDateString() : ""}</td>
                                <td className="p-3.5">
                                  <select
                                    value={ret.status || "yangi"}
                                    onChange={(e) => handleUpdateReturnStatus(ret.id, e.target.value)}
                                    className="bg-[#090D16] border border-[#1F2B45] text-xs text-white rounded-lg px-2 py-1 focus:outline-none focus:border-rose-500"
                                  >
                                    <option value="yangi">Yangi</option>
                                    <option value="qabul_qilindi">Qabul qilindi</option>
                                    <option value="rad_etildi">Rad etildi</option>
                                  </select>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'settings' && (
                <div className="space-y-6 max-w-3xl">
                  <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
                    {/* Payment Cards Settings */}
                    <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                      <h3 className="text-sm font-black flex items-center gap-2">
                        <Icon name="credit-card" className="w-4 h-4 text-rose-500" />
                        <span>To'lov Kartalari Sozlamalari (Uzcard, Humo, Visa)</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Mijozlar buyurtma berishda tanlashi va to'lov qilishi mumkin bo'lgan kartalar:
                      </p>

                      {/* Uzcard */}
                      <div className="p-3.5 rounded-xl border border-slate-800 bg-[#090D16] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>Uzcard Karta</span>
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.uzcard_active !== false}
                              onChange={e => setSettings({ ...settings, uzcard_active: e.target.checked })}
                              className="accent-rose-600 rounded"
                            />
                            <span className="text-[11px] text-slate-400">Faol</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block mb-1 text-[11px] text-slate-400 font-semibold">Uzcard Raqami</label>
                            <input 
                              type="text" 
                              value={settings.uzcard_number || settings.card_number || ""}
                              onChange={e => setSettings({ ...settings, uzcard_number: e.target.value, card_number: e.target.value })}
                              placeholder="8600 5304 1234 5678"
                              className={'w-full p-2 rounded-xl border focus:outline-none font-mono font-bold ' + 
                                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-[11px] text-slate-400 font-semibold">Karta Egasi</label>
                            <input 
                              type="text" 
                              value={settings.uzcard_holder || settings.card_holder || ""}
                              onChange={e => setSettings({ ...settings, uzcard_holder: e.target.value, card_holder: e.target.value })}
                              placeholder="AZIMXON (KUZAVNOY.UZZ)"
                              className={'w-full p-2 rounded-xl border focus:outline-none ' + 
                                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Humo */}
                      <div className="p-3.5 rounded-xl border border-slate-800 bg-[#090D16] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Humo Karta</span>
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.humo_active !== false}
                              onChange={e => setSettings({ ...settings, humo_active: e.target.checked })}
                              className="accent-rose-600 rounded"
                            />
                            <span className="text-[11px] text-slate-400">Faol</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block mb-1 text-[11px] text-slate-400 font-semibold">Humo Raqami</label>
                            <input 
                              type="text" 
                              value={settings.humo_number || ""}
                              onChange={e => setSettings({ ...settings, humo_number: e.target.value })}
                              placeholder="9860 1201 5678 4321"
                              className={'w-full p-2 rounded-xl border focus:outline-none font-mono font-bold ' + 
                                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-[11px] text-slate-400 font-semibold">Karta Egasi</label>
                            <input 
                              type="text" 
                              value={settings.humo_holder || settings.card_holder || ""}
                              onChange={e => setSettings({ ...settings, humo_holder: e.target.value })}
                              placeholder="AZIMXON (KUZAVNOY.UZZ)"
                              className={'w-full p-2 rounded-xl border focus:outline-none ' + 
                                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Visa (User Explicit Request) */}
                      <div className="p-3.5 rounded-xl border border-rose-900/40 bg-[#090D16] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>Visa Karta (Xalqaro)</span>
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.visa_active !== false}
                              onChange={e => setSettings({ ...settings, visa_active: e.target.checked })}
                              className="accent-rose-600 rounded"
                            />
                            <span className="text-[11px] text-slate-400">Faol</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block mb-1 text-[11px] text-slate-400 font-semibold">Visa Raqami</label>
                            <input 
                              type="text" 
                              value={settings.visa_number || ""}
                              onChange={e => setSettings({ ...settings, visa_number: e.target.value })}
                              placeholder="4000 1234 5678 9010"
                              className={'w-full p-2 rounded-xl border focus:outline-none font-mono font-bold ' + 
                                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-[11px] text-slate-400 font-semibold">Visa Egasi</label>
                            <input 
                              type="text" 
                              value={settings.visa_holder || settings.card_holder || ""}
                              onChange={e => setSettings({ ...settings, visa_holder: e.target.value })}
                              placeholder="AZIMXON (KUZAVNOY.UZZ)"
                              className={'w-full p-2 rounded-xl border focus:outline-none ' + 
                                (isDark ? 'bg-[#101726] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Store Contact & Address Settings */}
                    <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                      <h3 className="text-sm font-black flex items-center gap-2">
                        <Icon name="phone" className="w-4 h-4 text-rose-500" />
                        <span>Do'kon Aloqa & Manzillari</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 font-semibold text-slate-400">Aloqa Telefoni (1)</label>
                          <input 
                            type="text" 
                            value={settings.phone || ""}
                            onChange={e => setSettings({ ...settings, phone: e.target.value })}
                            className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono ' + 
                              (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-semibold text-slate-400">Aloqa Telefoni (2)</label>
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
                        <label className="block mb-1 font-semibold text-slate-400">Do'kon Manzili (Farhod Bozori)</label>
                        <input 
                          type="text" 
                          value={settings.store_address || ""}
                          onChange={e => setSettings({ ...settings, store_address: e.target.value })}
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className="block mb-1 font-semibold text-slate-400">Ish Vaqti</label>
                        <input 
                          type="text" 
                          value={settings.store_hours || "09:00 - 19:00"}
                          onChange={e => setSettings({ ...settings, store_hours: e.target.value })}
                          className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                            (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                        />
                      </div>

                      {settingsMessage && (
                        <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                          <Icon name="check" className="w-4 h-4" />
                          <span>{settingsMessage}</span>
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={settingsSaving}
                        className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2"
                      >
                        <Icon name="check" className="w-4 h-4" />
                        <span>{settingsSaving ? "Saqlanmoqda..." : "Sozlamalarni Saqlash"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </main>
          </div>

          {/* EDIT PRODUCT MODAL */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={'w-full max-w-lg rounded-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                
                <div className="flex items-center justify-between border-b border-[#1F2B45] pb-3">
                  <h3 className="font-black text-sm">Mahsulotni Tahrirlash</h3>
                  <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white">
                    <Icon name="close" className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
                  <div>
                    <label className="block mb-1 text-slate-400 font-semibold">Nomi</label>
                    <input 
                      type="text" 
                      value={editingProduct.name}
                      onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                        (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-slate-400 font-semibold">Narxi (UZS)</label>
                      <input 
                        type="number" 
                        value={editingProduct.price}
                        onChange={e => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                        className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-400 font-semibold">Ombordagi Soni (Stock)</label>
                      <input 
                        type="number" 
                        value={editingProduct.stock}
                        onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                        className={'w-full p-2.5 rounded-xl border focus:outline-none font-mono font-bold ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-slate-400 font-semibold">Avto Model</label>
                      <input 
                        type="text" 
                        value={editingProduct.car_model || ""}
                        onChange={e => setEditingProduct({ ...editingProduct, car_model: e.target.value })}
                        className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-400 font-semibold">Holati</label>
                      <select
                        value={editingProduct.condition || 'new'}
                        onChange={e => setEditingProduct({ ...editingProduct, condition: e.target.value })}
                        className={'w-full p-2.5 rounded-xl border focus:outline-none ' + 
                          (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      >
                        <option value="new">Yangi (Original)</option>
                        <option value="used">Ideal B/U</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400 font-semibold">Rasm Havolasi (URL)</label>
                    <input 
                      type="text" 
                      value={editingProduct.image_url || ""}
                      onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                      className={'w-full p-2.5 rounded-xl border focus:outline-none text-[11px] font-mono ' + 
                        (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-bold"
                    >
                      Bekor qilish
                    </button>
                    <button 
                      type="submit" 
                      disabled={productSaving}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition"
                    >
                      {productSaving ? "Saqlanmoqda..." : "Saqlash"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW ORDER DETAILS MODAL */}
          {selectedOrder && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={'w-full max-w-lg rounded-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ' + 
                (isDark ? 'bg-[#101726] border-[#1F2B45]' : 'bg-white border-slate-200')}>
                
                <div className="flex items-center justify-between border-b border-[#1F2B45] pb-3">
                  <div>
                    <h3 className="font-black text-sm">Buyurtma #{selectedOrder.id} Tafsilotlari</h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('uz-UZ') : ''}
                    </div>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white">
                    <Icon name="close" className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#090D16] border border-[#1F2B45] space-y-1">
                    <div className="text-slate-400">Mijoz ma'lumotlari:</div>
                    <div className="font-bold text-slate-200 text-sm">{selectedOrder.customer_name}</div>
                    <div className="font-mono text-rose-400 font-bold flex items-center justify-between">
                      <span>{selectedOrder.phone}</span>
                      <a href={'tel:' + selectedOrder.phone} className="px-2 py-0.5 rounded-md bg-rose-600/20 text-rose-400 text-[10px]">
                        Qo'ng'iroq
                      </a>
                    </div>
                    {selectedOrder.address && (
                      <div className="text-slate-400 pt-1">
                        Manzil: <span className="text-slate-200">{selectedOrder.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-slate-400 font-semibold">Buyurtma tovarlari:</div>
                    <div className="divide-y divide-slate-800/60 p-2.5 rounded-xl bg-[#090D16] border border-[#1F2B45]">
                      {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map((item, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-200">{item.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {parseInt(item.price || 0).toLocaleString()} UZS × {item.quantity || 1}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-slate-200">
                            {(parseInt(item.price || 0) * (item.quantity || 1)).toLocaleString()} UZS
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#090D16] border border-[#1F2B45] font-bold">
                    <span>Jami to'lov:</span>
                    <span className="text-base text-rose-400 font-mono">
                      {parseInt(selectedOrder.total_price || 0).toLocaleString()} UZS
                    </span>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400 font-semibold">Buyurtma holatini yangilash</label>
                    <select
                      value={selectedOrder.status}
                      onChange={e => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                      className={'w-full p-2.5 rounded-xl border font-bold text-xs focus:outline-none ' + 
                        (isDark ? 'bg-[#090D16] border-[#1F2B45] text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    >
                      {['Yangi', 'Tasdiqlandi', 'Tayyorlanmoqda', 'Yetkazilmoqda', 'Yetkazildi', 'Bekor qilindi'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<AdminDashboard />);
  
  </script>
</body>
</html>`;
}
