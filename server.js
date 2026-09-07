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
        { tag: "Yangi", title: "🔥 Yangi partiya", description: "Original M-Sport anatomik rullari qayta keldi!", image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80" },
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
      "🔥 Yangi kelgan original zapchastlar va tyuning detallari\n" +
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

    const dType = delivery_type === 'pickup' ? 'pickup' : 'delivery';
    const pMethod = payment_method === 'card' ? 'card' : 'cash';

    const result = await pool.query(
      `INSERT INTO orders (
        telegram_id, customer_name, phone, items, total_price, location, 
        delivery_type, payment_method, needs_installation, installation_service, 
        courier_name, courier_phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Sardor (Kuzavnoy Express)', '+998 90 123 45 67') 
      RETURNING *`,
      [
        telegram_id || 0, customer_name, phone, JSON.stringify(items), total_price, location, 
        dType, pMethod, Boolean(needs_installation), installation_service || null
      ]
    );
    const order = result.rows[0];

    // Ombordan tovarlar qoldig'ini (stock) avtomatik kamaytirish
    try {
      for (const it of items) {
        if (it && it.id && it.id !== 9999) {
          const q = parseInt(it.quantity) || 1;
          await pool.query('UPDATE products SET stock = GREATEST(0, COALESCE(stock, 10) - $1) WHERE id = $2', [q, it.id]);
        }
      }
    } catch(stockErr) {
      console.error('Stock kamaytirishda xato:', stockErr.message);
    }

    const dTypeText = dType === 'pickup' ? "🏬 O'zi olib ketish (Do'kondan / Samovivoz)" : "🚚 Kuryer orqali yetkazib berish";
    const pMethodText = pMethod === 'card' ? "💳 Karta orqali oldindan to'lov (Uzcard / Humo / Visa)" : "💵 Qabul qilinganda to'lash (Naqd / Kuryerga)";

    // Telegram Bot orqali mijozga tasdiqlash xabari yuborish
    if (bot && telegram_id && telegram_id !== 0) {
      try {
        let cleanLocDisplay = location ? escapeHtml(location.split(' | 🗺 Xarita: ')[0]) : "Ko'rsatilmagan";
        let itemsList = items.map((it, idx) => `• ${escapeHtml(it.name)} (${it.quantity || 1} dona) — ${((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm`).join('\n');
        
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
          `💰 <b>Jami summa:</b> ${total_price.toLocaleString()} so'm\n\n` +
          `<i>kuzavnoy.uzz ni tanlaganingiz uchun rahmat!</i>`;

        bot.sendMessage(telegram_id, messageText, { parse_mode: 'HTML' });
      } catch (botErr) {
        console.error('Telegram bot xabar yuborishda xatolik:', botErr.message);
      }
    }

    // Telegram Bot orqali ADMINGA yangi buyurtma haqida go'zal dizayndagi tezkor xabar (Task 9)
    if (bot && ADMIN_CHAT_IDS && ADMIN_CHAT_IDS.length > 0) {
      try {
        let cleanLocForAdmin = location ? escapeHtml(location.split(' | 🗺 Xarita: ')[0]) : "Ko'rsatilmagan";
        let adminItemsList = items.map((it, idx) => 
          `   ${idx + 1}. <b>${escapeHtml(it.name)}</b>\n` +
          `      └ <i>${it.quantity || 1} dona × ${it.new_price.toLocaleString()} so'm = <b>${((it.quantity || 1) * it.new_price).toLocaleString()} so'm</b></i>`
        ).join('\n');
        
        const adminText = 
          `🚗 <b>kuzavnoy.uzz — YANGI BUYURTMA!</b> 🚗\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Buyurtma raqami:</b> <code>#${order.id}</code>\n` +
          `⏰ <b>Vaqti:</b> <i>${new Date().toLocaleString('uz-UZ')}</i>\n\n` +
          `👤 <b>MIJOZ MA'LUMOTLARI:</b>\n` +
          `• <b>Ismi:</b> <b>${escapeHtml(customer_name)}</b>\n` +
          `• <b>Telefon:</b> <code>${escapeHtml(phone)}</code>\n` +
          `• <b>Telegram ID:</b> <code>${telegram_id || 'Mavjud emas'}</code>\n\n` +
          `🚚 <b>YETKAZIB BERISH:</b>\n` +
          `• <b>Turi:</b> ${dTypeText}\n` +
          `• <b>Manzil:</b> <i>${cleanLocForAdmin}</i>\n\n` +
          `💳 <b>TO'LOV HOLATI:</b>\n` +
          `• <b>Usuli:</b> ${pMethodText}\n` +
          `• <b>JAMI TUSHUM:</b> 💰 <b>${total_price.toLocaleString()} SO'M</b>\n\n` +
          `📦 <b>BUYURTMA TARKIBI (${items.length} xil detal):</b>\n` +
          `${adminItemsList}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👇 <i>Buyurtmani boshqarish uchun pastdagi tugmani bosing:</i>`;

        const mapMatch = location && location.match(/https?:\/\/[^\s]+/);
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
            reply_markup: {
              inline_keyboard: inlineButtons
            }
          }).catch(e => console.error('Admin notify err:', e.message));
        }
      } catch (adminErr) {
        console.error('Admin xabari yuborishda xatolik:', adminErr.message);
      }
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. MINI APP FRONTEND (REACT 18 + TAILWIND CSS - TOZA VA MINIMALIST OQ DIZAYN)
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
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>kuzavnoy.uzz | Avto Ehtiyot Qismlar</title>
  <!-- Telegram WebApp SDK -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React & Babel -->
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
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
  <script>
    window.onerror = function(msg, url, line) {
      var el = document.getElementById('debug-err');
      if (el) el.innerHTML = '<b>Xatolik:</b> ' + msg + ' (' + line + ')';
    };
  </script>
</head>
<body class="select-none transition-colors duration-200">
  <div id="root">
    <div class="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div class="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin-custom mb-3"></div>
      <p class="text-xs font-bold text-slate-700">kuzavnoy.uzz yuklanmoqda...</p>
      <span class="text-[10px] text-slate-400 mt-1">Avto ehtiyot qismlar do'koni</span>
      <div id="debug-err" class="mt-4 text-xs text-red-600 max-w-xs font-mono"></div>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect, useMemo } = React;

    const I18N = {
      uz: {
        appName: "kuzavnoy.uzz",
        subtitle: "Avto Ehtiyot Qismlar",
        greeting: "Salom",
        driver: "Haydovchi",
        official: "Rasmiy Do'kon",
        heroBadge: "Rasmiy Mahsulotlar",
        heroTitle: "Avtomobilingizni yangilang va zavqlaning!",
        heroDesc: "Original rul, bar, oyna va balonlar kafolat bilan taqdim etiladi.",
        heroBtn: "Yangi buyurtma berish →",
        popularTitle: "Eng ko'p xarid qilinganlar",
        viewAll: "Barchasi",
        add: "Qo'shish",
        catalogTitle: "Mahsulotlar Katalogi",
        catalogDesc: "Kerakli bo'limni tanlang va qulay xarid qiling",
        all: "Barchasi",
        universal: "Universal / Boshqa",
        cartTitle: "Savatcha",
        cartDesc: "Tanlangan ehtiyot qismlar va buyurtmani rasmiylashtirish",
        cartEmpty: "Savatchangiz bo'sh!",
        cartEmptyDesc: "Katalogdan o'zingizga yoqqan ehtiyot qismlarni tanlang",
        aromaPromo: "Kola / BubbleGum Premium Aromatizator qo'shish (+35,000 so'm)",
        checkoutInfo: "Yetkazib berish ma'lumotlari",
        nameLabel: "Ismingiz",
        phoneLabel: "Telefon raqamingiz",
        addressLabel: "Yetkazib berish manzili",
        addressPlaceholder: "Toshkent shahri, Yunusobod 4-mavze...",
        deliveryTypeLabel: "Yetkazib berish usuli",
        deliveryCourier: "🚚 Kuryer orqali",
        deliveryPickup: "🏬 O'zi olib ketish",
        pickupStoreAddress: "Toshkent sh., Farhod avto bozori (Samovivoz)",
        pickupStoreBadge: "Samovivoz manzili: Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori. Ish vaqti: 09:00 - 19:00",
        paymentMethodLabel: "To'lov usuli",
        payCard: "💳 Karta / Visa / Click",
        payCash: "💵 Qabul qilganda naqd",
        cardDetailsTitle: "Oldindan to'lov uchun karta:",
        cardNumber: "8600 5304 1234 5678",
        cardHolder: "AZIMXON (KUZAVNOY.UZZ)",
        cardCopyBtn: "Nusxa olish",
        cardCopiedText: "Nusxalandi! ✅",
        cardPaymentHint: "To'lovni Click / Payme / Visa orqali ushbu kartaga o'tkazishingiz mumkin",
        cashPaymentHint: "Kuryer mahsulotni yetkazganda yoki do'konda qabul qilayotganingizda to'laysiz",
        reviewsTitle: "Mijozlar Fikrlari & Sharhlar",
        writeReview: "Sharh qoldirish",
        sendReview: "Sharhni yuborish ⭐️",
        reviewPlaceholder: "Ehtiyot qism sifati va xizmat haqida fikringiz...",
        noReviews: "Hozircha sharhlar yo'q. Birinchi bo'lib fikr bildiring!",
        reviewSent: "Sharhingiz muvaffaqiyatli qabul qilindi! Rahmat! 🎉",
        socialChannels: "Rasmiy Ijtimoiy Tarmoqlarimiz",
        cancelOrderBtn: "Buyurtmani bekor qilish ❌",
        cancelOrderConfirm: "Haqiqatdan ham ushbu buyurtmani bekor qilmoqchimisiz?",
        orderCancelledMsg: "Buyurtmangiz muvaffaqiyatli bekor qilindi! 🔴",
        callStore: "Do'konga qo'ng'iroq",
        storePhoneTitle: "Bog'lanish uchun telefon",
        totalPayment: "JAMI TO'LOV:",
        confirmOrder: "Buyurtmani Tasdiqlash 🚀",
        submitting: "Buyurtma yuborilmoqda...",
        orderSuccessTitle: "Buyurtmangiz qabul qilindi! 🎉",
        orderSuccessDesc: "Kuryerimiz tez orada siz bilan bog'lanadi 🚗💨",
        continueShopping: "Xaridni davom ettirish",
        profileTitle: "Mijoz Profili",
        profileDesc: "Shaxsiy ma'lumotlar va buyurtmalar tarixi",
        ordersHistory: "Mening Buyurtmalarim",
        noOrders: "Hali buyurtmalar berilmagan",
        orderNum: "Buyurtma",
        repeatOrder: "Qayta buyurtma",
        specsTitle: "Asosiy Xususiyatlari & Sifat:",
        viewInCatalog: "Katalogda ko'rish",
        close: "Yopish",
        skip: "O'tkazib yuborish",
        next: "Davom etish →",
        start: "Boshlash 🚀",
        navHome: "Asosiy",
        navCatalog: "Katalog",
        navCart: "Savatcha",
        navProfile: "Profil",
        som: "so'm",
        themeLight: "Kun",
        themeDark: "Tun",
        onboard1Title: "Mashinangizga sifatli zapchast qidiryapsizmi?",
        onboard1Desc: "kuzavnoy.uzz — labavoy, bakavoy, rul, bar va original ehtiyot qismlarni tezkor yetkazib beradi!",
        onboard2Title: "Bu qanday ishlaydi?",
        onboard2Desc: "Katalogdan detalni tanlang, savatchaga soling va birgina tugma orqali buyurtma bering. Kuryerimiz bevosita yetkazadi.",
        onboard3Title: "10,000+ Haydovchilar biz bilan!",
        onboard3Desc: "Toshkent va O'zbekiston bo'ylab 100% ishonchli va kafolatlangan zapchastlar bitta ilovada jamlangan.",
        condition: "Mahsulot Holati",
        conditionNew: "✨ Yangi (Original)",
        conditionUsed: "🔄 B/U (Ideal holatda)",
        warrantyTitle: "Sifat Kafolati",
        warrantyText: "100% tekshirilgan",
        adminPanel: "Admin Panel",
        adminPanelDesc: "Do'kon egasi uchun boshqaruv",
        openAdmin: "Kirish"
      },
      ru: {
        appName: "kuzavnoy.uzz",
        subtitle: "Автозапчасти",
        greeting: "Привет",
        driver: "Водитель",
        official: "Официальный магазин",
        heroBadge: "Официальные Товары",
        heroTitle: "Обновите свой автомобиль с удовольствием!",
        heroDesc: "Оригинальные рули, бары, стекла и шины с гарантией.",
        heroBtn: "Оформить заказ →",
        popularTitle: "Популярные детали",
        viewAll: "Все",
        add: "В корзину",
        catalogTitle: "Каталог Запчастей",
        catalogDesc: "Выберите нужный раздел и закажите удобно",
        all: "Все",
        universal: "Универсал / Другое",
        cartTitle: "Корзина",
        cartDesc: "Выбранные запчасти и оформление заказа",
        cartEmpty: "Ваша корзина пуста!",
        cartEmptyDesc: "Выберите понравившиеся товары из каталога",
        aromaPromo: "Добавить премиум ароматизатор Cola / BubbleGum (+35 000 сум)",
        checkoutInfo: "Данные для доставки",
        nameLabel: "Ваше имя",
        phoneLabel: "Номер телефона",
        addressLabel: "Адрес доставки",
        addressPlaceholder: "г. Ташкент, Юнусабад 4-квартал...",
        deliveryTypeLabel: "Способ доставки",
        deliveryCourier: "🚚 Доставка курьером",
        deliveryPickup: "🏬 Самовывоз",
        pickupStoreAddress: "г. Ташкент, авторынок Сергели (Самовывоз)",
        pickupStoreBadge: "Адрес самовывоза: г. Ташкент, авторынок Сергели, 4-й ряд, магазин 12. Время: 09:00 - 19:00",
        paymentMethodLabel: "Способ оплаты",
        payCard: "💳 Карта / Visa / Click",
        payCash: "💵 Наличными курьеру",
        cardDetailsTitle: "Карта для предоплаты:",
        cardNumber: "8600 5304 1234 5678",
        cardHolder: "AZIMXON (KUZAVNOY.UZZ)",
        cardCopyBtn: "Скопировать",
        cardCopiedText: "Скопировано! ✅",
        cardPaymentHint: "Вы можете перевести через Click / Payme / Visa на эту карту",
        cashPaymentHint: "Оплата при получении товара у курьера или в магазине",
        reviewsTitle: "Отзывы Клиентов",
        writeReview: "Оставить отзыв",
        sendReview: "Отправить отзыв ⭐️",
        reviewPlaceholder: "Ваш отзыв о качестве запчасти...",
        noReviews: "Отзывов пока нет. Будьте первым!",
        reviewSent: "Ваш отзыв успешно принят! Спасибо! 🎉",
        socialChannels: "Наши Официальные Соцсети",
        cancelOrderBtn: "Отменить заказ ❌",
        cancelOrderConfirm: "Вы действительно хотите отменить этот заказ?",
        orderCancelledMsg: "Ваш заказ успешно отменен! 🔴",
        callStore: "Позвонить в магазин",
        storePhoneTitle: "Телефон для связи",
        totalPayment: "ИТОГО К ОПЛАТЕ:",
        confirmOrder: "Подтвердить Заказ 🚀",
        submitting: "Отправка заказа...",
        orderSuccessTitle: "Ваш заказ успешно принят! 🎉",
        orderSuccessDesc: "Наш курьер свяжется с вами в ближайшее время 🚗💨",
        continueShopping: "Продолжить покупки",
        profileTitle: "Профиль Клиента",
        profileDesc: "Личные данные и история заказов",
        ordersHistory: "Мои Заказы",
        noOrders: "Заказов пока нет",
        orderNum: "Заказ",
        repeatOrder: "Повторить заказ",
        specsTitle: "Характеристики & Качество:",
        viewInCatalog: "Смотреть в каталоге",
        close: "Закрыть",
        skip: "Пропустить",
        next: "Продолжить →",
        start: "Начать 🚀",
        navHome: "Главная",
        navCatalog: "Каталог",
        navCart: "Корзина",
        navProfile: "Профиль",
        som: "сум",
        themeLight: "День",
        themeDark: "Ночь",
        onboard1Title: "Ищете качественные запчасти на авто?",
        onboard1Desc: "kuzavnoy.uzz — быстрая доставка лобовых стекол, рулей, консолей и оригинальных автозапчастей!",
        onboard2Title: "Как это работает?",
        onboard2Desc: "Выберите нужную деталь из каталога, добавьте в корзину и оформите в один клик. Наш курьер доставит заказ.",
        onboard3Title: "10,000+ Водителей с нами!",
        onboard3Desc: "100% надежные запчасти с гарантией по Ташкенту и всему Узбекистану в одном приложении.",
        condition: "Состояние детали",
        conditionNew: "✨ Новый (Оригинал)",
        conditionUsed: "🔄 Б/У (В идеале)",
        warrantyTitle: "Гарантия качества",
        warrantyText: "100% проверено",
        adminPanel: "Панель администратора",
        adminPanelDesc: "Управление для владельца",
        openAdmin: "Войти"
      },
      en: {
        appName: "kuzavnoy.uzz",
        subtitle: "Auto Spare Parts",
        greeting: "Hello",
        driver: "Driver",
        official: "Official Store",
        heroBadge: "Official Products",
        heroTitle: "Upgrade your car and enjoy every ride!",
        heroDesc: "Original steering wheels, consoles, glass and tires with warranty.",
        heroBtn: "Order now →",
        popularTitle: "Most popular parts",
        viewAll: "All",
        add: "Add to cart",
        catalogTitle: "Products Catalog",
        catalogDesc: "Select category and shop with ease",
        all: "All",
        universal: "Universal / Other",
        cartTitle: "Shopping Cart",
        cartDesc: "Selected auto parts and checkout",
        cartEmpty: "Your cart is empty!",
        cartEmptyDesc: "Choose items you like from the catalog",
        aromaPromo: "Add premium air freshener Cola / BubbleGum (+35,000 UZS)",
        checkoutInfo: "Delivery details",
        nameLabel: "Your name",
        phoneLabel: "Phone number",
        addressLabel: "Delivery address",
        addressPlaceholder: "Tashkent city, Yunusabad 4th block...",
        deliveryTypeLabel: "Delivery Method",
        deliveryCourier: "🚚 Courier Delivery",
        deliveryPickup: "🏬 Store Pickup",
        pickupStoreAddress: "Tashkent city, Farhod car market (Pickup)",
        pickupStoreBadge: "Pickup address: Tashkent, Farhod car market, row 4, shop 12. Working hours: 09:00 - 19:00",
        paymentMethodLabel: "Payment Method",
        payCard: "💳 Card / Visa / Click",
        payCash: "💵 Cash on Delivery",
        cardDetailsTitle: "Card for prepayment:",
        cardNumber: "8600 5304 1234 5678",
        cardHolder: "AZIMXON (KUZAVNOY.UZZ)",
        cardCopyBtn: "Copy",
        cardCopiedText: "Copied! ✅",
        cardPaymentHint: "You can transfer via Click / Payme / Visa to this card",
        cashPaymentHint: "Pay in cash upon receiving items from courier or at store",
        reviewsTitle: "Customer Reviews",
        writeReview: "Write a review",
        sendReview: "Submit Review ⭐️",
        reviewPlaceholder: "Your thoughts on part quality...",
        noReviews: "No reviews yet. Be the first to review!",
        reviewSent: "Your review has been submitted! Thank you! 🎉",
        socialChannels: "Our Official Social Networks",
        cancelOrderBtn: "Cancel Order ❌",
        cancelOrderConfirm: "Are you sure you want to cancel this order?",
        orderCancelledMsg: "Your order has been cancelled! 🔴",
        callStore: "Call Store",
        storePhoneTitle: "Store Phone",
        totalPayment: "TOTAL PAYMENT:",
        confirmOrder: "Confirm Order 🚀",
        submitting: "Submitting order...",
        orderSuccessTitle: "Order placed successfully! 🎉",
        orderSuccessDesc: "Our courier will contact you shortly 🚗💨",
        continueShopping: "Continue shopping",
        profileTitle: "Customer Profile",
        profileDesc: "Personal info and order history",
        ordersHistory: "My Orders",
        noOrders: "No orders placed yet",
        orderNum: "Order",
        repeatOrder: "Re-order",
        specsTitle: "Key Features & Quality:",
        viewInCatalog: "View in catalog",
        close: "Close",
        skip: "Skip",
        next: "Next →",
        start: "Get Started 🚀",
        navHome: "Home",
        navCatalog: "Catalog",
        navCart: "Cart",
        navProfile: "Profile",
        som: "UZS",
        themeLight: "Day",
        themeDark: "Night",
        onboard1Title: "Looking for quality auto parts?",
        onboard1Desc: "kuzavnoy.uzz — fast delivery of windshields, steering wheels, consoles, and original auto parts!",
        onboard2Title: "How it works",
        onboard2Desc: "Select parts from catalog, add to cart and order with a single click. Our courier delivers directly.",
        onboard3Title: "10,000+ Drivers trust us!",
        onboard3Desc: "100% genuine and guaranteed parts across Tashkent and Uzbekistan in one app.",
        condition: "Part Condition",
        conditionNew: "✨ Brand New (Original)",
        conditionUsed: "🔄 Used (Like New)",
        warrantyTitle: "Quality Warranty",
        warrantyText: "100% verified",
        adminPanel: "Admin Dashboard",
        adminPanelDesc: "Management for store owner",
        openAdmin: "Open"
      }
    };

    // Rasmiy brend SVG logolari (Instagram, YouTube, Telegram, Veb-sayt)
    const InstagramIcon = ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    );

    const YouTubeIcon = ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    );

    const TelegramIcon = ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    );

    const WebsiteIcon = ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
    );

    function App() {
      const [lang, setLang] = useState(localStorage.getItem('kuzavnoy_lang') || 'uz');
      const [theme, setTheme] = useState(localStorage.getItem('kuzavnoy_theme') || 'light');
      const [activeTab, setActiveTab] = useState('home'); // home | catalog | cart | profile
      const [products, setProducts] = useState([]);
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

      const [dbCategories, setDbCategories] = useState([]);
      const [needsInstallation, setNeedsInstallation] = useState(false);
      const [selectedWorkshop, setSelectedWorkshop] = useState("kuzavnoy.uzz Farhod bozori ustaxonasi");
      const [selectedProduct, setSelectedProduct] = useState(null); // Bottom sheet
      const [selectedCategory, setSelectedCategory] = useState('Barchasi');
      const [addOnFragrance, setAddOnFragrance] = useState(false);
      const [userOrders, setUserOrders] = useState([]);
      const [activeStoryIdx, setActiveStoryIdx] = useState(null);
      const [storyProgress, setStoryProgress] = useState(0);
      const [isStoryPaused, setIsStoryPaused] = useState(false);
      const [stories, setStories] = useState([]);
      const [miniRefreshing, setMiniRefreshing] = useState(false);
      const [showOnboarding, setShowOnboarding] = useState(false);
      const [onboardSlide, setOnboardSlide] = useState(0);

      // Buyurtma formasi
      const [custName, setCustName] = useState('');
      const [custPhone, setCustPhone] = useState('+998 ');
      const [custAddress, setCustAddress] = useState('');
      const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' | 'pickup'
      const [isLocating, setIsLocating] = useState(false);
      const [geoCoord, setGeoCoord] = useState(null);

      const handleGetLocation = () => {
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
            setGeoCoord({ lat, lng });
            const gpsLabel = "📍 GPS: " + lat.toFixed(5) + ", " + lng.toFixed(5);
            if (!custAddress.trim()) {
              setCustAddress(gpsLabel);
            } else if (!custAddress.includes('GPS:')) {
              setCustAddress(custAddress.trim() + " (" + gpsLabel + ")");
            }
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          },
          (err) => {
            setIsLocating(false);
            alert("Geolokatsiyani aniqlashga ruxsat berilmadi yoki xatolik yuz berdi. Iltimos, manzilni matn ko'rinishida yozing.");
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      };
      const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'cash'
      const [cardCopied, setCardCopied] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [orderSuccess, setOrderSuccess] = useState(false);
      const [reviews, setReviews] = useState([]);
      const [settings, setSettings] = useState({
        card_number: '8600 5304 1234 5678',
        card_holder: 'AZIMXON (KUZAVNOY.UZZ)',
        uzcard_number: '8600 5304 1234 5678',
        uzcard_holder: 'AZIMXON (KUZAVNOY.UZZ)',
        humo_number: '9860 1201 5678 4321',
        humo_holder: 'AZIMXON (KUZAVNOY.UZZ)',
        visa_number: '',
        visa_holder: 'AZIMXON (KUZAVNOY.UZZ)',
        phone: '+998 90 123 45 67',
        phone2: '+998 97 765 43 21',
        phone3: '+998 99 888 77 66',
        uzcard_active: true,
        humo_active: true,
        visa_active: false,
        phone1_active: true,
        phone2_active: true,
        phone3_active: true,
        instagram_url: 'https://instagram.com/kuzavnoy.uzz',
        youtube_url: 'https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G',
        store_address: "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori",
        store_hours: '09:00 - 19:00'
      });
      const [selectedCardIdx, setSelectedCardIdx] = useState(0);
      const [newRating, setNewRating] = useState(5);
      const [newComment, setNewComment] = useState('');
      const [isSendingReview, setIsSendingReview] = useState(false);

      const copyCardNumber = (num) => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(num.replace(/\s+/g, ''));
        }
        setCardCopied(true);
        setTimeout(() => setCardCopied(false), 2000);
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      };

      const t = (key) => (I18N[lang] && I18N[lang][key]) || (I18N['uz'] && I18N['uz'][key]) || key;

      const changeLang = (l) => {
        setLang(l);
        localStorage.setItem('kuzavnoy_lang', l);
      };

      const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        localStorage.setItem('kuzavnoy_theme', next);
      };

      // Telegram WebApp foydalanuvchi ma'lumotlari
      const tg = window.Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user || { id: 7770001, first_name: "Azizbek", username: "kuzavnoy_fan" };

      useEffect(() => {
        if (tg) {
          tg.ready();
          tg.expand();
        }
        const seen = localStorage.getItem('kuzavnoy_seen_onboard');
        if (!seen) setShowOnboarding(true);

        if (tgUser?.first_name) {
          setCustName(tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''));
        }

        fetchProducts();
        fetchStories();
        fetchReviews();
        fetchSettings();
        if (tgUser?.id) fetchUserOrders(tgUser.id);
      }, []);

      const fetchCategories = async () => {
        try {
          const res = await fetch("/api/categories");
          const data = await res.json();
          if (Array.isArray(data)) setCategories(data);
        } catch(e) {}
      };

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
          alert("Qoldiqni yangilashda xatolik yuz berdi");
        }
      };

      const handlePromptStock = async (prod) => {
        const input = prompt("Offline/Online ombor sonini kiriting:", prod.stock !== undefined ? prod.stock : 10);
        if (input === null) return;
        const val = parseInt(input);
        if (isNaN(val) || val < 0) {
          alert("Iltimos, to'g'ri musbat son kiriting!");
          return;
        }
        try {
          const res = await fetch("/api/products/" + prod.id + "/quick-stock", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stock: val })
          });
          const updated = await res.json();
          if (updated && updated.id) {
            setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, stock: updated.stock } : p));
          }
        } catch(e) {
          alert("Qoldiqni saqlashda xatolik yuz berdi");
        }
      };

      const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
          const res = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newCategoryName.trim(), icon: newCategoryIcon || "🚗" })
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

      const fetchProducts = async () => {
        try {
          const res = await fetch('/api/products');
          const data = await res.json();
          if (Array.isArray(data)) {
            setProducts(data);
          }
        } catch (e) {
          console.error(e);
        }
      };

      const fetchStories = async () => {
        try {
          const res = await fetch('/api/stories');
          const data = await res.json();
          if (Array.isArray(data)) {
            setStories(data);
          }
        } catch (e) {
          console.error(e);
        }
      };

      const fetchUserOrders = async (tgId) => {
        try {
          const res = await fetch('/api/user/orders/' + tgId);
          const data = await res.json();
          if (Array.isArray(data)) {
            setUserOrders(data);
          }
        } catch (e) {
          console.error(e);
        }
      };

      const fetchReviews = async () => {
        try {
          const res = await fetch('/api/reviews');
          const data = await res.json();
          setReviews(data);
        } catch (e) {
          console.error(e);
        }
      };

      const fetchSettings = async () => {
        try {
          const res = await fetch('/api/settings');
          const data = await res.json();
          if (data && (data.card_number || data.uzcard_number)) {
            setSettings(data);
          }
        } catch (e) {
          console.error('Settings fetch error:', e);
        }
      };

      // Instagram Uslubidagi Stories Taymeri (5 soniya avto-o'tish)
      useEffect(() => {
        if (activeStoryIdx === null || isStoryPaused || stories.length === 0) return;
        const timer = setInterval(() => {
          setStoryProgress(prev => {
            if (prev >= 100) {
              if (activeStoryIdx < stories.length - 1) {
                setActiveStoryIdx(i => i + 1);
                return 0;
              } else {
                setActiveStoryIdx(null);
                return 0;
              }
            }
            return prev + 1; // 50ms x 100 = 5000ms (5 soniya)
          });
        }, 50);
        return () => clearInterval(timer);
      }, [activeStoryIdx, isStoryPaused, stories.length]);

      const handleNextStory = (e) => {
        if (e) e.stopPropagation();
        if (activeStoryIdx !== null && activeStoryIdx < stories.length - 1) {
          setActiveStoryIdx(prev => prev + 1);
          setStoryProgress(0);
        } else {
          setActiveStoryIdx(null);
          setStoryProgress(0);
        }
      };

      const handlePrevStory = (e) => {
        if (e) e.stopPropagation();
        if (storyProgress > 25 || activeStoryIdx === 0) {
          setStoryProgress(0);
        } else if (activeStoryIdx !== null && activeStoryIdx > 0) {
          setActiveStoryIdx(prev => prev - 1);
          setStoryProgress(0);
        }
      };

      const handleMiniRefresh = async () => {
        setMiniRefreshing(true);
        try {
          const t = Date.now();
          await Promise.all([
            fetch('/api/categories?_t=' + t).then(r => r.json()).then(d => { if (Array.isArray(d)) setDbCategories(d); }),
        fetch('/api/products?_t=' + t).then(r => r.json()).then(d => { if (Array.isArray(d)) setProducts(d); }),
            fetch('/api/stories?_t=' + t).then(r => r.json()).then(d => { if (Array.isArray(d)) setStories(d); }),
            fetch('/api/settings?_t=' + t).then(r => r.json()).then(d => { if (d) setSettings(d); }),
            fetch('/api/reviews?_t=' + t).then(r => r.json()).then(d => { if (Array.isArray(d)) setReviews(d); }),
            tgUser?.id ? fetch('/api/user/orders/' + tgUser.id + '?_t=' + t).then(r => r.json()).then(d => { if (Array.isArray(d)) setUserOrders(d); }) : Promise.resolve()
          ]);
          if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } catch(e) {}
        setTimeout(() => setMiniRefreshing(false), 600);
      };

      const availableCards = useMemo(() => {
        const list = [];
        if (settings.uzcard_active !== false && settings.uzcard_number && settings.uzcard_number.trim()) {
          list.push({ type: 'uzcard', name: 'Uzcard', number: settings.uzcard_number, holder: settings.uzcard_holder || settings.card_holder, badge: '🔵 UZCARD' });
        }
        if (settings.humo_active !== false && settings.humo_number && settings.humo_number.trim()) {
          list.push({ type: 'humo', name: 'Humo', number: settings.humo_number, holder: settings.humo_holder || settings.card_holder, badge: '🟠 HUMO' });
        }
        if (settings.visa_active && settings.visa_number && settings.visa_number.trim()) {
          list.push({ type: 'visa', name: 'Visa / MC', number: settings.visa_number, holder: settings.visa_holder || settings.card_holder, badge: '🟡 VISA' });
        }
        if (list.length === 0) {
          list.push({ type: 'card', name: 'Uzcard', number: settings.card_number || '8600 5304 1234 5678', holder: settings.card_holder || 'AZIMXON (KUZAVNOY.UZZ)', badge: '💳 KARTA' });
        }
        return list;
      }, [settings]);

      const handleCancelOrder = async (orderId) => {
        if (!confirm(t('cancelOrderConfirm'))) return;
        try {
          const res = await fetch('/api/orders/' + orderId + '/cancel', { method: 'PUT' });
          const data = await res.json();
          if (data.success) {
            alert(t('orderCancelledMsg'));
            if (tgUser?.id) fetchUserOrders(tgUser.id);
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
          } else {
            alert(data.error || 'Xatolik yuz berdi');
          }
        } catch (e) {
          alert('Xatolik: ' + e.message);
        }
      };

      const handleSendReview = async (productId) => {
        if (!newComment.trim()) {
          alert(lang === 'ru' ? "Пожалуйста, напишите текст отзыва!" : (lang === 'en' ? "Please enter your review!" : "Iltimos, sharh matnini yozing!"));
          return;
        }
        setIsSendingReview(true);
        try {
          const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: productId,
              telegram_id: tgUser.id,
              customer_name: custName || tgUser.first_name || 'Mijoz',
              rating: newRating,
              comment: newComment.trim()
            })
          });
          if (res.ok) {
            setNewComment('');
            setNewRating(5);
            alert(t('reviewSent'));
            fetchReviews();
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          }
        } catch (e) {
          alert("Xatolik yuz berdi!");
        } finally {
          setIsSendingReview(false);
        }
      };

      const addToCart = (product) => {
        setCart(prev => {
          const exist = prev.find(i => i.id === product.id);
          if (exist) {
            return prev.map(i => i.id === product.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i);
          }
          return [...prev, { ...product, quantity: 1 }];
        });
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      };

      const updateQty = (id, delta) => {
        setCart(prev => prev.map(item => {
          if (item.id === id) {
            const newQ = (item.quantity || 1) + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        }).filter(Boolean));
      };

      const cartTotal = cart.reduce((acc, item) => acc + (item.new_price * (item.quantity || 1)), 0) + (addOnFragrance ? 35000 : 0);
      const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

      const handleCheckout = async () => {
        if (!custName.trim() || !custPhone.trim() || custPhone.length < 9) {
          alert(lang === 'ru' ? "Пожалуйста, введите имя и номер телефона!" : (lang === 'en' ? "Please enter your name and phone number!" : "Iltimos, ismingiz va to'liq telefon raqamingizni kiriting!"));
          return;
        }
        if (deliveryType === 'delivery' && (!custAddress.trim() || custAddress.trim().length < 3)) {
          alert(lang === 'ru' ? "Пожалуйста, укажите адрес доставки!" : (lang === 'en' ? "Please enter delivery address!" : "Iltimos, yetkazib berish manzilini kiriting!"));
          return;
        }
        if (cart.length === 0) {
          alert(t('cartEmpty'));
          return;
        }

        setIsSubmitting(true);
        try {
          const finalItems = [...cart];
          if (addOnFragrance) {
            finalItems.push({
              id: 9999,
              name: "Premium Avto-Aromatizator (Kola / BubbleGum)",
              new_price: 35000,
              quantity: 1
            });
          }

          let finalLocation = deliveryType === 'pickup' 
            ? t('pickupStoreAddress')
            : (custAddress || (lang === 'ru' ? "г. Ташкент (Доставка)" : (lang === 'en' ? "Tashkent city (Delivery)" : "Toshkent shahri (Yetkazib berish)")));

          if (deliveryType === 'delivery' && geoCoord) {
            const gMapUrl = "https://maps.google.com/?q=" + geoCoord.lat + "," + geoCoord.lng;
            finalLocation = finalLocation + " | 🗺 Xarita: " + gMapUrl;
          }

          const payload = {
            telegram_id: tgUser.id,
            customer_name: custName,
            phone: custPhone,
            items: finalItems,
            total_price: cartTotal,
            location: finalLocation,
            delivery_type: deliveryType,
            payment_method: paymentMethod,
            needs_installation: needsInstallation,
            installation_service: needsInstallation ? "kuzavnoy.uzz Farhod bozori ustaxonasi" : null
          };

          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            setCart([]);
            try { localStorage.removeItem('kuzavnoy_cart'); } catch(e) {}
            setAddOnFragrance(false);
            setOrderSuccess(true);
            fetchUserOrders(tgUser.id);
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          }
        } catch (err) {
          alert(lang === 'ru' ? "Произошла ошибка. Попробуйте снова!" : (lang === 'en' ? "An error occurred. Please try again!" : "Xatolik yuz berdi. Qayta urinib ko'ring!"));
        } finally {
          setIsSubmitting(false);
        }
      };

      const carPresets = [
        'Barchasi', 
        'Cobalt', 
        'Gentra / Lacetti', 
        'Nexia (1 / 2 / 3)',
        'Spark',
        'Matiz',
        'Damas / Labo',
        'Malibu (1 / 2)', 
        'Tracker (1 / 2)', 
        'Onix', 
        'Monjaro / Xitoy avto', 
        'Kia / Hyundai', 
        'Boshqa / Import'
      ];
      const categories = ['Barchasi', ...new Set([...(dbCategories.length > 0 ? dbCategories.map(c => c.name) : carPresets.slice(1)), ...products.map(p => p.category || p.car_model).filter(Boolean)])];
      const filteredProducts = selectedCategory === 'Barchasi' 
        ? products 
        : products.filter(p => p.category === selectedCategory || (p.category && p.category.toLowerCase().includes(selectedCategory.toLowerCase())));

      const isDark = theme === 'dark';

      return (
        <div className={'min-h-screen transition-colors duration-200 ' + (isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900')}>
          <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
            
            {/* ONBOARDING MODAL */}
            {showOnboarding && (
              <div className={'fixed inset-0 z-50 flex flex-col justify-between p-6 ' + (isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900')}>
                <div className="flex justify-end">
                  <button 
                    onClick={() => { setShowOnboarding(false); localStorage.setItem('kuzavnoy_seen_onboard', '1'); }}
                    className={'text-xs font-semibold px-3 py-1 rounded-full ' + (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}
                  >
                    {t('skip')}
                  </button>
                </div>

                <div className="text-center px-4 my-auto">
                  <div className={'w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center text-4xl shadow-sm border ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200')}>
                    {onboardSlide === 0 ? '🚗' : (onboardSlide === 1 ? '⚡️' : '🏆')}
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-3">
                    {onboardSlide === 0 ? t('onboard1Title') : (onboardSlide === 1 ? t('onboard2Title') : t('onboard3Title'))}
                  </h2>
                  <p className={'text-sm leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {onboardSlide === 0 ? t('onboard1Desc') : (onboardSlide === 1 ? t('onboard2Desc') : t('onboard3Desc'))}
                  </p>

                  <div className="flex justify-center gap-1.5 mt-8">
                    {[0, 1, 2].map(idx => (
                      <div 
                        key={idx} 
                        className={'h-1.5 rounded-full transition-all ' + (onboardSlide === idx ? (isDark ? 'w-6 bg-red-500' : 'w-6 bg-slate-900') : (isDark ? 'w-2 bg-slate-800' : 'w-2 bg-slate-200'))} 
                      />
                    ))}
                  </div>
                </div>

                <div>
                  {onboardSlide < 2 ? (
                    <button 
                      onClick={() => setOnboardSlide(s => s + 1)}
                      className={'w-full py-4 font-bold rounded-2xl shadow-lg active:scale-[0.98] transition ' + (isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white')}
                    >
                      {t('next')}
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setShowOnboarding(false); localStorage.setItem('kuzavnoy_seen_onboard', '1'); }}
                      className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-900/40 active:scale-[0.98] transition"
                    >
                      {t('start')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* INSTAGRAM-STYLE STORY VIEWER */}
            {activeStoryIdx !== null && stories[activeStoryIdx] && (
              <div 
                className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
                onPointerDown={() => setIsStoryPaused(true)}
                onPointerUp={() => setIsStoryPaused(false)}
                onPointerCancel={() => setIsStoryPaused(false)}
              >
                {/* Asosiy Karkas (Mobile 9:16 yoki to'liq ekran) */}
                <div className="relative w-full h-full max-w-md bg-slate-950 flex flex-col justify-between overflow-hidden shadow-2xl">
                  
                  {/* YUQORI SEGMENTLI PROGRESS BAR (Instagram kabi) */}
                  <div className="absolute top-2.5 inset-x-3 z-30 flex items-center gap-1 pointer-events-none">
                    {stories.map((s, sIdx) => (
                      <div key={sIdx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                        <div 
                          className="h-full bg-white transition-all duration-75"
                          style={{
                            width: sIdx < activeStoryIdx ? '100%' : (sIdx === activeStoryIdx ? (storyProgress + '%') : '0%')
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* YUQORI DO'KON LOGO & YOPISH TUGMASI */}
                  <div className="absolute top-5 inset-x-3 z-30 flex items-center justify-between text-white pointer-events-auto">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-xs shadow-md">
                        🚗
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black drop-shadow-md">{t('appName')}</span>
                          <span className="text-[10px] bg-red-600/80 px-1.5 py-0.2 rounded font-extrabold">{stories[activeStoryIdx].tag || 'Aksiya'}</span>
                        </div>
                        <span className="text-[9px] text-slate-300 block">{(activeStoryIdx + 1) + ' / ' + stories.length}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveStoryIdx(null); setStoryProgress(0); }} 
                      className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 flex items-center justify-center text-sm font-bold active:scale-90 transition backdrop-blur"
                    >
                      ✕
                    </button>
                  </div>

                  {/* HD TO'LIQ FORMATLI RASM */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                    <img 
                      src={stories[activeStoryIdx].image_url || stories[activeStoryIdx].img} 
                      alt={stories[activeStoryIdx].title}
                      className="w-full h-full object-cover"
                    />
                    {/* Yuqori va pastki qorong'i gradient */}
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
                  </div>

                  {/* CHAP VA O'NG INTERAKTIV BOSISH HUDUDLARI (Instagram tap) */}
                  <div className="absolute inset-0 z-20 flex pointer-events-auto">
                    {/* Chap 35%: Oldingi istoriya */}
                    <div 
                      onClick={handlePrevStory} 
                      className="w-[35%] h-full cursor-pointer active:bg-white/5 transition"
                      title="Oldingi istoriya"
                    />
                    {/* O'ng 65%: Keyingi istoriya */}
                    <div 
                      onClick={handleNextStory} 
                      className="w-[65%] h-full cursor-pointer active:bg-white/5 transition"
                      title="Keyingi istoriya"
                    />
                  </div>

                  {/* PASTKI MATN VA KATALOGDA KO'RISH TUGMASI */}
                  <div className="relative z-30 p-5 mt-auto text-white space-y-3 pointer-events-auto">
                    <div>
                      <h3 className="text-lg font-black leading-tight drop-shadow-md text-amber-300">
                        {stories[activeStoryIdx].title}
                      </h3>
                      <p className="text-xs text-slate-200 mt-1 leading-relaxed drop-shadow-sm line-clamp-3">
                        {stories[activeStoryIdx].description || stories[activeStoryIdx].desc}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveStoryIdx(null); 
                        setStoryProgress(0); 
                        setActiveTab('catalog'); 
                      }}
                      className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-red-950/60 active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      <span>🛒</span>
                      <span>{t('viewInCatalog')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HEADER (BRAND + LANG + THEME TOGGLE) */}
            <header className={'px-4 pt-3 pb-2 border-b flex items-center justify-between transition-colors ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100')}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-red-950/30">
                  🚗
                </div>
                <div>
                  <span className="text-xs font-black tracking-tight block leading-tight">{t('appName')}</span>
                  <span className={'text-[9px] block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('subtitle')}</span>
                </div>
              </div>

              {/* TIL VA THEME CONTROLS */}
              <div className="flex items-center gap-1.5">
                {/* Mini App Refresh Tugmasi */}
                <button
                  onClick={handleMiniRefresh}
                  disabled={miniRefreshing}
                  title="Yangilash"
                  className={'w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-90 ' + 
                    (isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 shadow-sm')}
                >
                  <span className={'text-xs ' + (miniRefreshing ? 'inline-block animate-spin text-red-500' : '')}>🔄</span>
                </button>
                {/* 3 Til selektori */}
                <div className={'flex items-center p-0.5 rounded-xl border text-[10px] font-bold ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200')}>
                  {['uz', 'ru', 'en'].map(code => (
                    <button
                      key={code}
                      onClick={() => changeLang(code)}
                      className={'px-1.5 py-0.5 rounded-lg uppercase transition ' + 
                        (lang === code ? 'bg-red-600 text-white shadow-sm font-black' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'))}
                    >
                      {code}
                    </button>
                  ))}
                </div>

                {/* Tun / Kun tugmasi */}
                <button
                  onClick={toggleTheme}
                  title="Mavzuni o'zgartirish"
                  className={'w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold border transition active:scale-95 ' + 
                    (isDark ? 'bg-slate-900 border-slate-800 text-amber-300' : 'bg-slate-100 border-slate-200 text-slate-700')}
                >
                  {isDark ? '☀️' : '🌙'}
                </button>
              </div>
            </header>

            {/* 1. ASOSIY SAHIFA (HOME) */}
            {activeTab === 'home' && (
              <div className="px-4 pt-3">
                {/* Salomlashish */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={'text-[10px] font-semibold uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-400')}>{t('subtitle')}</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    </div>
                    <h1 className="text-lg font-black tracking-tight mt-0.5">
                      {t('greeting')}, {tgUser.first_name || t('driver')} 👋
                    </h1>
                  </div>
                  <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + (isDark ? 'bg-red-950/50 border-red-800/40 text-red-400' : 'bg-red-50 border-red-100 text-red-600')}>
                    @{t('appName')}
                  </span>
                </div>

                {/* Rasmiy Ijtimoiy Tarmoqlar Bloki (Task 8) */}
                <div className={'p-3 rounded-2xl border mb-3 flex items-center justify-between ' + 
                  (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-100')}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌐</span>
                    <div>
                      <span className="text-[11px] font-black block leading-tight">kuzavnoy.uzz</span>
                      <span className={'text-[9px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Rasmiy sahifalarimiz</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a 
                      href={settings.instagram_url || "https://instagram.com/kuzavnoy.uzz"} 
                      target="_blank" 
                      className={'px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition flex items-center gap-1.5 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-rose-400 hover:border-rose-500' : 'bg-white border-rose-200 text-rose-600 shadow-sm')}
                    >
                      <InstagramIcon className="w-3.5 h-3.5 fill-rose-500" />
                      <span>Instagram</span>
                    </a>
                    <a 
                      href={settings.youtube_url || "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"} 
                      target="_blank" 
                      className={'px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition flex items-center gap-1.5 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-red-400 hover:border-red-500' : 'bg-white border-red-200 text-red-600 shadow-sm')}
                    >
                      <YouTubeIcon className="w-3.5 h-3.5 fill-red-500" />
                      <span>YouTube</span>
                    </a>
                  </div>
                </div>

                {/* Stories Bloki */}
                {stories.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 mb-3">
                    {stories.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => { const sIdx = stories.findIndex(item => item.id === s.id); setActiveStoryIdx(sIdx >= 0 ? sIdx : 0); setStoryProgress(0); }}
                        className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition"
                      >
                        <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-red-500 via-rose-400 to-amber-400">
                          <img src={s.image_url || s.img} className={'w-full h-full rounded-full object-cover border-2 ' + (isDark ? 'border-slate-950' : 'border-white')} />
                        </div>
                        <span className={'text-[10px] font-medium w-14 text-center truncate ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{s.tag || 'Yangi'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Asosiy Hero Banner */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 mb-5 shadow-xl border border-slate-800">
                  <div className="relative z-10">
                    <span className="inline-block text-[9px] uppercase tracking-widest font-extrabold bg-red-600 px-2 py-0.5 rounded-md mb-2">
                      {t('heroBadge')}
                    </span>
                    <h2 className="text-lg font-black leading-snug mb-1.5">
                      {t('heroTitle')}
                    </h2>
                    <p className="text-xs text-slate-300 mb-3.5 max-w-[240px] leading-relaxed">
                      {t('heroDesc')}
                    </p>
                    <button 
                      onClick={() => setActiveTab('catalog')}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-black rounded-xl shadow active:scale-95 transition"
                    >
                      {t('heroBtn')}
                    </button>
                  </div>
                  <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />
                </div>

                {/* Populyar Tovarlar */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">{t('popularTitle')}</h3>
                  <button onClick={() => setActiveTab('catalog')} className="text-xs font-semibold text-red-500 hover:underline">
                    {t('viewAll')} →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {products.slice(0, 8).map(product => (
                    <div 
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={'group rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer active:scale-[0.99] transition border ' + 
                        (isDark ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-300')}
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-slate-800/20">
                        <img src={product.image_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
                          <span className="text-[9px] font-bold bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-white">
                            {product.category}
                          </span>
                          <span className={'text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm ' + 
                            (product.condition === 'B/U (Ideal)' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-emerald-500 text-white font-black')}>
                            {product.condition === 'B/U (Ideal)' ? '🔄 B/U' : '✨ Yangi'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold line-clamp-1 mb-1">{product.name}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <div>
                            {product.old_price && (
                              <span className={'block text-[10px] line-through leading-none ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>
                                {product.old_price.toLocaleString()}
                              </span>
                            )}
                            <span className="text-xs font-extrabold text-red-500">
                              {product.new_price.toLocaleString()} <span className="text-[9px] font-normal">{t('som')}</span>
                            </span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                            className="w-7 h-7 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center font-bold text-sm shadow active:scale-90 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. KATALOG (MAHSULOTLAR) */}
            {activeTab === 'catalog' && (
              <div className="px-4 pt-3">
                <div className="mb-3">
                  <h1 className="text-lg font-black">{t('catalogTitle')}</h1>
                  <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('catalogDesc')}</p>
                </div>

                {/* Kategoriyalar Gorizontal Skroll */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 mb-4">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition ' + 
                        (selectedCategory === cat 
                          ? 'bg-red-600 text-white shadow-md shadow-red-950/30' 
                          : (isDark ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'))}
                    >
                      {cat === 'Barchasi' ? t('all') : (cat === 'Universal / Boshqa' ? t('universal') : cat)}
                    </button>
                  ))}
                </div>

                {/* Mahsulotlar kartochkalari */}
                <div className="space-y-3 mb-6">
                  {filteredProducts.map(product => {
                    const isOutOfStock = product.stock !== undefined && product.stock !== null && product.stock <= 0;
                    return (
                    <div 
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={'rounded-2xl p-3 flex gap-3 cursor-pointer shadow-sm transition border ' + 
                        (isDark ? 'bg-slate-900/90 border-slate-800 active:bg-slate-850' : 'bg-white border-slate-200 active:bg-slate-50')}
                    >
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800/10">
                        <img src={product.image_url} className="w-full h-full object-cover" />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-1 text-center">
                            <span className="text-[9px] font-black text-rose-300 leading-tight">Tugagan</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-wide">{product.category}</span>
                            <span className={'text-[8px] font-black px-1.5 py-0.5 rounded ' + 
                              (product.condition === 'B/U (Ideal)' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30')}>
                              {product.condition === 'B/U (Ideal)' ? '🔄 B/U' : '✨ Yangi'}
                            </span>
                            {product.stock !== undefined && product.stock !== null && (
                              <span className={'text-[8px] font-black px-1.5 py-0.5 rounded ' + 
                                (product.stock > 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500')}>
                                {product.stock > 0 ? ("📦 " + product.stock + " dona") : "🔴 Omborda qolmagan"}
                              </span>
                            )}
                            {product.color && product.color !== 'Universal' && (
                              <span className="text-[8px] font-bold text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded">
                                🎨 {product.color}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs font-black leading-snug line-clamp-1 mt-0.5">{product.name}</h3>
                          <p className={'text-[11px] line-clamp-2 mt-0.5 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{product.description}</p>
                        </div>

                        <div className={'flex items-center justify-between mt-2 pt-1.5 border-t ' + (isDark ? 'border-slate-800' : 'border-slate-100')}>
                          <div>
                            {product.old_price && (
                              <span className={'text-[10px] line-through mr-1.5 ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>
                                {product.old_price.toLocaleString()}
                              </span>
                            )}
                            <span className="text-xs font-black text-red-500">
                              {product.new_price.toLocaleString()} <span className="text-[9px] font-normal">{t('som')}</span>
                            </span>
                          </div>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (!isOutOfStock) addToCart(product); 
                            }}
                            disabled={isOutOfStock}
                            className={'px-3 py-1.5 rounded-lg text-xs font-bold shadow active:scale-95 transition flex items-center gap-1 ' + 
                              (isOutOfStock 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                                : 'bg-red-600 hover:bg-red-500 text-white cursor-pointer')}
                          >
                            <span>{isOutOfStock ? "Tugagan" : t('add')}</span>
                            {!isOutOfStock && <span>+</span>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );})} 
                </div>
              </div>
            )}

            {/* 3. SAVATCHA (CART) */}
            {activeTab === 'cart' && (
              <div className="px-4 pt-3">
                <h1 className="text-lg font-black mb-0.5">{t('cartTitle')}</h1>
                <p className={'text-xs mb-4 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('cartDesc')}</p>

                {orderSuccess ? (
                  <div className={'text-center py-10 px-4 rounded-3xl border ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-3xl mb-3">
                      ✓
                    </div>
                    <h2 className="text-lg font-black mb-1">{t('orderSuccessTitle')}</h2>
                    <p className={'text-xs mb-6 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('orderSuccessDesc')}</p>
                    <button 
                      onClick={() => { setOrderSuccess(false); setActiveTab('catalog'); }}
                      className="w-full py-3 bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg active:scale-95 transition"
                    >
                      {t('continueShopping')}
                    </button>
                  </div>
                ) : cart.length === 0 ? (
                  <div className={'text-center py-16 px-4 rounded-3xl border ' + (isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className="text-4xl mb-3">🛒</div>
                    <h3 className="text-base font-bold mb-1">{t('cartEmpty')}</h3>
                    <p className={'text-xs mb-6 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('cartEmptyDesc')}</p>
                    <button 
                      onClick={() => setActiveTab('catalog')}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold active:scale-95 transition"
                    >
                      {t('catalogTitle')} →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Tovarlar ro'yxati */}
                    <div className="space-y-2">
                      {cart.map(item => (
                        <div key={item.id} className={'p-3 rounded-2xl flex items-center justify-between border ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
                          <div className="flex items-center gap-3">
                            <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover bg-slate-800/10" />
                            <div>
                              <h4 className="text-xs font-bold line-clamp-1">{item.name}</h4>
                              <span className="text-xs font-black text-red-500">
                                {item.new_price.toLocaleString()} {t('som')}
                              </span>
                            </div>
                          </div>
                          <div className={'flex items-center gap-2 border rounded-xl px-2 py-1 ' + (isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200')}>
                            <button onClick={() => updateQty(item.id, -1)} className="text-xs font-black px-1 text-slate-400 hover:text-red-500">−</button>
                            <span className="text-xs font-bold">{item.quantity || 1}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="text-xs font-black px-1 text-slate-400 hover:text-emerald-500">+</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cross-sell Aromatizator */}
                    <div 
                      onClick={() => setAddOnFragrance(!addOnFragrance)}
                      className={'p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ' + 
                        (addOnFragrance 
                          ? (isDark ? 'bg-red-950/40 border-red-500/40' : 'bg-red-50 border-red-200') 
                          : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'))}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">🌸</span>
                        <div>
                          <div className="text-xs font-bold leading-tight">{t('aromaPromo')}</div>
                          <span className={'text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Maxsus xushbo'y avtomobil havosi</span>
                        </div>
                      </div>
                      <input type="checkbox" checked={addOnFragrance} onChange={() => {}} className="w-4 h-4 rounded text-red-600" />
                    </div>

                    {/* Buyurtma formasi */}
                    <div className={'p-4 rounded-3xl border space-y-3.5 ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                      <h3 className="text-xs font-black uppercase tracking-wider">{t('checkoutInfo')}</h3>
                      
                      <div>
                        <label className={'text-[10px] font-bold block mb-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('nameLabel')}</label>
                        <input 
                          type="text" 
                          value={custName}
                          onChange={e => setCustName(e.target.value)}
                          placeholder="Azizbek Aliyev"
                          className={'w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
                        />
                      </div>

                      <div>
                        <label className={'text-[10px] font-bold block mb-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('phoneLabel')}</label>
                        <input 
                          type="text" 
                          value={custPhone}
                          onChange={e => setCustPhone(e.target.value)}
                          placeholder="+998 90 123 45 67"
                          className={'w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:border-red-500 font-mono ' + 
                            (isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
                        />
                      </div>

                      {/* 1. Yetkazib berish usuli selektori */}
                      <div>
                        <label className={'text-[10px] font-bold block mb-1.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('deliveryTypeLabel')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => setDeliveryType('delivery')}
                            className={'py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ' + 
                              (deliveryType === 'delivery' 
                                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-950/30' 
                                : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'))}
                          >
                            {t('deliveryCourier')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeliveryType('pickup')}
                            className={'py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ' + 
                              (deliveryType === 'pickup' 
                                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-950/30' 
                                : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'))}
                          >
                            {t('deliveryPickup')}
                          </button>
                        </div>
                      </div>

                      {/* Manzil yoki Samovivoz tafsiloti (GPS Lokatsiya bilan) */}
                      {deliveryType === 'delivery' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className={'text-[10px] font-bold block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('addressLabel')}</label>
                            <span className="text-[9px] text-slate-400">Qo'lda yozing yoki GPS tugmasini bosing</span>
                          </div>
                          
                          <input 
                            type="text" 
                            value={custAddress}
                            onChange={e => setCustAddress(e.target.value)}
                            placeholder="Tuman, ko'cha, uy / xonadon raqami"
                            className={'w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
                          />

                          {/* 📍 GPS Hozirgi Lokatsiyani olish tugmasi */}
                          <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={isLocating}
                            className={'w-full py-2 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ' + 
                              (geoCoord 
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' 
                                : (isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'))}
                          >
                            {isLocating ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                <span>🛰 Lokatsiyangiz aniqlanmoqda...</span>
                              </>
                            ) : geoCoord ? (
                              <>
                                <span>✅</span>
                                <span>📍 GPS aniqlandi ({geoCoord.lat.toFixed(4)}, {geoCoord.lng.toFixed(4)})</span>
                              </>
                            ) : (
                              <>
                                <span>📍</span>
                                <span>Hozirgi turgan joyimni aniqlash (GPS)</span>
                              </>
                            )}
                          </button>

                          {geoCoord && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <a 
                                href={"https://maps.google.com/?q=" + geoCoord.lat + "," + geoCoord.lng} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex-1 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] text-blue-500 text-center font-bold hover:underline"
                              >
                                Google Xaritada ko'rish ↗
                              </a>
                              <a 
                                href={"https://yandex.uz/maps/?pt=" + geoCoord.lng + "," + geoCoord.lat + "&z=17"} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex-1 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] text-amber-500 text-center font-bold hover:underline"
                              >
                                Yandex Kartada ko'rish ↗
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={'p-3.5 rounded-2xl border space-y-2 ' + (isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-red-50/60 border-red-100 text-slate-800')}>
                          <div className="flex items-start gap-2.5">
                            <span className="text-base">📍</span>
                            <div className="text-[11px] leading-relaxed">
                              <span className="font-bold block text-xs">{t('pickupStoreAddress')}</span>
                              <span className={'text-[10px] block mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{settings.store_address || t('pickupStoreBadge')}</span>
                            </div>
                          </div>
                          {/* Yandex va Google Maps tugmalari */}
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                            <a 
                              href={settings.store_location_url && settings.store_location_url.trim() ? settings.store_location_url : ('https://yandex.uz/maps/?text=' + encodeURIComponent(settings.store_address || "Toshkent Farhod avto bozori"))}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 text-[10px] font-black flex items-center justify-center gap-1 transition active:scale-95"
                            >
                              <span>🗺</span>
                              <span>Yandex Karta</span>
                            </a>
                            <a 
                              href={settings.store_location_url && settings.store_location_url.trim() ? settings.store_location_url : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(settings.store_address || "Toshkent Farhod avto bozori"))}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 border border-blue-500/30 text-[10px] font-black flex items-center justify-center gap-1 transition active:scale-95"
                            >
                              <span>📍</span>
                              <span>Google Maps</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 2. To'lov usuli selektori */}
                      <div>
                        <label className={'text-[10px] font-bold block mb-1.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('paymentMethodLabel')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => setPaymentMethod('card')}
                            className={'py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ' + 
                              (paymentMethod === 'card' 
                                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-950/30' 
                                : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'))}
                          >
                            {t('payCard')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={'py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ' + 
                              (paymentMethod === 'cash' 
                                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-950/30' 
                                : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'))}
                          >
                            {t('payCash')}
                          </button>
                        </div>
                      </div>

                      {/* Karta vidjeti yoki Naqd to'lov izohi */}
                      {paymentMethod === 'card' ? (
                        <div className={'p-3.5 rounded-2xl border space-y-2.5 ' + (isDark ? 'bg-slate-950 border-slate-800' : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white')}>
                          {availableCards.length > 1 && (
                            <div className="flex gap-1.5 pb-1 border-b border-white/10">
                              {availableCards.map((c, idx) => (
                                <button
                                  key={c.type}
                                  type="button"
                                  onClick={() => setSelectedCardIdx(idx)}
                                  className={'px-2.5 py-1 rounded-xl text-[10px] font-black border transition ' + 
                                    (selectedCardIdx === idx 
                                      ? 'bg-red-600 border-red-500 text-white shadow-sm' 
                                      : 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20')}
                                >
                                  {c.badge}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-[10px] tracking-wider uppercase text-amber-400">
                              {(availableCards[selectedCardIdx] || availableCards[0]).badge} TO'LOV
                            </span>
                            <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-black">Click / Payme</span>
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="font-mono font-black text-sm tracking-wider">
                              {(availableCards[selectedCardIdx] || availableCards[0]).number}
                            </span>
                            <button 
                              type="button" 
                              onClick={() => copyCardNumber((availableCards[selectedCardIdx] || availableCards[0]).number)}
                              className={'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition active:scale-95 ' + 
                                (cardCopied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white')}
                            >
                              {cardCopied ? t('cardCopiedText') : t('cardCopyBtn')}
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-300 border-t border-white/10 pt-1.5">
                            <span>{(availableCards[selectedCardIdx] || availableCards[0]).holder}</span>
                            <span className="text-emerald-400 font-bold">0% komissiya</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight pt-0.5">{t('cardPaymentHint')}</p>
                        </div>
                      ) : (
                        <div className={'p-3 rounded-2xl border flex items-center gap-2.5 ' + (isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-amber-50/80 border-amber-200 text-slate-800')}>
                          <span className="text-xl">💵</span>
                          <p className="text-[11px] leading-tight font-medium">{t('cashPaymentHint')}</p>
                        </div>
                      )}

                      <div className={'pt-3 border-t flex items-center justify-between ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                        <span className="text-xs font-bold">{t('totalPayment')}</span>
                        <span className="text-base font-black text-red-500">
                          {cartTotal.toLocaleString()} {t('som')}
                        </span>
                      </div>

                      {/* 🛠 O'RNATIB BERISH XIZMATI (Do'konning o'z ustaxonasi - Farhod bozori) */}
                      <div className={'p-4 rounded-2xl border mb-3 ' + (isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                        <label className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">🛠</span>
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-white">O'rnatib berish servisi kerakmi?</div>
                              <div className="text-[10px] text-slate-400">Farhod bozoridagi do'konimiz ustaxonasida o'rnatib beriladi</div>
                            </div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={needsInstallation} 
                            onChange={e => setNeedsInstallation(e.target.checked)}
                            className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                          />
                        </label>

                        {needsInstallation && (
                          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="p-3 rounded-xl border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs space-y-1">
                              <div className="font-black text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                <span>🏬</span>
                                <span>kuzavnoy.uzz Ustaxonasi (Farhod bozori)</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                Xarid qilingan detal do'konimizning Farhod bozoridagi professional ustaxonasida 100% kafolat bilan o'rnatib beriladi.
                              </p>
                              <div className="text-[10px] text-slate-400 pt-1">
                                📍 <b>Manzil:</b> Toshkent sh., Farhod avto bozori, kuzavnoy.uzz do'koni va servisi
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
                              <span>🎁 10% chegirma promokodingiz:</span>
                              <span className="font-mono font-black text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">KUZAVNOY-USTA</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={handleCheckout}
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg shadow-red-900/40 active:scale-95 transition"
                      >
                        {isSubmitting ? t('submitting') : t('confirmOrder')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. PROFIL TAB */}
            {activeTab === 'profile' && (
              <div className="px-4 pt-3">
                {/* PROFIL SARLAVHASI (Sodda va qulay) */}
                <div className="mb-4">
                  <h1 className="text-lg font-black mb-0.5">{t('profileTitle')}</h1>
                  <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('profileDesc')}</p>
                </div>

                {/* User Info Card */}
                <div className={'p-4 rounded-3xl border mb-5 flex items-center gap-3.5 ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center font-black text-lg">
                    {(tgUser.first_name || 'U')[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-black">{tgUser.first_name || t('driver')} {tgUser.last_name || ''}</h3>
                    <span className="text-[10px] text-slate-500 font-mono">ID: {tgUser.id}</span>
                  </div>
                </div>

                {/* RASMIY IJTIMOIY TARMOQLARIMIZ (Zamonaviy 2x2 Grid) */}
                <div className={'p-4 rounded-3xl border mb-5 ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌐</span>
                      <h3 className="text-xs font-black uppercase tracking-wider">{t('socialChannels')}</h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">Obuna bo'ling</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Instagram */}
                    {settings.instagram_active !== false && (
                      <a 
                        href={settings.instagram_url || "https://instagram.com/kuzavnoy.uzz"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/10 via-rose-500/10 to-purple-600/10 hover:from-amber-500/20 hover:via-rose-500/20 hover:to-purple-600/20 border border-rose-500/30 flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                          <InstagramIcon className="w-4 h-4 fill-white" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-black block truncate text-slate-900 dark:text-white">Instagram</span>
                          <span className="text-[9px] text-rose-500 font-bold block truncate">@kuzavnoy.uzz</span>
                        </div>
                      </a>
                    )}

                    {/* YouTube */}
                    {settings.youtube_active !== false && (
                      <a 
                        href={settings.youtube_url || "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#FF0000] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                          <YouTubeIcon className="w-4 h-4 fill-white" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-black block truncate text-slate-900 dark:text-white">YouTube</span>
                          <span className="text-[9px] text-red-500 font-bold block truncate">@kuzavnoyuzz</span>
                        </div>
                      </a>
                    )}

                    {/* Telegram Kanal */}
                    {settings.telegram_active !== false && (
                      <a 
                        href={settings.telegram_channel_url || "https://t.me/kuzavnoy_uz"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 rounded-2xl bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/30 flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#229ED9] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                          <TelegramIcon className="w-4 h-4 fill-white" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-black block truncate text-slate-900 dark:text-white">Telegram</span>
                          <span className="text-[9px] text-sky-500 font-bold block truncate">Kanalimiz ↗</span>
                        </div>
                      </a>
                    )}

                    {/* Rasmiy Veb-Sayt */}
                    {settings.website_active && (
                      <a 
                        href={settings.website_url || "https://kuzavnoy.uz"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                          <WebsiteIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-black block truncate text-slate-900 dark:text-white">Veb-sayt</span>
                          <span className="text-[9px] text-emerald-500 font-bold block truncate">kuzavnoy.uz ↗</span>
                        </div>
                      </a>
                    )}
                  </div>
                </div>

                {/* Do'kon bilan aloqa (3 ta telefon raqami va Manzil) */}
                <div className={'p-4 rounded-3xl border mb-5 ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                  <h4 className="text-xs font-black uppercase tracking-wider mb-2.5 text-emerald-500 flex items-center gap-1.5">
                    <span>📞</span>
                    <span>Aloqa & Qo'ng'iroq Markazi</span>
                  </h4>
                  <div className="space-y-2.5">
                    {/* Asosiy telefon (agar faol bo'lsa) */}
                    {settings.phone1_active !== false && settings.phone && (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={'text-[10px] font-bold block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Asosiy raqam</span>
                          <span className={'text-xs font-mono font-black ' + (isDark ? 'text-slate-200' : 'text-slate-800')}>{settings.phone}</span>
                        </div>
                        <a 
                          href={'tel:' + settings.phone.replace(/\s+/g, '')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black shadow transition active:scale-95 flex items-center gap-1"
                        >
                          <span>📞</span>
                          <span>{t('callStore')}</span>
                        </a>
                      </div>
                    )}

                    {/* Qo'shimcha telefon 1 (agar faol bo'lsa) */}
                    {settings.phone2_active !== false && settings.phone2 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className={'text-[10px] font-bold block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Call-markaz / Savdo</span>
                          <span className={'text-xs font-mono font-black ' + (isDark ? 'text-slate-200' : 'text-slate-800')}>{settings.phone2}</span>
                        </div>
                        <a 
                          href={'tel:' + settings.phone2.replace(/\s+/g, '')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black shadow transition active:scale-95 flex items-center gap-1"
                        >
                          <span>📞</span>
                          <span>{t('callStore')}</span>
                        </a>
                      </div>
                    )}

                    {/* Qo'shimcha telefon 2 (agar faol bo'lsa) */}
                    {settings.phone3_active !== false && settings.phone3 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className={'text-[10px] font-bold block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Texnik yordam & Konsultatsiya</span>
                          <span className={'text-xs font-mono font-black ' + (isDark ? 'text-slate-200' : 'text-slate-800')}>{settings.phone3}</span>
                        </div>
                        <a 
                          href={'tel:' + settings.phone3.replace(/\s+/g, '')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black shadow transition active:scale-95 flex items-center gap-1"
                        >
                          <span>📞</span>
                          <span>{t('callStore')}</span>
                        </a>
                      </div>
                    )}
                  </div>
                  <div className={'text-xs mt-3 pt-3 border-t space-y-2 ' + (isDark ? 'border-slate-800' : 'border-slate-100')}>
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">📍</span>
                      <div>
                        <span className={'text-[10px] font-bold block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Do'konimiz manzili:</span>
                        <span className={'text-xs font-black ' + (isDark ? 'text-slate-200' : 'text-slate-800')}>
                          {settings.store_address || "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori"}
                        </span>
                      </div>
                    </div>
                    {/* Yandex Karta va Google Maps tugmalari */}
                    <div className="flex items-center gap-2 pt-1">
                      <a 
                        href={settings.store_location_url && settings.store_location_url.trim() ? settings.store_location_url : ('https://yandex.uz/maps/?text=' + encodeURIComponent(settings.store_address || "Toshkent Farhod avto bozori"))}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[11px] font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                      >
                        <span>🗺</span>
                        <span>Yandex Karta</span>
                      </a>
                      <a 
                        href={settings.store_location_url && settings.store_location_url.trim() ? settings.store_location_url : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(settings.store_address || "Toshkent Farhod avto bozori"))}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 text-[11px] font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                      >
                        <span>📍</span>
                        <span>Google Maps</span>
                      </a>
                    </div>
                  </div>
                </div>

                <h3 className="text-xs font-black uppercase tracking-wider mb-2.5">{t('ordersHistory')}</h3>
                
                {userOrders.length === 0 ? (
                  <div className={'p-8 text-center rounded-2xl border text-xs ' + (isDark ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')}>
                    {t('noOrders')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userOrders.map(o => (
                      <div key={o.id} className={'p-3.5 rounded-2xl border ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black">#{o.id}</span>
                          <span className={'text-[10px] font-extrabold px-2 py-0.5 rounded-md ' + 
                            (o.status === 'Yetkazildi' ? 'bg-emerald-500/20 text-emerald-400' : 
                            (o.status === 'Bekor qilindi' ? 'bg-rose-500/20 text-rose-400' : 
                            (o.status === 'Jarayonda' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400')))}>
                            {o.status}
                          </span>
                        </div>

                        {/* Buyurtma Holat Bannerni Ko'rsatish (Barcha 5 ta holat) */}
                        <div className={'p-2.5 rounded-xl mb-2 text-[11px] font-bold flex items-center gap-2 border ' + 
                          (o.status === 'Jarayonda' ? (isDark ? 'bg-sky-950/60 border-sky-800/50 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-800') :
                           o.status === 'Tayyorlandi' ? (isDark ? 'bg-indigo-950/60 border-indigo-800/50 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800') :
                           o.status === 'Yetkazildi' ? (isDark ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') :
                           o.status === 'Bekor qilindi' ? (isDark ? 'bg-rose-950/60 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800') :
                           (isDark ? 'bg-amber-950/60 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'))}>
                          <span className="text-base">
                            {o.status === 'Jarayonda' ? '✅' : (o.status === 'Tayyorlandi' ? '📦' : (o.status === 'Yetkazildi' ? '🎉' : (o.status === 'Bekor qilindi' ? '🔴' : '⏳')))}
                          </span>
                          <span className="leading-tight">
                            {o.status === 'Jarayonda' ? 'Buyurtmangiz qabul qilindi va tayyorlanmoqda! 🚗💨' : 
                            (o.status === 'Tayyorlandi' ? 'Buyurtmangiz tayyorlandi va yetkazishga shay! 📦' : 
                            (o.status === 'Yetkazildi' ? 'Buyurtma yetkazildi! Xaridingiz uchun rahmat!' : 
                            (o.status === 'Bekor qilindi' ? 'Buyurtma bekor qilingan.' : "Buyurtma ko'rib chiqilmoqda (Kutilmoqda)...")))}
                          </span>
                        </div>

                        {/* Bosqichma-bosqich vizual status-treker */}
                        {o.status !== 'Bekor qilindi' && (
                          <div className={'px-3 py-2.5 rounded-2xl mb-2.5 border ' + (isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200')}>
                            <div className="flex items-center justify-between text-[9px] font-black text-slate-400">
                              <span className={o.status === 'Kutilmoqda' ? 'text-amber-400 font-extrabold' : 'text-emerald-500'}>1. Qabul</span>
                              <span>→</span>
                              <span className={o.status === 'Jarayonda' ? 'text-sky-400 font-extrabold' : (['Tayyorlandi', 'Yetkazildi'].includes(o.status) ? 'text-emerald-500' : '')}>2. Yig'ilmoqda</span>
                              <span>→</span>
                              <span className={o.status === 'Tayyorlandi' ? 'text-indigo-400 font-extrabold' : (o.status === 'Yetkazildi' ? 'text-emerald-500' : '')}>3. Kuryer yo'lda</span>
                              <span>→</span>
                              <span className={o.status === 'Yetkazildi' ? 'text-emerald-500 font-extrabold' : ''}>4. Yetkazildi</span>
                            </div>
                            <div className="w-full bg-slate-700/20 h-1.5 rounded-full overflow-hidden mt-1.5">
                              <div 
                                className="h-full bg-red-600 rounded-full transition-all duration-500"
                                style={{
                                  width: o.status === 'Kutilmoqda' ? '25%' : 
                                         (o.status === 'Jarayonda' ? '50%' : 
                                         (o.status === 'Tayyorlandi' ? '75%' : '100%'))
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* O'rnatish servisi nishoni */}
                        {o.needs_installation && (
                          <div className={'p-2 rounded-xl mb-2 text-[10px] font-bold border flex items-center gap-1.5 ' + (isDark ? 'bg-amber-950/30 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800')}>
                            <span>🛠</span>
                            <span><b>O'rnatish:</b> {o.installation_service || 'Kuzavnoy Hamkor Servis'} (10% chegirma kod: KUZAVNOY-USTA)</span>
                          </div>
                        )}
                        <div className={'text-[11px] mb-2 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                          {(o.items || []).map(i => i.name + ' x ' + (i.quantity || 1)).join(', ')}
                        </div>
                        <div className={'pt-2 border-t flex justify-between items-center ' + (isDark ? 'border-slate-800' : 'border-slate-100')}>
                          <span className="text-xs font-black text-red-500">{o.total_price?.toLocaleString()} {t('som')}</span>
                          <div className="flex items-center gap-2">
                            {o.status === 'Kutilmoqda' && (
                              <button 
                                onClick={() => handleCancelOrder(o.id)}
                                title="Buyurtmani bekor qilish"
                                className="text-[10px] px-2 py-0.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white font-extrabold transition flex items-center gap-1"
                              >
                                <span>✕</span>
                                <span>{t('cancelOrderBtn')}</span>
                              </button>
                            )}
                            {o.items && o.items[0] && (
                              <button 
                                onClick={() => {
                                  const prod = products.find(p => p.id === o.items[0].id) || o.items[0];
                                  setSelectedProduct(prod);
                                }}
                                className="text-[10px] text-amber-500 font-extrabold hover:underline flex items-center gap-0.5"
                              >
                                <span>⭐️</span>
                                <span>{t('writeReview')}</span>
                              </button>
                            )}
                            <span className="text-[10px] text-slate-500">{new Date(o.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BOTTOM SHEET PRODUCT MODAL */}
            {selectedProduct && (
              <div onClick={() => setSelectedProduct(null)} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-0 animate-fade-in">
                <div onClick={e => e.stopPropagation()} className={'w-full max-w-md rounded-t-3xl p-5 border-t max-h-[88vh] overflow-y-auto no-scrollbar animate-slide-up relative flex flex-col ' + 
                  (isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                  
                  {/* Top Bar with Pull Handle & Circular Close Button */}
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-inherit z-20 pb-1">
                    <div className="w-12 h-1 bg-slate-400/40 rounded-full mx-auto" />
                    <button 
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      title="Yopish"
                      className="absolute right-0 top-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold text-sm transition active:scale-90 shadow-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-3.5 bg-slate-800/10">
                    <img src={selectedProduct.image_url} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/70 backdrop-blur px-2 py-0.5 rounded text-white">
                      {selectedProduct.category}
                    </span>
                  </div>

                  <h2 className="text-base font-black mb-1">{selectedProduct.name}</h2>
                  <p className={'text-xs mb-3 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{selectedProduct.description}</p>

                  {/* Mahsulot Holati, Kafolati, Stock va Rangi Bloki */}
                  <div className={'grid grid-cols-2 gap-2 mb-3.5 p-2.5 rounded-2xl border text-xs ' + 
                    (isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{selectedProduct.condition === 'B/U (Ideal)' ? '🔄' : '✨'}</span>
                      <div>
                        <span className="text-[10px] block text-slate-400 font-semibold">{t('condition')}</span>
                        <span className={'text-xs font-black ' + (selectedProduct.condition === 'B/U (Ideal)' ? 'text-amber-500' : 'text-emerald-500')}>
                          {selectedProduct.condition === 'B/U (Ideal)' ? t('conditionUsed') : t('conditionNew')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛡</span>
                      <div>
                        <span className="text-[10px] block text-slate-400 font-semibold">{t('warrantyTitle')}</span>
                        <span className="text-xs font-black text-sky-400">{t('warrantyText')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-base">{(selectedProduct.stock === undefined || selectedProduct.stock > 0) ? '📦' : '🔴'}</span>
                      <div>
                        <span className="text-[10px] block text-slate-400 font-semibold">Omborda mavjud:</span>
                        <span className={'text-xs font-black ' + ((selectedProduct.stock === undefined || selectedProduct.stock > 0) ? 'text-emerald-500' : 'text-rose-500')}>
                          {(selectedProduct.stock !== undefined && selectedProduct.stock !== null) 
                            ? (selectedProduct.stock > 0 ? (selectedProduct.stock + " dona") : "Tugagan") 
                            : "Mavjud"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-base">🎨</span>
                      <div>
                        <span className="text-[10px] block text-slate-400 font-semibold">Rangi:</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                          {selectedProduct.color || "Universal"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Xususiyatlar (6-7 ta boy detallar) */}
                  {selectedProduct.details && (
                    <div className={'p-3.5 rounded-2xl mb-4 space-y-2 ' + (isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-100')}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block mb-1">{t('specsTitle')}</span>
                      {(Array.isArray(selectedProduct.details) ? selectedProduct.details : JSON.parse(selectedProduct.details || '[]')).map((d, i) => (
                        <div key={i} className="text-xs flex items-start gap-2 leading-relaxed">
                          <span className="text-red-500 font-bold mt-0.5">•</span>
                          <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{d}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mijozlar Sharhlari & Reyting (Task 3) */}
                  <div className={'pt-4 border-t mb-4 ' + (isDark ? 'border-slate-800' : 'border-slate-100')}>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                        <span>⭐️</span>
                        <span>{t('reviewsTitle')}</span>
                      </h4>
                      <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (isDark ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 'bg-amber-50 text-amber-700 border border-amber-200')}>
                        {reviews.filter(r => r.product_id === selectedProduct.id).length > 0 
                          ? (reviews.filter(r => r.product_id === selectedProduct.id).reduce((s, r) => s + r.rating, 0) / reviews.filter(r => r.product_id === selectedProduct.id).length).toFixed(1) + " ★" 
                          : "5.0 ★"}
                      </span>
                    </div>

                    {/* Mavjud sharhlar */}
                    <div className="space-y-2 mb-3 max-h-36 overflow-y-auto no-scrollbar">
                      {reviews.filter(r => r.product_id === selectedProduct.id).length === 0 ? (
                        <p className={'text-[11px] italic ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>{t('noReviews')}</p>
                      ) : (
                        reviews.filter(r => r.product_id === selectedProduct.id).map(r => (
                          <div key={r.id} className={'p-2.5 rounded-xl border ' + (isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="font-bold">{r.customer_name}</span>
                              <span className="text-amber-500">{"★".repeat(r.rating || 5)}</span>
                            </div>
                            <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{r.comment}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Sharh qoldirish formasi */}
                    <div className={'p-3 rounded-2xl border space-y-2 ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold">{t('writeReview')}:</span>
                        <div className="flex gap-1 text-sm cursor-pointer">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button 
                              key={star} 
                              type="button" 
                              onClick={() => setNewRating(star)}
                              className={newRating >= star ? "text-amber-400 scale-110 transition" : "text-slate-400 hover:text-amber-300"}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={newComment} 
                        onChange={e => setNewComment(e.target.value)} 
                        placeholder={t('reviewPlaceholder')} 
                        className={'w-full p-2 text-xs rounded-xl border focus:outline-none focus:border-red-500 ' + 
                          (isDark ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
                      />
                      <button 
                        type="button" 
                        onClick={() => handleSendReview(selectedProduct.id)} 
                        disabled={isSendingReview}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold active:scale-95 transition"
                      >
                        {isSendingReview ? "..." : t('sendReview')}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      {selectedProduct.old_price && (
                        <span className="text-[10px] text-slate-400 line-through block">
                          {selectedProduct.old_price.toLocaleString()} {t('som')}
                        </span>
                      )}
                      <span className="text-base font-black text-red-500">
                        {selectedProduct.new_price.toLocaleString()} {t('som')}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => { 
                          if (selectedProduct.stock === undefined || selectedProduct.stock === null || selectedProduct.stock > 0) {
                            addToCart(selectedProduct); 
                            setSelectedProduct(null); 
                          }
                        }}
                        disabled={selectedProduct.stock !== undefined && selectedProduct.stock !== null && selectedProduct.stock <= 0}
                        className={'px-5 py-2.5 font-bold rounded-xl text-xs shadow-lg active:scale-95 transition ' +
                          (selectedProduct.stock !== undefined && selectedProduct.stock !== null && selectedProduct.stock <= 0
                            ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-500 text-white cursor-pointer')}
                      >
                        {(selectedProduct.stock !== undefined && selectedProduct.stock !== null && selectedProduct.stock <= 0) ? "Omborda qolmagan" : (t('add') + " 🛒")}
                      </button>
                      <button 
                        onClick={() => setSelectedProduct(null)}
                        className={'px-3.5 py-2.5 font-bold rounded-xl text-xs cursor-pointer ' + (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}
                      >
                        {t('close')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM FIXED NAVIGATION BAR */}
            <nav className={'fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t backdrop-blur z-40 px-4 py-2 flex items-center justify-around transition-colors ' + 
              (isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200')}>
              
              <button 
                onClick={() => setActiveTab('home')}
                className={'flex flex-col items-center gap-0.5 transition ' + (activeTab === 'home' ? 'text-red-500 font-bold' : (isDark ? 'text-slate-500' : 'text-slate-400'))}
              >
                <span className="text-lg">🏠</span>
                <span className="text-[10px]">{t('navHome')}</span>
              </button>

              <button 
                onClick={() => setActiveTab('catalog')}
                className={'flex flex-col items-center gap-0.5 transition ' + (activeTab === 'catalog' ? 'text-red-500 font-bold' : (isDark ? 'text-slate-500' : 'text-slate-400'))}
              >
                <span className="text-lg">🔍</span>
                <span className="text-[10px]">{t('navCatalog')}</span>
              </button>

              <button 
                onClick={() => setActiveTab('cart')}
                className={'relative flex flex-col items-center gap-0.5 transition ' + (activeTab === 'cart' ? 'text-red-500 font-bold' : (isDark ? 'text-slate-500' : 'text-slate-400'))}
              >
                <span className="text-lg">🛒</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
                <span className="text-[10px]">{t('navCart')}</span>
              </button>

              <button 
                onClick={() => setActiveTab('profile')}
                className={'flex flex-col items-center gap-0.5 transition ' + (activeTab === 'profile' ? 'text-red-500 font-bold' : (isDark ? 'text-slate-500' : 'text-slate-400'))}
              >
                <span className="text-lg">👤</span>
                <span className="text-[10px]">{t('navProfile')}</span>
              </button>
            </nav>

          </div>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>`;
}


function getAdminPanelHtml() {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>kuzavnoy.uzz | Admin Dashboard</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin-custom { animation: spin 0.8s linear infinite; }
  </style>
  <script>
    window.onerror = function(msg, url, line) {
      var el = document.getElementById('debug-err');
      if (el) el.innerHTML = '<b>Xatolik:</b> ' + msg + ' (' + line + ')';
    };
  </script>
</head>
<body class="transition-colors duration-200">
  <div id="root">
    <div class="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div class="w-12 h-12 border-4 border-slate-800 border-t-red-600 rounded-full animate-spin-custom mb-3"></div>
      <p class="text-sm font-bold text-slate-400">kuzavnoy.uzz Admin yuklanmoqda...</p>
      <div id="debug-err" class="mt-4 text-xs text-red-500 max-w-sm font-mono"></div>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect, useMemo } = React;

    const ADMIN_I18N = {
      uz: {
        controlHub: "Boshqaruv & Savdo Markazi",
        soundOn: "🔔 Ovoz: Yoqiq",
        soundOff: "🔕 Ovoz: O'chiq",
        refresh: "Yangilash",
        themeLight: "Kun",
        themeDark: "Tun",
        tabDashboard: "📊 Analitika",
        tabOrders: "📦 Buyurtmalar",
        tabProducts: "🛠 Zapchastlar Ombori",
        tabStories: "📱 Istoriyalar",
        tabCrm: "👥 Mijozlar Bazasi",
        tabBroadcast: "📢 Xabar Tarqatish",
        totalRevenue: "Jami Savdo Tushumi",
        totalOrders: "Jami Buyurtmalar",
        deliveredOrders: "Yetkazilgan buyurtmalar",
        activeCustomers: "Faol Mijozlar",
        realtime: "Real vaqtda hisoblangan",
        ordersManage: "Buyurtmalar Jurnali & Boshqaruv",
        ordersDesc: "Mijozlarning yangi zakazlarini kuzating va holatini o'zgartiring",
        all: "Barchasi",
        pending: "Kutilmoqda",
        processing: "Jarayonda",
        ready: "Tayyorlandi",
        delivered: "Yetkazildi",
        cancelled: "Bekor qilindi",
        searchOrderPlaceholder: "Buyurtma ID, ism yoki telefon...",
        receipt: "🧾 Chek",
        itemsList: "Xarid qilingan detallar",
        totalSum: "Jami to'lov:",
        printReceipt: "Chop etish 🖨",
        close: "Yopish",
        partsCatalog: "Zapchastlar Katalogi & Ombor",
        partsDesc: "Yangi tovar qo'shing, narxini jadvalning o'zida o'zgartiring",
        searchPartPlaceholder: "Qismlarni qidirish...",
        addNewPart: "+ Yangi Zapchast",
        edit: "Tahrirlash",
        delete: "O'chirish",
        quickPriceDesc: "Tezkor Narx Tahrirlash",
        photoHeader: "Rasm",
        partNameHeader: "Detal Nomi & Kategoriya",
        featuresHeader: "Tavsif & Xususiyatlar",
        actionsHeader: "Amallar",
        storiesHub: "📱 Telegram Mini App Istoriyalari (Stories)",
        storiesDesc: "Mini App yuqori qismida aylanib turadigan aksiyalar va yangiliklarni boshqaring",
        addNewStory: "+ Yangi Istoriya Qo'shish",
        noStories: "Hozircha hech qanday istoriya yo'q.",
        crmHub: "Mijozlar Bazasi (CRM)",
        crmDesc: "Do'koningizdan ro'yxatdan o'tgan barcha Telegram mijozlar",
        broadcastHub: "Barcha Mijozlarga Xabar Tarqatish 📢",
        broadcastDesc: "Yangi chegirmalar yoki aksiyalar haqida bot orqali bir bosishda xabar yuboring.",
        photoUrlOptional: "Rasm URL manzili (Ixtiyoriy)",
        broadcastMsgLabel: "Xabar Matni (HTML qo'llab-quvvatlanadi)",
        broadcastPlaceholder: "⚡️ DIQQAT AKSIYA! M-Sport rullariga 25% chegirma boshlandi!",
        sendBroadcast: "🚀 Barcha Foydalanuvchilarga Yuborish",
        sending: "Yuborilmoqda...",
        modalNewProduct: "Yangi Ehtiyot Qism Qo'shish",
        modalEditProduct: "Zapchastni Tahrirlash",
        productName: "Mahsulot Nomi",
        categoryCarModel: "Kategoriya (Mashina Modeli)",
        newPrice: "Yangi Narxi (so'm)",
        oldPrice: "Eski Narxi (so'm, chegirma ko'rsatish uchun)",
        photoPhoneOrUrl: "Mahsulot Rasmi (Telefondan tanlash yoki URL)",
        photoFromPhone: "Telefondan rasm tanlash",
        photoHint: "Galereya yoki kameradan rasm yuklang",
        photoSelected: "✅ Rasm tanlandi (Almashtirish uchun bosing)",
        shortDesc: "Qisqa Tavsif",
        featuresInput: "Xususiyatlari (har bir qator yangi nuqta bo'ladi)",
        cancel: "Bekor qilish",
        save: "Saqlash",
        modalNewStory: "📱 Yangi Istoriya (Story) Qo'shish",
        storyTitle: "Sarlavha (Title)",
        storyTag: "Teg (Belgisi)",
        tagNew: "Yangi",
        tagDiscount: "Chegirma",
        tagPromo: "Aksiya",
        tagService: "Xizmat",
        tagOriginal: "Original",
        tagTop: "Top",
        storyPhoto: "Istoriya Rasmi (Telefondan yoki URL)",
        publishStory: "Saqlash va Joylash",
        tabSettings: "⚙️ Sozlamalar",
        settingsTitle: "Do'kon Sozlamalari & Rekvizitlar",
        settingsDesc: "Karta raqami, telefon, Instagram, YouTube va do'kon manzilini boshqaring",
        paymentDetailsHeader: "💳 To'lov Rekvizitlari (Online Karta)",
        cardNumberLabel: "Karta raqami (Uzcard / Humo / Visa)",
        cardHolderLabel: "Karta egasi (Ism va Familiya)",
        contactHeader: "📞 Aloqa & Kontaktlar",
        storePhoneLabel: "Do'kon / Admin telefon raqami",
        socialHeader: "🌐 Rasmiy Sahifalar & Ijtimoiy Tarmoqlar",
        instagramUrlLabel: "Instagram sahifasi havolasi",
        youtubeUrlLabel: "YouTube kanali havolasi",
        storeLocationHeader: "🏬 Do'kon Manzili & Ish Vaqti (Samovivoz)",
        storeAddressLabel: "Do'kon manzili (Samovivoz uchun)",
        storeHoursLabel: "Ish vaqti",
        saveSettings: "Sozlamalarni Saqlash 💾",
        settingsSaved: "Sozlamalar muvaffaqiyatli saqlandi! ✅"
      },
      ru: {
        controlHub: "Центр Управления & Продаж",
        soundOn: "🔔 Звук: Вкл",
        soundOff: "🔕 Звук: Выкл",
        refresh: "Обновить",
        themeLight: "День",
        themeDark: "Ночь",
        tabDashboard: "📊 Аналитика",
        tabOrders: "📦 Заказы",
        tabProducts: "🛠 Склад Запчастей",
        tabStories: "📱 Истории",
        tabCrm: "👥 База Клиентов",
        tabBroadcast: "📢 Рассылка",
        totalRevenue: "Общая Выручка",
        totalOrders: "Всего Заказов",
        deliveredOrders: "Доставленные заказы",
        activeCustomers: "Активные Клиенты",
        realtime: "Рассчитано в реальном времени",
        ordersManage: "Журнал Заказов & Управление",
        ordersDesc: "Следите за новыми заказами и меняйте их статус",
        all: "Все",
        pending: "Ожидание",
        processing: "В процессе",
        ready: "Готов",
        delivered: "Доставлен",
        cancelled: "Отменен",
        searchOrderPlaceholder: "ID заказа, имя или телефон...",
        receipt: "🧾 Чек",
        itemsList: "Купленные детали",
        totalSum: "Итого к оплате:",
        printReceipt: "Печать 🖨",
        close: "Закрыть",
        partsCatalog: "Каталог Запчастей & Склад",
        partsDesc: "Добавляйте запчасти и меняйте цены прямо в таблице",
        searchPartPlaceholder: "Поиск запчастей...",
        addNewPart: "+ Новая Запчасть",
        edit: "Редактировать",
        delete: "Удалить",
        quickPriceDesc: "Быстрое Редактирование Цены",
        photoHeader: "Фото",
        partNameHeader: "Название & Категория",
        featuresHeader: "Описание & Характеристики",
        actionsHeader: "Действия",
        storiesHub: "📱 Истории Telegram Mini App (Stories)",
        storiesDesc: "Управляйте акциями и историями в верхней части приложения",
        addNewStory: "+ Добавить Историю",
        noStories: "Историй пока нет.",
        crmHub: "База Клиентов (CRM)",
        crmDesc: "Все пользователи Telegram, зарегистрированные в магазине",
        broadcastHub: "Рассылка Всем Клиентам 📢",
        broadcastDesc: "Отправьте сообщение об акциях всем клиентам в один клик.",
        photoUrlOptional: "Ссылка на фото URL (Необязательно)",
        broadcastMsgLabel: "Текст Сообщения (Поддерживается HTML)",
        broadcastPlaceholder: "⚡️ ВНИМАНИЕ АКЦИЯ! Скидка 25% на рули M-Sport!",
        sendBroadcast: "🚀 Отправить Всем Клиентам",
        sending: "Отправка...",
        modalNewProduct: "Добавить Запчасть",
        modalEditProduct: "Редактировать Запчасть",
        productName: "Название Товара",
        categoryCarModel: "Категория (Модель Авто)",
        newPrice: "Новая Цена (сум)",
        oldPrice: "Старая Цена (сум, для отображения скидки)",
        photoPhoneOrUrl: "Фото Товара (С телефона или URL)",
        photoFromPhone: "Выбрать фото с телефона",
        photoHint: "Загрузите из галереи или камеры",
        photoSelected: "✅ Фото выбрано (Нажмите для замены)",
        shortDesc: "Краткое Описание",
        featuresInput: "Характеристики (каждая строка — отдельный пункт)",
        cancel: "Отмена",
        save: "Сохранить",
        modalNewStory: "📱 Добавить Историю (Story)",
        storyTitle: "Заголовок (Title)",
        storyTag: "Тег (Бейдж)",
        tagNew: "Новинка",
        tagDiscount: "Скидка",
        tagPromo: "Акция",
        tagService: "Сервис",
        tagOriginal: "Оригинал",
        tagTop: "Топ",
        storyPhoto: "Фото Истории (С телефона или URL)",
        publishStory: "Сохранить и Опубликовать",
        tabSettings: "⚙️ Настройки",
        settingsTitle: "Настройки Магазина & Реквизиты",
        settingsDesc: "Управляйте номером карты, телефоном, соцсетями и адресом магазина",
        paymentDetailsHeader: "💳 Платежные Реквизиты (Карта)",
        cardNumberLabel: "Номер карты (Uzcard / Humo / Visa)",
        cardHolderLabel: "Владелец карты (Имя и Фамилия)",
        contactHeader: "📞 Контакты",
        storePhoneLabel: "Телефон магазина / Администратора",
        socialHeader: "🌐 Официальные Страницы & Соцсети",
        instagramUrlLabel: "Ссылка на Instagram",
        youtubeUrlLabel: "Ссылка на YouTube",
        storeLocationHeader: "🏬 Адрес Магазина & Время Работы (Самовывоз)",
        storeAddressLabel: "Адрес магазина (для самовывоза)",
        storeHoursLabel: "Время работы",
        saveSettings: "Сохранить Настройки 💾",
        settingsSaved: "Настройки успешно сохранены! ✅"
      },
      en: {
        controlHub: "Control & Sales Hub",
        soundOn: "🔔 Sound: On",
        soundOff: "🔕 Sound: Off",
        refresh: "Refresh",
        themeLight: "Day",
        themeDark: "Night",
        tabDashboard: "📊 Analytics",
        tabOrders: "📦 Orders",
        tabProducts: "🛠 Parts Inventory",
        tabStories: "📱 Stories",
        tabCrm: "👥 Customer Base",
        tabBroadcast: "📢 Broadcast",
        totalRevenue: "Total Revenue",
        totalOrders: "Total Orders",
        deliveredOrders: "Delivered Orders",
        activeCustomers: "Active Customers",
        realtime: "Calculated in real-time",
        ordersManage: "Orders Journal & Management",
        ordersDesc: "Track new incoming customer orders and change statuses",
        all: "All",
        pending: "Pending",
        processing: "Processing",
        ready: "Ready",
        delivered: "Delivered",
        cancelled: "Cancelled",
        searchOrderPlaceholder: "Order ID, customer name or phone...",
        receipt: "🧾 Receipt",
        itemsList: "Purchased parts",
        totalSum: "Total payment:",
        printReceipt: "Print 🖨",
        close: "Close",
        partsCatalog: "Parts Catalog & Inventory",
        partsDesc: "Add parts and edit prices directly in the live table",
        searchPartPlaceholder: "Search parts...",
        addNewPart: "+ New Part",
        edit: "Edit",
        delete: "Delete",
        quickPriceDesc: "Quick Price Editor",
        photoHeader: "Photo",
        partNameHeader: "Part Name & Category",
        featuresHeader: "Description & Specs",
        actionsHeader: "Actions",
        storiesHub: "📱 Telegram Mini App Stories",
        storiesDesc: "Manage promos and stories displayed at the top of the Mini App",
        addNewStory: "+ Add New Story",
        noStories: "No stories available yet.",
        crmHub: "Customer Base (CRM)",
        crmDesc: "All Telegram users registered in your shop",
        broadcastHub: "Broadcast Message to All 📢",
        broadcastDesc: "Send instant notifications about discounts to all users via bot.",
        photoUrlOptional: "Photo URL (Optional)",
        broadcastMsgLabel: "Message Text (HTML tags supported)",
        broadcastPlaceholder: "⚡️ SPECIAL OFFER! 25% discount on M-Sport wheels!",
        sendBroadcast: "🚀 Send to All Users",
        sending: "Sending...",
        modalNewProduct: "Add Auto Part",
        modalEditProduct: "Edit Auto Part",
        productName: "Product Name",
        categoryCarModel: "Category (Car Model)",
        newPrice: "New Price (UZS)",
        oldPrice: "Old Price (UZS, for discount display)",
        photoPhoneOrUrl: "Part Photo (From phone or URL)",
        photoFromPhone: "Select photo from phone",
        photoHint: "Upload from gallery or camera",
        photoSelected: "✅ Photo selected (Click to change)",
        shortDesc: "Short Description",
        featuresInput: "Specs & Features (each line is a point)",
        cancel: "Cancel",
        save: "Save",
        modalNewStory: "📱 Add New Story",
        storyTitle: "Title",
        storyTag: "Tag (Badge)",
        tagNew: "New",
        tagDiscount: "Discount",
        tagPromo: "Promo",
        tagService: "Service",
        tagOriginal: "Original",
        tagTop: "Top",
        storyPhoto: "Story Photo (From phone or URL)",
        publishStory: "Save & Publish",
        tabSettings: "⚙️ Settings",
        settingsTitle: "Store Settings & Details",
        settingsDesc: "Manage card number, phone, social networks, and store address",
        paymentDetailsHeader: "💳 Payment Details (Card)",
        cardNumberLabel: "Card Number (Uzcard / Humo / Visa)",
        cardHolderLabel: "Card Holder Name",
        contactHeader: "📞 Contacts",
        storePhoneLabel: "Store / Admin Phone Number",
        socialHeader: "🌐 Official Pages & Social Networks",
        instagramUrlLabel: "Instagram Link",
        youtubeUrlLabel: "YouTube Channel Link",
        storeLocationHeader: "🏬 Store Address & Hours (Pickup)",
        storeAddressLabel: "Store Address (for pickup)",
        storeHoursLabel: "Working Hours",
        saveSettings: "Save Settings 💾",
        settingsSaved: "Settings saved successfully! ✅"
      }
    };

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
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch(e) {}
    }

    function AdminApp() {
      const [lang, setLang] = useState(localStorage.getItem('kuzavnoy_admin_lang') || 'uz');
      const [theme, setTheme] = useState(localStorage.getItem('kuzavnoy_admin_theme') || 'dark');
      const [tab, setTab] = useState("dashboard"); // dashboard | orders | products | stories | crm | broadcast | settings
      const [orders, setOrders] = useState([]);
      const [products, setProducts] = useState([]);
      const [users, setUsers] = useState([]);
      const [stories, setStories] = useState([]);
      const [loading, setLoading] = useState(false);
      const [isRefreshing, setIsRefreshing] = useState(false);
      const [refreshToast, setRefreshToast] = useState(false);
      const [soundEnabled, setSoundEnabled] = useState(true);

      // Davriy analitika filtri
      const [analyticsPeriod, setAnalyticsPeriod] = useState("all");

      // Sozlamalar holati
      const [settings, setSettings] = useState({
        card_number: "8600 5304 1234 5678",
        card_holder: "AZIMXON (KUZAVNOY.UZZ)",
        uzcard_number: "8600 5304 1234 5678",
        uzcard_holder: "AZIMXON (KUZAVNOY.UZZ)",
        humo_number: "9860 1201 5678 4321",
        humo_holder: "AZIMXON (KUZAVNOY.UZZ)",
        visa_number: "",
        visa_holder: "AZIMXON (KUZAVNOY.UZZ)",
        phone: "+998 90 123 45 67",
        phone2: "+998 97 765 43 21",
        phone3: "+998 99 888 77 66",
        uzcard_active: true,
        humo_active: true,
        visa_active: false,
        phone1_active: true,
        phone2_active: true,
        phone3_active: true,
        instagram_url: "https://instagram.com/kuzavnoy.uzz",
        youtube_url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G",
        store_address: "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori",
        store_hours: "09:00 - 19:00"
      });

      const handleAdminRefresh = async () => {
        setIsRefreshing(true);
        try {
          await Promise.all([fetchOrders(), fetchProducts(), fetchUsers(), fetchStories(), fetchSettings(), fetchCategories()]);
          setRefreshToast(true);
          setTimeout(() => setRefreshToast(false), 3000);
        } catch(e) {
          console.error('Refresh error:', e);
        } finally {
          setIsRefreshing(false);
        }
      };
      const [settingsSaving, setSettingsSaving] = useState(false);
      const [settingsMessage, setSettingsMessage] = useState("");

      const t = (key) => (ADMIN_I18N[lang] && ADMIN_I18N[lang][key]) || (ADMIN_I18N['uz'] && ADMIN_I18N['uz'][key]) || key;

      const changeLang = (l) => {
        setLang(l);
        localStorage.setItem('kuzavnoy_admin_lang', l);
      };

      const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('kuzavnoy_admin_theme', next);
      };

      // Buyurtmalar filtrlari
      const [orderSearch, setOrderSearch] = useState("");
      const [orderStatusFilter, setOrderStatusFilter] = useState("Barchasi");
      const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);

      // Mahsulotlar filtrlari
      const [productSearch, setProductSearch] = useState("");
      const [productCategoryFilter, setProductCategoryFilter] = useState("Barchasi");

      // Mahsulot Modal
      const [showProductModal, setShowProductModal] = useState(false);
      const [categories, setCategories] = useState([]);
      const [showCategoryModal, setShowCategoryModal] = useState(false);
      const [newCategoryName, setNewCategoryName] = useState("");
      const [newCategoryIcon, setNewCategoryIcon] = useState("🚗");
      const [editingProduct, setEditingProduct] = useState(null);
      const [productImagePreview, setProductImagePreview] = useState("");
      const [formData, setFormData] = useState({
        name: "", category: "Cobalt", new_price: "", old_price: "",
        image_url: "", description: "", detailsText: "", condition: "Yangi",
        stock: "10", color: "Universal", car_model: "Cobalt"
      });

      // Istoriyalar Modal
      const [showStoryModal, setShowStoryModal] = useState(false);
      const [storyImagePreview, setStoryImagePreview] = useState("");
      const [storySaving, setStorySaving] = useState(false);
      const [storyFormData, setStoryFormData] = useState({
        title: "", tag: "Yangi", description: "", image_url: ""
      });

      // Broadcast form
      const [broadcastMsg, setBroadcastMsg] = useState("");
      const [broadcastPhoto, setBroadcastPhoto] = useState("");
      const [broadcastSending, setBroadcastSending] = useState(false);
      const [broadcastResult, setBroadcastResult] = useState(null);

      const handleImageUpload = (file, onSuccess) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxDim = 800;
            if (width > height && width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            onSuccess(dataUrl);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };

      useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) { tg.ready(); tg.expand(); }
        loadAllData();
        const interval = setInterval(checkForNewOrders, 5000);
        return () => clearInterval(interval);
      }, []);

      const loadAllData = async () => {
        setLoading(true);
        await Promise.all([fetchOrders(), fetchProducts(), fetchUsers(), fetchStories(), fetchSettings()]);
        setLoading(false);
      };

      const fetchOrders = async () => {
        try {
          const res = await fetch("/api/orders");
          const data = await res.json();
          if (Array.isArray(data)) setOrders(data);
        } catch(e) {}
      };

      const checkForNewOrders = async () => {
        try {
          const res = await fetch("/api/orders");
          const data = await res.json();
          if (Array.isArray(data)) {
            setOrders(prev => {
              if (prev.length > 0 && data.length > prev.length) {
                if (soundEnabled) playChime();
              }
              return data;
            });
          }
        } catch(e) {}
      };

      const fetchProducts = async () => {
        try {
          const res = await fetch("/api/products");
          const data = await res.json();
          if (Array.isArray(data)) setProducts(data);
        } catch(e) {}
      };

      const fetchUsers = async () => {
        try {
          const res = await fetch("/api/users");
          const data = await res.json();
          if (Array.isArray(data)) setUsers(data);
        } catch(e) {}
      };

      const fetchStories = async () => {
        try {
          const res = await fetch("/api/stories");
          const data = await res.json();
          if (Array.isArray(data)) setStories(data);
        } catch(e) {}
      };

      const fetchSettings = async () => {
        try {
          const res = await fetch("/api/settings");
          const data = await res.json();
          if (data && data.card_number) {
            setSettings(data);
          }
        } catch(e) {}
      };

      const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSettingsSaving(true);
        setSettingsMessage('');
        try {
          const res = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings)
          });
          const data = await res.json();
          if (data && data.card_number) {
            setSettings(data);
            setSettingsMessage(t('settingsSaved'));
            setTimeout(() => setSettingsMessage(''), 4000);
          }
        } catch(err) {
          alert("Xatolik: " + err.message);
        } finally {
          setSettingsSaving(false);
        }
      };

      const handleSaveStory = async (e) => {
        e.preventDefault();
        if (!storyFormData.title.trim() || !storyFormData.image_url) {
          alert("Iltimos, sarlavha va rasm kiriting!");
          return;
        }
        setStorySaving(true);
        try {
          const res = await fetch("/api/stories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(storyFormData)
          });
          if (res.ok) {
            setShowStoryModal(false);
            setStoryFormData({ title: "", tag: "Yangi", description: "", image_url: "" });
            setStoryImagePreview("");
            fetchStories();
          } else {
            alert("Saqlashda xatolik yuz berdi!");
          }
        } catch(err) {
          alert("Xatolik: " + err.message);
        } finally {
          setStorySaving(false);
        }
      };

      const handleDeleteStory = async (id) => {
        if (!confirm("Haqiqatdan ham bu istoriyani o'chirmoqchimisiz?")) return;
        try {
          await fetch("/api/stories/" + id, { method: "DELETE" });
          fetchStories();
        } catch(err) {
          alert("O'chirishda xatolik!");
        }
      };

      const updateOrderStatus = async (id, status) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        try {
          await fetch("/api/orders/" + id + "/status", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
          });
          fetchOrders();
        } catch(e) {
          fetchOrders();
          alert("Holatni yangilashda xatolik!");
        }
      };

      // Professional 80mm POS Thermal Chek Chop Etish (Task 1)
      const printThermalReceipt = (o) => {
              var itemsRows = "";
              (Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items || '[]') : [])).forEach(function(it, idx) {
                var q = it.quantity || 1;
                var pr = it.new_price || 0;
                var total = q * pr;
                itemsRows += "<tr>" +
                  "<td style='padding: 6px 0; border-bottom: 1px dashed #cbd5e1;'>" +
                    "<div style='font-weight: bold; font-size: 12px;'>" + (idx + 1) + ". " + it.name + "</div>" +
                    "<div style='font-size: 11px; color: #64748b;'>" + q + " dona × " + pr.toLocaleString() + " so'm</div>" +
                  "</td>" +
                  "<td style='padding: 6px 0; text-align: right; font-weight: bold; font-size: 12px; border-bottom: 1px dashed #cbd5e1; vertical-align: top;'>" +
                    total.toLocaleString() + " so'm" +
                  "</td>" +
                "</tr>";
              });
      
              var dText = o.delivery_type === "pickup" ? "Do'kondan olib ketish (Samovivoz)" : "Kuryer orqali yetkazish";
              var pText = o.payment_method === "card" ? "Karta / Visa / Click (Oldindan to'lov)" : "Naqd to'lov";
      
              var receiptDoc = "<!DOCTYPE html>" +
                "<html><head><meta charset='utf-8'><title>Chek #" + o.id + " - kuzavnoy.uzz</title>" +
                "<style>" +
                "@page { size: 80mm auto; margin: 3mm; }" +
                "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 12px; color: #0f172a; background: #fff; font-size: 12px; line-height: 1.4; }" +
                ".ticket { max-width: 360px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }" +
                ".center { text-align: center; }" +
                ".divider { border-top: 1px dashed #94a3b8; margin: 10px 0; }" +
                ".total-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }" +
                "@media print { body { padding: 0; } .ticket { border: none; box-shadow: none; padding: 0; max-width: 100%; } .no-print { display: none !important; } }" +
                "</style></head><body>" +
                "<div class='ticket'>" +
                "<div class='center'>" +
                  "<div style='font-size: 18px; font-weight: 900;'>🚗 kuzavnoy.uzz</div>" +
                  "<div style='font-size: 11px; color: #475569; margin-top: 2px;'>Avto Ehtiyot Qismlar Do'koni</div>" +
                  "<div style='font-size: 10px; color: #64748b; margin-top: 2px;'>" + (settings.store_address || "Toshkent sh., Farhod avto bozori") + "</div>" +
                  "<div style='font-size: 10px; color: #64748b;'>Tel: " + (settings.phone || "+998 90 123 45 67") + (settings.phone2 ? " • " + settings.phone2 : "") + (settings.phone3 ? " • " + settings.phone3 : "") + " | @kuzavnoyuz_bot</div>" +
                "</div>" +
                "<div class='divider'></div>" +
                "<div style='display: flex; justify-content: space-between; font-size: 11px;'>" +
                  "<span><b>Buyurtma:</b> #" + o.id + "</span>" +
                  "<span>" + new Date(o.created_at).toLocaleString('uz-UZ') + "</span>" +
                "</div>" +
                "<div class='divider'></div>" +
                "<div style='font-size: 11px; line-height: 1.5;'>" +
                  "<div><b>Mijoz:</b> " + o.customer_name + "</div>" +
                  "<div><b>Telefon:</b> " + o.phone + "</div>" +
                  "<div><b>Yetkazish turi:</b> " + dText + "</div>" +
                  "<div><b>Manzil:</b> " + (o.location || "Ko'rsatilmagan") + "</div>" +
                  "<div><b>To'lov usuli:</b> " + pText + "</div>" +
                  "<div><b>Holati:</b> " + o.status + "</div>" +
                "</div>" +
                "<div class='divider'></div>" +
                "<table style='width: 100%; border-collapse: collapse;'>" +
                  "<thead>" +
                    "<tr style='border-bottom: 2px solid #0f172a; font-size: 10px; text-transform: uppercase; color: #475569;'>" +
                      "<th style='text-align: left; padding-bottom: 4px;'>Detal</th>" +
                      "<th style='text-align: right; padding-bottom: 4px;'>Summa</th>" +
                    "</tr>" +
                  "</thead>" +
                  "<tbody>" + itemsRows + "</tbody>" +
                "</table>" +
                "<div class='total-box'>" +
                  "<span style='font-size: 12px; font-weight: 800;'>JAMI TO'LOV:</span>" +
                  "<span style='font-size: 15px; font-weight: 900; color: #dc2626;'>" + (o.total_price || 0).toLocaleString() + " so'm</span>" +
                "</div>" +
                "<div style='margin-top: 12px; padding: 10px; border: 1px dashed #94a3b8; border-radius: 8px; text-align: center; background: #f8fafc;'>" +
                  "<div style='font-size: 11px; font-weight: 800; color: #047857; margin-bottom: 4px;'>🟢 1% KESHBEK (SOLIQ.UZ)</div>" +
                  "<img src='https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=2&data=" + encodeURIComponent("https://soliq.uz/cashback?order=" + o.id + "&sum=" + (o.total_price || 0) + "&fiscal=KZV" + o.id) + "' style='width: 110px; height: 110px; margin: 4px auto; display: block; border-radius: 4px;' />" +
                  "<div style='font-size: 9px; color: #64748b; font-family: monospace; margin-top: 3px;'>Fiskal belgi: KZV-" + o.id + "-" + new Date().getFullYear() + "</div>" +
                  "<div style='font-size: 8.5px; color: #475569; margin-top: 2px;'>Soliq ilovasida skanerlab 1% keshbek oling</div>" +
                "</div>" +
                "<div class='center' style='margin-top: 12px; font-size: 10px; color: #64748b;'>Xaridingiz uchun rahmat! Salomat bo'ling! 🚗💨</div>" +
                "<div class='no-print' style='margin-top: 15px; display: flex; gap: 8px;'>" +
                  "<button onclick='window.print()' style='flex: 1; padding: 10px; background: #dc2626; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;'>Chop etish 🖨</button>" +
                  "<button onclick='window.close()' style='padding: 10px 15px; background: #e2e8f0; color: #334155; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;'>Yopish</button>" +
                "</div>" +
                "</div>" +
                "<script>" +
                  "setTimeout(function() { window.print(); }, 400);" +
                "<" + "/script>" +
                "</body></html>";
      
              var printWin = null;
              try {
                printWin = window.open('', '_blank', 'width=450,height=700');
              } catch(e) {}
      
              if (printWin && printWin.document) {
                printWin.document.open();
                printWin.document.write(receiptDoc);
                printWin.document.close();
              } else {
                var iframe = document.getElementById('thermalReceiptFrame');
                if (!iframe) {
                  iframe = document.createElement('iframe');
                  iframe.id = 'thermalReceiptFrame';
                  iframe.style.position = 'fixed';
                  iframe.style.right = '0';
                  iframe.style.bottom = '0';
                  iframe.style.width = '0';
                  iframe.style.height = '0';
                  iframe.style.border = 'none';
                  document.body.appendChild(iframe);
                }
                var fDoc = iframe.contentWindow || iframe.contentDocument;
                var doc = fDoc.document || fDoc;
                doc.open();
                doc.write(receiptDoc);
                doc.close();
                setTimeout(function() {
                  try {
                    (iframe.contentWindow || iframe).focus();
                    (iframe.contentWindow || iframe).print();
                  } catch(e) {}
                }, 400);
              }
            };

      const handleDeleteOrder = async (id) => {
        if (!confirm("Haqiqatdan ham #" + id + " raqamli bekor qilingan buyurtmani bazadan o'chirmoqchimisiz? (Do'kondagi mahsulotlarga ta'sir qilmaydi)")) return;
        try {
          const res = await fetch("/api/orders/" + id, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            fetchOrders();
          } else {
            alert(data.error || "O'chirishda xatolik yuz berdi");
          }
        } catch(e) {
          alert("Xatolik: " + e.message);
        }
      };

      const handleSaveProduct = async (e) => {
        e.preventDefault();
        try {
          const payload = {
            name: formData.name,
            category: formData.category,
            new_price: parseInt(formData.new_price),
            old_price: formData.old_price ? parseInt(formData.old_price) : 0,
            image_url: formData.image_url,
            description: formData.description,
            condition: formData.condition || "Yangi",
            details: formData.detailsText.split("\\n").filter(Boolean),
            stock: parseInt(formData.stock) || 0,
            color: formData.color || "Universal",
            car_model: formData.car_model || formData.category || "Cobalt"
          };

          const url = editingProduct ? "/api/products/" + editingProduct.id : "/api/products";
          const method = editingProduct ? "PUT" : "POST";

          await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          setShowProductModal(false);
          setEditingProduct(null);
          setProductImagePreview("");
          fetchProducts();
        } catch(e) {
          alert("Saqlashda xatolik!");
        }
      };

      const handleQuickPrice = async (prod, newPrice) => {
        const val = parseInt(newPrice);
        if (isNaN(val) || val <= 0) return;
        try {
          await fetch("/api/products/" + prod.id + "/quick-price", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_price: val, old_price: prod.old_price })
          });
          fetchProducts();
        } catch(e) {}
      };

      const handleDeleteProduct = async (id) => {
        if (!confirm("Rostdan ham ushbu ehtiyot qismni o'chirmoqchimisiz?")) return;
        try {
          await fetch("/api/products/" + id, { method: "DELETE" });
          fetchProducts();
        } catch(e) {
          alert("O'chirishda xatolik!");
        }
      };

      const handleSendBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastMsg.trim()) return alert("Xabar matnini kiriting!");
        if (!confirm("Haqiqatdan ham barcha Telegram foydalanuvchilariga xabar yuborilsinmi?")) return;

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
            setBroadcastResult("✅ Xabar " + data.sentCount + " ta mijozga muvaffaqiyatli yuborildi!");
            setBroadcastMsg("");
            setBroadcastPhoto("");
          }
        } catch(e) {
          setBroadcastResult("❌ Xabar yuborishda xatolik yuz berdi!");
        } finally {
          setBroadcastSending(false);
        }
      };

      // Davriy analitika hisobi (Aniq sanalar kesimida)
      const periodOrders = useMemo(() => {
        const now = new Date();
        const nowTime = now.getTime();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = nowTime - (7 * 24 * 60 * 60 * 1000);
        const startOfMonth = nowTime - (30 * 24 * 60 * 60 * 1000);
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

        return orders.filter(o => {
          if (analyticsPeriod === 'all') return true;
          const orderTime = new Date(o.created_at).getTime();
          if (analyticsPeriod === 'today') return orderTime >= startOfToday;
          if (analyticsPeriod === 'week') return orderTime >= startOfWeek;
          if (analyticsPeriod === 'month') return orderTime >= startOfMonth;
          if (analyticsPeriod === 'year') return orderTime >= startOfYear;
          return true;
        });
      }, [orders, analyticsPeriod]);

      const totalRevenue = useMemo(() => periodOrders.reduce((sum, o) => sum + (o.total_price || 0), 0), [periodOrders]);
      const pendingOrders = useMemo(() => periodOrders.filter(o => o.status === "Kutilmoqda"), [periodOrders]);
      const deliveredOrders = useMemo(() => periodOrders.filter(o => o.status === "Yetkazildi"), [periodOrders]);
      const periodAvgTicket = useMemo(() => periodOrders.length > 0 ? Math.round(totalRevenue / periodOrders.length) : 0, [totalRevenue, periodOrders]);

      const filteredOrders = useMemo(() => {
        return orders.filter(o => {
          const matchStatus = orderStatusFilter === "Barchasi" || o.status === orderStatusFilter;
          const searchLower = orderSearch.toLowerCase();
          const matchSearch = !orderSearch || 
            String(o.id).includes(searchLower) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(searchLower)) ||
            (o.phone && o.phone.includes(searchLower)) ||
            (o.location && o.location.toLowerCase().includes(searchLower));
          return matchStatus && matchSearch;
        });
      }, [orders, orderStatusFilter, orderSearch]);

      const filteredProducts = useMemo(() => {
        return products.filter(p => {
          const matchCat = productCategoryFilter === "Barchasi" || p.category === productCategoryFilter;
          const matchSearch = !productSearch || 
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()));
          return matchCat && matchSearch;
        });
      }, [products, productCategoryFilter, productSearch]);

      const isDark = theme === 'dark';

      return (
        <div className={'min-h-screen transition-colors duration-200 flex flex-col ' + 
          (isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900')}>
          
          {/* YANGILASH XABARI (TOAST) */}
          {refreshToast && (
            <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-400/40 animate-bounce">
              <span>✅</span>
              <span>Barcha ma'lumotlar muvaffaqiyatli yangilandi!</span>
            </div>
          )}
          
          {/* HEADER */}
          <header className={'sticky top-0 z-30 px-3 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b backdrop-blur ' + 
            (isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200')}>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-red-950/40">
                🚗
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-tight">kuzavnoy.uzz</h1>
                  <span className={'px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ' + 
                    (isDark ? 'bg-red-600/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200')}>
                    Pro Dashboard
                  </span>
                </div>
                <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('controlHub')}</p>
              </div>
            </div>

            {/* CONTROLS: SOUND + LANG + THEME + REFRESH */}
            <div className="flex items-center gap-2">
              
              {/* 3 Til Selektori */}
              <div className={'flex items-center p-1 rounded-xl border text-xs font-bold ' + 
                (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}>
                {[
                  { code: 'uz', label: '🇺🇿 UZ' },
                  { code: 'ru', label: '🇷🇺 RU' },
                  { code: 'en', label: '🇬🇧 EN' }
                ].map(item => (
                  <button
                    key={item.code}
                    onClick={() => changeLang(item.code)}
                    className={'px-2 py-0.5 rounded-lg transition ' + 
                      (lang === item.code ? 'bg-red-600 text-white font-black shadow' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Tun / Kun tugmasi */}
              <button 
                onClick={toggleTheme}
                className={'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ' + 
                  (isDark ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm')}
              >
                <span>{isDark ? '☀️ ' + t('themeLight') : '🌙 ' + t('themeDark')}</span>
              </button>

              {/* Ovoz */}
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={'hidden sm:flex px-2.5 py-1.5 rounded-xl text-xs font-bold border transition items-center gap-1 ' + 
                  (soundEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'))}
              >
                <span>{soundEnabled ? t('soundOn') : t('soundOff')}</span>
              </button>

              {/* Refresh */}
              <button 
                onClick={handleAdminRefresh}
                disabled={isRefreshing}
                title="Barcha ma'lumotlarni yangilash"
                className={'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 active:scale-95 ' + 
                  (isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm')}
              >
                <span>{t('refresh')}</span> 
                <span className={isRefreshing ? 'inline-block animate-spin text-red-500' : ''}>🔄</span>
              </button>
            </div>
          </header>

          {/* NAVIGATION TABS */}
          <div className={'border-b px-4 md:px-8 overflow-x-auto no-scrollbar ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
            <div className="flex gap-1 max-w-7xl mx-auto py-2">
              {[
                { id: "dashboard", label: t('tabDashboard'), count: null },
                { id: "orders", label: t('tabOrders'), count: pendingOrders.length ? pendingOrders.length : orders.length },
                { id: "products", label: t('tabProducts'), count: products.length },
                { id: "stories", label: t('tabStories'), count: stories.length },
                { id: "crm", label: t('tabCrm'), count: users.length },
                { id: "broadcast", label: t('tabBroadcast'), count: "Bot" },
                { id: "settings", label: t('tabSettings'), count: null }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ' + 
                    (tab === item.id 
                      ? 'bg-red-600 text-white shadow-lg shadow-red-950/40' 
                      : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'))}
                >
                  <span>{item.label}</span>
                  {item.count !== null && (
                    <span className={'text-[10px] px-1.5 py-0.2 rounded-full ' + 
                      (tab === item.id ? 'bg-black/25 text-white' : (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'))}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* CONTENT AREA */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
            
            {/* 1. DASHBOARD & ANALITIKA */}
            {tab === "dashboard" && (
              <div className="space-y-5">
                {/* DAVRIY ANALITIKA FILTRLARI (Task 5) */}
                <div className={'p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ' + (isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <div>
                      <span className="text-xs font-black block leading-tight">Davriy Tushum & Chiqim Tahlili</span>
                      <span className={'text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Tanlangan davr bo'yicha real ko'rsatkichlar</span>
                    </div>
                  </div>
                  <div className={'flex items-center p-1 rounded-xl border text-xs font-bold gap-1 ' + (isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200')}>
                    {[
                      { id: 'today', label: 'Kunlik (Bugun)' },
                      { id: 'week', label: 'Haftalik' },
                      { id: 'month', label: 'Oylik' },
                      { id: 'year', label: 'Yillik' },
                      { id: 'all', label: 'Barchasi' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAnalyticsPeriod(p.id)}
                        className={'px-3 py-1 rounded-lg transition ' + 
                          (analyticsPeriod === p.id 
                            ? 'bg-red-600 text-white shadow font-black' 
                            : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'))}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  <div className={'border rounded-3xl p-5 shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                    <span className={'text-xs font-semibold uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>💰 Jami Tushum (Kassa)</span>
                    <h3 className="text-2xl md:text-3xl font-black text-emerald-500 mt-2">
                      {totalRevenue.toLocaleString()} <span className={'text-xs font-bold ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>so'm</span>
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 mt-2">
                      <span>↗ {analyticsPeriod === 'today' ? 'Bugungi' : (analyticsPeriod === 'week' ? 'Haftalik' : (analyticsPeriod === 'month' ? 'Oylik' : (analyticsPeriod === 'year' ? 'Yillik' : 'Barcha davr')))}</span>
                    </div>
                  </div>

                  <div className={'border rounded-3xl p-5 shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                    <span className={'text-xs font-semibold uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>📦 Buyurtmalar Soni</span>
                    <h3 className="text-2xl md:text-3xl font-black mt-2">
                      {periodOrders.length} <span className={'text-xs font-bold ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>ta</span>
                    </h3>
                    <span className={'text-xs mt-2 block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {deliveredOrders.length} {t('deliveredOrders')}
                    </span>
                  </div>

                  <div className={'border rounded-3xl p-5 shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                    <span className={'text-xs font-semibold uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>📉 Chiqim (Xarajatlar ~70%)</span>
                    <h3 className="text-2xl md:text-3xl font-black text-rose-500 mt-2">
                      {Math.round(totalRevenue * 0.7).toLocaleString()} <span className={'text-xs font-bold ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>so'm</span>
                    </h3>
                    <span className={'text-xs mt-2 block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Ehtiyot qismlar tan narxi</span>
                  </div>

                  <div className={'border rounded-3xl p-5 shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                    <span className={'text-xs font-semibold uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>📈 Sof Foyda (~30%)</span>
                    <h3 className="text-2xl md:text-3xl font-black text-indigo-500 mt-2">
                      {Math.round(totalRevenue * 0.3).toLocaleString()} <span className={'text-xs font-bold ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>so'm</span>
                    </h3>
                    <span className={'text-xs mt-2 block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>O'rtacha chek: {periodAvgTicket.toLocaleString()} so'm</span>
                  </div>
                </div>

                {/* Tanlangan davr holat ko'rsatkichlari */}
                <div className={'p-4 rounded-3xl border flex flex-wrap items-center justify-between gap-3 ' + (isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Holatlar taqsimoti ({periodOrders.length} ta):</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                      Yetkazildi: {periodOrders.filter(o => o.status === 'Yetkazildi').length} ta
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-sky-500/10 border border-sky-500/30 text-sky-500">
                      Jarayonda: {periodOrders.filter(o => o.status === 'Jarayonda').length} ta
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-500">
                      Tayyorlandi: {periodOrders.filter(o => o.status === 'Tayyorlandi').length} ta
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-500">
                      Kutilmoqda: {periodOrders.filter(o => o.status === 'Kutilmoqda').length} ta
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-500">
                      Bekor qilindi: {periodOrders.filter(o => o.status === 'Bekor qilindi').length} ta
                    </span>
                  </div>
                </div>

                {/* Tanlangan davr buyurtmalari jadvali */}
                <div className={'border rounded-3xl overflow-hidden shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm">📋 Tanlangan davr buyurtmalari jurnali</span>
                      <span className="text-[10px] bg-red-600/20 text-red-500 font-bold px-2 py-0.5 rounded-full">{periodOrders.length} ta</span>
                    </div>
                    <button onClick={() => setTab("orders")} className="text-xs font-bold text-red-500 hover:underline">Barcha buyurtmalar jurnali →</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className={'border-b uppercase text-[10px] ' + (isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                        <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">Mijoz</th>
                          <th className="p-3">Telefon</th>
                          <th className="p-3">Summa</th>
                          <th className="p-3">Holat</th>
                          <th className="p-3">Sana & Vaqt</th>
                        </tr>
                      </thead>
                      <tbody className={'divide-y ' + (isDark ? 'divide-slate-800' : 'divide-slate-200')}>
                        {periodOrders.length === 0 ? (
                          <tr><td colSpan="6" className="p-8 text-center text-slate-400">Ushbu davrda buyurtmalar mavjud emas</td></tr>
                        ) : (
                          periodOrders.map(o => (
                            <tr key={o.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                              <td className="p-3 font-mono font-bold">#{o.id}</td>
                              <td className="p-3 font-bold">{o.customer_name}</td>
                              <td className="p-3 font-mono">{o.phone}</td>
                              <td className="p-3 font-black text-emerald-500">{o.total_price?.toLocaleString()} so'm</td>
                              <td className="p-3">
                                <span className={'text-[10px] font-black px-2 py-0.5 rounded-md ' + 
                                  (o.status === 'Yetkazildi' ? 'bg-emerald-500/20 text-emerald-400' : 
                                  (o.status === 'Jarayonda' ? 'bg-sky-500/20 text-sky-400' : 
                                  (o.status === 'Bekor qilindi' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400')))}>
                                  {o.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 whitespace-nowrap">{new Date(o.created_at).toLocaleString('uz-UZ')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BUYURTMALAR (ORDERS) */}
            {tab === "orders" && (
              <div className={'border rounded-3xl overflow-hidden shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                <div className={'p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                  <div>
                    <h2 className="text-lg font-black">{t('ordersManage')}</h2>
                    <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('ordersDesc')}</p>
                  </div>
                  <input 
                    type="text"
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    placeholder={t('searchOrderPlaceholder')}
                    className={'px-3.5 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                      (isDark ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400')}
                  />
                </div>

                {/* Status Filtrlar (Bo'limlar) */}
                <div className={'px-6 py-2.5 border-b flex gap-2 overflow-x-auto no-scrollbar ' + (isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  {["Barchasi", "Kutilmoqda", "Jarayonda", "Tayyorlandi", "Yetkazildi", "Bekor qilindi"].map(st => {
                    const count = st === "Barchasi" ? orders.length : orders.filter(o => o.status === st).length;
                    let emoji = "📋";
                    let label = st;
                    if (st === "Barchasi") { emoji = "📋"; label = t('all'); }
                    else if (st === "Kutilmoqda") { emoji = "🟡"; label = t('pending'); }
                    else if (st === "Jarayonda") { emoji = "🔵"; label = t('processing'); }
                    else if (st === "Tayyorlandi") { emoji = "📦"; label = t('ready') || "Tayyorlandi"; }
                    else if (st === "Yetkazildi") { emoji = "🟢"; label = t('delivered'); }
                    else if (st === "Bekor qilindi") { emoji = "🔴"; label = t('cancelled'); }

                    return (
                      <button
                        key={st}
                        onClick={() => setOrderStatusFilter(st)}
                        className={'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ' + 
                          (orderStatusFilter === st 
                            ? (isDark ? 'bg-slate-800 text-white border border-slate-700 shadow-sm' : 'bg-white text-slate-900 border border-slate-300 shadow-sm') 
                            : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}
                      >
                        <span>{emoji}</span>
                        <span>{label}</span>
                        <span className={'px-1.5 py-0.2 rounded-full text-[10px] font-black ' + 
                          (orderStatusFilter === st 
                            ? (isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-900') 
                            : (isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500'))}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Jadval */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={'border-b uppercase text-[10px] tracking-wider ' + (isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                      <tr>
                        <th className="p-4">ID & Sana</th>
                        <th className="p-4">Mijoz & Manzil</th>
                        <th className="p-4">{t('itemsList')}</th>
                        <th className="p-4">Summa</th>
                        <th className="p-4">Holati</th>
                        <th className="p-4 text-right">{t('actionsHeader')}</th>
                      </tr>
                    </thead>
                    <tbody className={'divide-y ' + (isDark ? 'divide-slate-800' : 'divide-slate-200')}>
                      {filteredOrders.length === 0 ? (
                        <tr><td colSpan="6" className="p-8 text-center text-slate-500">Buyurtmalar topilmadi</td></tr>
                      ) : (
                        filteredOrders.map(order => (
                          <tr key={order.id} className={'transition ' + (isDark ? 'hover:bg-slate-850' : 'hover:bg-slate-50')}>
                            <td className="p-4 whitespace-nowrap">
                              <span className="font-extrabold text-red-500">#{order.id}</span>
                              <div className={'text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{new Date(order.created_at).toLocaleString()}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold">{order.customer_name}</div>
                              <div className="text-[11px] font-mono text-slate-500">{order.phone}</div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold ' + 
                                  (order.delivery_type === 'pickup' 
                                    ? (isDark ? 'bg-purple-950/70 text-purple-300 border border-purple-800/40' : 'bg-purple-100 text-purple-800') 
                                    : (isDark ? 'bg-blue-950/70 text-blue-300 border border-blue-800/40' : 'bg-blue-100 text-blue-800'))}>
                                  {order.delivery_type === 'pickup' ? "🏬 Samovivoz" : "🚚 Dastavka"}
                                </span>
                                <span className={'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold ' + 
                                  (order.payment_method === 'card' 
                                    ? (isDark ? 'bg-amber-950/70 text-amber-300 border border-amber-800/40' : 'bg-amber-100 text-amber-800') 
                                    : (isDark ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40' : 'bg-emerald-100 text-emerald-800'))}>
                                  {order.payment_method === 'card' ? "💳 Karta/Visa" : "💵 Naqd"}
                                </span>
                              </div>
                              <div className={'text-[10px] mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                                {(() => {
                                  if (!order.location) return "—";
                                  if (order.location.indexOf('http') === -1) {
                                    return <span className="line-clamp-1">{order.location}</span>;
                                  }
                                  var parts = order.location.split(' | 🗺 Xarita: ');
                                  var cleanLoc = parts[0] || 'Manzil';
                                  var mapUrl = parts.length > 1 ? parts[1] : (order.location.indexOf('http') === 0 ? order.location : order.location.slice(order.location.indexOf('http')));
                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="line-clamp-1">{cleanLoc}</span>
                                      {mapUrl && (
                                        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 font-bold hover:underline">
                                          <span>📍 Xaritada ochish (GPS) ↗</span>
                                        </a>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="p-4 max-w-xs">
                              {(Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : [])).map((it, idx) => (
                                <div key={idx} className={'truncate text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                                  • {it.name} x {it.quantity || 1}
                                </div>
                              ))}
                            </td>
                            <td className="p-4 font-black text-emerald-500 whitespace-nowrap">
                              {order.total_price.toLocaleString()} so'm
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <select 
                                value={order.status}
                                onChange={e => updateOrderStatus(order.id, e.target.value)}
                                className={'text-xs font-bold rounded-lg px-2 py-1 border focus:outline-none ' + 
                                  (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                              >
                                <option value="Kutilmoqda">🟡 {t('pending')}</option>
                                <option value="Jarayonda">🔵 {t('processing')}</option>
                                <option value="Tayyorlandi">📦 {t('ready') || "Tayyorlandi"}</option>
                                <option value="Yetkazildi">🟢 {t('delivered')}</option>
                                <option value="Bekor qilindi">🔴 {t('cancelled')}</option>
                              </select>
                            </td>
                            <td className="p-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {(order.status === "Yetkazildi" || order.status === "Tayyorlandi") ? (
                                  <button 
                                    onClick={() => setSelectedReceiptOrder(order)}
                                    title="Fiskal chekni ochish (Soliq 1% keshbek)"
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border-emerald-600 cursor-pointer animate-pulse"
                                  >
                                    <span>🧾</span>
                                    <span>{t('receipt')}</span>
                                  </button>
                                ) : order.status === "Bekor qilindi" ? (
                                  <button 
                                    onClick={() => handleDeleteOrder(order.id)}
                                    title="Bekor qilingan buyurtmani tozalash"
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-rose-600/15 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>🗑</span>
                                    <span className="hidden sm:inline">O'chirish</span>
                                  </button>
                                ) : (
                                  <span className={'px-2 py-1 rounded-lg text-[10px] font-semibold ' + (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                                    {order.status === "Jarayonda" ? "🔵 Tayyorlanmoqda" : "🟡 Kutilmoqda"}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. ZAPCHASTLAR OMBORI */}
            {tab === "products" && (
              <div className={'border rounded-3xl overflow-hidden shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                <div className={'p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                  <div>
                    <h2 className="text-lg font-black">{t('partsCatalog')}</h2>
                    <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('partsDesc')}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      placeholder={t('searchPartPlaceholder')}
                      className={'px-3.5 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                        (isDark ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400')}
                    />

                    <button 
                      onClick={() => setShowCategoryModal(true)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 active:scale-95 shadow-sm"
                      title="Yangi avto bo'limlarini ochish yoki o'chirish"
                    >
                      <span>📁 Bo'limlar & Modellar</span>
                    </button>

                    <button 
                      onClick={() => {
                        setEditingProduct(null);
                        setProductImagePreview("");
                        setFormData({
                          name: "", category: categories.length > 0 ? categories[0].name : "Cobalt", new_price: "", old_price: "",
                          image_url: "", description: "", detailsText: "Original sifat\\nKafolat beriladi",
                          condition: "Yangi", stock: "10", color: "Universal", car_model: categories.length > 0 ? categories[0].name : "Cobalt"
                        });
                        setShowProductModal(true);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-950/40 active:scale-95 transition flex items-center gap-1.5"
                    >
                      <span>{t('addNewPart')}</span>
                    </button>
                  </div>
                </div>

                {/* Kategoriyalar filtri */}
                <div className={'px-6 py-2.5 border-b flex gap-2 overflow-x-auto no-scrollbar ' + (isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  {["Barchasi", ...(categories.length > 0 ? categories.map(c => c.name) : ["Cobalt", "Gentra / Lacetti", "Nexia (1 / 2 / 3)", "Spark", "Matiz", "Damas / Labo", "Malibu (1 / 2)", "Tracker (1 / 2)", "Onix", "Monjaro / Xitoy avto", "Kia / Hyundai", "Boshqa / Import"])].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setProductCategoryFilter(cat)}
                      className={'px-3 py-1 rounded-lg text-xs font-bold transition ' + 
                        (productCategoryFilter === cat 
                          ? (isDark ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-slate-900 border border-slate-300 shadow-sm') 
                          : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}
                    >
                      {cat === 'Barchasi' ? t('all') : cat}
                    </button>
                  ))}
                </div>

                {/* Mahsulotlar Jadvali */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={'border-b uppercase text-[10px] tracking-wider ' + (isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                      <tr>
                        <th className="p-4">{t('photoHeader')}</th>
                        <th className="p-4">{t('partNameHeader')}</th>
                        <th className="p-4">{t('quickPriceDesc')}</th>
                        <th className="p-4">{t('featuresHeader')}</th>
                        <th className="p-4 text-right">{t('actionsHeader')}</th>
                      </tr>
                    </thead>
                    <tbody className={'divide-y ' + (isDark ? 'divide-slate-800' : 'divide-slate-200')}>
                      {filteredProducts.map(prod => (
                        <tr key={prod.id} className={'transition ' + (isDark ? 'hover:bg-slate-850' : 'hover:bg-slate-50')}>
                          <td className="p-4">
                            <img src={prod.image_url} className="w-14 h-14 rounded-2xl object-cover border border-slate-700 bg-slate-800" />
                          </td>
                          <td className="p-4">
                            <div className="font-extrabold text-sm">{prod.name}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={'text-[10px] font-bold px-2 py-0.5 rounded-md border ' + 
                                (isDark ? 'text-red-400 bg-red-950/40 border-red-500/20' : 'text-red-600 bg-red-50 border-red-200')}>
                                {prod.category}
                              </span>
                              <span className={'text-[9px] font-black px-1.5 py-0.5 rounded border ' + 
                                (prod.condition === 'B/U (Ideal)' 
                                  ? (isDark ? 'text-amber-400 bg-amber-950/40 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200')
                                  : (isDark ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'))}>
                                {prod.condition === 'B/U (Ideal)' ? '🔄 B/U' : '✨ Yangi'}
                              </span>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStock(prod.id, -1)}
                                  title="Offline bozor: 1 dona sotildi (-1)"
                                  className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800 hover:bg-rose-500 hover:text-white flex items-center justify-center text-[10px] font-black transition"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePromptStock(prod)}
                                  title="Bosib aniq son yozing (Offline / Online)"
                                  className={'text-[9px] font-black px-1.5 py-0.5 rounded border ' + 
                                    (prod.stock > 3 
                                      ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200') 
                                      : (prod.stock > 0 
                                          ? (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200') 
                                          : (isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-200')))}
                                >
                                  {prod.stock > 0 ? ("📦 " + prod.stock) : "🔴 0"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStock(prod.id, 1)}
                                  title="Yangi keltirildi: +1 dona"
                                  className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white flex items-center justify-center text-[10px] font-black transition"
                                >
                                  +
                                </button>
                              </div>
                              {prod.color && prod.color !== 'Universal' && (
                                <span className={'text-[9px] font-semibold px-1.5 py-0.5 rounded border ' + 
                                  (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                                  🎨 {prod.color}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number"
                                defaultValue={prod.new_price}
                                onBlur={e => handleQuickPrice(prod, e.target.value)}
                                className={'w-28 px-2 py-1 border rounded-lg text-emerald-500 font-bold text-xs focus:outline-none ' + 
                                  (isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-300')}
                              />
                              <span className={'text-[11px] ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>so'm</span>
                            </div>
                            {prod.old_price && (
                              <span className="text-[10px] text-slate-500 line-through block mt-1">
                                {prod.old_price.toLocaleString()} so'm
                              </span>
                            )}
                          </td>
                          <td className={'p-4 max-w-xs ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                            <div className="truncate">{prod.description}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {(Array.isArray(prod.details) ? prod.details.length : 0)} ta xususiyat
                            </div>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setProductImagePreview(prod.image_url);
                                  setFormData({
                                    name: prod.name,
                                    category: prod.category || prod.car_model || "Cobalt",
                                    new_price: prod.new_price,
                                    old_price: prod.old_price || "",
                                    image_url: prod.image_url,
                                    description: prod.description || "",
                                    condition: prod.condition || "Yangi",
                                    detailsText: (Array.isArray(prod.details) ? prod.details : []).join("\\n"),
                                    stock: String(prod.stock !== undefined && prod.stock !== null ? prod.stock : 10),
                                    color: prod.color || "Universal",
                                    car_model: prod.car_model || prod.category || "Cobalt"
                                  });
                                  setShowProductModal(true);
                                }}
                                className={'px-3 py-1.5 font-bold rounded-xl border transition ' + 
                                  (isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300')}
                              >
                                {t('edit')}
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl border border-rose-500/20 transition"
                              >
                                {t('delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. ISTORIYALAR (STORIES) */}
            {tab === "stories" && (
              <div className={'border rounded-3xl overflow-hidden shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                <div className={'p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                  <div>
                    <h2 className="text-lg font-black">{t('storiesHub')}</h2>
                    <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('storiesDesc')}</p>
                  </div>

                  <button 
                    onClick={() => {
                      setStoryFormData({ title: "", tag: "Yangi", description: "", image_url: "" });
                      setStoryImagePreview("");
                      setShowStoryModal(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-950/40 active:scale-95 transition flex items-center gap-1.5"
                  >
                    <span>{t('addNewStory')}</span>
                  </button>
                </div>

                <div className="p-4 md:p-6">
                  {stories.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">{t('noStories')}</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {stories.map(s => (
                        <div key={s.id} className={'border rounded-2xl overflow-hidden flex flex-col justify-between group transition ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')}>
                          <div className="relative aspect-[4/5] w-full bg-slate-800/10 overflow-hidden">
                            <img src={s.image_url || s.img} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <span className="absolute top-2 left-2 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-600 text-white shadow">
                              {s.tag || 'Yangi'}
                            </span>
                          </div>
                          <div className="p-3.5 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs font-black line-clamp-1">{s.title}</h4>
                              <p className={'text-[11px] line-clamp-2 mt-1 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{s.description || s.desc}</p>
                            </div>
                            <div className={'mt-3 pt-2.5 border-t flex items-center justify-between ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                              <span className="text-[10px] text-slate-500 font-mono">#{s.id}</span>
                              <button 
                                onClick={() => handleDeleteStory(s.id)}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-bold transition"
                              >
                                {t('delete')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. CRM / MIJOZLAR */}
            {tab === "crm" && (
              <div className={'border rounded-3xl overflow-hidden shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                <div className={'p-6 border-b flex justify-between items-center ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                  <div>
                    <h2 className="text-lg font-black">{t('crmHub')}</h2>
                    <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('crmDesc')}</p>
                  </div>
                  <span className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 rounded-xl text-xs font-bold">
                    Jami: {users.length} ta
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={'border-b uppercase text-[10px] tracking-wider ' + (isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                      <tr>
                        <th className="p-4">Telegram ID & Ism</th>
                        <th className="p-4">Telefon</th>
                        <th className="p-4">Buyurtmalar</th>
                        <th className="p-4">Jami Xarid</th>
                        <th className="p-4">Sana</th>
                      </tr>
                    </thead>
                    <tbody className={'divide-y ' + (isDark ? 'divide-slate-800' : 'divide-slate-200')}>
                      {users.length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-slate-500">Mijozlar mavjud emas</td></tr>
                      ) : (
                        users.map(u => (
                          <tr key={u.id} className={'transition ' + (isDark ? 'hover:bg-slate-850' : 'hover:bg-slate-50')}>
                            <td className="p-4 font-bold whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-500 font-black flex items-center justify-center">
                                  {(u.name || "M")[0]}
                                </div>
                                <div>
                                  <div>{u.name || "Telegram Foydalanuvchisi"}</div>
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {u.telegram_id}</span>
                                </div>
                              </div>
                            </td>
                            <td className={'p-4 font-mono ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{u.phone || "Kiritilmagan"}</td>
                            <td className="p-4 font-black">{u.orders_count || 0} ta</td>
                            <td className="p-4 font-black text-emerald-500">{parseInt(u.total_spent || 0).toLocaleString()} so'm</td>
                            <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. BROADCAST */}
            {tab === "broadcast" && (
              <div className={'max-w-2xl mx-auto border rounded-3xl p-6 md:p-8 ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                <div className="mb-6">
                  <h2 className="text-xl font-black">{t('broadcastHub')}</h2>
                  <p className={'text-xs mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('broadcastDesc')}</p>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                  {/* Rasm yuklash (Telefondan yoki kompyuterdan - Task 4) */}
                  <div>
                    <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>📸 Xabar rasmi (Telefondan yoki kompyuterdan tanlang)</label>
                    <div className={'border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition relative mb-2.5 ' + 
                      (isDark ? 'border-slate-700 hover:border-red-500 bg-slate-950/60' : 'border-slate-300 hover:border-red-500 bg-slate-50')}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            handleImageUpload(file, (dataUrl) => {
                              setBroadcastPhoto(dataUrl);
                            });
                          }
                        }}
                      />
                      {broadcastPhoto ? (
                        <div className="flex flex-col items-center">
                          <img src={broadcastPhoto} className="w-32 h-32 object-cover rounded-xl border border-slate-700 shadow-md mb-2" />
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-emerald-500 font-bold">✅ Rasm biriktirildi</span>
                            <button 
                              type="button" 
                              onClick={(ev) => { ev.stopPropagation(); setBroadcastPhoto(''); }}
                              className="text-[10px] text-red-500 underline font-bold"
                            >
                              O'chirish
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="text-3xl mb-1">🖼</div>
                          <p className="text-xs font-bold">Telefondan yoki noutbukdan rasm tanlash</p>
                          <p className={'text-[10px] mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Galereya yoki fayllardan rasm yuklang (avtomatik siqiladi)</p>
                        </div>
                      )}
                    </div>

                    <input 
                      type="url"
                      value={(broadcastPhoto && broadcastPhoto.startsWith('data:')) ? '' : broadcastPhoto}
                      onChange={e => setBroadcastPhoto(e.target.value)}
                      placeholder="Yoki to'g'ridan-to'g'ri rasm URL manzilini kiriting..."
                      className={'w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400')}
                    />
                  </div>

                  <div>
                    <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{t('broadcastMsgLabel')}</label>
                    <textarea 
                      rows="5"
                      required
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                      placeholder={t('broadcastPlaceholder')}
                      className={'w-full p-3.5 border rounded-xl leading-relaxed focus:outline-none focus:border-red-500 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400')}
                    />
                  </div>

                  {broadcastResult && (
                    <div className={'p-3.5 rounded-xl border font-bold text-xs ' + (isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900')}>
                      {broadcastResult}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={broadcastSending}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg shadow-red-950/50 transition active:scale-98"
                  >
                    {broadcastSending ? t('sending') : t('sendBroadcast')}
                  </button>
                </form>
              </div>
            )}

            {/* 7. SETTINGS (SOZLAMALAR) */}
            {tab === "settings" && (
              <div className={'max-w-3xl mx-auto border rounded-3xl p-6 md:p-8 shadow-sm ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-black">{t('settingsTitle')}</h2>
                    <p className={'text-xs mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('settingsDesc')}</p>
                  </div>
                  <span className={'text-[10px] font-bold px-2.5 py-1 rounded-full border self-start ' + (isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600')}>
                    Real vaqtda yangilanadi ⚡️
                  </span>
                </div>

                {settingsMessage && (
                  <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-bold text-xs flex items-center gap-2">
                    <span>✅</span>
                    <span>{settingsMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
                  {/* 1. TO'LOV KARTALARI (Uzcard, Humo, Visa alohida) */}
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-red-500 flex items-center gap-2">
                      <span>💳</span>
                      <span>To'lov Kartalari Boshqaruvi (Uzcard, Humo, Visa)</span>
                    </h3>

                    {/* 1.1 Uzcard */}
                    <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-blue-500 flex items-center gap-1.5">🔵 UZCARD</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                          <input 
                            type="checkbox" 
                            checked={settings.uzcard_active !== false} 
                            onChange={e => setSettings({ ...settings, uzcard_active: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                          <span className={settings.uzcard_active !== false ? 'text-blue-500 font-extrabold' : 'text-slate-400'}>
                            {settings.uzcard_active !== false ? "✅ Faol (Kassada ko'rinadi)" : "❌ Nofaol (Yashirilgan)"}
                          </span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Uzcard Karta Raqami</label>
                          <input 
                            type="text"
                            value={settings.uzcard_number || ''}
                            onChange={e => setSettings({ ...settings, uzcard_number: e.target.value, card_number: e.target.value })}
                            placeholder="8600 5304 1234 5678"
                            className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                          />
                        </div>
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Karta Egasi</label>
                          <input 
                            type="text"
                            value={settings.uzcard_holder || ''}
                            onChange={e => setSettings({ ...settings, uzcard_holder: e.target.value, card_holder: e.target.value })}
                            placeholder="AZIMXON (KUZAVNOY.UZZ)"
                            className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 1.2 Humo */}
                    <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">🟠 HUMO</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                          <input 
                            type="checkbox" 
                            checked={settings.humo_active !== false} 
                            onChange={e => setSettings({ ...settings, humo_active: e.target.checked })}
                            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                          />
                          <span className={settings.humo_active !== false ? 'text-amber-500 font-extrabold' : 'text-slate-400'}>
                            {settings.humo_active !== false ? "✅ Faol (Kassada ko'rinadi)" : "❌ Nofaol (Yashirilgan)"}
                          </span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Humo Karta Raqami</label>
                          <input 
                            type="text"
                            value={settings.humo_number || ''}
                            onChange={e => setSettings({ ...settings, humo_number: e.target.value })}
                            placeholder="9860 1201 5678 4321"
                            className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                          />
                        </div>
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Karta Egasi</label>
                          <input 
                            type="text"
                            value={settings.humo_holder || ''}
                            onChange={e => setSettings({ ...settings, humo_holder: e.target.value })}
                            placeholder="AZIMXON (KUZAVNOY.UZZ)"
                            className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 1.3 Visa / Mastercard */}
                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-500 flex items-center gap-1.5">🟡 VISA / MASTERCARD</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                          <input 
                            type="checkbox" 
                            checked={Boolean(settings.visa_active)} 
                            onChange={e => setSettings({ ...settings, visa_active: e.target.checked })}
                            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                          />
                          <span className={settings.visa_active ? 'text-emerald-500 font-extrabold' : 'text-slate-400'}>
                            {settings.visa_active ? "✅ Faol (Kassada ko'rinadi)" : "❌ Nofaol (Yashirilgan)"}
                          </span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Visa Karta Raqami</label>
                          <input 
                            type="text"
                            value={settings.visa_number || ''}
                            onChange={e => setSettings({ ...settings, visa_number: e.target.value })}
                            placeholder="4000 1234 5678 9010"
                            className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                          />
                        </div>
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Karta Egasi</label>
                          <input 
                            type="text"
                            value={settings.visa_holder || ''}
                            onChange={e => setSettings({ ...settings, visa_holder: e.target.value })}
                            placeholder="AZIMXON (USD/UZS)"
                            className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. ALOQA UCHUN 3 TA TELEFON RAQAMLARI */}
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-2">
                      <span>📞</span>
                      <span>Aloqa Telefonlari (3 ta raqam)</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className={'font-bold text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Asosiy Telefon *</label>
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold">
                            <input 
                              type="checkbox" 
                              checked={settings.phone1_active !== false} 
                              onChange={e => setSettings({ ...settings, phone1_active: e.target.checked })}
                              className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                            />
                            <span className={settings.phone1_active !== false ? 'text-emerald-500' : 'text-slate-400'}>
                              {settings.phone1_active !== false ? '✅ Faol' : '❌ Nofaol'}
                            </span>
                          </label>
                        </div>
                        <input 
                          type="text"
                          required
                          value={settings.phone || ''}
                          onChange={e => setSettings({ ...settings, phone: e.target.value })}
                          placeholder="+998 90 123 45 67"
                          className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <span className={'text-[10px] block ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>Cheklarda va do'konda chiqadi</span>
                      </div>

                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className={'font-bold text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Qo'shimcha 1 (Call-markaz)</label>
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold">
                            <input 
                              type="checkbox" 
                              checked={settings.phone2_active !== false} 
                              onChange={e => setSettings({ ...settings, phone2_active: e.target.checked })}
                              className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                            />
                            <span className={settings.phone2_active !== false ? 'text-emerald-500' : 'text-slate-400'}>
                              {settings.phone2_active !== false ? '✅ Faol' : '❌ Nofaol'}
                            </span>
                          </label>
                        </div>
                        <input 
                          type="text"
                          value={settings.phone2 || ''}
                          onChange={e => setSettings({ ...settings, phone2: e.target.value })}
                          placeholder="+998 97 765 43 21"
                          className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <span className={'text-[10px] block ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>Mijoz profilida ko'rinadi</span>
                      </div>

                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className={'font-bold text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Qo'shimcha 2 (Texnik yordam)</label>
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold">
                            <input 
                              type="checkbox" 
                              checked={settings.phone3_active !== false} 
                              onChange={e => setSettings({ ...settings, phone3_active: e.target.checked })}
                              className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                            />
                            <span className={settings.phone3_active !== false ? 'text-emerald-500' : 'text-slate-400'}>
                              {settings.phone3_active !== false ? '✅ Faol' : '❌ Nofaol'}
                            </span>
                          </label>
                        </div>
                        <input 
                          type="text"
                          value={settings.phone3 || ''}
                          onChange={e => setSettings({ ...settings, phone3: e.target.value })}
                          placeholder="+998 99 888 77 66"
                          className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <span className={'text-[10px] block ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>Konsultatsiya uchun</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. IJTIMOIY TARMOQLAR */}
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-2">
                      <span>🌐</span>
                      <span>{t('socialHeader')}</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Instagram */}
                      <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={'font-bold text-xs flex items-center gap-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                            <span>📸</span>
                            <span>{t('instagramUrlLabel')}</span>
                          </label>
                          <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer text-rose-500">
                            <input 
                              type="checkbox" 
                              checked={settings.instagram_active !== false} 
                              onChange={e => setSettings({ ...settings, instagram_active: e.target.checked })} 
                              className="accent-rose-500 rounded"
                            />
                            <span>Faol</span>
                          </label>
                        </div>
                        <input 
                          type="url"
                          value={settings.instagram_url || ''}
                          onChange={e => setSettings({ ...settings, instagram_url: e.target.value })}
                          placeholder="https://instagram.com/kuzavnoy.uzz"
                          className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                        />
                      </div>

                      {/* YouTube */}
                      <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={'font-bold text-xs flex items-center gap-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                            <span>▶️</span>
                            <span>{t('youtubeUrlLabel')}</span>
                          </label>
                          <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer text-red-500">
                            <input 
                              type="checkbox" 
                              checked={settings.youtube_active !== false} 
                              onChange={e => setSettings({ ...settings, youtube_active: e.target.checked })} 
                              className="accent-red-500 rounded"
                            />
                            <span>Faol</span>
                          </label>
                        </div>
                        <input 
                          type="url"
                          value={settings.youtube_url || ''}
                          onChange={e => setSettings({ ...settings, youtube_url: e.target.value })}
                          placeholder="https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"
                          className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                        />
                      </div>

                      {/* Telegram Kanal */}
                      <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={'font-bold text-xs flex items-center gap-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                            <span>✈️</span>
                            <span>Telegram Kanal Havolasi</span>
                          </label>
                          <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer text-sky-500">
                            <input 
                              type="checkbox" 
                              checked={settings.telegram_active !== false} 
                              onChange={e => setSettings({ ...settings, telegram_active: e.target.checked })} 
                              className="accent-sky-500 rounded"
                            />
                            <span>Faol</span>
                          </label>
                        </div>
                        <input 
                          type="url"
                          value={settings.telegram_channel_url || ''}
                          onChange={e => setSettings({ ...settings, telegram_channel_url: e.target.value })}
                          placeholder="https://t.me/kuzavnoy_uz"
                          className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                        />
                      </div>

                      {/* Rasmiy Veb-Sayt */}
                      <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={'font-bold text-xs flex items-center gap-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                            <span>🌐</span>
                            <span>Rasmiy Veb-Sayt Havolasi</span>
                          </label>
                          <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer text-emerald-500">
                            <input 
                              type="checkbox" 
                              checked={Boolean(settings.website_active)} 
                              onChange={e => setSettings({ ...settings, website_active: e.target.checked })} 
                              className="accent-emerald-500 rounded"
                            />
                            <span>Faol</span>
                          </label>
                        </div>
                        <input 
                          type="url"
                          value={settings.website_url || ''}
                          onChange={e => setSettings({ ...settings, website_url: e.target.value })}
                          placeholder="https://kuzavnoy.uz"
                          className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. DO'KON MANZILI & ISH VAQTI (AVTO TIME PICKER BILAN) */}
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
                      <span>🏬</span>
                      <span>{t('storeLocationHeader')}</span>
                    </h3>

                    <div>
                      <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{t('storeAddressLabel')}</label>
                      <input 
                        type="text"
                        required
                        value={settings.store_address || ''}
                        onChange={e => setSettings({ ...settings, store_address: e.target.value })}
                        placeholder="Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori"
                        className={'w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                          (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                      />
                    </div>

                    {/* Avtomatik Ish Vaqti Tanlagich (Time Picker & Kunlar) */}
                    <div className={'p-3.5 rounded-xl border space-y-3 ' + (isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200')}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                          <span>⏰</span>
                          <span>Avtomatik Ish Tartibi (Time Picker)</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          Natija: {settings.store_days || "Har kuni"}, {settings.store_hours_open || "09:00"} - {settings.store_hours_close || "19:00"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold block mb-1 text-slate-400">Ish kunlari:</label>
                          <select 
                            value={settings.store_days || "Har kuni"}
                            onChange={e => {
                              const newDays = e.target.value;
                              const open = settings.store_hours_open || "09:00";
                              const close = settings.store_hours_close || "19:00";
                              setSettings({ 
                                ...settings, 
                                store_days: newDays, 
                                store_hours: newDays + ", " + open + " - " + close 
                              });
                            }}
                            className={'w-full p-2 border rounded-xl text-xs focus:outline-none ' + 
                              (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                          >
                            <option value="Har kuni">Har kuni (Dushanba - Yakshanba)</option>
                            <option value="Dushanba - Shanba">Dushanba - Shanba (Yakshanba dam)</option>
                            <option value="Dushanba - Juma">Dushanba - Juma (Hafta kunlari)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold block mb-1 text-slate-400">Ochilish soati:</label>
                          <input 
                            type="time"
                            value={settings.store_hours_open || "09:00"}
                            onChange={e => {
                              const newOpen = e.target.value;
                              const days = settings.store_days || "Har kuni";
                              const close = settings.store_hours_close || "19:00";
                              setSettings({ 
                                ...settings, 
                                store_hours_open: newOpen, 
                                store_hours: days + ", " + newOpen + " - " + close 
                              });
                            }}
                            className={'w-full p-2 border rounded-xl text-xs focus:outline-none ' + 
                              (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold block mb-1 text-slate-400">Yopilish soati:</label>
                          <input 
                            type="time"
                            value={settings.store_hours_close || "19:00"}
                            onChange={e => {
                              const newClose = e.target.value;
                              const days = settings.store_days || "Har kuni";
                              const open = settings.store_hours_open || "09:00";
                              setSettings({ 
                                ...settings, 
                                store_hours_close: newClose, 
                                store_hours: days + ", " + open + " - " + newClose 
                              });
                            }}
                            className={'w-full p-2 border rounded-xl text-xs focus:outline-none ' + 
                              (isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Karta lokatsiyasi havolasi */}
                    <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className={'font-bold text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>🗺 Xarita Lokatsiyasi Havolasi (Google Maps yoki Yandex Karta - Ixtiyoriy)</label>
                        <span className="text-[10px] text-slate-400">Bo'sh qolsa manzil bo'yicha avtomatik ochadi</span>
                      </div>
                      <input 
                        type="url"
                        value={settings.store_location_url || ''}
                        onChange={e => setSettings({ ...settings, store_location_url: e.target.value })}
                        placeholder="https://maps.google.com/?q=... yoki https://yandex.uz/maps/..."
                        className={'w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-red-500 ' + 
                          (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <a 
                          href={settings.store_location_url && settings.store_location_url.trim() ? settings.store_location_url : ('https://yandex.uz/maps/?text=' + encodeURIComponent(settings.store_address || "Toshkent"))}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                        >
                          <span>🗺</span>
                          <span>Yandex Kartada tekshirish</span>
                        </a>
                        <a 
                          href={settings.store_location_url && settings.store_location_url.trim() ? settings.store_location_url : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(settings.store_address || "Toshkent"))}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                        >
                          <span>📍</span>
                          <span>Google Maps'da tekshirish</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={settingsSaving}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg shadow-red-950/50 transition active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>💾</span>
                    <span>{settingsSaving ? t('sending') : t('saveSettings')}</span>
                  </button>
                </form>
              </div>
            )}

          </main>

          {/* CHEK / RECEIPT MODAL (SOLIQ 1% KESHBEK & QR KOD BILAN) */}
          {selectedReceiptOrder && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
              <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col font-sans border border-slate-200">
                
                {/* Yopish tugmasi */}
                <button 
                  onClick={() => setSelectedReceiptOrder(null)} 
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center font-bold text-sm transition shadow-sm z-10"
                >
                  ✕
                </button>
                
                {/* Scrollable Receipt Content */}
                <div className="overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
                  
                  {/* Chek Bosh qismi (Header) */}
                  <div className="text-center pb-3 border-b-2 border-dashed border-slate-300">
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <span className="text-2xl">🚗</span>
                      <span className="text-xl font-black tracking-tight text-slate-900">kuzavnoy.uzz</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 mt-0.5">Avto Ehtiyot Qismlar Do'koni</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{settings.store_address || "Toshkent sh., Uchtepa tumani, Farhod avto ehtiyot qismlar bozori"}</p>
                    <p className="text-[10px] text-slate-500">Tel: {settings.phone || "+998 90 123 45 67"} {settings.phone2 ? " • " + settings.phone2 : ""} | @kuzavnoyuz_bot</p>
                    
                    <div className="flex items-center justify-between text-[11px] font-mono mt-2.5 pt-2 border-t border-dashed border-slate-200 text-slate-600">
                      <span><b>Chek:</b> #KZV-{selectedReceiptOrder.id}</span>
                      <span>{new Date(selectedReceiptOrder.created_at).toLocaleString('uz-UZ')}</span>
                    </div>
                  </div>

                  {/* Mijoz va yetkazish tafsilotlari */}
                  <div className="p-3 bg-slate-50 rounded-2xl text-[11px] space-y-1.5 border border-slate-200/80">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">👤 Mijoz:</span>
                      <span className="font-bold text-slate-900">{selectedReceiptOrder.customer_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">📞 Telefon:</span>
                      <span className="font-bold text-slate-900 font-mono">{selectedReceiptOrder.phone}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">🚚 Yetkazish:</span>
                      <span className="font-bold text-slate-800">
                        {selectedReceiptOrder.delivery_type === 'pickup' ? "🏬 Do'kondan olib ketish" : "🚚 Kuryer orqali"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">💳 To'lov:</span>
                      <span className="font-bold text-slate-800">
                        {selectedReceiptOrder.payment_method === 'card' ? "💳 Karta (Uzcard/Humo/Visa)" : "💵 Naqd to'lov"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500 whitespace-nowrap">📍 Manzil:</span>
                      <span className="font-medium text-slate-700 text-right max-w-[200px] truncate">
                        {selectedReceiptOrder.location || "Do'kondan olib ketish"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">📊 Holati:</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        {selectedReceiptOrder.status}
                      </span>
                    </div>
                  </div>

                  {/* Nima olganligi ro'yxati (Tovarlar) */}
                  <div className="py-2 border-b-2 border-dashed border-slate-300 space-y-2">
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex justify-between">
                      <span>📦 Xarid qilingan detallar:</span>
                      <span>Summa</span>
                    </div>
                    <div className="space-y-2">
                      {(Array.isArray(selectedReceiptOrder.items) ? selectedReceiptOrder.items : (typeof selectedReceiptOrder.items === 'string' ? JSON.parse(selectedReceiptOrder.items || '[]') : [])).map((it, idx) => {
                        const qty = it.quantity || 1;
                        const price = it.new_price || 0;
                        const itemTotal = qty * price;
                        return (
                          <div key={idx} className="flex items-start justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                            <div className="pr-2">
                              <div className="font-bold text-slate-900">{idx + 1}. {it.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{qty} dona × {price.toLocaleString()} so'm</div>
                            </div>
                            <div className="font-black text-slate-900 text-right whitespace-nowrap">
                              {itemTotal.toLocaleString()} so'm
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Moliyaviy Jami hisob */}
                  <div className="p-3 bg-slate-100/80 rounded-2xl space-y-1 border border-slate-200">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Oraliq summa:</span>
                      <span className="font-bold">{selectedReceiptOrder.total_price?.toLocaleString()} so'm</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>QQS (12% hisoblangan):</span>
                      <span>{Math.round((selectedReceiptOrder.total_price || 0) * 0.12 / 1.12).toLocaleString()} so'm</span>
                    </div>
                    <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                      <span className="text-sm font-black text-slate-900 uppercase">JAMI TO'LOV:</span>
                      <span className="text-lg font-black text-red-600">
                        {selectedReceiptOrder.total_price?.toLocaleString()} so'm
                      </span>
                    </div>
                  </div>

                  {/* 🟢 SOLIQ.UZ 1% KESHBEK VA QR KOD BO'LIMI */}
                  <div className="p-4 bg-emerald-50/90 border-2 border-emerald-500/40 rounded-2xl text-center shadow-inner">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 uppercase tracking-wide">
                      <span className="text-base">🟢</span>
                      <span>SOLIQ.UZ — 1% FISKAL KESHBEK</span>
                    </div>
                    
                    <div className="text-xs text-emerald-800 font-bold mt-1">
                      Keshbek summasi: <span className="text-sm font-black text-emerald-900 bg-emerald-200/60 px-2 py-0.5 rounded-lg">+{Math.round((selectedReceiptOrder.total_price || 0) * 0.01).toLocaleString()} so'm</span>
                    </div>

                    {/* Skaner qilinadigan haqiqiy QR-KOD */}
                    <div className="my-3 flex justify-center">
                      <div className="p-2.5 bg-white rounded-2xl shadow-md border border-emerald-300 inline-block">
                        <img 
                          src={"https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=2&data=" + encodeURIComponent("https://soliq.uz/cashback?order=" + selectedReceiptOrder.id + "&sum=" + (selectedReceiptOrder.total_price || 0) + "&fiscal=KZV" + selectedReceiptOrder.id)}
                          alt="Soliq QR Code"
                          className="w-36 h-36 block mx-auto rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100/80 py-1 px-2 rounded-lg inline-block">
                      {"FPU: 890123 • FD: KZV-" + selectedReceiptOrder.id + "-" + new Date().getFullYear()}
                    </div>
                    
                    <p className="text-[9.5px] text-emerald-700 font-medium mt-1.5">
                      📱 <b>Soliq</b> ilovasida QR-kodni skanerlang va 1% keshbek oling
                    </p>
                  </div>

                  <div className="text-center text-[10px] text-slate-400 py-1">
                    Xaridingiz uchun rahmat! Oq yo'l! 🚗💨
                  </div>
                </div>

                {/* Pastki Harakat Tugmalari */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex gap-2">
                  <button 
                    onClick={() => printThermalReceipt(selectedReceiptOrder)} 
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🖨</span>
                    <span>{t('printReceipt')}</span>
                  </button>

                  {selectedReceiptOrder.status === "Bekor qilindi" && (
                    <button 
                      onClick={() => {
                        const id = selectedReceiptOrder.id;
                        setSelectedReceiptOrder(null);
                        handleDeleteOrder(id);
                      }} 
                      className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>🗑</span>
                      <span>O'chirish</span>
                    </button>
                  )}

                  <button 
                    onClick={() => setSelectedReceiptOrder(null)} 
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {t('close')}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* PRODUCT MODAL */}
          {/* 📁 BO'LIMLAR & MODELLARNI BOSHQARISH MODALI */}
          {showCategoryModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className={'w-full max-w-lg rounded-3xl border shadow-2xl p-6 ' + (isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/40 mb-4">
                  <div>
                    <h3 className="text-base font-black flex items-center gap-2">
                      <span>📁</span>
                      <span>Bo'limlar & Avto Modellarni Boshqarish</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Admin bu yerda xohlagan yangi avto toifasini ocha oladi</p>
                  </div>
                  <button 
                    onClick={() => setShowCategoryModal(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs"
                  >
                    ✕
                  </button>
                </div>

                {/* Yangi bo'lim qo'shish formasi */}
                <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="Masalan: Labo yoki BYD Song"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className={'flex-1 p-2.5 rounded-xl border text-xs focus:outline-none focus:border-red-500 ' + 
                      (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                  />
                  <select
                    value={newCategoryIcon}
                    onChange={e => setNewCategoryIcon(e.target.value)}
                    className={'p-2.5 rounded-xl border text-xs focus:outline-none ' + 
                      (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900')}
                  >
                    <option value="🚗">🚗 Yengil</option>
                    <option value="🚘">🚘 Sedan</option>
                    <option value="🚙">🚙 Krossover</option>
                    <option value="🚐">🚐 Mini-ven</option>
                    <option value="⚡️">⚡️ Elektro</option>
                    <option value="🌐">🌐 Import</option>
                  </select>
                  <button 
                    type="submit"
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition"
                  >
                    + Qo'shish
                  </button>
                </form>

                {/* Mavjud bo'limlar ro'yxati */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {categories.map((c, idx) => (
                    <div 
                      key={c.id || c.name} 
                      className={'p-2.5 rounded-xl border flex items-center justify-between text-xs ' + 
                        (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{c.icon || '🚗'}</span>
                        <span className="font-bold">{c.name}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteCategory(c.id, c.name)}
                        className="text-slate-400 hover:text-rose-500 transition p-1"
                        title="O'chirish"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showProductModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className={'border rounded-3xl max-w-lg w-full p-6 shadow-2xl ' + (isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-black">
                    {editingProduct ? t('modalEditProduct') : t('modalNewProduct')}
                  </h3>
                  <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-500 font-bold">✕</button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('productName')}</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="M-Sport Anatomiya Rul" 
                      className={'w-full p-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('categoryCarModel')}</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value, car_model: e.target.value })}
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      >
                        {(categories.length > 0 ? categories : [
                          { name: 'Cobalt', icon: '🚗' },
                          { name: 'Gentra / Lacetti', icon: '🚗' },
                          { name: 'Nexia (1 / 2 / 3)', icon: '🚗' },
                          { name: 'Spark', icon: '🚗' },
                          { name: 'Matiz', icon: '🚗' },
                          { name: 'Damas / Labo', icon: '🚐' },
                          { name: 'Malibu (1 / 2)', icon: '🚘' },
                          { name: 'Tracker (1 / 2)', icon: '🚙' },
                          { name: 'Onix', icon: '🚗' },
                          { name: 'Monjaro / Xitoy avto', icon: '⚡️' },
                          { name: 'Kia / Hyundai', icon: '🚘' },
                          { name: 'Boshqa / Import', icon: '🌐' }
                        ]).map(cat => (
                          <option key={cat.name} value={cat.name}>
                            {(cat.icon || '🚗') + ' ' + cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('partCondition')}</label>
                      <select 
                        value={formData.condition || 'Yangi'}
                        onChange={e => setFormData({ ...formData, condition: e.target.value })}
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      >
                        <option value="Yangi">{t('conditionNew')}</option>
                        <option value="B/U (Ideal)">{t('conditionUsed')}</option>
                      </select>
                    </div>

                    <div>
                      <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Ombor (Stock)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.stock !== undefined ? formData.stock : "10"}
                        onChange={e => setFormData({ ...formData, stock: e.target.value })}
                        placeholder="10"
                        className={'w-full p-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>

                    <div>
                      <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Rangi (Color)</label>
                      <input 
                        type="text" 
                        value={formData.color || ""}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        placeholder="Qora / Oq / Karbon"
                        className={'w-full p-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('newPrice')}</label>
                      <input 
                        type="number" 
                        required
                        value={formData.new_price}
                        onChange={e => setFormData({ ...formData, new_price: e.target.value })}
                        placeholder="1450000" 
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('oldPrice')}</label>
                    <input 
                      type="number" 
                      value={formData.old_price}
                      onChange={e => setFormData({ ...formData, old_price: e.target.value })}
                      placeholder="1850000" 
                      className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  {/* TELEFON RASMI YOKI URL */}
                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('photoPhoneOrUrl')}</label>
                    
                    <div className={'border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition relative mb-2 ' + 
                      (isDark ? 'border-slate-700 hover:border-red-500 bg-slate-950/60' : 'border-slate-300 hover:border-red-500 bg-slate-50')}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            handleImageUpload(file, (dataUrl) => {
                              setFormData(prev => ({ ...prev, image_url: dataUrl }));
                              setProductImagePreview(dataUrl);
                            });
                          }
                        }}
                      />
                      {productImagePreview || formData.image_url ? (
                        <div className="flex flex-col items-center">
                          <img src={productImagePreview || formData.image_url} className="w-24 h-24 object-cover rounded-xl border border-slate-700 shadow-md mb-2" />
                          <span className="text-[11px] text-emerald-500 font-bold">{t('photoSelected')}</span>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="text-3xl mb-1">📸</div>
                          <p className="text-xs font-bold">{t('photoFromPhone')}</p>
                          <p className={'text-[10px] mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('photoHint')}</p>
                        </div>
                      )}
                    </div>

                    <input 
                      type="url" 
                      value={(formData.image_url && formData.image_url.startsWith("data:")) ? "" : (formData.image_url || "")}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, image_url: val }));
                        setProductImagePreview(val);
                      }}
                      placeholder="yoki internetdagi rasm havolasi (URL): https://..." 
                      className={'w-full p-2 border rounded-xl text-[11px] focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}
                    />
                  </div>

                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('shortDesc')}</label>
                    <input 
                      type="text" 
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Malibu va Tracker uchun original sport rul" 
                      className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('featuresInput')}</label>
                    <textarea 
                      rows="3"
                      value={formData.detailsText}
                      onChange={e => setFormData({ ...formData, detailsText: e.target.value })}
                      placeholder="Nappa charm qoplama&#10;Ko'p funksiyali tugmalar&#10;Airbag bilan mos"
                      className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button 
                      type="button" 
                      onClick={() => setShowProductModal(false)}
                      className={'px-4 py-2 rounded-xl font-bold ' + (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                    >
                      {t('cancel')}
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold"
                    >
                      {t('save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* STORY MODAL */}
          {showStoryModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className={'border rounded-3xl max-w-md w-full p-6 shadow-2xl ' + (isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-black">{t('modalNewStory')}</h3>
                  <button onClick={() => setShowStoryModal(false)} className="text-slate-400 hover:text-slate-500 font-bold">✕</button>
                </div>

                <form onSubmit={handleSaveStory} className="space-y-3.5 text-xs">
                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('storyTitle')}</label>
                    <input 
                      type="text" 
                      required
                      value={storyFormData.title}
                      onChange={e => setStoryFormData({ ...storyFormData, title: e.target.value })}
                      placeholder="Masalan: 🔥 Qaynoq Chegirma!" 
                      className={'w-full p-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('storyTag')}</label>
                    <select 
                      value={storyFormData.tag}
                      onChange={e => setStoryFormData({ ...storyFormData, tag: e.target.value })}
                      className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    >
                      <option value="Yangi">{t('tagNew')}</option>
                      <option value="Chegirma">{t('tagDiscount')}</option>
                      <option value="Aksiya">{t('tagPromo')}</option>
                      <option value="Xizmat">{t('tagService')}</option>
                      <option value="Original">{t('tagOriginal')}</option>
                      <option value="Top">{t('tagTop')}</option>
                    </select>
                  </div>

                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('shortDesc')}</label>
                    <textarea 
                      rows="2"
                      value={storyFormData.description}
                      onChange={e => setStoryFormData({ ...storyFormData, description: e.target.value })}
                      placeholder="Barcha Malibu va Tracker zapchastlariga 30% chegirma..." 
                      className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                    />
                  </div>

                  <div>
                    <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('storyPhoto')}</label>
                    
                    <div className={'border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition relative mb-2 ' + 
                      (isDark ? 'border-slate-700 hover:border-red-500 bg-slate-950/60' : 'border-slate-300 hover:border-red-500 bg-slate-50')}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            handleImageUpload(file, (dataUrl) => {
                              setStoryFormData(prev => ({ ...prev, image_url: dataUrl }));
                              setStoryImagePreview(dataUrl);
                            });
                          }
                        }}
                      />
                      {storyImagePreview || storyFormData.image_url ? (
                        <div className="flex flex-col items-center">
                          <img src={storyImagePreview || storyFormData.image_url} className="w-24 h-24 object-cover rounded-xl border border-slate-700 shadow-md mb-2" />
                          <span className="text-[11px] text-emerald-500 font-bold">{t('photoSelected')}</span>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="text-3xl mb-1">📸</div>
                          <p className="text-xs font-bold">{t('photoFromPhone')}</p>
                          <p className={'text-[10px] mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('photoHint')}</p>
                        </div>
                      )}
                    </div>

                    <input 
                      type="url" 
                      value={(storyFormData.image_url && storyFormData.image_url.startsWith("data:")) ? "" : (storyFormData.image_url || "")}
                      onChange={e => {
                        const val = e.target.value;
                        setStoryFormData(prev => ({ ...prev, image_url: val }));
                        setStoryImagePreview(val);
                      }}
                      placeholder="yoki internetdagi rasm havolasi (URL): https://..." 
                      className={'w-full p-2 border rounded-xl text-[11px] focus:outline-none ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button 
                      type="button" 
                      onClick={() => setShowStoryModal(false)}
                      className={'px-4 py-2 rounded-xl font-bold ' + (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                    >
                      {t('cancel')}
                    </button>
                    <button 
                      type="submit" 
                      disabled={storySaving}
                      className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-bold"
                    >
                      {storySaving ? t('sending') : t('publishStory')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<AdminApp />);
  </script>
</body>
</html>`;
}

