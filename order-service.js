const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.ORDER_SERVICE_PORT || 5003;

// Get Orders by user_id
app.get('/api/orders', async (req, res) => {
    const userId = req.query.user_id || req.headers['x-user-id'];
    if (!userId) {
        return res.status(400).json({ error: 'user_id required' });
    }
    try {
        const { rows } = await db.query(
            'SELECT * FROM orders WHERE user_id = $1 ORDER BY order_date DESC', [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Update Order Status (only if owned by user)
app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.body.user_id || req.headers['x-user-id'];
    try {
        const { rowCount } = await db.query(
            'UPDATE orders SET status=$1 WHERE id=$2 AND user_id=$3',
            [status, id, userId]
        );
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ id, status, message: 'Updated' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.listen(PORT, () => console.log(`🚚 Order Service running on port ${PORT}`));
