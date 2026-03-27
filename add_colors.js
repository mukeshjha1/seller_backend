const db = require('./db');

(async () => {
    try {
        await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT DEFAULT '[]'`);
        console.log('✅ colors column added to products table');
    } catch (e) {
        console.log('Error:', e.message);
    }
    process.exit();
})();
