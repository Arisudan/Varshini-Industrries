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
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const multer = require('multer');

// --- FIREBASE SETUP ---
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

// --- LOGGER ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
if (process.env.NODE_ENV !== 'production') logger.add(new winston.transports.Console({ format: winston.format.simple() }));

// --- MIDDLEWARE ---
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000, httpOnly: true }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Slightly higher for admin usage
    message: 'Too many requests.'
});
app.use('/api/', limiter);

// Multer (Images still local for now)
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

const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ success: false });
            req.user = user;
            return next();
        });
    } else if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).json({ success: false });
    }
};

// --- ROUTES (FIREBASE EDITION) ---

// 1. Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const snapshot = await db.collection('users').where('username', '==', username).get();
        if (snapshot.empty) return res.status(401).json({ success: false, message: 'Invalid Credentials' });

        const user = snapshot.docs[0].data();
        if (bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
            req.session.user = { name: user.name, role: user.role };
            res.json({ success: true, token, user: { name: user.name, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Credentials' });
        }
    } catch (e) {
        logger.error(e);
        res.status(500).send('Login Error');
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.user, user: req.session.user });
});

// Change Password
app.post('/api/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const targetUser = req.user ? req.user.username : 'admin'; // fallback

    try {
        const snapshot = await db.collection('users').where('username', '==', targetUser).get();
        if (snapshot.empty) return res.status(404).json({ success: false });

        const docId = snapshot.docs[0].id;
        const user = snapshot.docs[0].data();

        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(400).json({ success: false, message: 'Bad Password' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        await db.collection('users').doc(docId).update({ password: hash });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// 2. Products (Public)
app.get('/api/public/products', async (req, res) => {
    try {
        const snapshot = await db.collection('products').get();
        const products = snapshot.docs.map(doc => {
            const d = doc.data();
            // Firebase stores objects directly, no need for JSON.parse if we migrated correctly
            // But strict migration parsed strings to objects, so they are objects now.
            return d;
        });
        res.json(products);
    } catch (e) {
        logger.error(e);
        res.status(500).send('Error');
    }
});

// 3. Leads (Create)
app.post('/api/leads', async (req, res) => {
    const { name, email, phone, message } = req.body;
    const lead = {
        id: uuidv4(),
        date: new Date().toLocaleString(),
        client: name,
        interest: `Enquiry: ${message ? message.substring(0, 50) : 'General'}`,
        status: 'New Lead',
        contact_info: { email, phone }
    };
    try {
        await db.collection('leads').doc(lead.id).set(lead);
        res.json({ success: true });
    } catch (e) {
        logger.error(e);
        res.status(500).json({ success: false });
    }
});

// 4. Products (Admin)
app.post('/api/products', isAuthenticated, upload.single('image'), async (req, res) => {
    const p = req.body;
    let tableData = {};
    try { tableData = typeof p.table_data === 'string' ? JSON.parse(p.table_data) : p.table_data; } catch (e) { }

    const id = Date.now();
    let imagePath = 'assets/Home/Centrifugal Pumps.png';
    if (req.file) imagePath = 'assets/uploads/' + req.file.filename;

    const newProd = {
        id: id,
        category: p.category,
        name: p.name,
        series: p.series,
        hp: p.hp,
        price: p.price,
        stock: p.stock,
        image: imagePath,
        table_data: tableData || {}
    };

    try {
        await db.collection('products').doc(String(id)).set(newProd);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/api/products/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const p = req.body;

    try {
        const docRef = db.collection('products').doc(String(id));
        const docHook = await docRef.get();
        if (!docHook.exists) return res.status(404).json({ message: 'Not Found' });

        const old = docHook.data();
        let imagePath = old.image;
        if (req.file) imagePath = 'assets/uploads/' + req.file.filename;

        // Merge logic
        const updateData = {
            category: p.category || old.category,
            name: p.name || old.name,
            series: p.series || old.series,
            hp: p.hp || old.hp,
            price: p.price || old.price,
            stock: p.stock || old.stock,
            image: imagePath
        };
        // Optional Table Data update - keeping simple for now

        await docRef.update(updateData);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
        await db.collection('products').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- CATEGORIES ---
app.get('/api/categories', isAuthenticated, async (req, res) => {
    try {
        const catsSnap = await db.collection('categories').get();
        const prodsSnap = await db.collection('products').get(); // Need to count in code or aggregation query

        const products = prodsSnap.docs.map(d => d.data());
        const cats = catsSnap.docs.map(d => {
            const c = d.data();
            const count = products.filter(p => p.category === c.name).length;
            return { ...c, count };
        });
        res.json(cats);
    } catch (e) { res.status(500).json([]); }
});

app.post('/api/categories', isAuthenticated, async (req, res) => {
    const { id, name } = req.body;
    const newId = id || Date.now();
    try {
        await db.collection('categories').doc(String(newId)).set({ id: newId, name });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.delete('/api/categories/:id', isAuthenticated, async (req, res) => {
    try {
        await db.collection('categories').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- WARRANTIES ---
app.post('/api/warranties', async (req, res) => {
    // Public endpoint for registration
    const w = req.body;
    const warranty = {
        id: uuidv4(),
        date: new Date().toLocaleString(),
        name: w.name,
        email: w.email,
        phone: w.phone,
        address: w.address,
        product: w.product || 'Not Specified',
        purchaseDate: w.purchaseDate,
        message: w.message,
        status: 'Pending'
    };
    try {
        await db.collection('warranties').doc(warranty.id).set(warranty);
        res.json({ success: true });
    } catch (e) {
        logger.error(e);
        res.status(500).json({ success: false });
    }
});

// --- LEADS ---
app.delete('/api/leads/:id', isAuthenticated, async (req, res) => {
    try {
        await db.collection('leads').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/leads/status', isAuthenticated, async (req, res) => {
    const { id, status } = req.body;
    try {
        await db.collection('leads').doc(id).update({ status });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- DASHBOARD ---
app.get('/api/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Parallel Fetch
        const [pSnap, lSnap, wSnap, cSnap] = await Promise.all([
            db.collection('products').get(),
            db.collection('leads').get(),
            db.collection('warranties').get(),
            db.collection('categories').get()
        ]);

        const products = pSnap.docs.map(d => d.data());
        const leads = lSnap.docs.map(d => d.data());
        const warranties = wSnap.docs.map(d => d.data());
        const rawCats = cSnap.docs.map(d => d.data());

        const categories = rawCats.map(c => ({
            ...c,
            count: products.filter(p => p.category === c.name).length
        }));

        res.json({ products, leads, warranties, categories });
    } catch (e) {
        logger.error(e);
        res.status(500).send('Error');
    }
});

// Start
app.listen(PORT, () => {
    console.log(`Firebase-Powered Server running at http://localhost:${PORT}`);
    logger.info(`Server started on port ${PORT}`);
});
