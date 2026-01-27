require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const multer = require('multer');

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';
const DB_PATH = path.join(__dirname, 'data', 'varshini.db');

// --- LOGGER SETUP (Winston) ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// --- DB CONNECTION ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        logger.error('Could not connect to database', err);
    } else {
        logger.info('Connected to SQLite database');
    }
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000, httpOnly: true }
}));

// Rate Limiter (Security)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter); // Apply to API routes only

// Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/assets/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- AUTH MIDDLEWARE ---
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
            req.user = user;
            return next();
        });
    } else if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
    }
};

// --- API ROUTES ---

// 1. Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            logger.error('Login Error', err);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
            req.session.user = { name: user.name, role: user.role };
            res.json({ success: true, token, user: { name: user.name, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Username or Password' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.user, user: req.session.user });
});

// 2. Products (Public)
app.get('/api/public/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            logger.error('Fetch Products Error', err);
            return res.status(500).send('Error fetching products');
        }
        // Parse JSON table_data
        const products = rows.map(p => ({
            ...p,
            table_data: p.table_data ? JSON.parse(p.table_data) : {}
        }));
        res.json(products);
    });
});

// 3. Leads (Public - Create)
app.post('/api/leads', (req, res) => {
    const { name, email, phone, message } = req.body;
    const id = uuidv4();
    const date = new Date().toLocaleString();
    const interest = `Enquiry: ${message.substring(0, 30)}...`;
    const contact = JSON.stringify({ email, phone });
    const status = 'New Lead';

    db.run('INSERT INTO leads (id, date, client, interest, status, contact_info) VALUES (?, ?, ?, ?, ?, ?)',
        [id, date, name, interest, status, contact],
        function (err) {
            if (err) {
                logger.error('Create Lead Error', err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true, message: 'Lead captured successfully' });
        }
    );
});

// 4. Products (Admin - Create/Update/Delete)
app.post('/api/products', isAuthenticated, upload.single('image'), (req, res) => {
    const p = req.body;
    let tableDataStr = '{}';
    if (typeof p.table_data === 'string') {
        try { tableDataStr = p.table_data; } catch (e) { } // Assuming client sends JSON string
    } else if (typeof p.table_data === 'object') {
        tableDataStr = JSON.stringify(p.table_data);
    }

    // Validate JSON validity just in case
    try { JSON.parse(tableDataStr); } catch (e) { tableDataStr = '{}'; }

    const id = Date.now();
    let imagePath = 'assets/Home/Centrifugal Pumps.png';
    if (req.file) imagePath = 'assets/uploads/' + req.file.filename;

    db.run("INSERT INTO products (id, category, name, series, hp, price, stock, image, table_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, p.category, p.name, p.series, p.hp, p.price, p.stock, imagePath, tableDataStr],
        function (err) {
            if (err) { logger.error('Add Product Error', err); return res.status(500).json({ success: false }); }
            res.json({ success: true, product: { ...p, id, image: imagePath } });
        }
    );
});

app.put('/api/products/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const id = parseInt(req.params.id);
    const p = req.body;

    // First, fetch existing to keep image if not updated
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
        if (!row) return res.status(404).json({ message: 'Product not found' });

        let imagePath = row.image;
        if (req.file) imagePath = 'assets/uploads/' + req.file.filename;

        let tableDataStr = row.table_data;
        if (p.table_data) tableDataStr = typeof p.table_data === 'string' ? p.table_data : JSON.stringify(p.table_data);

        // Update each field if provided, else keep old (simplistic approach: full update usually sent by frontend)
        // Optimized: just overwrite with new body values + defaults
        const category = p.category || row.category;
        const name = p.name || row.name;
        const series = p.series || row.series;
        const hp = p.hp || row.hp;
        const price = p.price || row.price;
        const stock = p.stock || row.stock;

        db.run("UPDATE products SET category=?, name=?, series=?, hp=?, price=?, stock=?, image=?, table_data=? WHERE id=?",
            [category, name, series, hp, price, stock, imagePath, tableDataStr, id],
            function (err) {
                if (err) { logger.error('Update Product Error', err); return res.status(500).json({ success: false }); }
                res.json({ success: true });
            }
        );
    });
});

app.delete('/api/products/:id', isAuthenticated, (req, res) => {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], function (err) {
        if (err) { logger.error('Delete Product Error', err); return res.status(500).json({ success: false }); }
        res.json({ success: true });
    });
});

// 5. Dashboard Data (Aggregation)
app.get('/api/dashboard', isAuthenticated, (req, res) => {
    const data = { products: [], leads: [], warranties: [], categories: [] };

    // Use Promises for parallel queries
    const getProducts = new Promise((resolve) => db.all('SELECT * FROM products', (err, r) => resolve(r || [])));
    const getLeads = new Promise((resolve) => db.all('SELECT * FROM leads', (err, r) => resolve(r || [])));
    const getWarranties = new Promise((resolve) => db.all('SELECT * FROM warranties', (err, r) => resolve(r || [])));
    const getCategories = new Promise((resolve) => db.all('SELECT * FROM categories', (err, r) => resolve(r || [])));

    Promise.all([getProducts, getLeads, getWarranties, getCategories]).then((results) => {
        data.products = results[0];
        data.leads = results[1];
        data.warranties = results[2];
        let cats = results[3];

        // Format data
        data.products = data.products.map(p => ({ ...p, table_data: JSON.parse(p.table_data || '{}') }));
        data.leads = data.leads.map(l => ({ ...l, contact: JSON.parse(l.contact_info || '{}') }));

        // Calculate category counts
        if (cats.length === 0 && data.products.length > 0) {
            // Fallback if no categories table entry
            const unique = [...new Set(data.products.map(p => p.category))];
            cats = unique.map((c, i) => ({ id: i, name: c }));
        }

        const catsWithCount = cats.map(c => ({
            ...c,
            count: data.products.filter(p => p.category === c.name).length
        }));

        res.json({
            stats: {},
            products: data.products,
            leads: data.leads,
            warranties: data.warranties,
            categories: catsWithCount
        });
    }).catch(err => {
        logger.error('Dashboard Data Error', err);
        res.status(500).send('Server Error');
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Enterprise Server running at http://localhost:${PORT}`);
    logger.info(`Server started on port ${PORT}`);
});
