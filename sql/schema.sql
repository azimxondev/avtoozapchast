-- =====================================================
-- AVTO SKLAD — DATABASE SCHEMA
-- PostgreSQL (Neon) uchun
-- =====================================================

-- Mahsulotlar jadvali
CREATE TABLE IF NOT EXISTS stock_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
    description TEXT DEFAULT '',
    condition VARCHAR(10) NOT NULL DEFAULT 'NEW'
        CHECK (condition IN ('NEW', 'USED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kirim/Chiqim tarixi
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES stock_products(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('kirim', 'chiqim')),
    amount INT NOT NULL CHECK (amount > 0),
    price_at_transaction BIGINT NOT NULL,
    admin_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot foydalanuvchilari (broadcast uchun)
CREATE TABLE IF NOT EXISTS bot_users (
    telegram_id BIGINT PRIMARY KEY,
    full_name VARCHAR(255) DEFAULT '',
    username VARCHAR(255) DEFAULT '',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indekslari
CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_products_name ON stock_products(name);
