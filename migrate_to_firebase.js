const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 1. Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const dbCloud = admin.firestore();

// 2. Initialize SQLite
const dbLocal = new sqlite3.Database(path.join(__dirname, 'data', 'varshini.db'));

console.log('🚀 Starting Migration to Firebase Cloud...');

dbLocal.serialize(() => {

    // --- MIGRATE CATEGORIES ---
    dbLocal.all("SELECT * FROM categories", [], async (err, rows) => {
        if (err) console.error(err);
        else {
            const batch = dbCloud.batch();
            rows.forEach(row => {
                const ref = dbCloud.collection('categories').doc(String(row.id));
                batch.set(ref, row);
            });
            await batch.commit();
            console.log(`✅ Migrated ${rows.length} Categories.`);
        }
    });

    // --- MIGRATE PRODUCTS ---
    dbLocal.all("SELECT * FROM products", [], async (err, rows) => {
        if (err) console.error(err);
        else {
            // Firestore batches limited to 500. We assume <500 products.
            const batch = dbCloud.batch();
            rows.forEach(row => {
                // Convert JSON string back to object if needed
                let data = { ...row };
                try { data.table_data = JSON.parse(row.table_data || '{}'); } catch (e) { }

                const ref = dbCloud.collection('products').doc(String(row.id));
                batch.set(ref, data);
            });
            await batch.commit();
            console.log(`✅ Migrated ${rows.length} Products.`);
        }
    });

    // --- MIGRATE LEADS ---
    dbLocal.all("SELECT * FROM leads", [], async (err, rows) => {
        if (err) console.error(err);
        else {
            const batch = dbCloud.batch();
            rows.forEach(row => {
                let data = { ...row };
                try { data.contact_info = JSON.parse(row.contact_info || '{}'); } catch (e) { }

                const ref = dbCloud.collection('leads').doc(String(row.id));
                batch.set(ref, data);
            });
            await batch.commit();
            console.log(`✅ Migrated ${rows.length} Leads.`);
        }
    });

    // --- MIGRATE USERS ---
    dbLocal.all("SELECT * FROM users", [], async (err, rows) => {
        if (err) console.error(err);
        else {
            const batch = dbCloud.batch();
            rows.forEach(row => {
                // We keep password hashes as is. They verify same way.
                const ref = dbCloud.collection('users').doc(String(row.username));
                batch.set(ref, row);
            });
            await batch.commit();
            console.log(`✅ Migrated ${rows.length} Users.`);
        }
    });

    // --- MIGRATE WARRANTIES ---
    dbLocal.all("SELECT * FROM warranties", [], async (err, rows) => {
        if (err) console.error(err);
        else {
            const batch = dbCloud.batch();
            rows.forEach(row => {
                const ref = dbCloud.collection('warranties').doc(String(row.id));
                batch.set(ref, row);
            });
            await batch.commit();
            console.log(`✅ Migrated ${rows.length} Warranties.`);
            console.log('🎉 MIGRATION COMPLETE! Ctrl+C to exit if it hangs.');
        }
    });

});
