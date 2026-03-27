const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.AUTH_SERVICE_PORT || 5004;

// Generate 4-digit OTP
const generateOTP = () => String(Math.floor(1000 + Math.random() * 9000));

// Helper: get client info
const getClientInfo = (req) => ({
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
    ua: req.headers['user-agent'] || 'unknown',
});

// ═══ 1. SEND OTP ═══
app.post('/api/auth/send-otp', async (req, res) => {
    const { phone } = req.body;
    const { ip, ua } = getClientInfo(req);

    if (!phone || !/^\d{10}$/.test(phone)) {
        // Log failed attempt
        await db.query(
            `INSERT INTO login_logs (phone, action, status, ip_address, user_agent, details)
       VALUES ($1, 'OTP_SENT', 'FAILED', $2, $3, 'Invalid phone number')`,
            [phone || 'unknown', ip, ua]
        );
        return res.status(400).json({ error: 'Valid 10-digit phone number required' });
    }

    try {
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

        // Save OTP to otp_logs
        await db.query(
            `INSERT INTO otp_logs (phone, otp_code, expired_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
            [phone, otp, expiry, ip, ua]
        );

        // Log the action
        await db.query(
            `INSERT INTO login_logs (phone, action, status, ip_address, user_agent, details)
       VALUES ($1, 'OTP_SENT', 'SUCCESS', $2, $3, $4)`,
            [phone, ip, ua, `OTP: ${otp}`]
        );

        console.log(`📱 OTP for +91 ${phone}: ${otp} (expires: ${expiry.toLocaleTimeString()})`);

        // In production, send OTP via SMS gateway (Twilio, MSG91, etc.)
        // For now, return OTP in response for testing
        res.json({
            success: true,
            message: 'OTP sent successfully',
            otp: otp, // Remove this in production!
            expiresIn: '5 minutes',
        });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// ═══ 2. VERIFY OTP ═══
app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;
    const { ip, ua } = getClientInfo(req);

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP required' });
    }

    try {
        // Find latest unexpired, unverified OTP for this phone
        const { rows } = await db.query(
            `SELECT * FROM otp_logs 
       WHERE phone = $1 AND otp_code = $2 AND is_verified = FALSE AND expired_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
            [phone, otp]
        );

        if (rows.length === 0) {
            // Check if OTP exists but expired
            const { rows: expiredRows } = await db.query(
                `SELECT * FROM otp_logs WHERE phone = $1 AND otp_code = $2 AND is_verified = FALSE ORDER BY created_at DESC LIMIT 1`,
                [phone, otp]
            );

            let detail = 'Invalid OTP';
            if (expiredRows.length > 0 && new Date(expiredRows[0].expired_at) < new Date()) {
                detail = 'OTP expired';
            }

            // Log failed attempt
            await db.query(
                `INSERT INTO login_logs (phone, action, status, ip_address, user_agent, details)
         VALUES ($1, 'OTP_FAILED', 'FAILED', $2, $3, $4)`,
                [phone, ip, ua, detail]
            );

            return res.status(400).json({ error: detail });
        }

        // Mark OTP as verified
        await db.query(
            `UPDATE otp_logs SET is_verified = TRUE, verified_at = NOW() WHERE id = $1`,
            [rows[0].id]
        );

        // Create or get user
        let user;
        const { rows: existingUser } = await db.query(
            `SELECT * FROM users WHERE phone = $1`, [phone]
        );

        if (existingUser.length > 0) {
            user = existingUser[0];
            await db.query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [user.id]);
        } else {
            const { rows: newUser } = await db.query(
                `INSERT INTO users (phone) VALUES ($1) RETURNING *`, [phone]
            );
            user = newUser[0];
        }

        // Log success
        await db.query(
            `INSERT INTO login_logs (user_id, phone, action, status, ip_address, user_agent, details)
       VALUES ($1, $2, 'LOGIN_SUCCESS', 'SUCCESS', $3, $4, 'OTP verified')`,
            [user.id, phone, ip, ua]
        );

        // Check if user has an existing shop
        const { rows: shopRows } = await db.query(
            `SELECT * FROM shops WHERE user_id = $1 LIMIT 1`, [user.id]
        );

        const hasShop = shopRows.length > 0;
        const shopData = hasShop ? shopRows[0] : null;

        console.log(`✅ Login successful: +91 ${phone} (User ID: ${user.id}) | Has Shop: ${hasShop}`);

        res.json({
            success: true,
            message: 'OTP verified successfully',
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                isActive: user.is_active,
                createdAt: user.created_at,
            },
            hasShop: hasShop,
            shop: shopData,
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ═══ 3. LOGOUT ═══
app.post('/api/auth/logout', async (req, res) => {
    const { phone, userId } = req.body;
    const { ip, ua } = getClientInfo(req);

    try {
        await db.query(
            `INSERT INTO login_logs (user_id, phone, action, status, ip_address, user_agent, details)
       VALUES ($1, $2, 'LOGOUT', 'SUCCESS', $3, $4, 'User logged out')`,
            [userId || null, phone || 'unknown', ip, ua]
        );
        res.json({ success: true, message: 'Logged out' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ═══ 4. GET LOGIN LOGS ═══
app.get('/api/auth/logs', async (req, res) => {
    const { phone, action, limit = 50 } = req.query;
    try {
        let query = `SELECT ll.*, u.name as user_name 
                 FROM login_logs ll 
                 LEFT JOIN users u ON ll.user_id = u.id`;
        const params = [];
        const conditions = [];

        if (phone) {
            conditions.push(`ll.phone = $${params.length + 1}`);
            params.push(phone);
        }
        if (action) {
            conditions.push(`ll.action = $${params.length + 1}`);
            params.push(action);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY ll.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Get logs error:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// ═══ 5. GET OTP LOGS ═══
app.get('/api/auth/otp-logs', async (req, res) => {
    const { phone, limit = 50 } = req.query;
    try {
        let query = 'SELECT * FROM otp_logs';
        const params = [];

        if (phone) {
            query += ' WHERE phone = $1';
            params.push(phone);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Get OTP logs error:', err);
        res.status(500).json({ error: 'Failed to fetch OTP logs' });
    }
});

// ═══ 6. GET ALL USERS ═══
app.get('/api/auth/users', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT u.*, 
        (SELECT COUNT(*) FROM login_logs WHERE user_id = u.id AND action = 'LOGIN_SUCCESS') as total_logins,
        (SELECT created_at FROM login_logs WHERE user_id = u.id AND action = 'LOGIN_SUCCESS' ORDER BY created_at DESC LIMIT 1) as last_login
       FROM users u ORDER BY u.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.listen(PORT, () => console.log(`🔐 Auth Service running on port ${PORT}`));
