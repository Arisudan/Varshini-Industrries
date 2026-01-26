require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const multer = require('multer');

// Import SQLite Database
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Configure Multer Storage (Image Uploads)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/assets/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(bodyParser.json());

// Security Middleware: Block access to raw DB files
app.use((req, res, next) => {
    if (req.path.startsWith('/data') || req.path.includes('.db') || req.path.includes('db.json') || req.path.startsWith('/.git')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// Serve frontend from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Session Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000, httpOnly: true }
}));

// Middleware: Check Auth
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

// --- AUTH API ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.getOne("SELECT * FROM users WHERE username = ?", [username]);

        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign(
                { username: user.username, role: user.role, name: user.name },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            req.session.user = { name: user.name, role: user.role, username: user.username };
            res.json({
                success: true,
                token: token,
                user: { name: user.name, role: user.role }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Username or Password' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/api/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const username = req.user ? req.user.username : (req.session.user ? req.session.user.username : null);

        if (!username) return res.status(401).send('Unauthorized');

        const user = await db.getOne("SELECT * FROM users WHERE username = ?", [username]);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(400).json({ success: false, message: 'Incorrect current password' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashed = bcrypt.hashSync(newPassword, salt);

        await db.runQuery("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- PUBLIC APIs ---
app.get('/api/public/products', async (req, res) => {
    try {
        const products = await db.query("SELECT * FROM products");
        // Parse JSON strings back to objects
        const parsed = products.map(p => {
            try {
                if (p.table_data && typeof p.table_data === 'string') {
                    p.table_data = JSON.parse(p.table_data);
                }
            } catch (e) { }
            return p;
        });
        res.json(parsed);
    } catch (e) {
        res.status(500).send('Error fetching products');
    }
});

app.post('/api/leads', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;
        const id = uuidv4();
        const date = new Date().toLocaleString();
        const status = 'New Lead';
        const interest = `Enquiry: ${message ? message.substring(0, 30) : ''}...`;

        await db.runQuery(
            "INSERT INTO leads (id, date, client, interest, email, phone, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [id, date, name, interest, email, phone, message, status]
        );

        res.json({ success: true, message: 'Lead captured successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Error saving lead' });
    }
});

// --- DASHBOARD APIs ---
app.get('/api/dashboard', isAuthenticated, async (req, res) => {
    try {
        const productsRaw = await db.query("SELECT * FROM products");
        const leads = await db.query("SELECT * FROM leads ORDER BY rowid DESC"); // rowid loosely proxies insertion order or use date sorting in client
        const warranties = await db.query("SELECT * FROM warranties ORDER BY id DESC");
        const categoriesRaw = await db.query("SELECT * FROM categories");

        // Parse Product JSON
        const products = productsRaw.map(p => {
            try {
                if (typeof p.table_data === 'string') p.table_data = JSON.parse(p.table_data);
            } catch (e) { }
            return p;
        });

        // Calculate counts
        const categories = categoriesRaw.map(c => ({
            ...c,
            count: products.filter(p => p.category === c.name).length
        }));

        res.json({
            stats: {}, // Frontend calculates stats from raw arrays
            products,
            leads,
            warranties,
            categories
        });
    } catch (e) {
        console.error(e);
        res.status(500).send("Dashboard Error");
    }
});

// --- PRODUCTS MANAGEMENT ---
app.post('/api/products', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const p = req.body;
        // Handling multipart string vs objects
        if (typeof p.table_data === 'string') {
            try { JSON.parse(p.table_data); } catch (e) { p.table_data = "{}" } // Validate JSON
        } else {
            p.table_data = JSON.stringify(p.table_data || {});
        }

        const id = Date.now();
        let image = 'assets/Home/Centrifugal Pumps.png';
        if (req.file) image = 'assets/uploads/' + req.file.filename;

        await db.runQuery(
            "INSERT INTO products (id, name, category, series, hp, price, stock, image, table_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [id, p.name, p.category, p.series, p.hp, p.price, p.stock, image, p.table_data]
        );

        res.json({ success: true, product: { ...p, id, image } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

app.put('/api/products/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const p = req.body;
        const currentCheck = await db.getOne("SELECT image FROM products WHERE id = ?", [id]);

        if (!currentCheck) return res.status(404).json({ success: false, message: 'Product not found' });

        let image = currentCheck.image;
        if (req.file) {
            image = 'assets/uploads/' + req.file.filename;
        }

        let tableData = p.table_data;
        if (typeof tableData !== 'string') tableData = JSON.stringify(tableData || {});

        await db.runQuery(
            "UPDATE products SET name=?, category=?, series=?, hp=?, price=?, stock=?, image=?, table_data=? WHERE id=?",
            [p.name, p.category, p.series, p.hp, p.price, p.stock, image, tableData, id]
        );

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await db.runQuery("DELETE FROM products WHERE id = ?", [id]);
        if (result.changes > 0) res.json({ success: true });
        else res.status(404).json({ success: false });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- CATEGORIES MANAGEMENT ---
app.get('/api/categories', async (req, res) => {
    try {
        const cats = await db.query("SELECT * FROM categories");
        const prodCounts = await db.query("SELECT category, count(*) as count FROM products GROUP BY category");

        const result = cats.map(c => {
            const match = prodCounts.find(pc => pc.category === c.name);
            return { ...c, count: match ? match.count : 0 };
        });
        res.json(result);
    } catch (e) {
        res.status(500).send("Error");
    }
});

app.post('/api/categories', isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        // Check exist
        const exists = await db.getOne("SELECT * FROM categories WHERE name LIKE ?", [name]);
        if (exists) return res.status(400).json({ success: false, message: 'Category exists' });

        const id = Date.now();
        await db.runQuery("INSERT INTO categories (id, name) VALUES (?, ?)", [id, name]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/categories/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const cat = await db.getOne("SELECT * FROM categories WHERE id = ?", [id]);
        if (!cat) return res.status(404).json({ success: false });

        // Check products
        const products = await db.getOne("SELECT * FROM products WHERE category = ?", [cat.name]);
        if (products) return res.status(400).json({ success: false, message: 'Cannot delete: Category is not empty' });

        await db.runQuery("DELETE FROM categories WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- WARRANTY MANAGEMENT ---
app.get('/api/warranties', isAuthenticated, async (req, res) => {
    try {
        const rows = await db.query("SELECT * FROM warranties ORDER BY date DESC");
        res.json(rows);
    } catch (e) {
        res.status(500).send("Error");
    }
});

app.post('/api/warranties', async (req, res) => {
    try {
        const w = req.body;
        if (!w.name || !w.email) return res.status(400).json({ success: false, message: 'Missing fields' });

        const id = Date.now();
        const date = new Date().toISOString();
        const status = 'Pending';

        await db.runQuery(
            "INSERT INTO warranties (id, date, name, email, phone, city, product, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [id, date, w.name, w.email, w.phone, w.city, w.product, w.address, status]
        );
        res.json({ success: true, message: 'Submitted' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/warranties/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        await db.runQuery("UPDATE warranties SET status = ? WHERE id = ?", [status, id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/warranties/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await db.runQuery("DELETE FROM warranties WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- LEADS MANAGEMENT ---
app.get('/api/leads', isAuthenticated, async (req, res) => {
    try {
        // Return full structure expected by frontend
        const rows = await db.query("SELECT * FROM leads ORDER BY rowid DESC");
        // Reconstruct 'contact' object if frontend expects it nested
        const mapped = rows.map(r => ({
            ...r,
            contact: { email: r.email, phone: r.phone }
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).send("Error");
    }
});

app.post('/api/leads/status', isAuthenticated, async (req, res) => {
    try {
        const { id, status } = req.body;
        await db.runQuery("UPDATE leads SET status = ? WHERE id = ?", [status, id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/leads/:id', isAuthenticated, async (req, res) => {
    try {
        const id = req.params.id; // UUID is string from params
        await db.runQuery("DELETE FROM leads WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Login Page: http://localhost:${PORT}/login.html`);
    console.log(`- Database: SQLite (High Performance)`);
});
