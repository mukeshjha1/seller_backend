// migrate.js — Run this once to add user_id columns to existing APNABAZAR database
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Mukesh@123',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'APNABAZAR',
});

async function migrate() {
    console.log('🔄 Running migration on database:', process.env.DB_NAME || 'APNABAZAR');

    const migrations = [
        // Create users table if not exists
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            phone VARCHAR(15) UNIQUE NOT NULL,
            name VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create otp_logs if not exists
        `CREATE TABLE IF NOT EXISTS otp_logs (
            id SERIAL PRIMARY KEY,
            phone VARCHAR(15) NOT NULL,
            otp_code VARCHAR(6) NOT NULL,
            is_verified BOOLEAN DEFAULT FALSE,
            expired_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            verified_at TIMESTAMP,
            ip_address VARCHAR(45),
            user_agent TEXT
        )`,

        // Create login_logs if not exists
        `CREATE TABLE IF NOT EXISTS login_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            phone VARCHAR(15) NOT NULL,
            action VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Add user_id to shops
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='user_id') THEN
                ALTER TABLE shops ADD COLUMN user_id INTEGER REFERENCES users(id);
                RAISE NOTICE 'Added user_id to shops';
            END IF;
        END $$`,

        // Add user_id to products
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='user_id') THEN
                ALTER TABLE products ADD COLUMN user_id INTEGER REFERENCES users(id);
                RAISE NOTICE 'Added user_id to products';
            END IF;
        END $$`,

        // Add user_id to orders
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='user_id') THEN
                ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id);
                RAISE NOTICE 'Added user_id to orders';
            END IF;
        END $$`,

        // Add created_at to shops if missing
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='created_at') THEN
                ALTER TABLE shops ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            END IF;
        END $$`,

        // Add verification_pending to shops if missing
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='verification_pending') THEN
                ALTER TABLE shops ADD COLUMN verification_pending BOOLEAN DEFAULT FALSE;
            END IF;
        END $$`,

        // Add subcategory column to products if missing
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='subcategory') THEN
                ALTER TABLE products ADD COLUMN subcategory VARCHAR(100);
                RAISE NOTICE 'Added subcategory to products';
            END IF;
        END $$`,

        // Add sizes column to products if missing
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sizes') THEN
                ALTER TABLE products ADD COLUMN sizes TEXT DEFAULT '[]';
                RAISE NOTICE 'Added sizes to products';
            END IF;
        END $$`,

        // Indexes
        'CREATE INDEX IF NOT EXISTS idx_shops_user ON shops(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_logs(phone)',
        'CREATE INDEX IF NOT EXISTS idx_login_phone ON login_logs(phone)',
        'CREATE INDEX IF NOT EXISTS idx_login_user ON login_logs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_login_action ON login_logs(action)',
    ];

    for (const sql of migrations) {
        try {
            await pool.query(sql);
            // Extract a short name from the SQL for logging
            const name = sql.substring(0, 60).replace(/\s+/g, ' ').trim();
            console.log(`  ✅ ${name}...`);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            console.error(`     SQL: ${sql.substring(0, 80)}...`);
        }
    }

    console.log('\n🎉 Migration complete!');
    await pool.end();
}

migrate();
