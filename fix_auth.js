const db = require('./database');
const bcrypt = require('bcryptjs');

async function fixAdmin() {
    try {
        console.log("Fixing Admin Password...");
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync("admin123", salt);

        await db.runQuery("UPDATE users SET password = ? WHERE username = 'admin'", [hash]);
        console.log("Admin password has been hashed and updated.");
    } catch (e) {
        console.error("Error:", e);
    }
}

fixAdmin();
