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
// Ngrok yoki HTTPS domeni (node server.js https://xxx.ngrok-free.app orqali ham berish mumkin)
let WEB_APP_URL = process.argv[2] || process.env.WEB_APP_URL || `http://localhost:${PORT}`;

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

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
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

    const welcomeText = 
      `Assalomu alaykum, <b>${firstName}</b>!\n\n` +
      `🚗 <b>kuzavnoy.uzz</b> — Avtomobil ehtiyot qismlari do'konimizga xush kelibsiz!\n\n` +
      `Bizda: Rullar, Barlar, Labavoy va Bakavoy oynalar, Balonlar hamda original kuzov qismlari mavjud.\n\n` +
      (isHttps 
        ? `Pastdagi tugmani bosing va qulay <b>Telegram Mini App</b> orqali xarid qiling! 👇`
        : `⚙️ <i>Eslatma: Mini App Telegram ichida ochilishi uchun ngrok orqali olingan HTTPS domenidan foydalaning (masalan: node server.js https://...ngrok-free.app). Hozirgi havola orqali brauzerda ochishingiz mumkin.</i>`);

    const inlineKeyboard = isHttps ? [
      [
        {
          text: "🛒 Katalog & Xarid qilish (Mini App)",
          web_app: { url: WEB_APP_URL }
        }
      ],
      [
        { text: "👨‍💻 Admin Panelga o'tish", url: `${WEB_APP_URL}/admin` }
      ]
    ] : [
      [
        {
          text: "🌐 Do'konni brauzerda ochish",
          url: WEB_APP_URL
        }
      ],
      [
        { text: "👨‍💻 Admin Panel", url: `${WEB_APP_URL}/admin` }
      ]
    ];

    bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard
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
          `<b>Manzil:</b> ${location || 'Ko\'rsatilmagan'}\n\n` +
          `<b>Xarid qilingan detallar:</b>\n${itemsList}\n\n` +
          `💰 <b>Jami summa:</b> ${total_price.toLocaleString()} so'm\n\n` +
          `<i>kuzavnoy.uzz ni tanlaganingiz uchun rahmat!</i>`;

        bot.sendMessage(telegram_id, messageText, { parse_mode: 'HTML' });
      } catch (botErr) {
        console.error('Telegram bot xabar yuborishda xatolik:', botErr.message);
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
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <!-- Google Fonts (Inter) -->
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
  </style>
</head>
<body class="bg-white text-slate-900 select-none pb-24">
  <div id="root"></div>

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
                  <span className="text-[11px] text-slate-500">ID: {tgUser.id || 'Noma\'lum'}</span>
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
  <title>kuzavnoy.uzz | Boshqaruv Paneli (Admin Dashboard)</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React & Babel -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8fafc; }
  </style>
</head>
<body class="text-slate-900">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect } = React;

    function AdminApp() {
      const [view, setView] = useState('orders'); // 'orders' | 'products'
      const [orders, setOrders] = useState([]);
      const [products, setProducts] = useState([]);
      const [loading, setLoading] = useState(false);

      // Modal (Yangi mahsulot yoki tahrirlash)
      const [showModal, setShowModal] = useState(false);
      const [editId, setEditId] = useState(null);
      const [formData, setFormData] = useState({
        name: '',
        category: 'Rul va Salon',
        new_price: '',
        old_price: '',
        image_url: '',
        description: '',
        detailsText: ''
      });

      useEffect(() => {
        loadData();
        const interval = setInterval(loadOrders, 10000); // 10 soniyada avto-yangilash
        return () => clearInterval(interval);
      }, []);

      const loadData = async () => {
        setLoading(true);
        await Promise.all([loadOrders(), loadProducts()]);
        setLoading(false);
      };

      const loadOrders = async () => {
        try {
          const res = await fetch('/api/orders');
          const data = await res.json();
          setOrders(data);
        } catch (e) {
          console.error(e);
        }
      };

      const loadProducts = async () => {
        try {
          const res = await fetch('/api/products');
          const data = await res.json();
          setProducts(data);
        } catch (e) {
          console.error(e);
        }
      };

      const updateOrderStatus = async (id, status) => {
        try {
          await fetch('/api/orders/' + id + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });
          loadOrders();
        } catch (e) {
          alert('Statusni yangilashda xatolik!');
        }
      };

      const handleDeleteProduct = async (id) => {
        if (!confirm("Rostdan ham ushbu ehtiyot qismni o'chirmoqchimisiz?")) return;
        try {
          await fetch('/api/products/' + id, { method: 'DELETE' });
          loadProducts();
        } catch (e) {
          alert("O'chirishda xatolik!");
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
            details: formData.detailsText.split('\\n').filter(Boolean)
          };

          const url = editId ? '/api/products/' + editId : '/api/products';
          const method = editId ? 'PUT' : 'POST';

          await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          setShowModal(false);
          setEditId(null);
          loadProducts();
        } catch (err) {
          alert("Saqlashda xatolik yuz berdi!");
        }
      };

      const openEditModal = (prod) => {
        setEditId(prod.id);
        setFormData({
          name: prod.name,
          category: prod.category || 'Rul va Salon',
          new_price: prod.new_price,
          old_price: prod.old_price || '',
          image_url: prod.image_url,
          description: prod.description,
          detailsText: (Array.isArray(prod.details) ? prod.details : []).join('\\n')
        });
        setShowModal(true);
      };

      const openCreateModal = () => {
        setEditId(null);
        setFormData({
          name: '',
          category: 'Rul va Salon',
          new_price: '',
          old_price: '',
          image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
          description: '',
          detailsText: 'Original zavodskoy mahsulot\\n100% kafolat beriladi'
        });
        setShowModal(true);
      };

      // Tushum hisob-kitobi
      const totalRevenue = orders.reduce((sum, ord) => sum + (ord.total_price || 0), 0);
      const pendingOrders = orders.filter(o => o.status === 'Kutilmoqda').length;

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          {/* Top Navbar */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                🚗
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 leading-none">kuzavnoy.uzz</h1>
                <span className="text-[11px] text-slate-500 font-medium">Boshqaruv Paneli (Admin)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setView('orders')}
                className={'px-3.5 py-1.5 rounded-lg text-xs font-bold transition ' + (view === 'orders' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}
              >
                📦 Buyurtmalar ({orders.length})
              </button>
              <button 
                onClick={() => setView('products')}
                className={'px-3.5 py-1.5 rounded-lg text-xs font-bold transition ' + (view === 'products' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}
              >
                🛠 Ehtiyot Qismlar ({products.length})
              </button>
            </div>
          </header>

          {/* Asosiy Kontent */}
          <main className="max-w-6xl w-full mx-auto p-6 flex-1">
            {/* Metrika Vidjetlari */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Jami Buyurtmalar</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{orders.length} ta</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Yangi / Kutilayotgan</span>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingOrders} ta</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Jami Tushum</span>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalRevenue.toLocaleString()} so'm</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Tovarlar soni</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{products.length} xil</h3>
              </div>
            </div>

            {/* VIEW 1: BUYURTMALAR SAHIFASI */}
            {view === 'orders' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Kelib tushgan buyurtmalar</h2>
                  <button onClick={loadOrders} className="text-xs font-semibold text-red-600 hover:underline">
                    Yangilash 🔄
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">ID & Sana</th>
                        <th className="p-3">Mijoz & Tel</th>
                        <th className="p-3">Manzil</th>
                        <th className="p-3">Xarid qilingan detallar</th>
                        <th className="p-3">Jami Summa</th>
                        <th className="p-3">Holati</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-400">Hozircha yangi buyurtmalar kelib tushmadi</td>
                        </tr>
                      ) : (
                        orders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                              <div>#{order.id}</div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {new Date(order.created_at).toLocaleString('uz-UZ')}
                              </span>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{order.customer_name}</div>
                              <a href={'tel:' + order.phone} className="text-red-600 hover:underline">{order.phone}</a>
                            </td>
                            <td className="p-3 text-slate-600 max-w-[180px]">{order.location || 'Ko\'rsatilmagan'}</td>
                            <td className="p-3">
                              <div className="space-y-1">
                                {(order.items || []).map((it, idx) => (
                                  <div key={idx} className="text-[11px] text-slate-700">
                                    <span className="font-semibold">{it.name}</span> <span className="text-slate-400">x {it.quantity || 1}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 font-black text-slate-900 whitespace-nowrap">
                              {order.total_price?.toLocaleString()} so'm
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <select 
                                value={order.status} 
                                onChange={e => updateOrderStatus(order.id, e.target.value)}
                                className={'text-[11px] font-bold px-2 py-1 rounded-md border focus:outline-none ' + 
                                  (order.status === 'Yetkazildi' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                   order.status === 'Bekor qilindi' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                   'bg-amber-50 text-amber-700 border-amber-200')}
                              >
                                <option value="Kutilmoqda">Kutilmoqda</option>
                                <option value="Yetkazilmoqda">Yetkazilmoqda</option>
                                <option value="Yetkazildi">Yetkazildi</option>
                                <option value="Bekor qilindi">Bekor qilindi</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 2: MAHSULOTLAR CRUD */}
            {view === 'products' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Avto ehtiyot qismlari ro'yxati</h2>
                    <p className="text-[11px] text-slate-500">Yangi tovar qo'shing, tahrirlang yoki narxini o'zgartiring</p>
                  </div>
                  <button 
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow active:scale-95 transition"
                  >
                    + Yangi Zapchast Qo'shish
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Rasm</th>
                        <th className="p-3">Nomi & Kategoriya</th>
                        <th className="p-3">Narxi</th>
                        <th className="p-3">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map(prod => (
                        <tr key={prod.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <img src={prod.image_url} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{prod.name}</div>
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{prod.category}</span>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{prod.description}</div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-black text-slate-900">{prod.new_price?.toLocaleString()} so'm</div>
                            {prod.old_price && (
                              <div className="text-[10px] text-slate-400 line-through">{prod.old_price?.toLocaleString()} so'm</div>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openEditModal(prod)}
                                className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200"
                              >
                                Tahrirlash
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="px-2.5 py-1 bg-rose-50 text-rose-600 font-bold rounded-md hover:bg-rose-100"
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
          </main>

          {/* MODAL (QO'SHISH / TAHRIRLASH) */}
          {showModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-900">
                    {editId ? "Zapchastni tahrirlash" : "Yangi ehtiyot qism qo'shish"}
                  </h3>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Mahsulot nomi</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Masalan: M-Sport Anatomiya Rul" 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Kategoriya</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                      >
                        <option value="Rul va Salon">Rul va Salon</option>
                        <option value="Oynalar">Oynalar</option>
                        <option value="Balon va Disklar">Balon va Disklar</option>
                        <option value="Kuzov qismlari">Kuzov qismlari</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Yangi Narxi (so'm)</label>
                      <input 
                        type="number" 
                        required
                        value={formData.new_price}
                        onChange={e => setFormData({ ...formData, new_price: e.target.value })}
                        placeholder="1450000" 
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Eski Narxi (so'm, ixtiyoriy)</label>
                    <input 
                      type="number" 
                      value={formData.old_price}
                      onChange={e => setFormData({ ...formData, old_price: e.target.value })}
                      placeholder="1850000" 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Rasm URL manzili</label>
                    <input 
                      type="url" 
                      required
                      value={formData.image_url}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://..." 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Qisqa tavsif</label>
                    <input 
                      type="text" 
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Malibu va Tracker uchun mos sport rul" 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Xususiyatlari (har bir satr yangi nuqta bo'ladi)</label>
                    <textarea 
                      rows="3"
                      value={formData.detailsText}
                      onChange={e => setFormData({ ...formData, detailsText: e.target.value })}
                      placeholder="Nappa charm qoplama&#10;Ko'p funksiyali boshqaruv&#10;Airbag bilan mos"
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold"
                    >
                      Bekor qilish
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800"
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

    ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
  </script>
</body>
</html>`;
}
