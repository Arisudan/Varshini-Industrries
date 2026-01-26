const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'varshini.db');
const JSON_DB_PATH = path.join(__dirname, 'data', 'db.json');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Error opening database:', err);
    else console.log('Connected to SQLite database.');
});

// Helper for Promises
db.query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

db.getOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

db.runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// Initialize Tables
db.serialize(() => {
    // Users
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT
    )`);

    // Products
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT,
        category TEXT,
        series TEXT,
        hp TEXT,
        price TEXT,
        stock TEXT,
        image TEXT,
        table_data TEXT
    )`);

    // Categories
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE
    )`);

    // Leads
    db.run(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        date TEXT,
        client TEXT,
        interest TEXT,
        email TEXT,
        phone TEXT,
        message TEXT,
        status TEXT
    )`);

    // Warranties
    db.run(`CREATE TABLE IF NOT EXISTS warranties (
        id INTEGER PRIMARY KEY,
        date TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        city TEXT,
        product TEXT,
        address TEXT,
        status TEXT
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);
});

// One-Time Migration Logic
async function migrate() {
    try {
        const result = await db.getOne("SELECT count(*) as count FROM users");
        if (result.count === 0 && fs.existsSync(JSON_DB_PATH)) {
            console.log("Migrating from db.json to SQLite...");
            const jsonData = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));

            db.serialize(() => {
                // Users
                if (jsonData.users) {
                    const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)");
                    jsonData.users.forEach(u => stmt.run(u.username, u.password, u.role, u.name));
                    stmt.finalize();
                }

                // Products
                if (jsonData.products) {
                    const stmt = db.prepare("INSERT OR IGNORE INTO products (id, name, category, series, hp, price, stock, image, table_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    jsonData.products.forEach(p => stmt.run(p.id, p.name, p.category, p.series, p.hp, p.price, p.stock, p.image, JSON.stringify(p.table_data)));
                    stmt.finalize();
                }

                // Categories
                if (jsonData.categories) {
                    const stmt = db.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)");
                    jsonData.categories.forEach(c => stmt.run(c.id, c.name));
                    stmt.finalize();
                }

                // Leads
                if (jsonData.leads) {
                    const stmt = db.prepare("INSERT OR IGNORE INTO leads (id, date, client, interest, email, phone, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    jsonData.leads.forEach(l => {
                        const email = l.contact ? l.contact.email : '';
                        const phone = l.contact ? l.contact.phone : '';
                        // Extract message from interest loosely if possible
                        stmt.run(l.id, l.date, l.client, l.interest, email, phone, '', l.status);
                    });
                    stmt.finalize();
                }

                // Warranties (if any in db.json, though likely empty in sample)
                if (jsonData.warranties) {
                    const stmt = db.prepare("INSERT OR IGNORE INTO warranties (id, date, name, email, phone, city, product, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    jsonData.warranties.forEach(w => stmt.run(w.id, w.date, w.name, w.email, w.phone, w.city, w.product, w.address, w.status));
                    stmt.finalize();
                }
            });

            console.log("Migration Complete.");
        }
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

// Run migration
migrate();

module.exports = db;
