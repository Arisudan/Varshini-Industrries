const db = require('./database');

async function check() {
    try {
        console.log("--- Checking Database ---");

        // Check Users
        const users = await db.query("SELECT * FROM users");
        console.log(`Users found: ${users.length}`);
        users.forEach(u => console.log(`- User: ${u.username}, Role: ${u.role}`));

        // Check Products
        const products = await db.query("SELECT * FROM products");
        console.log(`Products found: ${products.length}`);
        if (products.length > 0) {
            console.log("Sample Product:", products[0].name);
            console.log("Table Data Type:", typeof products[0].table_data);
        }

        // Check Categories
        const cats = await db.query("SELECT * FROM categories");
        console.log(`Categories found: ${cats.length}`);

        // Check Leads
        const leads = await db.query("SELECT * FROM leads");
        console.log(`Leads found: ${leads.length}`);

    } catch (e) {
        console.error("Database Error:", e);
    }
}

check();
