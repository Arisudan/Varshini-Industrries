const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_JSON_PATH = path.join(__dirname, 'data', 'db.json');
const SQLITE_DB_PATH = path.join(__dirname, 'data', 'varshini.db');

// Read JSON Data
if (!fs.existsSync(DB_JSON_PATH)) {
    console.error('db.json not found!');
    process.exit(1);
}
const jsonData = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));

// Initialize SQLite Database
const db = new sqlite3.Database(SQLITE_DB_PATH);

db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT
    )`);

    // 2. Categories Table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE
    )`);

    // 3. Products Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        category TEXT,
        name TEXT,
        series TEXT,
        hp TEXT,
        price TEXT,
        stock TEXT,
        image TEXT,
        table_data TEXT
    )`);

    // 4. Leads Table
    db.run(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        date TEXT,
        client TEXT,
        interest TEXT,
        status TEXT,
        contact_info TEXT
    )`);

    // 5. Warranties Table
    db.run(`CREATE TABLE IF NOT EXISTS warranties (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        product_serial TEXT,
        purchase_date TEXT,
        invoice_number TEXT,
        dealer_name TEXT,
        status TEXT,
        date_submitted TEXT
    )`);
});

// Use parallel insertion (not transaction/serialize for this simple script so we see errors per item)

setTimeout(() => {
    // Users
    if (jsonData.users) {
        jsonData.users.forEach(u => {
            db.run("INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)",
                [u.username, u.password, u.role, u.name], (err) => { if (err) console.error("User Error:", err.message); });
        });
    }

    // Categories
    if (jsonData.categories) {
        jsonData.categories.forEach(c => {
            db.run("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)",
                [c.id, c.name], (err) => { if (err) console.error("Category Error:", err.message); });
        });
    }

    // Products
    if (jsonData.products) {
        jsonData.products.forEach(p => {
            db.run("INSERT OR IGNORE INTO products (id, category, name, series, hp, price, stock, image, table_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [p.id, p.category, p.name, p.series, p.hp, p.price, p.stock, p.image, JSON.stringify(p.table_data)],
                (err) => { if (err) console.error("Product Error:", err.message); });
        });
    }

    // Leads
    if (jsonData.leads) {
        jsonData.leads.forEach(l => {
            const leadId = String(l.id);
            const contact = l.contact || {};
            db.run("INSERT OR IGNORE INTO leads (id, date, client, interest, status, contact_info) VALUES (?, ?, ?, ?, ?, ?)",
                [leadId, l.date, l.client, l.interest, l.status, JSON.stringify(contact)],
                (err) => { if (err) console.error("Lead Error:", err.message); });
        });
    }

    // Warranties
    if (jsonData.warranties) {
        jsonData.warranties.forEach(w => {
            db.run("INSERT OR IGNORE INTO warranties (id, name, email, phone, product_serial, purchase_date, invoice_number, dealer_name, status, date_submitted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [w.id, w.name, w.email, w.phone, w.product_serial, w.purchase_date, w.invoice_number, w.dealer_name, w.status || 'Pending', w.date || new Date().toISOString()],
                (err) => { if (err) console.error("Warranty Error:", err.message); });
        });
    }

    console.log("Migration Logic Sent. Closing DB...");
    db.close();
}, 1000); // Small delay to ensure tables created
