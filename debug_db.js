// debug_db.js — Check exactly which DB we connect to and what columns exist
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Mukesh@123',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'APNABAZAR',
});

async function debug() {
    try {
        // 1. What database are we on?
        const dbRes = await pool.query('SELECT current_database()');
        console.log('Connected to DB:', dbRes.rows[0].current_database);

        // 2. List all databases
        const allDb = await pool.query("SELECT datname FROM pg_database WHERE datistemplate = false");
        console.log('All databases:', allDb.rows.map(r => r.datname).join(', '));

        // 3. List all tables
        const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));

        // 4. Check columns for each key table
        for (const tbl of ['shops', 'products', 'orders']) {
            const cols = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [tbl]
            );
            console.log(`\n${tbl} columns:`, cols.rows.map(r => r.column_name).join(', '));
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
    await pool.end();
}

debug();
