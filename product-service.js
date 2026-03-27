const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PRODUCT_SERVICE_PORT || 5002;

// ═══ Uploads folder setup ═══
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('📁 Created uploads/products directory');
}

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══ Multer config ═══
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const name = `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
    },
});

// ═══ Get Products by user_id ═══
app.get('/api/products', async (req, res) => {
    const userId = req.query.user_id || req.headers['x-user-id'];
    if (!userId) {
        return res.status(400).json({ error: 'user_id required' });
    }
    try {
        const { rows } = await db.query(
            'SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC', [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ═══ Add Product with Multiple Image Upload (up to 5) ═══
app.post('/api/products', upload.array('images', 5), async (req, res) => {
    const { user_id, name, category, subcategory, price, qty, desc, colors, sizes } = req.body;
    console.log('📥 Received product data:', { user_id, name, category, subcategory, price, qty, colors: colors?.substring(0, 30), sizes: sizes?.substring(0, 50) });
    if (!user_id) {
        return res.status(400).json({ error: 'user_id required' });
    }

    // Build image URLs array (stored as JSON string in DB)
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
        imageUrls = req.files.map(f => `/uploads/products/${f.filename}`);
        console.log(`🖼️ ${req.files.length} image(s) uploaded: ${req.files.map(f => f.filename).join(', ')}`);
    }

    // Colors is already a JSON string from frontend
    const colorsJson = colors || '[]';

    // Sizes: JSON string like [{"size":"M","qty":5},{"size":"XL","qty":3}]
    const sizesJson = sizes || '[]';

    // If sizes are provided, compute total qty from sizes
    let finalQty = qty;
    try {
        const parsedSizes = JSON.parse(sizesJson);
        if (Array.isArray(parsedSizes) && parsedSizes.length > 0) {
            finalQty = parsedSizes.reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);
        }
    } catch (e) { /* keep original qty */ }

    try {
        const { rows } = await db.query(
            'INSERT INTO products (user_id, name, category, subcategory, price, qty, description, image, colors, sizes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [user_id, name, category, subcategory || null, price, finalQty, desc, JSON.stringify(imageUrls), colorsJson, sizesJson]
        );
        console.log(`📦 Product added: "${name}" by user ${user_id} (cat: ${category}/${subcategory}, ${imageUrls.length} images)`);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ═══ Delete Product (only if owned by user) ═══
app.delete('/api/products/:id', async (req, res) => {
    const userId = req.query.user_id || req.headers['x-user-id'];
    const productId = req.params.id;
    if (!userId) {
        return res.status(400).json({ error: 'user_id required' });
    }
    try {
        // Get image paths before deleting
        const { rows: existing } = await db.query(
            'SELECT image FROM products WHERE id = $1 AND user_id = $2', [productId, userId]
        );

        const { rowCount } = await db.query(
            'DELETE FROM products WHERE id = $1 AND user_id = $2', [productId, userId]
        );
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Delete all image files
        if (existing.length > 0 && existing[0].image) {
            try {
                const images = JSON.parse(existing[0].image);
                images.forEach(imgPath => {
                    const fullPath = path.join(__dirname, imgPath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                        console.log(`🗑️ Deleted image: ${imgPath}`);
                    }
                });
            } catch (e) {
                // Old single-image format fallback
                const imgPath = path.join(__dirname, existing[0].image);
                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            }
        }

        res.json({ success: true, message: 'Product deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Multer error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Max 5MB per image.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

app.listen(PORT, () => console.log(`📦 Product Service running on port ${PORT}`));
