const { Pool } = require('pg');
require('dotenv').config();

const adminPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Mukesh@123',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
});

const DB_NAME = (process.env.DB_NAME || 'APNABAZAR').toLowerCase();

async function setup() {
    console.log(`Connecting with user: ${process.env.DB_USER || 'postgres'}`);

    try {
        // Check if database exists
        const dbCheck = await adminPool.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
        );

        if (dbCheck.rows.length === 0) {
            console.log(`Creating database "${DB_NAME}"...`);
            await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
            console.log('Database created successfully.');
        } else {
            console.log(`Database "${DB_NAME}" already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err.message);
    }

    await adminPool.end();

    // Connect to our database
    const appPool = new Pool({
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'Mukesh@123',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: DB_NAME,
    });

    try {
        // Read and execute schema
        const fs = require('fs');
        const schema = fs.readFileSync('./schema.sql', 'utf8');
        await appPool.query(schema);
        console.log('✅ Tables created/verified successfully!');

        // Migration: Add user_id columns if they don't exist (for existing databases)
        const migrations = [
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='user_id') THEN
                    ALTER TABLE shops ADD COLUMN user_id INTEGER REFERENCES users(id);
                    RAISE NOTICE 'Added user_id to shops';
                END IF;
            END $$;`,
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='user_id') THEN
                    ALTER TABLE products ADD COLUMN user_id INTEGER REFERENCES users(id);
                    RAISE NOTICE 'Added user_id to products';
                END IF;
            END $$;`,
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='user_id') THEN
                    ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id);
                    RAISE NOTICE 'Added user_id to orders';
                END IF;
            END $$;`,
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='created_at') THEN
                    ALTER TABLE shops ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;`,
        ];

        for (const migration of migrations) {
            await appPool.query(migration);
        }
        console.log('✅ Migrations applied successfully!');

        // Create indexes if they don't exist
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_shops_user ON shops(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
        ];
        for (const idx of indexes) {
            await appPool.query(idx);
        }
        console.log('✅ Indexes verified!');

    } catch (err) {
        console.error('Error setting up tables:', err.message);
    }

    await appPool.end();
}

setup();
