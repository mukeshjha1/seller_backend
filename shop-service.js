const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.SHOP_SERVICE_PORT || 5001;

// Get Shop by user_id
app.get('/api/shop', async (req, res) => {
    const userId = req.query.user_id || req.headers['x-user-id'];
    if (!userId) {
        return res.status(400).json({ error: 'user_id required' });
    }
    try {
        const { rows } = await db.query('SELECT * FROM shops WHERE user_id = $1 LIMIT 1', [userId]);
        res.json(rows.length > 0 ? rows[0] : {});
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Create or Update Shop (linked to user)
app.post('/api/shop', async (req, res) => {
    const { user_id, name, category, area, phone, timings, bank, verified, verification_pending } = req.body;
    if (!user_id) {
        return res.status(400).json({ error: 'user_id required' });
    }
    try {
        // Check if this user already has a shop
        const { rows: existing } = await db.query('SELECT id FROM shops WHERE user_id = $1 LIMIT 1', [user_id]);

        if (existing.length > 0) {
            // Update existing shop
            await db.query(
                `UPDATE shops SET name=$1, category=$2, area=$3, phone=$4, timings=$5, bank=$6, verified=$7, verification_pending=$8 
                 WHERE user_id=$9`,
                [name, category, area, phone, timings, bank, verified || false, verification_pending || false, user_id]
            );
            const { rows: updatedRows } = await db.query('SELECT * FROM shops WHERE user_id=$1 LIMIT 1', [user_id]);
            res.json(updatedRows[0]);
        } else {
            // Create new shop for this user
            const { rows } = await db.query(
                `INSERT INTO shops (user_id, name, category, area, phone, timings, bank, verified, verification_pending) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [user_id, name, category, area, phone, timings, bank, verified || false, verification_pending || false]
            );
            console.log(`🏪 New shop created: "${name}" for user ${user_id}`);
            res.json(rows[0]);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.listen(PORT, () => console.log(`🏪 Shop Service running on port ${PORT}`));
