const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;
const SHOP_SERVICE = `http://localhost:${process.env.SHOP_SERVICE_PORT || 5001}`;
const PRODUCT_SERVICE = `http://localhost:${process.env.PRODUCT_SERVICE_PORT || 5002}`;
const ORDER_SERVICE = `http://localhost:${process.env.ORDER_SERVICE_PORT || 5003}`;
const AUTH_SERVICE = `http://localhost:${process.env.AUTH_SERVICE_PORT || 5004}`;

// Multer for temporary file handling at gateway level
const upload = multer({ dest: 'tmp_uploads/' });

// ═══ JSON Proxy (for shop, orders, auth) ═══
const proxyJsonRequest = async (serviceUrl, req, res) => {
    try {
        const url = `${serviceUrl}${req.originalUrl}`;
        console.log(`Forwarding ${req.method} ${req.originalUrl} to ${url}`);

        const headers = { 'Content-Type': 'application/json' };
        if (req.headers['x-user-id']) {
            headers['x-user-id'] = req.headers['x-user-id'];
        }
        const response = await axios({
            method: req.method,
            url: url,
            data: req.body,
            headers: headers,
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            console.error('Gateway Error:', error.message);
            res.status(500).json({ error: 'Service Unavailable' });
        }
    }
};

// ═══ Multipart Proxy (for products with image upload) ═══
const proxyMultipartRequest = async (serviceUrl, req, res) => {
    try {
        const url = `${serviceUrl}${req.originalUrl}`;
        console.log(`Forwarding MULTIPART ${req.method} ${req.originalUrl} to ${url}`);

        const formData = new FormData();

        // Add all text fields
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                formData.append(key, req.body[key]);
            });
        }

        // Add files if present (multiple images)
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                formData.append('images', fs.createReadStream(file.path), {
                    filename: file.originalname,
                    contentType: file.mimetype,
                });
            });
        }

        const response = await axios({
            method: req.method,
            url: url,
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'x-user-id': req.headers['x-user-id'] || '',
            },
            maxContentLength: 10 * 1024 * 1024,
        });

        // Clean up temp files
        if (req.files) {
            req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
        }

        res.status(response.status).json(response.data);
    } catch (error) {
        // Clean up temp files on error too
        if (req.files) {
            req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
        }
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            console.error('Gateway Error:', error.message);
            res.status(500).json({ error: 'Service Unavailable' });
        }
    }
};

// ═══ Serve uploaded product images through gateway ═══
app.use('/uploads', async (req, res) => {
    try {
        const url = `${PRODUCT_SERVICE}${req.originalUrl}`;
        const response = await axios({ method: 'GET', url, responseType: 'stream' });
        response.data.pipe(res);
    } catch (err) {
        res.status(404).send('Image not found');
    }
});

// ═══ Parse JSON for non-product routes ═══
app.use('/api/shop', express.json(), (req, res) => proxyJsonRequest(SHOP_SERVICE, req, res));
app.use('/api/orders', express.json(), (req, res) => proxyJsonRequest(ORDER_SERVICE, req, res));
app.use('/api/auth', express.json(), (req, res) => proxyJsonRequest(AUTH_SERVICE, req, res));

// ═══ Product routes: handle both JSON (GET/DELETE) and multipart (POST) ═══
app.get('/api/products', (req, res) => proxyJsonRequest(PRODUCT_SERVICE, req, res));
app.delete('/api/products/:id', (req, res) => proxyJsonRequest(PRODUCT_SERVICE, req, res));
app.post('/api/products', upload.array('images', 5), (req, res) => proxyMultipartRequest(PRODUCT_SERVICE, req, res));

app.listen(PORT, () => {
    console.log(`🌐 API Gateway running on port ${PORT}`);
    console.log(`   -> Shop Service: ${SHOP_SERVICE}`);
    console.log(`   -> Product Service: ${PRODUCT_SERVICE}`);
    console.log(`   -> Order Service: ${ORDER_SERVICE}`);
    console.log(`   -> Auth Service: ${AUTH_SERVICE}`);
});
