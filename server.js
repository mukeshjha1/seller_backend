const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes will go here

// 1. Get Shop Details
app.get('/api/shop', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM shops LIMIT 1');
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.json({}); // Not setup
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 2. Setup Shop
app.post('/api/shop', async (req, res) => {
    const { name, category, area, phone, timings, bank, verified } = req.body;
    try {
        // Check if exists, update else insert (using upsert logic or simple check)
        const { rowCount } = await db.query('SELECT * FROM shops LIMIT 1');
        if (rowCount > 0) {
            await db.query(
                'UPDATE shops SET name=$1, category=$2, area=$3, phone=$4, timings=$5, bank=$6, verified=$7',
                [name, category, area, phone, timings, bank, verified]
            );
        } else {
            await db.query(
                'INSERT INTO shops (name, category, area, phone, timings, bank, verified) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [name, category, area, phone, timings, bank, verified]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 3. Products
app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/api/products', async (req, res) => {
    const { name, category, price, qty, desc, image } = req.body;
    try {
        const { rows } = await db.query(
            'INSERT INTO products (name, category, price, qty, description, image) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, category, price, qty, desc, image]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 4. Orders
app.get('/api/orders', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM orders ORDER BY order_date DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const { rowCount } = await db.query(
            'UPDATE orders SET status=$1 WHERE id=$2',
            [status, id]
        );
        res.json({ id, status, updated: rowCount > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
