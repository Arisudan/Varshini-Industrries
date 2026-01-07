const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Session Config (Secure cookie handling)
app.use(session({
    secret: 'titanflow-secure-secret-key-2026', // In production, use ENV var
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 } // 1 Hour session, set secure: true for HTTPS
}));

// Middleware: Check Auth
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
};

// Helper to read DB
const readDb = () => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { users: [], products: [], leads: [], stats: {} };
    }
};

// Helper to write DB
const writeDb = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));
};

// --- AUTH API ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDb();

    // Simple Hash Check (Ideally use bcrypt in production)
    const user = db.users.find(u => u.username === username && u.password === password);

    if (user) {
        req.session.user = { name: user.name, role: user.role }; // Create Session
        res.json({ success: true, user: { name: user.name, role: user.role } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Credentials' });
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

// --- PUBLIC APIs ---
app.get('/api/public/products', (req, res) => {
    const db = readDb();
    res.json(db.products);
});

// NEW: Capture Leads from Contact Form
app.post('/api/leads', (req, res) => {
    const { name, email, phone, message } = req.body;
    const db = readDb();

    const newLead = {
        id: uuidv4(),
        date: new Date().toLocaleString(),
        client: name,
        interest: `Enquiry: ${message.substring(0, 30)}...`,
        contact: { email, phone },
        status: 'New Lead'
    };

    if (!db.leads) db.leads = [];
    db.leads.unshift(newLead); // Add to top
    db.stats.monthLeads = (db.stats.monthLeads || 0) + 1; // Increment stats

    writeDb(db);
    res.json({ success: true, message: 'Lead captured successfully' });
});

// --- PROTECTED DASHBOARD APIs (Require Auth) ---
app.get('/api/dashboard', isAuthenticated, (req, res) => {
    const db = readDb();
    res.json({
        stats: db.stats,
        products: db.products,
        leads: db.leads
    });
});

app.post('/api/products', isAuthenticated, (req, res) => {
    const db = readDb();
    const newProduct = req.body;
    newProduct.id = Date.now();
    if (!newProduct.image) newProduct.image = 'assets/Home/Centrifugal Pumps.png';
    db.products.push(newProduct);
    db.stats.products = db.products.length;
    writeDb(db);
    res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    const updatedData = req.body;
    const db = readDb();
    const index = db.products.findIndex(p => p.id === id);
    if (index !== -1) {
        db.products[index] = { ...db.products[index], ...updatedData, id: id };
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Product not found' });
    }
});

app.delete('/api/products/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    // ... existing logic ...
    const db = readDb();
    const initialLength = db.products.length;
    db.products = db.products.filter(p => p.id !== id);
    if (db.products.length < initialLength) {
        db.stats.products = db.products.length;
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Product not found' });
    }
});

app.post('/api/leads/status', isAuthenticated, (req, res) => {
    const { id, status } = req.body;
    const db = readDb();
    const lead = db.leads.find(l => l.id == id); // ID is string now (UUID)
    if (lead) {
        lead.status = status;
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Lead not found' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Login Page: http://localhost:${PORT}/login.html`);
});
