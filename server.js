const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-2026'; // In production, use process.env.JWT_SECRET
const DB_FILE = path.join(__dirname, 'db.json');
const multer = require('multer');

// Configure Multer Storage (Image Uploads)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'assets/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Unique filename: product-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

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

// Middleware: Check Auth (Session or Token)
const isAuthenticated = (req, res, next) => {
    // Check for JWT token in Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
            req.user = user;
            return next();
        });
    } else if (req.session && req.session.user) {
        // Fallback to session
        return next();
    } else {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
    }
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
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = readDb();

    const user = db.users.find(u => u.username === username);

    if (user && bcrypt.compareSync(password, user.password)) {
        // Create JWT
        const token = jwt.sign(
            { username: user.username, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        req.session.user = { name: user.name, role: user.role }; // Support sessions too
        res.json({
            success: true,
            token: token,
            user: { name: user.name, role: user.role }
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Username or Password' });
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

    writeDb(db);
    res.json({ success: true, message: 'Lead captured successfully' });
});

// --- PROTECTED DASHBOARD APIs (No server-side auth check, using client localStorage) ---
app.get('/api/dashboard', isAuthenticated, (req, res) => {
    const db = readDb();

    // Calculate real-time stats from actual data
    const realStats = {
        dealers: 0, // Not tracked yet - will be 0
        pendingOrders: 0, // Not tracked yet - will be 0  
        monthLeads: db.leads ? db.leads.length : 0, // Actual count of leads
        products: db.products ? db.products.length : 0 // Actual count of products
    };

    res.json({
        stats: realStats,
        products: db.products,
        leads: db.leads
    });
});

app.post('/api/products', isAuthenticated, upload.single('image'), (req, res) => {
    const db = readDb();
    const newProduct = req.body;

    // Convert table_data from JSON string if sent as string (Multipart form data sends nested objects as strings sometimes)
    if (typeof newProduct.table_data === 'string') {
        try {
            newProduct.table_data = JSON.parse(newProduct.table_data);
        } catch (e) {
            newProduct.table_data = {};
        }
    }

    newProduct.id = Date.now();

    // Handle Image Path
    if (req.file) {
        // Save relative path using forward slashes for URL compatibility
        newProduct.image = 'assets/uploads/' + req.file.filename;
    } else if (!newProduct.image) {
        newProduct.image = 'assets/Home/Centrifugal Pumps.png';
    }

    db.products.push(newProduct);
    writeDb(db);
    res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const id = parseInt(req.params.id);
    const updatedData = req.body;
    const db = readDb();
    const index = db.products.findIndex(p => p.id === id);

    if (index !== -1) {
        // Parse table_data if string
        if (typeof updatedData.table_data === 'string') {
            try {
                updatedData.table_data = JSON.parse(updatedData.table_data);
            } catch (e) { }
        }

        // Keep existing image if no new one, or update if file provided
        if (req.file) {
            updatedData.image = 'assets/uploads/' + req.file.filename;
        } else {
            // If no file uploaded, use the hidden field 'existingImage' or keep current DB value
            updatedData.image = req.body.existingImage || db.products[index].image;
        }

        // Merge: ensure existing ID is kept
        db.products[index] = { ...db.products[index], ...updatedData, id: id };
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Product not found' });
    }
});

app.delete('/api/products/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDb();
    const initialLength = db.products.length;
    db.products = db.products.filter(p => p.id !== id);
    if (db.products.length < initialLength) {
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Product not found' });
    }
});

// --- CATEGORY APIs ---
app.get('/api/categories', (req, res) => {
    const db = readDb();
    if (!db.categories) {
        // Extract unique categories from products if not present
        const uniqueCats = [...new Set(db.products.map(p => p.category).filter(Boolean))];
        db.categories = uniqueCats.map((c, index) => ({ id: Date.now() + index, name: c }));
        writeDb(db);
    }
    // Calculate counts dynamically
    const categoriesWithCounts = db.categories.map(c => ({
        ...c,
        count: db.products.filter(p => p.category === c.name).length
    }));

    res.json(categoriesWithCounts);
});

app.post('/api/categories', isAuthenticated, (req, res) => {
    const { name } = req.body;
    const db = readDb();
    if (!db.categories) db.categories = [];

    if (db.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    db.categories.push({ id: Date.now(), name });
    writeDb(db);
    res.json({ success: true });
});

app.delete('/api/categories/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDb();

    // Ensure categories exists (should be initialized by GET, but safe check)
    if (!db.categories) {
        db.categories = [];
    }

    const category = db.categories.find(c => c.id === id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    if (db.products.some(p => p.category === category.name)) {
        return res.status(400).json({ success: false, message: 'Cannot delete category with associated products.' });
    }

    db.categories = db.categories.filter(c => c.id !== id);
    writeDb(db);
    res.json({ success: true });
});

// --- WARRANTY REGISTRATION APIs ---

app.get('/api/warranties', isAuthenticated, (req, res) => {
    const db = readDb();
    if (!db.warranties) db.warranties = [];
    res.json(db.warranties);
});

app.post('/api/warranties', (req, res) => {
    const registration = req.body;
    const db = readDb();
    if (!db.warranties) db.warranties = [];

    // Validate required fields
    if (!registration.name || !registration.email) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Add ID and Timestamp and default status
    registration.id = Date.now();
    registration.date = new Date().toISOString();
    registration.status = 'Pending';

    db.warranties.unshift(registration);

    writeDb(db);
    res.json({ success: true, message: 'Registration submitted successfully' });
});

app.put('/api/warranties/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const db = readDb();

    if (!db.warranties) return res.status(404).json({ success: false });

    const item = db.warranties.find(d => d.id === id);
    if (item) {
        item.status = status;
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Registration not found' });
    }
});

app.delete('/api/warranties/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDb();

    if (!db.warranties) return res.status(404).json({ success: false });

    const initialLength = db.warranties.length;
    db.warranties = db.warranties.filter(d => d.id !== id);

    if (db.warranties.length < initialLength) {
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Registration not found' });
    }
});

app.post('/api/leads/status', (req, res) => {
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

app.delete('/api/leads/:id', (req, res) => {
    const id = req.params.id;
    const db = readDb();
    const initialLength = db.leads.length;
    // Use loose equality to handle both numeric and string IDs
    db.leads = db.leads.filter(l => String(l.id) !== String(id));
    if (db.leads.length < initialLength) {
        writeDb(db);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Lead not found' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Login Page: http://localhost:${PORT}/login.html`);
});
