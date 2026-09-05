// ==============================================================================
// kuzavnoy.uzz — ALL-IN-ONE SINGLE FILE APPLICATION
// Telegram Bot + REST API + PostgreSQL (Neon) + React Mini App + React Admin Panel
// ==============================================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');

// 1. SOZLAMALAR (CONFIG)
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '8847186451:AAHk4YYqvkuo1pjQjdGsFRnhKbY9VABlBQs';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_ePwm65vBoGJY@ep-spring-snow-a5z1caba-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
// Ngrok, Render yoki HTTPS domeni
let WEB_APP_URL = process.argv[2] || process.env.WEB_APP_URL || (process.env.PORT ? 'https://kuzavnoy-app.onrender.com' : `http://localhost:${PORT}`);

// Adminlarning Telegram ID raqamlari (yangi zakaz tushganda bularga to'g'ridan-to'g'ri xabar boradi)
let ADMIN_CHAT_IDS = ['5361309526'];

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
        status VARCHAR(50) DEFAULT 'Kutilmoqda',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Dastlabki avto-ehtiyot qismlarni (seed) bazaga kiritish (agar baza bo'sh bo'lsa)
    const productsCount = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(productsCount.rows[0].count) === 0) {
      console.log('🌱 Baza bo\'sh, kuzavnoy.uzz avto-ehtiyot qismlari yuklanmoqda...');
      const initialParts = [
        {
          name: "M-Sport Anatomiya Rul (Carbon)",
          description: "Malibu, Tracker va Lacetti uchun qulay sport uslubidagi anatomik rul.",
          details: JSON.stringify([
            "Haqiqiy Nappa charm va uglerod tolali (carbon) qoplama",
            "Ko'p funksiyali audio va kruiz-kontrol boshqaruv tugmalari",
            "Zavodskoy xavfsizlik yostiqchasi (Airbag) bilan to'liq mos",
            "Ergonomik ushlagich va qizdirish funksiyasini qo'llab-quvvatlaydi"
          ]),
          old_price: 1850000,
          new_price: 1450000,
          category: "Rul va Salon",
          image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Malibu 2 O'rta Konsol Bar (Original)",
          description: "Yumshoq tirsaklagichli, simsiz zaryadka o'rni va stakan ushlagichli original bar.",
          details: JSON.stringify([
            "Tezkor simsiz (Wireless) quvvatlash uyasi",
            "LED fonli xrom podstakanniklar",
            "Eko-charm tirsaklagich va keng saqlash bo'linmasi",
            "Zavodskoy fiksatorlarga 100% tushadi, qirqish talab qilinmaydi"
          ]),
          old_price: 1250000,
          new_price: 980000,
          category: "Rul va Salon",
          image_url: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Akustik / Tonirovka Labavoy Oyna (Benson)",
          description: "Ultra-binafsha nurlardan 99% himoyalovchi sifatli original old oyna.",
          details: JSON.stringify([
            "Akustik polimer qatlam (tashqi shovqinni 40% pasaytiradi)",
            "UV va quyosh issiqligini qaytaruvchi Athermal himoya",
            "Yomg'ir va yorug'lik datchigi uchun maxsus tayyor o'rin",
            "Xalqaro DOT va ECE sifat sertifikatlariga ega"
          ]),
          old_price: 1650000,
          new_price: 1290000,
          category: "Oynalar",
          image_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Elektron Buklanadigan Bakavoy Oyna (Juft)",
          description: "Dinamik burilish LED chirog'i va isitgichli avtomatik yon oynalar to'plami.",
          details: JSON.stringify([
            "Elektron qizdirish (muzlashga qarshi) elementi",
            "Dinamik yuguruvchi LED burilish signali",
            "Pult orqali avtomatik yig'ilish va ochilish motori",
            "Ko'r zonalarni ko'rsatuvchi sferik qavariq oyna"
          ]),
          old_price: 1100000,
          new_price: 850000,
          category: "Oynalar",
          image_url: "https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Michelin Pilot Sport Balonlar (215/55 R17)",
          description: "Har qanday ob-havoda maksimal tormozlanish va jim, yumshoq harakat.",
          details: JSON.stringify([
            "Akvaplanatsiyaga qarshi maxsus yomg'ir kanallari",
            "Yuqori tezlikda yo'lga mustahkam yopishish texnologiyasi",
            "Shovqinsiz 'Acoustic Silent' maxsus qatlami",
            "2024-yil yangi ishlab chiqarilgan toza partiya"
          ]),
          old_price: 1950000,
          new_price: 1600000,
          category: "Balon va Disklar",
          image_url: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "VIP Glossy Radiator Panjarasi (Gril)",
          description: "Old qismga tajovuzkor sport qiyofa beruvchi zanglamas qora porloq reshyotka.",
          details: JSON.stringify([
            "Yuqori zarbaga chidamli ABS xrom/gloss plastmassa",
            "Dvigatel sovutish tizimiga to'liq shamol o'tkazish geometriyasi",
            "Zavod mahkamlagichlariga to'liq mos keladi",
            "Quyoshda rangi o'chmaydi va yorilmaydi"
          ]),
          old_price: 890000,
          new_price: 690000,
          category: "Kuzov qismlari",
          image_url: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80"
        }
      ];

      for (const p of initialParts) {
        await client.query(
          `INSERT INTO products (name, description, details, old_price, new_price, category, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [p.name, p.description, p.details, p.old_price, p.new_price, p.category, p.image_url]
        );
      }
      console.log('✅ 6 ta avto-ehtiyot qism bazaga muvaffaqiyatli saqlandi!');
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
    // Polling xatolarini ushlash
    if (error.code !== 'EFATAL') {
      // oddiy xatolar
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
        "Mahsulotlarni ko'rish uchun pastdagi menyudan foydalaning.", 
        { parse_mode: 'HTML' }
      );
    }

    const isHttps = WEB_APP_URL.startsWith('https://');

    bot.sendMessage(chatId, 
      `👨‍💼 <b>kuzavnoy.uzz — Boshqaruv Paneli (Admin)</b>\n\n` +
      `Xush kelibsiz, <b>${firstName}</b>!\n` +
      `Pastdagi tugmani bosib, Telegram ichida barcha buyurtmalar va mahsulotlarni boshqarishingiz mumkin! 👇`, 
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: isHttps ? [
            [
              {
                text: "📊 Admin Dashboardni ochish",
                web_app: { url: `${WEB_APP_URL}/admin` }
              }
            ],
            [
              { text: "🛒 Mijoz do'koni (Mini App)", web_app: { url: WEB_APP_URL } }
            ]
          ] : [
            [
              { text: "🌐 Admin Panelni ochish", url: `${WEB_APP_URL}/admin` }
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
      `🚗 <b>kuzavnoy.uzz</b> — Avtomobil ehtiyot qismlari do'konimizga xush kelibsiz!\n\n` +
      `Bizda: Rullar, Barlar, Labavoy va Bakavoy oynalar, Balonlar hamda original kuzov qismlari mavjud.\n\n` +
      (isAdmin ? `⭐️ <i>Siz tizimda Admin sifatida aniqlandingiz!</i>\n\n` : '') +
      `Pastdagi tugmani bosing va qulay <b>Telegram Mini App</b> orqali xarid qiling! 👇`;

    const buttons = [];
    if (isHttps) {
      buttons.push([
        { text: "🛒 Katalog & Xarid qilish (Mini App)", web_app: { url: WEB_APP_URL } }
      ]);
      if (isAdmin) {
        buttons.push([
          { text: "👨‍💼 Admin Panelni ochish (Telegram ichida)", web_app: { url: `${WEB_APP_URL}/admin` } }
        ]);
      }
    } else {
      buttons.push([
        { text: "🌐 Do'konni brauzerda ochish", url: WEB_APP_URL }
      ]);
      if (isAdmin) {
        buttons.push([
          { text: "👨‍💼 Admin Panel", url: `${WEB_APP_URL}/admin` }
        ]);
      }
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
app.use(express.json());

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
    const { name, description, details, old_price, new_price, category, image_url } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, description, details, old_price, new_price, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description, JSON.stringify(details || []), old_price || 0, new_price, category, image_url]
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
    const { name, description, details, old_price, new_price, category, image_url } = req.body;
    const result = await pool.query(
      `UPDATE products 
       SET name=$1, description=$2, details=$3, old_price=$4, new_price=$5, category=$6, image_url=$7
       WHERE id=$8 RETURNING *`,
      [name, description, JSON.stringify(details || []), old_price, new_price, category, image_url, id]
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

// API: Buyurtma holatini yangilash (Admin)
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
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

// API: Barcha Telegram foydalanuvchilariga xabar tarqatish (Broadcast)
app.post('/api/broadcast', async (req, res) => {
  try {
    const { message, photo_url } = req.body;
    if (!message) return res.status(400).json({ error: "Xabar matni kiritilishi shart!" });

    const users = await pool.query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');
    let sentCount = 0;

    for (const u of users.rows) {
      try {
        if (photo_url) {
          await bot.sendPhoto(u.telegram_id, photo_url, { 
            caption: message, 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛍 Do'konga o'tish (Mini App)", web_app: { url: WEB_APP_URL } }]
              ]
            }
          });
        } else {
          await bot.sendMessage(u.telegram_id, message, { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛍 Do'konga o'tish (Mini App)", web_app: { url: WEB_APP_URL } }]
              ]
            }
          });
        }
        sentCount++;
      } catch (sendErr) {}
    }
    res.json({ success: true, sentCount, total: users.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Yangi buyurtma yaratish (Mini App) + Telegram orqali xabar yuborish
app.post('/api/orders', async (req, res) => {
  try {
    const { telegram_id, customer_name, phone, items, total_price, location } = req.body;

    const result = await pool.query(
      `INSERT INTO orders (telegram_id, customer_name, phone, items, total_price, location)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [telegram_id || 0, customer_name, phone, JSON.stringify(items), total_price, location]
    );

    const order = result.rows[0];

    // Telegram Bot orqali mijozga tasdiqlash xabari yuborish
    if (bot && telegram_id && telegram_id !== 0) {
      try {
        let itemsList = items.map(it => `• ${it.name} (${it.quantity || 1} dona) - ${(it.new_price * (it.quantity || 1)).toLocaleString()} so'm`).join('\n');
        
        const messageText = 
          `🎉 <b>Buyurtmangiz muvaffaqiyatli qabul qilindi!</b>\n` +
          `Kuryerimiz tez orada siz bilan bog'lanadi 🚗💨\n\n` +
          `<b>Buyurtma raqami:</b> #${order.id}\n` +
          `<b>Mijoz:</b> ${customer_name}\n` +
          `<b>Telefon:</b> ${phone}\n` +
          `<b>Manzil:</b> ${location || "Ko'rsatilmagan"}\n\n` +
          `<b>Xarid qilingan detallar:</b>\n${itemsList}\n\n` +
          `💰 <b>Jami summa:</b> ${total_price.toLocaleString()} so'm\n\n` +
          `<i>kuzavnoy.uzz ni tanlaganingiz uchun rahmat!</i>`;

        bot.sendMessage(telegram_id, messageText, { parse_mode: 'HTML' });
      } catch (botErr) {
        console.error('Telegram bot xabar yuborishda xatolik:', botErr.message);
      }
    }

    // Telegram Bot orqali ADMINGA yangi buyurtma haqida tezkor xabar (SMS) yuborish
    if (bot && ADMIN_CHAT_IDS && ADMIN_CHAT_IDS.length > 0) {
      try {
        let itemsList = items.map(it => `• <b>${it.name}</b> x ${it.quantity || 1} dona (${(it.new_price * (it.quantity || 1)).toLocaleString()} so'm)`).join('\n');
        
        const adminText = 
          `🚨 <b>YANGI BUYURTMA KELIB TUSHDI! (#${order.id})</b> 🚨\n\n` +
          `👤 <b>Mijoz:</b> ${customer_name}\n` +
          `📞 <b>Telefon:</b> ${phone}\n` +
          `📍 <b>Manzil:</b> ${location || "Ko'rsatilmagan"}\n\n` +
          `📦 <b>Buyurtma tarkibi:</b>\n${itemsList}\n\n` +
          `💰 <b>Jami tushum:</b> <b>${total_price.toLocaleString()} so'm</b>\n` +
          `⏰ <b>Vaqti:</b> ${new Date().toLocaleString('uz-UZ')}\n\n` +
          `<i>Admin panelga kirish uchun: /admin</i>`;

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
  <!-- React & Babel (Tezkor CDN) -->
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      -webkit-tap-highlight-color: transparent;
    }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .animate-slide-up { animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
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
<body class="bg-white text-slate-900 select-none pb-24">
  <div id="root">
    <!-- Yuklanish animatsiyasi (Oq ekran bo'lib qolmasligi uchun) -->
    <div class="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div class="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin-custom mb-3"></div>
      <p class="text-xs font-bold text-slate-700">kuzavnoy.uzz yuklanmoqda...</p>
      <span class="text-[10px] text-slate-400 mt-1">Avto ehtiyot qismlar do'koni</span>
      <div id="debug-err" class="mt-4 text-xs text-red-600 max-w-xs font-mono"></div>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect } = React;

    function App() {
      const [activeTab, setActiveTab] = useState('home'); // home | catalog | cart | profile
      const [products, setProducts] = useState([]);
      const [cart, setCart] = useState([]);
      const [selectedProduct, setSelectedProduct] = useState(null); // Bottom sheet
      const [selectedCategory, setSelectedCategory] = useState('Barchasi');
      const [addOnFragrance, setAddOnFragrance] = useState(false);
      const [userOrders, setUserOrders] = useState([]);
      const [activeStory, setActiveStory] = useState(null);
      const [showOnboarding, setShowOnboarding] = useState(false);
      const [onboardSlide, setOnboardSlide] = useState(0);

      // Buyurtma formasi
      const [custName, setCustName] = useState('');
      const [custPhone, setCustPhone] = useState('+998 ');
      const [custAddress, setCustAddress] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [orderSuccess, setOrderSuccess] = useState(false);

      // Telegram WebApp foydalanuvchi ma'lumotlari
      const tg = window.Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user || { id: 7770001, first_name: "Azizbek", username: "kuzavnoy_fan" };

      useEffect(() => {
        if (tg) {
          tg.ready();
          tg.expand();
        }
        // Onboarding holati
        const seen = localStorage.getItem('kuzavnoy_seen_onboard');
        if (!seen) setShowOnboarding(true);

        if (tgUser?.first_name) {
          setCustName(tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''));
        }

        fetchProducts();
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

      const fetchUserOrders = async (tgId) => {
        try {
          const res = await fetch('/api/user/orders/' + tgId);
          const data = await res.json();
          setUserOrders(data);
        } catch (e) {
          console.error(e);
        }
      };

      // Savat boshqaruvi
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

      // Narxlarni hisoblash
      const cartTotal = cart.reduce((acc, item) => acc + (item.new_price * (item.quantity || 1)), 0) + (addOnFragrance ? 35000 : 0);
      const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

      // Buyurtmani tasdiqlash
      const handleCheckout = async () => {
        if (!custName.trim() || !custPhone.trim() || custPhone.length < 9) {
          alert("Iltimos, ismingiz va to'liq telefon raqamingizni kiriting!");
          return;
        }
        if (cart.length === 0) {
          alert("Savatchangiz bo'sh!");
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

          const payload = {
            telegram_id: tgUser.id,
            customer_name: custName,
            phone: custPhone,
            items: finalItems,
            total_price: cartTotal,
            location: custAddress || "Toshkent shahri (Yetkazib berish)"
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
          alert("Xatolik yuz berdi. Qayta urinib ko'ring!");
        } finally {
          setIsSubmitting(false);
        }
      };

      const categories = ['Barchasi', 'Rul va Salon', 'Oynalar', 'Balon va Disklar', 'Kuzov qismlari'];
      const filteredProducts = selectedCategory === 'Barchasi' 
        ? products 
        : products.filter(p => p.category === selectedCategory);

      // Stories ro'yxati
      const stories = [
        { id: 1, tag: "Yangi", title: "🔥 Yangi partiya", desc: "Original M-Sport anatomik rullari qayta keldi!", img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80" },
        { id: 2, tag: "Chegirma", title: "⚡️ -30% Oynalarga", desc: "Benson va Fuyao labavoy oynalari ulgurji narxda!", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80" },
        { id: 3, tag: "Xizmat", title: "🛠 O'rnatib berish", desc: "Servis markazimizda bepul o'rnatish kafolati mavjud.", img: "https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80" },
        { id: 4, tag: "Original", title: "⭐️ Sifat kafolati", desc: "Barcha mahsulotlar zavod kafolati bilan beriladi.", img: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80" }
      ];

      return (
        <div className="max-w-md mx-auto min-h-screen bg-white text-slate-900 flex flex-col">
          
          {/* ONBOARDING MODAL (Faqat 1-marta ko'rsatiladi) */}
          {showOnboarding && (
            <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between p-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => { setShowOnboarding(false); localStorage.setItem('kuzavnoy_seen_onboard', '1'); }}
                  className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-500"
                >
                  O'tkazib yuborish
                </button>
              </div>

              <div className="text-center px-4 my-auto">
                {onboardSlide === 0 && (
                  <div>
                    <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 rounded-3xl flex items-center justify-center text-4xl shadow-sm border border-slate-200">
                      🚗
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                      Mashinangizga sifatli zapchast qidiryapsizmi?
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      <b>kuzavnoy.uzz</b> — labavoy, bakavoy, rul, bar va barcha turdagi original avto-ehtiyot qismlarni tezkor yetkazib beradi!
                    </p>
                  </div>
                )}
                {onboardSlide === 1 && (
                  <div>
                    <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 rounded-3xl flex items-center justify-center text-4xl shadow-sm border border-slate-200">
                      ⚡️
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                      Bu qanday ishlaydi?
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Katalogdan kerakli detalni tanlang, savatchaga soling va birgina tugma orqali buyurtma bering. Kuryerimiz bevosita yetkazadi.
                    </p>
                  </div>
                )}
                {onboardSlide === 2 && (
                  <div>
                    <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 rounded-3xl flex items-center justify-center text-4xl shadow-sm border border-slate-200">
                      🏆
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                      10,000+ Haydovchilar biz bilan!
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Toshkent va butun O'zbekiston bo'ylab 100% ishonchli va kafolatlangan zapchastlar bitta ilovada jamlangan.
                    </p>
                  </div>
                )}

                {/* Slayd nuqtalari */}
                <div className="flex justify-center gap-1.5 mt-8">
                  {[0, 1, 2].map(idx => (
                    <div 
                      key={idx} 
                      className={'h-1.5 rounded-full transition-all ' + (onboardSlide === idx ? 'w-6 bg-slate-900' : 'w-2 bg-slate-200')} 
                    />
                  ))}
                </div>
              </div>

              <div>
                {onboardSlide < 2 ? (
                  <button 
                    onClick={() => setOnboardSlide(s => s + 1)}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg active:scale-[0.98] transition"
                  >
                    Davom etish →
                  </button>
                ) : (
                  <button 
                    onClick={() => { setShowOnboarding(false); localStorage.setItem('kuzavnoy_seen_onboard', '1'); }}
                    className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-200 active:scale-[0.98] transition"
                  >
                    Boshlash 🚀
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STORY MODAL */}
          {activeStory && (
            <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 text-white">
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs">K</div>
                  <span className="text-xs font-semibold">kuzavnoy.uzz</span>
                </div>
                <button onClick={() => setActiveStory(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">✕</button>
              </div>
              <div className="my-auto text-center px-4">
                <img src={activeStory.img} className="w-full max-h-72 object-cover rounded-2xl mb-4 border border-white/10" />
                <h3 className="text-xl font-bold mb-2">{activeStory.title}</h3>
                <p className="text-sm text-slate-300">{activeStory.desc}</p>
              </div>
              <button 
                onClick={() => { setActiveStory(null); setActiveTab('catalog'); }}
                className="w-full py-3.5 bg-white text-slate-900 font-bold rounded-xl active:scale-95 transition"
              >
                Katalogda ko'rish
              </button>
            </div>
          )}

          {/* 1. ASOSIY SAHIFA (HOME) */}
          {activeTab === 'home' && (
            <div className="px-4 pt-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avto Ehtiyot Qismlar</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Salom, {tgUser.first_name || 'Haydovchi'} 👋
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                    @kuzavnoy.uzz
                  </span>
                </div>
              </div>

              {/* Stories Bloki */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 mb-4">
                {stories.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => setActiveStory(s)}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-red-500 via-rose-400 to-amber-400">
                      <img src={s.img} className="w-full h-full rounded-full object-cover border-2 border-white" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-700 w-16 text-center truncate">{s.tag}</span>
                  </div>
                ))}
              </div>

              {/* Asosiy Hero Vidjet */}
              <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 mb-6 shadow-xl">
                <div className="relative z-10">
                  <span className="inline-block text-[10px] uppercase tracking-widest font-extrabold bg-red-600 px-2 py-0.5 rounded-md mb-2">
                    Rasmiy Mahsulotlar
                  </span>
                  <h2 className="text-xl font-black leading-snug mb-2">
                    Avtomobilingizni yangilang va zavqlaning!
                  </h2>
                  <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                    Original rul, bar, oyna va balonlar kafolat bilan taqdim etiladi.
                  </p>
                  <button 
                    onClick={() => setActiveTab('catalog')}
                    className="px-5 py-2.5 bg-white text-slate-900 text-xs font-black rounded-xl shadow active:scale-95 transition"
                  >
                    Yangi buyurtma berish →
                  </button>
                </div>
                <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />
              </div>

              {/* Populyar Tovarlar */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Eng ko'p xarid qilinganlar</h3>
                <button onClick={() => setActiveTab('catalog')} className="text-xs font-semibold text-red-600">Barchasi</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {products.slice(0, 4).map(product => (
                  <div 
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="group bg-slate-50 border border-slate-100 rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer active:scale-[0.99] transition hover:border-slate-300"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-white mb-2">
                      <img src={product.image_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-slate-800">
                        {product.category}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">{product.name}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          {product.old_price && (
                            <span className="block text-[10px] text-slate-400 line-through leading-none">
                              {product.old_price.toLocaleString()} so'm
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-red-600">
                            {product.new_price.toLocaleString()} so'm
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                          className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow active:scale-90 transition"
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
            <div className="px-4 pt-4">
              <div className="mb-3">
                <h1 className="text-xl font-black text-slate-900">Mahsulotlar Katalogi</h1>
                <p className="text-xs text-slate-500">Kerakli bo'limni tanlang va qulay xarid qiling</p>
              </div>

              {/* Kategoriyalar Gorizontal Skroll */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 mb-4">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition ' + 
                      (selectedCategory === cat 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Mahsulotlar kartochkalari */}
              <div className="space-y-3 mb-6">
                {filteredProducts.map(product => (
                  <div 
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 cursor-pointer shadow-sm active:bg-slate-50 transition"
                  >
                    <img src={product.image_url} className="w-24 h-24 rounded-xl object-cover flex-shrink-0 bg-slate-100" />
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">{product.category}</span>
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-1">{product.name}</h3>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{product.description}</p>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                        <div>
                          {product.old_price && (
                            <span className="text-[10px] text-slate-400 line-through mr-1.5">
                              {product.old_price.toLocaleString()} so'm
                            </span>
                          )}
                          <span className="text-xs font-black text-red-600">
                            {product.new_price.toLocaleString()} so'm
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition flex items-center gap-1"
                        >
                          <span>Qo'shish</span>
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
            <div className="px-4 pt-4">
              <h1 className="text-xl font-black text-slate-900 mb-1">Savatcha</h1>
              <p className="text-xs text-slate-500 mb-4">Tanlangan ehtiyot qismlar va buyurtmani rasmiylashtirish</p>

              {orderSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center my-6">
                  <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center text-3xl mb-3">
                    ✅
                  </div>
                  <h2 className="text-lg font-black text-emerald-900 mb-1">Buyurtmangiz qabul qilindi!</h2>
                  <p className="text-xs text-emerald-700 mb-4">
                    Telegram botingizga to'liq tafsilotlar yuborildi. Kuryerimiz tez orada telefon orqali bog'lanadi 🚗
                  </p>
                  <button 
                    onClick={() => { setOrderSuccess(false); setActiveTab('profile'); }}
                    className="px-5 py-2.5 bg-emerald-700 text-white text-xs font-bold rounded-xl"
                  >
                    Buyurtmalar tarixiga o'tish
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center text-3xl">🛒</div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Savatchangiz bo'sh</h3>
                  <p className="text-xs text-slate-400 mb-4">Katalogdan o'zingizga kerakli avto qismlarni tanlang</p>
                  <button 
                    onClick={() => setActiveTab('catalog')}
                    className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
                  >
                    Katalogga o'tish
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mahsulotlar ro'yxati */}
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={item.image_url} className="w-12 h-12 rounded-lg object-cover bg-white" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 line-clamp-1 max-w-[140px]">{item.name}</h4>
                            <span className="text-xs font-bold text-red-600">
                              {item.new_price.toLocaleString()} so'm
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateQty(item.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center active:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.quantity || 1}</span>
                          <button 
                            onClick={() => updateQty(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center active:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Kross-sel (Qo'shimcha aromatizator taklifi) */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-xl">🍋</div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-950 leading-tight">Premium Avto-Aromatizator</h4>
                        <p className="text-[10px] text-amber-700">Atigi 35,000 so'mga qo'shasizmi?</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={addOnFragrance} 
                        onChange={e => setAddOnFragrance(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Buyurtmachi ma'lumotlari */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Yetkazib berish ma'lumotlari</h4>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500">Ismingiz</label>
                      <input 
                        type="text" 
                        value={custName} 
                        onChange={e => setCustName(e.target.value)}
                        placeholder="Masalan: Jamshid"
                        className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500">Telefon raqam</label>
                      <input 
                        type="text" 
                        value={custPhone} 
                        onChange={e => setCustPhone(e.target.value)}
                        placeholder="+998 90 123 45 67"
                        className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500">Yetkazish manzili yoki Lokatsiya</label>
                      <input 
                        type="text" 
                        value={custAddress} 
                        onChange={e => setCustAddress(e.target.value)}
                        placeholder="Masalan: Toshkent, Chilonzor 9-mavze"
                        className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  {/* Narx xulosasi va Tugma */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-1 text-xs text-slate-300">
                      <span>Jami summa:</span>
                      <span className="text-base font-black text-white">{cartTotal.toLocaleString()} so'm</span>
                    </div>
                    <button 
                      onClick={handleCheckout}
                      disabled={isSubmitting}
                      className="w-full mt-3 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Yuborilmoqda..." : "Buyurtmani tasdiqlash →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. PROFIL VA BUYURTMALAR TARIXI */}
          {activeTab === 'profile' && (
            <div className="px-4 pt-4">
              {/* Foydalanuvchi kartochkasi */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-black text-lg flex items-center justify-center">
                  {(tgUser.first_name || 'U')[0]}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{tgUser.first_name || 'Mijoz'} {tgUser.last_name || ''}</h2>
                  <span className="text-[11px] text-slate-500">ID: {tgUser.id || "Noma'lum"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">📜 Mening buyurtmalarim</h3>
                <button onClick={() => fetchUserOrders(tgUser.id)} className="text-xs text-slate-500">Yangilash</button>
              </div>

              {userOrders.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">Hozircha hech qanday buyurtma yo'q</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userOrders.map(order => (
                    <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-900">Buyurtma #{order.id}</span>
                        <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + 
                          (order.status === 'Yetkazildi' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                          {order.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 mb-2">
                        {order.items?.map((it, idx) => (
                          <div key={idx}>• {it.name} x {it.quantity || 1}</div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-extrabold text-slate-900">
                          {order.total_price?.toLocaleString()} so'm
                        </span>
                        <button 
                          onClick={() => {
                            setCart(order.items || []);
                            setActiveTab('cart');
                          }}
                          className="text-[11px] font-bold text-red-600 hover:underline"
                        >
                          Yana shundan buyurtma qilish ↺
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PRODUCT BOTTOM SHEET MODAL */}
          {selectedProduct && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
              <div 
                className="bg-white w-full max-w-md rounded-t-[32px] overflow-hidden p-5 animate-slide-up max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Yopish tutqichi */}
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" onClick={() => setSelectedProduct(null)} />

                <div className="overflow-y-auto no-scrollbar flex-1 pb-4">
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 mb-4">
                    <img src={selectedProduct.image_url} className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-white/90 backdrop-blur px-2 py-1 rounded-md text-slate-800">
                      {selectedProduct.category}
                    </span>
                  </div>

                  <h2 className="text-lg font-black text-slate-900 mb-1">{selectedProduct.name}</h2>
                  <p className="text-xs text-slate-500 mb-3">{selectedProduct.description}</p>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-lg font-black text-red-600">
                      {selectedProduct.new_price.toLocaleString()} so'm
                    </span>
                    {selectedProduct.old_price && (
                      <span className="text-xs text-slate-400 line-through">
                        {selectedProduct.old_price.toLocaleString()} so'm
                      </span>
                    )}
                  </div>

                  {/* Tarkibi va Xususiyatlari (Bullet points) */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 mb-4">
                    <h4 className="text-xs font-extrabold text-slate-900 mb-2">Tarkibi va Xususiyatlari:</h4>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {(Array.isArray(selectedProduct.details) ? selectedProduct.details : []).map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-500 font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Sticky CTA Tugma */}
                <div className="pt-2 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                      setActiveTab('cart');
                    }}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <span>Savatchaga qo'shish —</span>
                    <span>{selectedProduct.new_price.toLocaleString()} so'm</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM NAVIGATION (DOIMIY PASTKI PANEL) */}
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-2.5 flex justify-between items-center z-40">
            <button 
              onClick={() => setActiveTab('home')}
              className={'flex flex-col items-center gap-1 ' + (activeTab === 'home' ? 'text-red-600' : 'text-slate-400')}
            >
              <span className="text-lg">🏠</span>
              <span className="text-[10px] font-bold">Bosh sahifa</span>
            </button>

            <button 
              onClick={() => setActiveTab('catalog')}
              className={'flex flex-col items-center gap-1 ' + (activeTab === 'catalog' ? 'text-red-600' : 'text-slate-400')}
            >
              <span className="text-lg">🔍</span>
              <span className="text-[10px] font-bold">Katalog</span>
            </button>

            <button 
              onClick={() => setActiveTab('cart')}
              className={'relative flex flex-col items-center gap-1 ' + (activeTab === 'cart' ? 'text-red-600' : 'text-slate-400')}
            >
              <span className="text-lg">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
              <span className="text-[10px] font-bold">Savatcha</span>
            </button>

            <button 
              onClick={() => setActiveTab('profile')}
              className={'flex flex-col items-center gap-1 ' + (activeTab === 'profile' ? 'text-red-600' : 'text-slate-400')}
            >
              <span className="text-lg">👤</span>
              <span className="text-[10px] font-bold">Profil</span>
            </button>
          </div>

        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>`;
}

// ==============================================================================
// HTML GENERATOR: ADMIN WEB DASHBOARD (REACT 18 + TAILWIND CSS)
// ==============================================================================
function getAdminPanelHtml() {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>kuzavnoy.uzz | Professional Boshqaruv Markazi (Admin Dashboard)</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.4/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0f172a; color: #f8fafc; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin-custom { animation: spin 0.8s linear infinite; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div id="root">
    <div class="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div class="w-12 h-12 border-4 border-slate-800 border-t-red-600 rounded-full animate-spin-custom mb-3"></div>
      <p class="text-sm font-bold text-slate-300">kuzavnoy.uzz Boshqaruv Markazi yuklanmoqda...</p>
      <span class="text-xs text-slate-500 mt-1">Professional Admin Tizimi</span>
    </div>
  </div>

  <script type="text/babel">
    const { useState, useEffect, useMemo } = React;

    // Web Audio API ovozli signal (Yangi buyurtma tushganda "Ding-Dong" ovozi)
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
      const [tab, setTab] = useState("dashboard"); // dashboard | orders | products | crm | broadcast
      const [orders, setOrders] = useState([]);
      const [products, setProducts] = useState([]);
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(false);
      const [soundEnabled, setSoundEnabled] = useState(true);

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
      const [formData, setFormData] = useState({
        name: "", category: "Rul va Salon", new_price: "", old_price: "",
        image_url: "", description: "", detailsText: ""
      });

      // Broadcast form
      const [broadcastMsg, setBroadcastMsg] = useState("");
      const [broadcastPhoto, setBroadcastPhoto] = useState("");
      const [broadcastSending, setBroadcastSending] = useState(false);
      const [broadcastResult, setBroadcastResult] = useState(null);

      useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) { tg.ready(); tg.expand(); }
        loadAllData();

        // 5 soniyada yangi zakazlarni tekshirish
        const interval = setInterval(checkForNewOrders, 5000);
        return () => clearInterval(interval);
      }, []);

      const loadAllData = async () => {
        setLoading(true);
        await Promise.all([fetchOrders(), fetchProducts(), fetchUsers()]);
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

      // Buyurtma holatini yangilash
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

      // Mahsulotni saqlash (Yangi yoki tahrirlash)
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
          fetchProducts();
        } catch(e) {
          alert("Saqlashda xatolik!");
        }
      };

      // Tezkor narx o'zgartirish
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

      // Mahsulotni o'chirish
      const handleDeleteProduct = async (id) => {
        if (!confirm("Rostdan ham ushbu ehtiyot qismni o'chirmoqchimisiz?")) return;
        try {
          await fetch("/api/products/" + id, { method: "DELETE" });
          fetchProducts();
        } catch(e) {
          alert("O'chirishda xatolik!");
        }
      };

      // Xabar tarqatish (Broadcast)
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

      // Excel / CSV ga eksport qilish
      const exportOrdersToCSV = () => {
        let csv = "ID,Sana,Mijoz,Telefon,Manzil,Jami Summa,Holati\\n";
        orders.forEach(o => {
          csv += [
            o.id,
            '"' + new Date(o.created_at).toLocaleString('uz-UZ') + '"',
            '"' + (o.customer_name || '').replace(/"/g, '""') + '"',
            '"' + (o.phone || '') + '"',
            '"' + (o.location || '').replace(/"/g, '""') + '"',
            o.total_price,
            '"' + o.status + '"'
          ].join(",") + "\\n";
        });

        const blob = new Blob(["\\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "kuzavnoy_buyurtmalar_" + new Date().toISOString().slice(0,10) + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      // Metrikalar hisobi
      const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + (o.total_price || 0), 0), [orders]);
      const pendingOrders = useMemo(() => orders.filter(o => o.status === "Kutilmoqda"), [orders]);
      const deliveredOrders = useMemo(() => orders.filter(o => o.status === "Yetkazildi"), [orders]);
      const avgOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;

      // Filtrlangan buyurtmalar
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

      // Filtrlangan mahsulotlar
      const filteredProducts = useMemo(() => {
        return products.filter(p => {
          const matchCat = productCategoryFilter === "Barchasi" || p.category === productCategoryFilter;
          const matchSearch = !productSearch || 
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase()));
          return matchCat && matchSearch;
        });
      }, [products, productCategoryFilter, productSearch]);

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          
          {/* TOP NAVBAR */}
          <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 md:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-red-950/40">
                🚗
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-tight text-white">kuzavnoy.uzz</h1>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-red-600/20 text-red-400 border border-red-500/30">
                    Pro Dashboard
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Boshqaruv & Savdo Markazi</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={"px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 " + 
                  (soundEnabled ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400")}
              >
                <span>{soundEnabled ? "🔔 Ovoz: Yoqiq" : "🔕 Ovoz: O'chiq"}</span>
              </button>

              <button 
                onClick={loadAllData}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1"
              >
                <span>Yangilash</span> 🔄
              </button>
            </div>
          </header>

          {/* ASOSIY NAVIGATION TABS */}
          <div className="bg-slate-900/60 border-b border-slate-800 px-4 md:px-8 overflow-x-auto no-scrollbar">
            <div className="flex gap-1 max-w-7xl mx-auto py-2">
              {[
                { id: "dashboard", label: "📊 Analitika", count: null },
                { id: "orders", label: "📦 Buyurtmalar", count: pendingOrders.length ? pendingOrders.length + " ta yangi" : orders.length },
                { id: "products", label: "🛠 Zapchastlar Ombori", count: products.length },
                { id: "crm", label: "👥 Mijozlar Bazasi", count: users.length },
                { id: "broadcast", label: "📢 Xabar Tarqatish", count: "Bot" }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={"px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 " + 
                    (tab === item.id 
                      ? "bg-red-600 text-white shadow-lg shadow-red-950/50" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60")}
                >
                  <span>{item.label}</span>
                  {item.count && (
                    <span className={"text-[10px] px-2 py-0.5 rounded-full " + 
                      (tab === item.id ? "bg-black/25 text-white" : "bg-slate-800 text-slate-300")}>
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
              <div className="space-y-6">
                
                {/* 4 Asosiy KPI kartalari */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jami Savdo Tushumi</span>
                    <h3 className="text-2xl md:text-3xl font-black text-emerald-400 mt-2">
                      {totalRevenue.toLocaleString()} <span className="text-sm font-bold text-slate-500">so'm</span>
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 mt-2">
                      <span>↗ Real vaqtda hisoblangan</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jami Buyurtmalar</span>
                    <h3 className="text-2xl md:text-3xl font-black text-white mt-2">
                      {orders.length} <span className="text-sm font-bold text-slate-500">ta</span>
                    </h3>
                    <span className="text-xs text-slate-400 mt-2 block">
                      {deliveredOrders.length} ta muvaffaqiyatli yetkazilgan
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kutilayotgan / Yangi</span>
                    <h3 className="text-2xl md:text-3xl font-black text-amber-400 mt-2">
                      {pendingOrders.length} <span className="text-sm font-bold text-slate-500">ta</span>
                    </h3>
                    <span className="text-xs text-amber-500/80 mt-2 block">Tezkor ko'rib chiqish talab etiladi</span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">O'rtacha Chek (AOV)</span>
                    <h3 className="text-2xl md:text-3xl font-black text-indigo-400 mt-2">
                      {avgOrderValue.toLocaleString()} <span className="text-sm font-bold text-slate-500">so'm</span>
                    </h3>
                    <span className="text-xs text-slate-400 mt-2 block">Har bitta xariddan tushum</span>
                  </div>
                </div>

                {/* Grafikli Vidjet va Eng xaridorgir detallar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Savdo Dinamikasi */}
                  <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-black text-white">Savdo Dinamikasi & Tushumlar</h3>
                          <p className="text-xs text-slate-400">Oxirgi buyurtmalar statistikasi</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                          ● Jonli Savdo
                        </span>
                      </div>

                      {/* Oddiy va chiroyli SVG Bar Diagrammasi */}
                      <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-800">
                        {orders.slice(0, 8).reverse().map((ord, i) => {
                          const heightPct = Math.min(100, Math.max(15, Math.round((ord.total_price / (totalRevenue || 1)) * 100 * 3)));
                          return (
                            <div key={ord.id} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                              <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                                {(ord.total_price / 1000).toFixed(0)}k
                              </span>
                              <div 
                                style={{ height: heightPct + "%" }}
                                className="w-full bg-gradient-to-t from-red-600 to-rose-400 rounded-t-xl group-hover:from-emerald-500 group-hover:to-teal-400 transition"
                              />
                              <span className="text-[10px] font-bold text-slate-500">#{ord.id}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 text-xs text-slate-400">
                      <span>Jami ro'yxatdan o'tgan mijozlar: <b className="text-white">{users.length} ta</b></span>
                      <button onClick={() => setTab("orders")} className="text-red-400 hover:underline font-bold">
                        Barcha buyurtmalarni ochish →
                      </button>
                    </div>
                  </div>

                  {/* Eng ko'p sotilgan zapchastlar */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-base font-black text-white mb-1">Eng Ko'p Xarid Qilinganlar</h3>
                    <p className="text-xs text-slate-400 mb-4">Top ehtiyot qismlar reytingi</p>

                    <div className="space-y-3">
                      {products.slice(0, 5).map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-2xl bg-slate-950/60 border border-slate-800/60">
                          <img src={p.image_url} className="w-11 h-11 rounded-xl object-cover bg-slate-800" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                            <span className="text-[11px] font-extrabold text-red-400">{p.new_price?.toLocaleString()} so'm</span>
                          </div>
                          <span className="text-xs font-black text-slate-500 px-2 py-1 bg-slate-900 rounded-lg">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* 2. BUYURTMALAR BO'LIMI (ORDERS CRM) */}
            {tab === "orders" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                
                {/* Filtrlash va qidiruv qatori */}
                <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-white">Buyurtmalar Ro'yxati</h2>
                    <p className="text-xs text-slate-400">Kelib tushgan va yetkazilgan barcha zakazlar</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input 
                      type="text"
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      placeholder="Qidiruv: Ism, Tel, ID..."
                      className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />

                    <button 
                      onClick={exportOrdersToCSV}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <span>Excel (CSV) yuklash</span> 📥
                    </button>
                  </div>
                </div>

                {/* Status Filtr Tablari */}
                <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                  {["Barchasi", "Kutilmoqda", "Yetkazilmoqda", "Yetkazildi", "Bekor qilindi"].map(st => (
                    <button
                      key={st}
                      onClick={() => setOrderStatusFilter(st)}
                      className={"px-3 py-1 rounded-lg text-xs font-bold transition " + 
                        (orderStatusFilter === st ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-white")}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Jadval */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-4">ID & Sana</th>
                        <th className="p-4">Mijoz & Telefon</th>
                        <th className="p-4">Manzil</th>
                        <th className="p-4">Xarid Qilingan Qismlar</th>
                        <th className="p-4">Jami Summa</th>
                        <th className="p-4">Holati</th>
                        <th className="p-4 text-right">Hujjat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-10 text-center text-slate-500">
                            Hech qanday buyurtma topilmadi
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-850 transition">
                            <td className="p-4 font-bold text-white whitespace-nowrap">
                              <div>#{order.id}</div>
                              <span className="text-[10px] text-slate-500 font-normal">
                                {new Date(order.created_at).toLocaleString("uz-UZ")}
                              </span>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <div className="font-extrabold text-white">{order.customer_name}</div>
                              <a href={"tel:" + order.phone} className="text-red-400 hover:underline font-mono text-[11px] block mt-0.5">
                                {order.phone}
                              </a>
                            </td>
                            <td className="p-4 text-slate-300 max-w-[180px] truncate">
                              {order.location || "Ko'rsatilmagan"}
                            </td>
                            <td className="p-4">
                              <div className="space-y-1">
                                {(order.items || []).map((it, idx) => (
                                  <div key={idx} className="text-[11px] text-slate-300">
                                    <span className="font-semibold text-white">• {it.name}</span> <span className="text-slate-500">x{it.quantity || 1}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="p-4 font-black text-emerald-400 whitespace-nowrap text-sm">
                              {order.total_price?.toLocaleString()} so'm
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <select 
                                value={order.status}
                                onChange={e => updateOrderStatus(order.id, e.target.value)}
                                className={"text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none cursor-pointer " + 
                                  (order.status === "Yetkazildi" ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30" :
                                   order.status === "Bekor qilindi" ? "bg-rose-950/60 text-rose-400 border-rose-500/30" :
                                   order.status === "Yetkazilmoqda" ? "bg-blue-950/60 text-blue-400 border-blue-500/30" :
                                   "bg-amber-950/60 text-amber-400 border-amber-500/30")}
                              >
                                <option value="Kutilmoqda">⏳ Kutilmoqda</option>
                                <option value="Yetkazilmoqda">🚙 Yetkazilmoqda</option>
                                <option value="Yetkazildi">✅ Yetkazildi</option>
                                <option value="Bekor qilindi">❌ Bekor qilindi</option>
                              </select>
                            </td>
                            <td className="p-4 text-right whitespace-nowrap">
                              <button 
                                onClick={() => setSelectedReceiptOrder(order)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 transition"
                              >
                                🧾 Chek
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. ZAPCHASTLAR OMBORI (PRODUCTS CRUD) */}
            {tab === "products" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                
                <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-white">Zapchastlar Katalogi & Ombor</h2>
                    <p className="text-xs text-slate-400">Yangi tovar qo'shing, narxini jadvalning o'zida o'zgartiring</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      placeholder="Qismlarni qidirish..."
                      className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />

                    <button 
                      onClick={() => {
                        setEditingProduct(null);
                        setFormData({
                          name: "", category: "Rul va Salon", new_price: "", old_price: "",
                          image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80",
                          description: "", detailsText: "Original sifat\\nKafolat beriladi"
                        });
                        setShowProductModal(true);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-950/40 active:scale-95 transition flex items-center gap-1.5"
                    >
                      <span>+ Yangi Zapchast</span>
                    </button>
                  </div>
                </div>

                {/* Kategoriyalar filtri */}
                <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                  {["Barchasi", "Rul va Salon", "Oynalar", "Balon va Disklar", "Kuzov qismlari"].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setProductCategoryFilter(cat)}
                      className={"px-3 py-1 rounded-lg text-xs font-bold transition " + 
                        (productCategoryFilter === cat ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-white")}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Mahsulotlar Jadvali */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-4">Rasm</th>
                        <th className="p-4">Detal Nomi & Kategoriya</th>
                        <th className="p-4">Tezkor Narx Tahrirlash</th>
                        <th className="p-4">Tavsif & Xususiyatlar</th>
                        <th className="p-4 text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredProducts.map(prod => (
                        <tr key={prod.id} className="hover:bg-slate-850 transition">
                          <td className="p-4">
                            <img src={prod.image_url} className="w-14 h-14 rounded-2xl object-cover bg-slate-800 border border-slate-700" />
                          </td>
                          <td className="p-4">
                            <div className="font-extrabold text-white text-sm">{prod.name}</div>
                            <span className="inline-block mt-1 text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-500/20 px-2 py-0.5 rounded-md">
                              {prod.category}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number"
                                defaultValue={prod.new_price}
                                onBlur={e => handleQuickPrice(prod, e.target.value)}
                                className="w-28 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-bold text-xs focus:outline-none focus:border-emerald-500"
                              />
                              <span className="text-[11px] text-slate-500">so'm</span>
                            </div>
                            {prod.old_price && (
                              <span className="text-[10px] text-slate-500 line-through block mt-1">
                                Eski: {prod.old_price.toLocaleString()} so'm
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-400 max-w-xs">
                            <div className="truncate">{prod.description}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {(Array.isArray(prod.details) ? prod.details.length : 0)} ta xususiyat kiritilgan
                            </div>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setFormData({
                                    name: prod.name,
                                    category: prod.category || "Rul va Salon",
                                    new_price: prod.new_price,
                                    old_price: prod.old_price || "",
                                    image_url: prod.image_url,
                                    description: prod.description || "",
                                    detailsText: (Array.isArray(prod.details) ? prod.details : []).join("\\n")
                                  });
                                  setShowProductModal(true);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition"
                              >
                                Tahrirlash
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-bold rounded-xl border border-rose-800/40 transition"
                              >
                                O'chirish
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

            {/* 4. CRM / MIJOZLAR BAZASI */}
            {tab === "crm" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-black text-white">Mijozlar Bazasi (CRM)</h2>
                    <p className="text-xs text-slate-400">Do'koningizdan ro'yxatdan o'tgan barcha Telegram mijozlar</p>
                  </div>
                  <span className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold">
                    Jami: {users.length} ta xaridor
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-4">Telegram ID & Ism</th>
                        <th className="p-4">Telefon</th>
                        <th className="p-4">Buyurtmalar Soni</th>
                        <th className="p-4">Jami Xarid Qilgan Summasi</th>
                        <th className="p-4">A'zo Bo'lgan Sana</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-slate-500">Mijozlar mavjud emas</td></tr>
                      ) : (
                        users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-850 transition">
                            <td className="p-4 font-bold text-white whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 font-black flex items-center justify-center">
                                  {(u.name || "M")[0]}
                                </div>
                                <div>
                                  <div>{u.name || "Telegram Foydalanuvchisi"}</div>
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {u.telegram_id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-slate-300">
                              {u.phone || "Kiritilmagan"}
                            </td>
                            <td className="p-4 font-black text-white">
                              {u.orders_count || 0} ta buyurtma
                            </td>
                            <td className="p-4 font-black text-emerald-400 text-sm">
                              {parseInt(u.total_spent || 0).toLocaleString()} so'm
                            </td>
                            <td className="p-4 text-slate-500 whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString("uz-UZ")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. TELEGRAM XABAR TARQATISH (BROADCAST) */}
            {tab === "broadcast" && (
              <div className="max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-black text-white">Barcha Mijozlarga Xabar Tarqatish 📢</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Yangi chegirmalar, aksiyalar yoki yangi kelgan zapchastlar haqida botingiz orqali barcha {users.length} ta foydalanuvchiga bir bosishda xabar yuboring.
                  </p>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Rasm URL manzili (Ixtiyoriy)</label>
                    <input 
                      type="url"
                      value={broadcastPhoto}
                      onChange={e => setBroadcastPhoto(e.target.value)}
                      placeholder="https://images.unsplash.com/... (agar rasm yubormoqchi bo'lsangiz)"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Xabar Matni (HTML teglari qo'llab-quvvatlanadi)</label>
                    <textarea 
                      rows="5"
                      required
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                      placeholder="Masalan: ⚡️ DIQQAT AKSIYA! M-Sport rullariga 25% chegirma boshlandi! Hoziroq Mini App orqali buyurtma bering!"
                      className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 leading-relaxed"
                    />
                  </div>

                  {broadcastResult && (
                    <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white">
                      {broadcastResult}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={broadcastSending}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg shadow-red-950/50 transition active:scale-98"
                  >
                    {broadcastSending ? "Yuborilmoqda..." : "🚀 Barcha Foydalanuvchilarga Yuborish"}
                  </button>
                </form>
              </div>
            )}

          </main>

          {/* INVOICE / CHEK MODAL */}
          {selectedReceiptOrder && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
                <button 
                  onClick={() => setSelectedReceiptOrder(null)} 
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>

                <div className="text-center pb-4 border-b border-dashed border-slate-200">
                  <h3 className="text-lg font-black tracking-tight">kuzavnoy.uzz</h3>
                  <p className="text-xs text-slate-500">Avto Ehtiyot Qismlar Do'koni</p>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Buyurtma #{selectedReceiptOrder.id} • {new Date(selectedReceiptOrder.created_at).toLocaleString("uz-UZ")}
                  </div>
                </div>

                <div className="py-3 text-xs border-b border-dashed border-slate-200 space-y-1">
                  <div><b>Mijoz:</b> {selectedReceiptOrder.customer_name}</div>
                  <div><b>Telefon:</b> {selectedReceiptOrder.phone}</div>
                  <div><b>Manzil:</b> {selectedReceiptOrder.location || "Ko'rsatilmagan"}</div>
                  <div><b>Holat:</b> {selectedReceiptOrder.status}</div>
                </div>

                <div className="py-3 space-y-2 border-b border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Xarid qilingan detallar</div>
                  {(selectedReceiptOrder.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span>{it.name} x {it.quantity || 1}</span>
                      <span className="font-bold">{((it.new_price || 0) * (it.quantity || 1)).toLocaleString()} so'm</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold">JAMI TO'LOV:</span>
                  <span className="text-base font-black text-red-600">
                    {selectedReceiptOrder.total_price?.toLocaleString()} so'm
                  </span>
                </div>

                <div className="mt-5 flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
                  >
                    Chop etish (Print) 🖨
                  </button>
                  <button 
                    onClick={() => setSelectedReceiptOrder(null)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MAHSULOT QO'SHISH / TAHRIRLASH MODAL */}
          {showProductModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-black text-white">
                    {editingProduct ? "Zapchastni Tahrirlash" : "Yangi Ehtiyot Qism Qo'shish"}
                  </h3>
                  <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Mahsulot Nomi</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="M-Sport Anatomiya Rul" 
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold">Kategoriya</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                      >
                        <option value="Rul va Salon">Rul va Salon</option>
                        <option value="Oynalar">Oynalar</option>
                        <option value="Balon va Disklar">Balon va Disklar</option>
                        <option value="Kuzov qismlari">Kuzov qismlari</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold">Yangi Narxi (so'm)</label>
                      <input 
                        type="number" 
                        required
                        value={formData.new_price}
                        onChange={e => setFormData({ ...formData, new_price: e.target.value })}
                        placeholder="1450000" 
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Eski Narxi (so'm, chegirma ko'rsatish uchun)</label>
                    <input 
                      type="number" 
                      value={formData.old_price}
                      onChange={e => setFormData({ ...formData, old_price: e.target.value })}
                      placeholder="1850000" 
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Rasm URL Manzili</label>
                    <input 
                      type="url" 
                      required
                      value={formData.image_url}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://..." 
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Qisqa Tavsif</label>
                    <input 
                      type="text" 
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Malibu va Tracker uchun original sport rul" 
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Xususiyatlari (har bir qator yangi nuqta bo'ladi)</label>
                    <textarea 
                      rows="3"
                      value={formData.detailsText}
                      onChange={e => setFormData({ ...formData, detailsText: e.target.value })}
                      placeholder="Nappa charm qoplama&#10;Ko'p funksiyali tugmalar&#10;Airbag bilan mos"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button 
                      type="button" 
                      onClick={() => setShowProductModal(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700"
                    >
                      Bekor qilish
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold"
                    >
                      Saqlash
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
