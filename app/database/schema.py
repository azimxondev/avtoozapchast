"""
Avto Sklad — Schema DDL & Auto-migrations
Includes Admins hierarchy (HEAD ADMIN + ADMIN), 15-min single-use invitations, and audit logs.
"""

from app.database.db import db
from app.config import HEAD_ADMIN_ID, INITIAL_BUDGET, SHOP_NAME, SHOP_ADDRESS, SHOP_PHONE, SHOP_TELEGRAM, SHOP_WORK_HOURS, SHOP_LAT, SHOP_LON

async def init_database():
    """Jadvallarni yaratish va zarur bo'lsa sozlamalarni initsializatsiya qilish."""
    if db.is_pg:
        # PostgreSQL DDL
        await db.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                icon VARCHAR(50) DEFAULT '📦',
                description TEXT DEFAULT '',
                sort_order INT DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                sku VARCHAR(100) NOT NULL,
                category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
                brand VARCHAR(100) DEFAULT '',
                car_brand VARCHAR(100) DEFAULT '',
                car_model VARCHAR(100) DEFAULT '',
                compatible_years VARCHAR(100) DEFAULT '',
                description TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                condition VARCHAR(20) DEFAULT 'NEW',
                purchase_price BIGINT NOT NULL DEFAULT 0,
                selling_price BIGINT NOT NULL DEFAULT 0,
                quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                min_stock INT NOT NULL DEFAULT 2,
                unit VARCHAR(20) DEFAULT 'dona',
                shelf_location VARCHAR(100) DEFAULT '',
                barcode VARCHAR(100) DEFAULT '',
                is_active SMALLINT DEFAULT 1,
                is_deleted SMALLINT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                tx_number VARCHAR(50) UNIQUE NOT NULL,
                product_id INT REFERENCES products(id) ON DELETE SET NULL,
                product_name VARCHAR(255) DEFAULT '',
                type VARCHAR(20) NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                unit_price BIGINT NOT NULL DEFAULT 0,
                cost_price BIGINT NOT NULL DEFAULT 0,
                total_amount BIGINT NOT NULL DEFAULT 0,
                profit BIGINT NOT NULL DEFAULT 0,
                prev_stock INT NOT NULL DEFAULT 0,
                new_stock INT NOT NULL DEFAULT 0,
                prev_balance BIGINT NOT NULL DEFAULT 0,
                new_balance BIGINT NOT NULL DEFAULT 0,
                admin_id BIGINT DEFAULT 0,
                admin_name VARCHAR(255) DEFAULT 'Admin',
                customer_or_supplier VARCHAR(255) DEFAULT '',
                reason VARCHAR(255) DEFAULT '',
                note TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS cash_ledger (
                id SERIAL PRIMARY KEY,
                transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
                entry_type VARCHAR(10) NOT NULL,
                amount BIGINT NOT NULL,
                balance_after BIGINT NOT NULL,
                description TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT UNIQUE,
                full_name VARCHAR(255) DEFAULT '',
                username VARCHAR(255) DEFAULT '',
                phone_number VARCHAR(50) DEFAULT '',
                role VARCHAR(20) DEFAULT 'USER',
                is_active SMALLINT DEFAULT 1,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_start_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT UNIQUE NOT NULL,
                username VARCHAR(255) DEFAULT '',
                first_name VARCHAR(255) DEFAULT '',
                last_name VARCHAR(255) DEFAULT '',
                phone_number VARCHAR(50) DEFAULT '',
                role VARCHAR(20) NOT NULL DEFAULT 'ADMIN', -- 'HEAD_ADMIN', 'ADMIN'
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
                created_by BIGINT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_login TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS admin_invitations (
                id SERIAL PRIMARY KEY,
                token VARCHAR(255) UNIQUE NOT NULL,
                token_hash VARCHAR(64) DEFAULT '',
                created_by BIGINT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                used_by BIGINT,
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' -- 'ACTIVE', 'USED', 'EXPIRED', 'REVOKED'
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id BIGINT DEFAULT 0,
                user_name VARCHAR(255) DEFAULT 'Tizim',
                action VARCHAR(100) NOT NULL,
                target_entity VARCHAR(50) DEFAULT '',
                target_id VARCHAR(100) DEFAULT '',
                old_values TEXT DEFAULT '',
                new_values TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS shop_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
            CREATE INDEX IF NOT EXISTS idx_products_car ON products(car_brand, car_model);
            CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, is_deleted);
            CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
            CREATE INDEX IF NOT EXISTS idx_admins_tg ON admins(telegram_id);
            CREATE INDEX IF NOT EXISTS idx_invites_token ON admin_invitations(token);
        """)
    else:
        # SQLite DDL
        await db.sqlite_conn.executescript("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                icon TEXT DEFAULT '📦',
                description TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sku TEXT NOT NULL,
                category_id INTEGER NOT NULL REFERENCES categories(id),
                brand TEXT DEFAULT '',
                car_brand TEXT DEFAULT '',
                car_model TEXT DEFAULT '',
                compatible_years TEXT DEFAULT '',
                description TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                condition TEXT DEFAULT 'NEW',
                purchase_price INTEGER NOT NULL DEFAULT 0,
                selling_price INTEGER NOT NULL DEFAULT 0,
                quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                min_stock INTEGER NOT NULL DEFAULT 2,
                unit TEXT DEFAULT 'dona',
                shelf_location TEXT DEFAULT '',
                barcode TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                is_deleted INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_number TEXT UNIQUE NOT NULL,
                product_id INTEGER REFERENCES products(id),
                product_name TEXT DEFAULT '',
                type TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price INTEGER NOT NULL DEFAULT 0,
                cost_price INTEGER NOT NULL DEFAULT 0,
                total_amount INTEGER NOT NULL DEFAULT 0,
                profit INTEGER NOT NULL DEFAULT 0,
                prev_stock INTEGER NOT NULL DEFAULT 0,
                new_stock INTEGER NOT NULL DEFAULT 0,
                prev_balance INTEGER NOT NULL DEFAULT 0,
                new_balance INTEGER NOT NULL DEFAULT 0,
                admin_id INTEGER DEFAULT 0,
                admin_name TEXT DEFAULT 'Admin',
                customer_or_supplier TEXT DEFAULT '',
                reason TEXT DEFAULT '',
                note TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cash_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER REFERENCES transactions(id),
                entry_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                balance_after INTEGER NOT NULL,
                description TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE,
                full_name TEXT DEFAULT '',
                username TEXT DEFAULT '',
                phone_number TEXT DEFAULT '',
                role TEXT DEFAULT 'USER',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT DEFAULT '',
                first_name TEXT DEFAULT '',
                last_name TEXT DEFAULT '',
                phone_number TEXT DEFAULT '',
                role TEXT NOT NULL DEFAULT 'ADMIN', -- 'HEAD_ADMIN', 'ADMIN'
                status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
                created_by INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                revoked_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admin_invitations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                token_hash TEXT DEFAULT '',
                created_by INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP,
                used_by INTEGER,
                status TEXT NOT NULL DEFAULT 'ACTIVE' -- 'ACTIVE', 'USED', 'EXPIRED', 'REVOKED'
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 0,
                user_name TEXT DEFAULT 'Tizim',
                action TEXT NOT NULL,
                target_entity TEXT DEFAULT '',
                target_id TEXT DEFAULT '',
                old_values TEXT DEFAULT '',
                new_values TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS shop_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
            CREATE INDEX IF NOT EXISTS idx_products_car ON products(car_brand, car_model);
            CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, is_deleted);
            CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
            CREATE INDEX IF NOT EXISTS idx_admins_tg ON admins(telegram_id);
            CREATE INDEX IF NOT EXISTS idx_invites_token ON admin_invitations(token);
        """)
        await db.sqlite_conn.commit()

    # Auto-migrations for existing databases (phone_number, token_hash, barcode)
    if db.is_pg:
        try:
            await db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) DEFAULT ''")
            await db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_start_at TIMESTAMPTZ DEFAULT NOW()")
            await db.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) DEFAULT ''")
            await db.execute("ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64) DEFAULT ''")
            await db.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) DEFAULT ''")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)")
            
            # Migrate products boolean to smallint
            await db.execute("""
                DO $$ BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'products' AND column_name = 'is_active' AND data_type = 'boolean'
                    ) THEN
                        ALTER TABLE products ALTER COLUMN is_active DROP DEFAULT;
                        ALTER TABLE products ALTER COLUMN is_active TYPE SMALLINT USING (CASE WHEN is_active THEN 1 ELSE 0 END);
                        ALTER TABLE products ALTER COLUMN is_active SET DEFAULT 1;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'products' AND column_name = 'is_deleted' AND data_type = 'boolean'
                    ) THEN
                        ALTER TABLE products ALTER COLUMN is_deleted DROP DEFAULT;
                        ALTER TABLE products ALTER COLUMN is_deleted TYPE SMALLINT USING (CASE WHEN is_deleted THEN 1 ELSE 0 END);
                        ALTER TABLE products ALTER COLUMN is_deleted SET DEFAULT 0;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'users' AND column_name = 'is_active' AND data_type = 'boolean'
                    ) THEN
                        ALTER TABLE users ALTER COLUMN is_active DROP DEFAULT;
                        ALTER TABLE users ALTER COLUMN is_active TYPE SMALLINT USING (CASE WHEN is_active THEN 1 ELSE 0 END);
                        ALTER TABLE users ALTER COLUMN is_active SET DEFAULT 1;
                    END IF;
                END $$;
            """)
        except Exception as e:
            print(f"[DB Migration Note] {e}")
    else:
        for alter_cmd in [
            "ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT ''",
            "ALTER TABLE admins ADD COLUMN phone_number TEXT DEFAULT ''",
            "ALTER TABLE admin_invitations ADD COLUMN token_hash TEXT DEFAULT ''",
            "ALTER TABLE products ADD COLUMN barcode TEXT DEFAULT ''",
            "CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)"
        ]:
            try:
                await db.sqlite_conn.execute(alter_cmd)
                await db.sqlite_conn.commit()
            except Exception:
                # Column already exists
                pass

    # Shop settings defaults
    defaults = {
        "shop_name": SHOP_NAME,
        "shop_phone": SHOP_PHONE,
        "shop_telegram": SHOP_TELEGRAM,
        "shop_address": SHOP_ADDRESS,
        "shop_work_hours": SHOP_WORK_HOURS,
        "shop_lat": str(SHOP_LAT),
        "shop_lon": str(SHOP_LON),
        "initial_budget": str(INITIAL_BUDGET),
        "currency": "UZS"
    }
    for k, v in defaults.items():
        existing = await db.fetchval("SELECT value FROM shop_settings WHERE key = $1", k)
        if existing is None:
            await db.execute("INSERT INTO shop_settings (key, value) VALUES ($1, $2)", k, v)

    # Ensure EXACTLY ONE configured HEAD_ADMIN exists in admins table
    if HEAD_ADMIN_ID:
        # First, ensure any other admin with role = 'HEAD_ADMIN' is downgraded to 'ADMIN'
        await db.execute(
            "UPDATE admins SET role = 'ADMIN' WHERE role = 'HEAD_ADMIN' AND telegram_id != $1",
            HEAD_ADMIN_ID
        )

        existing_ha = await db.fetchrow("SELECT * FROM admins WHERE telegram_id = $1", HEAD_ADMIN_ID)
        if not existing_ha:
            await db.execute("""
                INSERT INTO admins (telegram_id, username, first_name, role, status, created_by)
                VALUES ($1, 'head_admin', 'Bosh Admin', 'HEAD_ADMIN', 'ACTIVE', 0)
            """, HEAD_ADMIN_ID)
        else:
            await db.execute(
                "UPDATE admins SET role = 'HEAD_ADMIN', status = 'ACTIVE' WHERE telegram_id = $1",
                HEAD_ADMIN_ID
            )

    print("[DB] Ma'lumotlar bazasi jadvallari va sozlamalari tayyor.")
