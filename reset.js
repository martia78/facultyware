const bcrypt = require('bcryptjs');
const db = require('./lib/db'); 

async function fixAllPasswords() {
    try {
        console.log("Generating the REAL hash for 'password123'...");
        // Your server calculates the actual math here
        const realHash = await bcrypt.hash('password123', 10);
        
        // This time, we update ALL FOUR accounts at the exact same time
        await db.query(`
            UPDATE users 
            SET password = ? 
            WHERE username IN ('kaprodi123', 'admin123', 'wd1_123', '2211521000')
        `, [realHash]);
        
        console.log("✅ SUCCESS! All accounts have been fixed with the real hash.");
        process.exit();
    } catch (error) {
        console.error("❌ Error fixing passwords:", error);
        process.exit(1);
    }
}

fixAllPasswords();