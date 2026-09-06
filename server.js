// ==============================================================================
// kuzavnoy.uzz — ALL-IN-ONE SINGLE FILE APPLICATION
// Telegram Bot + REST API + PostgreSQL (Neon) + React Mini App + React Admin Panel
// ==============================================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
process.env.NTBA_FIX_350 = 1;
const TelegramBot = require('node-telegram-bot-api');

// 1. SOZLAMALAR (CONFIG)
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '8847186451:AAHk4YYqvkuo1pjQjdGsFRnhKbY9VABlBQs';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_ePwm65vBoGJY@ep-spring-snow-a5z1caba-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
// Ngrok, Render yoki HTTPS domeni
let WEB_APP_URL = process.argv[2] || process.env.WEB_APP_URL || (process.env.PORT ? 'https://kuzavnoy-app.onrender.com' : `http://localhost:${PORT}`);

// Adminlarning Telegram ID raqamlari (yangi zakaz tushganda bularga to'g'ridan-to'g'ri xabar boradi)
let ADMIN_CHAT_IDS = process.env.ADMIN_CHAT_IDS 
  ? process.env.ADMIN_CHAT_IDS.split(',').map(s => s.trim()) 
  : ['5361309526'];

// 2. MA'LUMOTLAR BAZASI (POSTGRESQL - NEON)
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL (Neon) bazasiga muvaffaqiyatli ulandi!');

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
        store_address TEXT DEFAULT 'Toshkent sh., Sergeli mashina bozori, 4-qator 12-do''kon',
        store_hours VARCHAR(100) DEFAULT '09:00 - 19:00',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
        (1, 5361309526, 'Azizbek', 5, 'M-Sport rul juda sifatli ekan, mashinaga 100% tushdi. Tavsiya qilaman!'),
        (2, 5361309527, 'Jasur', 5, 'Malibu 2 bar olingan, simsiz zaryadkasi tez va qulay ishlayapti.'),
        (3, 5361309528, 'Sherzod', 5, 'Benson labavoy oyna zo''r, quyosh issig''i umuman sezilmayapti.')
      `);
      console.log('✅ Dastlabki mijoz sharhlari (Reviews) bazaga kiritildi!');
    }

    const settingsCount = await client.query('SELECT COUNT(*) FROM store_settings');
    if (parseInt(settingsCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO store_settings (id, card_number, card_holder, phone, instagram_url, youtube_url, store_address, store_hours)
        VALUES (1, '8600 5304 1234 5678', 'AZIMXON (KUZAVNOY.UZZ)', '+998 90 123 45 67', 'https://instagram.com/kuzavnoy.uzz', 'https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G', 'Toshkent sh., Sergeli mashina bozori, 4-qator 12-do''kon', '09:00 - 19:00')
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
try {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('🤖 Telegram Bot ishga tushdi (@kuzavnoy.uzz bot)!');

  bot.on('polling_error', (error) => {
    if (error.code !== 'EFATAL') {}
  });

  
  bot.onText(/\/admin_login(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const pin = match && match[1] ? match[1].trim() : '';
    if (pin === '7777') {
      if (!ADMIN_CHAT_IDS.includes(chatId)) {
        ADMIN_CHAT_IDS.push(chatId);
      }
      const isHttps = WEB_APP_URL.startsWith('https://');
      return bot.sendMessage(chatId,
        "✅ <b>Muvaffaqiyatli tasdiqlandi!</b>\n\n" +
        "Siz <b>kuzavnoy.uzz</b> tizimida bosh Admin sifatida biriktirildingiz! 🎉\n\n" +
        "Pastdagi tugma orqali Admin Dashboardni ochishingiz mumkin: 👇",
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
    } else {
      return bot.sendMessage(chatId,
        "❌ <b>Noto'g'ri maxfiy kod!</b>\n\n" +
        "Iltimos, to'g'ri kod bilan yuboring, masalan: <code>/admin_login 7777</code>",
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.onText(/\/admin/, async (msg) => {
    const chatId = String(msg.chat.id);
    const firstName = msg.from.first_name || 'Admin';

    // Faqat haqiqiy adminga ruxsat berish, begona odamlarni qaytarish
    if (!ADMIN_CHAT_IDS.includes(chatId)) {
      return bot.sendMessage(chatId, 
        "⛔️ <b>Kechirasiz, siz admin emassiz!</b>\n\n" +
        "Ushbu bo'lim faqat <b>kuzavnoy.uzz</b> do'koni egasi uchun mo'ljallangan.\n" +
        `Sizning Telegram ID: <code>${chatId}</code>\n\n` +
        "Agar siz do'kon egasi bo'lsangiz, tizimga kirish uchun: <code>/admin_login 7777</code> buyrug'ini yuboring.", 
        { parse_mode: 'HTML' }
      );
    }

    const isHttps = WEB_APP_URL.startsWith('https://');

    bot.sendMessage(chatId, 
      `👨‍💼 <b>kuzavnoy.uzz — Boshqaruv Paneli (Admin)</b>\n\n` +
      `Xush kelibsiz, <b>${firstName}</b>!\n` +
      `Pastdagi tugmani bosib, Telegram ichida barcha buyurtmalar va omborni boshqarishingiz mumkin! 👇`, 
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: isHttps ? [
            [
              { text: "📊 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }
            ],
            [
              { text: "🛒 Mijoz do'koni (Mini App)", web_app: { url: WEB_APP_URL } }
            ]
          ] : [
            [
              { text: "📊 Admin Dashboardni ochish", url: `${WEB_APP_URL}/admin` }
            ]
          ]
        }
      }
    );
  });

  bot.onText(/\/start/, async (msg) => {
    const chatId = String(msg.chat.id);
    const firstName = msg.from.first_name || 'Hurmatli mijoz';

    // Foydalanuvchini bazaga qo'shish
    try {
      await pool.query(
        `INSERT INTO users (telegram_id, name) VALUES ($1, $2) ON CONFLICT (telegram_id) DO UPDATE SET name = $2`,
        [chatId, firstName]
      );
    } catch (e) {
      console.error('User save error:', e.message);
    }

    const isHttps = WEB_APP_URL.startsWith('https://');
    const isAdmin = ADMIN_CHAT_IDS.includes(chatId);

    const welcomeText = 
      `Assalomu alaykum, <b>${firstName}</b>!\n\n` +
      `🚗 <b>kuzavnoy.uzz — Professional Avto Ehtiyot Qismlari va Tyuning Markazi</b>\n\n` +
      `Biz avtomobilingiz uchun 100% original, kafolatlangan va yuqori sifatli ehtiyot qismlar, salon aksessuarlari va kuzov jihozlarini yetkazib beramiz.\n\n` +
      `🔹 <b>Bizning asosiy yo'nalishlarimiz:</b>\n` +
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

    const buttons = [];
    if (isHttps) {
      buttons.push([
        { text: "🛒 Katalog & Xarid qilish (Mini App)", web_app: { url: WEB_APP_URL } }
      ]);
      if (isAdmin) {
        buttons.push([
          { text: "👨‍💼 Admin Dashboardni ochish", web_app: { url: `${WEB_APP_URL}/admin` } }
        ]);
      }
      buttons.push([
        { text: "📸 Instagram (@kuzavnoy.uzz)", url: "https://instagram.com/kuzavnoy.uzz" },
        { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
      ]);
    } else {
      buttons.push([
        { text: "🌐 Do'konni ochish", url: WEB_APP_URL }
      ]);
      if (isAdmin) {
        buttons.push([
          { text: "👨‍💼 Admin Panel", url: `${WEB_APP_URL}/admin` }
        ]);
      }
      buttons.push([
        { text: "📸 Instagram (@kuzavnoy.uzz)", url: "https://instagram.com/kuzavnoy.uzz" },
        { text: "▶️ YouTube", url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G" }
      ]);
    }

    bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  });
} catch (e) {
  console.error('Telegram bot ishga tushmadi:', e.message);
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
    const { name, description, details, old_price, new_price, category, image_url, condition } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, description, details, old_price, new_price, category, image_url, condition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description, JSON.stringify(details || []), old_price || 0, new_price, category, image_url, condition || 'Yangi']
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
    const { name, description, details, old_price, new_price, category, image_url, condition } = req.body;
    const result = await pool.query(
      `UPDATE products 
       SET name=$1, description=$2, details=$3, old_price=$4, new_price=$5, category=$6, image_url=$7, condition=$8
       WHERE id=$9 RETURNING *`,
      [name, description, JSON.stringify(details || []), old_price, new_price, category, image_url, condition || 'Yangi', id]
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
    const { status } = req.body;
    const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Buyurtma topilmadi" });
    const order = result.rows[0];

    // Status yangilanganda mijozga Telegram bot orqali avtomatik xabar berish
    if (bot && order.telegram_id && String(order.telegram_id) !== '0') {
      let statusIcon = 'ℹ️';
      let statusMsg = `Buyurtmangiz holati: <b>${status}</b> ga o'zgardi.`;
      if (status === 'Jarayonda') {
        statusIcon = '✅';
        statusMsg = "Sizning buyurtmangiz <b>qabul qilindi va tayyorlanmoqda</b>! Tez orada kuryerimiz siz bilan bog'lanadi 🚗💨";
      } else if (status === 'Yetkazildi') {
        statusIcon = '🟢';
        statusMsg = "Buyurtmangiz <b>muvaffaqiyatli yetkazib berildi</b>! Xaridingiz uchun rahmat! 🎉";
      } else if (status === 'Bekor qilindi') {
        statusIcon = '🔴';
        statusMsg = "Buyurtmangiz <b>bekor qilindi</b>. Qo'shimcha savollaringiz bo'lsa biz bilan bog'lanishingiz mumkin.";
      }
      bot.sendMessage(order.telegram_id,
        `${statusIcon} <b>kuzavnoy.uzz — Buyurtma holati yangilandi!</b>\n\n` +
        `🆔 <b>Buyurtma raqami:</b> #${order.id}\n` +
        `📌 <b>Yangi holat:</b> <b>${status}</b>\n\n` +
        `${statusMsg}\n\n` +
        `<i>kuzavnoy.uzz rasmiy do'koni</i>`,
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
      instagram_url, youtube_url, store_address, store_hours 
    } = req.body;
    const result = await pool.query(
      `INSERT INTO store_settings (id, card_number, card_holder, uzcard_number, uzcard_holder, humo_number, humo_holder, visa_number, visa_holder, phone, phone2, phone3, instagram_url, youtube_url, store_address, store_hours, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
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
         store_address = EXCLUDED.store_address,
         store_hours = EXCLUDED.store_hours,
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
        store_address || 'Toshkent sh., Sergeli mashina bozori, 4-qator 12-do\'kon',
        store_hours || '09:00 - 19:00'
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
    const { telegram_id, customer_name, phone, items, total_price, location, delivery_type, payment_method } = req.body;

    const dType = delivery_type === 'pickup' ? 'pickup' : 'delivery';
    const pMethod = payment_method === 'card' ? 'card' : 'cash';

    const result = await pool.query(
      `INSERT INTO orders (telegram_id, customer_name, phone, items, total_price, location, delivery_type, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [telegram_id || 0, customer_name, phone, JSON.stringify(items), total_price, location, dType, pMethod]
    );

    const order = result.rows[0];

    const dTypeText = dType === 'pickup' ? "🏬 O'zi olib ketish (Do'kondan / Samovivoz)" : "🚚 Kuryer orqali yetkazib berish";
    const pMethodText = pMethod === 'card' ? "💳 Karta orqali oldindan to'lov (Uzcard / Humo / Visa)" : "💵 Qabul qilinganda to'lash (Naqd / Kuryerga)";

    // Telegram Bot orqali mijozga tasdiqlash xabari yuborish
    if (bot && telegram_id && telegram_id !== 0) {
      try {
        let itemsList = items.map((it, idx) => `• ${it.name} (${it.quantity || 1} dona) — ${((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm`).join('\n');
        
        const messageText = 
          `🎉 <b>Buyurtmangiz muvaffaqiyatli qabul qilindi!</b>\n` +
          (dType === 'pickup' ? `Do'konimizdan olib ketishingiz mumkin 🏬\n\n` : `Kuryerimiz tez orada siz bilan bog'lanadi 🚗💨\n\n`) +
          `<b>Buyurtma raqami:</b> #${order.id}\n` +
          `<b>Mijoz:</b> ${customer_name}\n` +
          `<b>Telefon:</b> ${phone}\n` +
          `<b>Yetkazish turi:</b> ${dTypeText}\n` +
          `<b>To'lov usuli:</b> ${pMethodText}\n` +
          (dType === 'delivery' ? `<b>Yetkazish manzili:</b> ${location || "Ko'rsatilmagan"}\n\n` : `<b>Do'kon manzili:</b> Toshkent sh., Sergeli mashina bozori\n\n`) +
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
        let itemsList = items.map((it, idx) => 
          `   ${idx + 1}. <b>${it.name}</b>\n` +
          `      └ <i>${it.quantity || 1} dona × ${it.new_price.toLocaleString()} so'm = <b>${((it.quantity || 1) * it.new_price).toLocaleString()} so'm</b></i>`
        ).join('\n');
        
        const adminText = 
          `🚗 <b>kuzavnoy.uzz — YANGI BUYURTMA!</b> 🚗\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Buyurtma raqami:</b> <code>#${order.id}</code>\n` +
          `⏰ <b>Vaqti:</b> <i>${new Date().toLocaleString('uz-UZ')}</i>\n\n` +
          `👤 <b>MIJOZ MA'LUMOTLARI:</b>\n` +
          `• <b>Ismi:</b> <b>${customer_name}</b>\n` +
          `• <b>Telefon:</b> <code>${phone}</code>\n` +
          `• <b>Telegram ID:</b> <code>${telegram_id || 'Mavjud emas'}</code>\n\n` +
          `🚚 <b>YETKAZIB BERISH:</b>\n` +
          `• <b>Turi:</b> ${dTypeText}\n` +
          `• <b>Manzil:</b> <i>${location || "Ko'rsatilmagan"}</i>\n\n` +
          `💳 <b>TO'LOV HOLATI:</b>\n` +
          `• <b>Usuli:</b> ${pMethodText}\n` +
          `• <b>JAMI TUSHUM:</b> 💰 <b>${total_price.toLocaleString()} SO'M</b>\n\n` +
          `📦 <b>BUYURTMA TARKIBI (${items.length} xil detal):</b>\n` +
          `${itemsList}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👇 <i>Buyurtmani boshqarish uchun pastdagi tugmani bosing:</i>`;

        for (const adminId of ADMIN_CHAT_IDS) {
          bot.sendMessage(adminId, adminText, { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📊 Admin Panelda ko'rish",
                    web_app: { url: `${WEB_APP_URL}/admin` }
                  }
                ]
              ]
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
        pickupStoreAddress: "Toshkent sh., Sergeli mashina bozori (Samovivoz)",
        pickupStoreBadge: "Samovivoz manzili: Toshkent sh., Sergeli mashina bozori, 4-qator 12-do'kon. Ish vaqti: 09:00 - 19:00",
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
        pickupStoreAddress: "Tashkent city, Sergeli car market (Pickup)",
        pickupStoreBadge: "Pickup address: Tashkent, Sergeli car market, row 4, shop 12. Working hours: 09:00 - 19:00",
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

    function App() {
      const [lang, setLang] = useState(localStorage.getItem('kuzavnoy_lang') || 'uz');
      const [theme, setTheme] = useState(localStorage.getItem('kuzavnoy_theme') || 'light');
      const [activeTab, setActiveTab] = useState('home'); // home | catalog | cart | profile
      const [products, setProducts] = useState([]);
      const [cart, setCart] = useState([]);
      const [selectedProduct, setSelectedProduct] = useState(null); // Bottom sheet
      const [selectedCategory, setSelectedCategory] = useState('Barchasi');
      const [addOnFragrance, setAddOnFragrance] = useState(false);
      const [userOrders, setUserOrders] = useState([]);
      const [activeStory, setActiveStory] = useState(null);
      const [stories, setStories] = useState([]);
      const [showOnboarding, setShowOnboarding] = useState(false);
      const [onboardSlide, setOnboardSlide] = useState(0);

      // Buyurtma formasi
      const [custName, setCustName] = useState('');
      const [custPhone, setCustPhone] = useState('+998 ');
      const [custAddress, setCustAddress] = useState('');
      const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' | 'pickup'
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
        instagram_url: 'https://instagram.com/kuzavnoy.uzz',
        youtube_url: 'https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G',
        store_address: "Toshkent sh., Sergeli mashina bozori, 4-qator 12-do'kon",
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

      const fetchProducts = async () => {
        try {
          const res = await fetch('/api/products');
          const data = await res.json();
          setProducts(data);
        } catch (e) {
          console.error(e);
        }
      };

      const fetchStories = async () => {
        try {
          const res = await fetch('/api/stories');
          const data = await res.json();
          setStories(data);
        } catch (e) {
          console.error(e);
        }
      };

      const fetchUserOrders = async (tgId) => {
        try {
          const res = await fetch('/api/user/orders/' + tgId);
          const data = await res.json();
          setUserOrders(data);
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

      const availableCards = useMemo(() => {
        const list = [];
        if (settings.uzcard_number && settings.uzcard_number.trim()) {
          list.push({ type: 'uzcard', name: 'Uzcard', number: settings.uzcard_number, holder: settings.uzcard_holder || settings.card_holder, badge: '🔵 UZCARD' });
        }
        if (settings.humo_number && settings.humo_number.trim()) {
          list.push({ type: 'humo', name: 'Humo', number: settings.humo_number, holder: settings.humo_holder || settings.card_holder, badge: '🟠 HUMO' });
        }
        if (settings.visa_number && settings.visa_number.trim()) {
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

          const finalLocation = deliveryType === 'pickup' 
            ? t('pickupStoreAddress')
            : (custAddress || (lang === 'ru' ? "г. Ташкент (Доставка)" : (lang === 'en' ? "Tashkent city (Delivery)" : "Toshkent shahri (Yetkazib berish)")));

          const payload = {
            telegram_id: tgUser.id,
            customer_name: custName,
            phone: custPhone,
            items: finalItems,
            total_price: cartTotal,
            location: finalLocation,
            delivery_type: deliveryType,
            payment_method: paymentMethod
          };

          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            setCart([]);
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
        'Malibu 1 / 2', 
        'Tracker 1 / 2', 
        'Onix', 
        'Nexia 1 / 2 / 3', 
        'Monjaro / Xitoy', 
        'Kia / Hyundai', 
        'Universal / Boshqa'
      ];
      const categories = ['Barchasi', ...new Set([...carPresets.slice(1), ...products.map(p => p.category).filter(Boolean)])];
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

            {/* STORY MODAL */}
            {activeStory && (
              <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 text-white">
                <div className={'sticky bottom-0 z-10 flex items-center justify-between pt-3 pb-1 mt-2 border-t backdrop-blur ' + (isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-100')}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs">K</div>
                    <span className="text-xs font-semibold">{t('appName')}</span>
                  </div>
                  <button onClick={() => setActiveStory(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">✕</button>
                </div>
                <div className="my-auto text-center px-4">
                  <img src={activeStory.image_url || activeStory.img} className="w-full max-h-72 object-cover rounded-2xl mb-4 border border-white/10 shadow-2xl" />
                  <h3 className="text-xl font-bold mb-2">{activeStory.title}</h3>
                  <p className="text-sm text-slate-300">{activeStory.description || activeStory.desc}</p>
                </div>
                <button 
                  onClick={() => { setActiveStory(null); setActiveTab('catalog'); }}
                  className="w-full py-3.5 bg-white text-slate-900 font-bold rounded-xl active:scale-95 transition"
                >
                  {t('viewInCatalog')}
                </button>
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
                      className={'px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition flex items-center gap-1 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-rose-400 hover:border-rose-500' : 'bg-white border-rose-200 text-rose-600 shadow-sm')}
                    >
                      <span>📸</span>
                      <span>Instagram</span>
                    </a>
                    <a 
                      href={settings.youtube_url || "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"} 
                      target="_blank" 
                      className={'px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition flex items-center gap-1 ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 text-red-400 hover:border-red-500' : 'bg-white border-red-200 text-red-600 shadow-sm')}
                    >
                      <span>▶️</span>
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
                        onClick={() => setActiveStory(s)}
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
                  {filteredProducts.map(product => (
                    <div 
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={'rounded-2xl p-3 flex gap-3 cursor-pointer shadow-sm transition border ' + 
                        (isDark ? 'bg-slate-900/90 border-slate-800 active:bg-slate-850' : 'bg-white border-slate-200 active:bg-slate-50')}
                    >
                      <img src={product.image_url} className="w-24 h-24 rounded-xl object-cover flex-shrink-0 bg-slate-800/10" />
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-wide">{product.category}</span>
                            <span className={'text-[8px] font-black px-1.5 py-0.5 rounded ' + 
                              (product.condition === 'B/U (Ideal)' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30')}>
                              {product.condition === 'B/U (Ideal)' ? '🔄 B/U (Ideal)' : '✨ Yangi'}
                            </span>
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
                            onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition flex items-center gap-1"
                          >
                            <span>{t('add')}</span>
                            <span>+</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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

                      {/* Manzil yoki Samovivoz tafsiloti */}
                      {deliveryType === 'delivery' ? (
                        <div>
                          <label className={'text-[10px] font-bold block mb-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('addressLabel')}</label>
                          <input 
                            type="text" 
                            value={custAddress}
                            onChange={e => setCustAddress(e.target.value)}
                            placeholder={t('addressPlaceholder')}
                            className={'w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:border-red-500 ' + 
                              (isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
                          />
                        </div>
                      ) : (
                        <div className={'p-3 rounded-2xl border flex items-start gap-2.5 ' + (isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-red-50/60 border-red-100 text-slate-800')}>
                          <span className="text-base">📍</span>
                          <div className="text-[11px] leading-relaxed">
                            <span className="font-bold block text-xs">{t('pickupStoreAddress')}</span>
                            <span className={'text-[10px] block mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('pickupStoreBadge')}</span>
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
                <h1 className="text-lg font-black mb-0.5">{t('profileTitle')}</h1>
                <p className={'text-xs mb-4 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{t('profileDesc')}</p>

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

                {/* Ijtimoiy Sahifalar (Task 8) */}
                <div className={'p-4 rounded-3xl border mb-3 ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                  <h4 className="text-xs font-black uppercase tracking-wider mb-2.5 text-red-500">{t('socialChannels')}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={settings.instagram_url || "https://instagram.com/kuzavnoy.uzz"} 
                      target="_blank" 
                      className={'p-2.5 rounded-2xl border flex items-center gap-2 transition ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 hover:border-rose-500' : 'bg-slate-50 border-slate-200 hover:border-rose-400')}
                    >
                      <span className="text-lg">📸</span>
                      <div>
                        <span className="text-[11px] font-bold block leading-tight">Instagram</span>
                        <span className="text-[9px] text-slate-400">@kuzavnoy.uzz</span>
                      </div>
                    </a>
                    <a 
                      href={settings.youtube_url || "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"} 
                      target="_blank" 
                      className={'p-2.5 rounded-2xl border flex items-center gap-2 transition ' + 
                        (isDark ? 'bg-slate-950 border-slate-800 hover:border-red-500' : 'bg-slate-50 border-slate-200 hover:border-red-400')}
                    >
                      <span className="text-lg">▶️</span>
                      <div>
                        <span className="text-[11px] font-bold block leading-tight">YouTube</span>
                        <span className="text-[9px] text-slate-400">kuzavnoy.uzz</span>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Do'kon bilan aloqa (3 ta telefon raqami va Manzil) */}
                <div className={'p-4 rounded-3xl border mb-5 ' + (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                  <h4 className="text-xs font-black uppercase tracking-wider mb-2.5 text-emerald-500 flex items-center gap-1.5">
                    <span>📞</span>
                    <span>Aloqa & Qo'ng'iroq Markazi</span>
                  </h4>
                  <div className="space-y-2.5">
                    {/* Asosiy telefon */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={'text-[10px] font-bold block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Asosiy raqam</span>
                        <span className={'text-xs font-mono font-black ' + (isDark ? 'text-slate-200' : 'text-slate-800')}>{settings.phone || "+998 90 123 45 67"}</span>
                      </div>
                      <a 
                        href={'tel:' + (settings.phone || '+998901234567').replace(/\s+/g, '')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black shadow transition active:scale-95 flex items-center gap-1"
                      >
                        <span>📞</span>
                        <span>{t('callStore')}</span>
                      </a>
                    </div>

                    {/* Qo'shimcha telefon 1 */}
                    {settings.phone2 && (
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

                    {/* Qo'shimcha telefon 2 */}
                    {settings.phone3 && (
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
                  <div className={'text-[10px] mt-2.5 pt-2.5 border-t flex items-center gap-1.5 ' + (isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500')}>
                    <span>📍</span>
                    <span>{settings.store_address || "Toshkent sh., Sergeli mashina bozori"}</span>
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

                        {/* Buyurtma Holat Bannerni Ko'rsatish */}
                        <div className={'p-2 rounded-xl mb-2.5 text-[11px] font-bold flex items-center gap-2 border ' + 
                          (o.status === 'Jarayonda' ? (isDark ? 'bg-sky-950/60 border-sky-800/50 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-800') : 
                          (o.status === 'Yetkazildi' ? (isDark ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : 
                          (o.status === 'Bekor qilindi' ? (isDark ? 'bg-rose-950/60 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800') : 
                          (isDark ? 'bg-amber-950/60 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'))))}>
                          <span className="text-sm">
                            {o.status === 'Jarayonda' ? '✅' : (o.status === 'Yetkazildi' ? '🎉' : (o.status === 'Bekor qilindi' ? '🔴' : '⏳'))}
                          </span>
                          <span>
                            {o.status === 'Jarayonda' ? 'Buyurtmangiz qabul qilindi va tayyorlanmoqda! 🚗💨' : 
                            (o.status === 'Yetkazildi' ? 'Buyurtma yetkazildi! Xaridingiz uchun rahmat!' : 
                            (o.status === 'Bekor qilindi' ? 'Buyurtma bekor qilingan.' : "Buyurtma ko'rib chiqilmoqda (Kutilmoqda)..."))}
                          </span>
                        </div>
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
              <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-0">
                <div className={'w-full max-w-md rounded-t-3xl p-5 border-t max-h-[85vh] overflow-y-auto no-scrollbar animate-slide-up ' + 
                  (isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                  
                  <div className="w-12 h-1 bg-slate-400/40 rounded-full mx-auto mb-4" />
                  
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-3.5 bg-slate-800/10">
                    <img src={selectedProduct.image_url} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/70 backdrop-blur px-2 py-0.5 rounded text-white">
                      {selectedProduct.category}
                    </span>
                  </div>

                  <h2 className="text-base font-black mb-1">{selectedProduct.name}</h2>
                  <p className={'text-xs mb-3 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{selectedProduct.description}</p>

                  {/* Mahsulot Holati va Kafolati Bloki */}
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
                        onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg active:scale-95 transition"
                      >
                        {t('add')} 🛒
                      </button>
                      <button 
                        onClick={() => setSelectedProduct(null)}
                        className={'px-3.5 py-2.5 font-bold rounded-xl text-xs ' + (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}
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
        instagram_url: "https://instagram.com/kuzavnoy.uzz",
        youtube_url: "https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G",
        store_address: "Toshkent sh., Sergeli mashina bozori, 4-qator 12-do'kon",
        store_hours: "09:00 - 19:00"
      });
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
      const [editingProduct, setEditingProduct] = useState(null);
      const [productImagePreview, setProductImagePreview] = useState("");
      const [formData, setFormData] = useState({
        name: "", category: "Cobalt", new_price: "", old_price: "",
        image_url: "", description: "", detailsText: "", condition: "Yangi"
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
          setOrders(data);
        } catch(e) {}
      };

      const checkForNewOrders = async () => {
        try {
          const res = await fetch("/api/orders");
          const data = await res.json();
          setOrders(prev => {
            if (prev.length > 0 && data.length > prev.length) {
              if (soundEnabled) playChime();
            }
            return data;
          });
        } catch(e) {}
      };

      const fetchProducts = async () => {
        try {
          const res = await fetch("/api/products");
          const data = await res.json();
          setProducts(data);
        } catch(e) {}
      };

      const fetchUsers = async () => {
        try {
          const res = await fetch("/api/users");
          const data = await res.json();
          setUsers(data);
        } catch(e) {}
      };

      const fetchStories = async () => {
        try {
          const res = await fetch("/api/stories");
          const data = await res.json();
          setStories(data);
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
        try {
          await fetch("/api/orders/" + id + "/status", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
          });
          fetchOrders();
        } catch(e) {
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
                  "<div style='font-size: 10px; color: #64748b; margin-top: 2px;'>" + (settings.store_address || "Toshkent sh., Sergeli mashina bozori") + "</div>" +
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
            details: formData.detailsText.split("\\n").filter(Boolean)
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
                onClick={loadAllData}
                className={'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ' + 
                  (isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm')}
              >
                <span>{t('refresh')}</span> 🔄
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

                {/* Status Filtrlar */}
                <div className={'px-6 py-2.5 border-b flex gap-2 overflow-x-auto no-scrollbar ' + (isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  {["Barchasi", "Kutilmoqda", "Jarayonda", "Yetkazildi", "Bekor qilindi"].map(st => (
                    <button
                      key={st}
                      onClick={() => setOrderStatusFilter(st)}
                      className={'px-3 py-1 rounded-lg text-xs font-bold transition ' + 
                        (orderStatusFilter === st 
                          ? (isDark ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-slate-900 border border-slate-300 shadow-sm') 
                          : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}
                    >
                      {st === 'Barchasi' ? t('all') : (st === 'Kutilmoqda' ? t('pending') : (st === 'Jarayonda' ? t('processing') : (st === 'Yetkazildi' ? t('delivered') : t('cancelled'))))}
                    </button>
                  ))}
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
                              <div className={'text-[10px] line-clamp-1 mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{order.location}</div>
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
                                <option value="Yetkazildi">🟢 {t('delivered')}</option>
                                <option value="Bekor qilindi">🔴 {t('cancelled')}</option>
                              </select>
                            </td>
                            <td className="p-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => printThermalReceipt(order)}
                                  title="Chekni chop etish"
                                  className={'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ' + 
                                    (isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300')}
                                >
                                  <span>🧾</span>
                                  <span>{t('receipt')}</span>
                                </button>
                                {order.status === "Bekor qilindi" && (
                                  <button 
                                    onClick={() => handleDeleteOrder(order.id)}
                                    title="Bekor qilingan buyurtmani bazadan tozalash (Task 2)"
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-rose-600/15 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 transition flex items-center gap-1"
                                  >
                                    <span>🗑</span>
                                    <span className="hidden sm:inline">O'chirish</span>
                                  </button>
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
                      onClick={() => {
                        setEditingProduct(null);
                        setProductImagePreview("");
                        setFormData({
                          name: "", category: "Cobalt", new_price: "", old_price: "",
                          image_url: "", description: "", detailsText: "Original sifat\\nKafolat beriladi",
                          condition: "Yangi"
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
                  {["Barchasi", "Cobalt", "Gentra / Lacetti", "Malibu 1 / 2", "Tracker 1 / 2", "Onix", "Nexia 1 / 2 / 3", "Monjaro / Xitoy", "Kia / Hyundai", "Universal / Boshqa"].map(cat => (
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
                            <div className="flex items-center gap-1.5 mt-1">
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
                                    category: prod.category || "Cobalt",
                                    new_price: prod.new_price,
                                    old_price: prod.old_price || "",
                                    image_url: prod.image_url,
                                    description: prod.description || "",
                                    condition: prod.condition || "Yangi",
                                    detailsText: (Array.isArray(prod.details) ? prod.details : []).join("\\n")
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
                      <span className="text-xs font-black text-blue-500 flex items-center gap-1.5">🔵 UZCARD</span>
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
                      <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">🟠 HUMO</span>
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
                        <span className="text-xs font-black text-emerald-500 flex items-center gap-1.5">🟡 VISA / MASTERCARD (Ixtiyoriy)</span>
                        <span className="text-[10px] text-slate-400">Agar bo'sh qoldirilsa, Mini Appda Visa chiqmaydi</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Visa Karta Raqami</label>
                          <input 
                            type="text"
                            value={settings.visa_number || ''}
                            onChange={e => setSettings({ ...settings, visa_number: e.target.value })}
                            placeholder="4000 1234 5678 9010 (Bo'sh bo'lsa ko'rinmaydi)"
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
                      <div>
                        <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Asosiy Telefon *</label>
                        <input 
                          type="text"
                          required
                          value={settings.phone || ''}
                          onChange={e => setSettings({ ...settings, phone: e.target.value })}
                          placeholder="+998 90 123 45 67"
                          className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <span className={'text-[10px] mt-1 block ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>Cheklarda va do'konda</span>
                      </div>

                      <div>
                        <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Qo'shimcha 1 (Call-markaz)</label>
                        <input 
                          type="text"
                          value={settings.phone2 || ''}
                          onChange={e => setSettings({ ...settings, phone2: e.target.value })}
                          placeholder="+998 97 765 43 21"
                          className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <span className={'text-[10px] mt-1 block ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>Mijoz profilida chiqadi</span>
                      </div>

                      <div>
                        <label className={'font-bold block mb-1 text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Qo'shimcha 2 (Texnik yordam)</label>
                        <input 
                          type="text"
                          value={settings.phone3 || ''}
                          onChange={e => setSettings({ ...settings, phone3: e.target.value })}
                          placeholder="+998 99 888 77 66"
                          className={'w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <span className={'text-[10px] mt-1 block ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>Konsultatsiya uchun</span>
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
                      <div>
                        <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{t('instagramUrlLabel')}</label>
                        <input 
                          type="url"
                          required
                          value={settings.instagram_url || ''}
                          onChange={e => setSettings({ ...settings, instagram_url: e.target.value })}
                          placeholder="https://instagram.com/kuzavnoy.uzz"
                          className={'w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{t('youtubeUrlLabel')}</label>
                        <input 
                          type="url"
                          required
                          value={settings.youtube_url || ''}
                          onChange={e => setSettings({ ...settings, youtube_url: e.target.value })}
                          placeholder="https://youtube.com/@kuzavnoyuzz?si=dSHr1EF4AXNE7k6G"
                          className={'w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. DO'KON MANZILI & ISH VAQTI */}
                  <div className={'p-5 rounded-2xl border space-y-4 ' + (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
                      <span>🏬</span>
                      <span>{t('storeLocationHeader')}</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{t('storeAddressLabel')}</label>
                        <input 
                          type="text"
                          required
                          value={settings.store_address || ''}
                          onChange={e => setSettings({ ...settings, store_address: e.target.value })}
                          placeholder="Toshkent sh., Sergeli mashina bozori, 4-qator 12-do'kon"
                          className={'w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                      </div>

                      <div>
                        <label className={'font-bold block mb-1.5 ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{t('storeHoursLabel')}</label>
                        <input 
                          type="text"
                          required
                          value={settings.store_hours || ''}
                          onChange={e => setSettings({ ...settings, store_hours: e.target.value })}
                          placeholder="09:00 - 19:00"
                          className={'w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-red-500 ' + 
                            (isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
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

          {/* CHEK / RECEIPT MODAL */}
          {selectedReceiptOrder && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
                <button onClick={() => setSelectedReceiptOrder(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">✕</button>
                
                <div className="text-center pb-4 border-b border-dashed border-slate-200">
                  <h3 className="text-lg font-black tracking-tight">kuzavnoy.uzz</h3>
                  <p className="text-xs text-slate-500">{t('controlHub')}</p>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Buyurtma #{selectedReceiptOrder.id} • {new Date(selectedReceiptOrder.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="py-3 text-xs border-b border-dashed border-slate-200 space-y-1">
                  <div><b>Mijoz:</b> {selectedReceiptOrder.customer_name}</div>
                  <div><b>Telefon:</b> {selectedReceiptOrder.phone}</div>
                  <div><b>Yetkazish turi:</b> {selectedReceiptOrder.delivery_type === 'pickup' ? "🏬 Do'kondan olib ketish (Samovivoz)" : "🚚 Kuryer orqali yetkazish"}</div>
                  <div><b>To'lov usuli:</b> {selectedReceiptOrder.payment_method === 'card' ? "💳 Karta / Visa / Click (Oldindan to'lov)" : "💵 Naqd to'lov (Yetkazilganda)"}</div>
                  <div><b>Manzil:</b> {selectedReceiptOrder.location || "Ko'rsatilmagan"}</div>
                  <div><b>Holat:</b> {selectedReceiptOrder.status}</div>
                </div>

                <div className="py-3 space-y-2 border-b border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">{t('itemsList')}</div>
                  {(Array.isArray(selectedReceiptOrder.items) ? selectedReceiptOrder.items : (typeof selectedReceiptOrder.items === 'string' ? JSON.parse(selectedReceiptOrder.items || '[]') : [])).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span>{it.name} x {it.quantity || 1}</span>
                      <span className="font-bold">{((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold">{t('totalSum')}</span>
                  <span className="text-base font-black text-red-600">
                    {selectedReceiptOrder.total_price?.toLocaleString()} so'm
                  </span>
                </div>

                <div className="mt-5 flex gap-2">
                  <button onClick={() => printThermalReceipt(selectedReceiptOrder)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition">
                    {t('printReceipt')}
                  </button>
                  {selectedReceiptOrder.status === "Bekor qilindi" && (
                    <button 
                      onClick={() => {
                        const id = selectedReceiptOrder.id;
                        setSelectedReceiptOrder(null);
                        handleDeleteOrder(id);
                      }} 
                      className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1"
                    >
                      <span>🗑</span>
                      <span>O'chirish</span>
                    </button>
                  )}
                  <button onClick={() => setSelectedReceiptOrder(null)} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">
                    {t('close')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCT MODAL */}
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

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={'block mb-1 font-semibold ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>{t('categoryCarModel')}</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className={'w-full p-2.5 border rounded-xl focus:outline-none ' + 
                          (isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}
                      >
                        <option value="Cobalt">Cobalt</option>
                        <option value="Gentra / Lacetti">Gentra / Lacetti</option>
                        <option value="Malibu 1 / 2">Malibu 1 / 2</option>
                        <option value="Tracker 1 / 2">Tracker 1 / 2</option>
                        <option value="Onix">Onix</option>
                        <option value="Nexia 1 / 2 / 3">Nexia 1 / 2 / 3</option>
                        <option value="Monjaro / Xitoy">Monjaro / Xitoy</option>
                        <option value="Kia / Hyundai">Kia / Hyundai</option>
                        <option value="Universal / Boshqa">Universal / Boshqa</option>
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

