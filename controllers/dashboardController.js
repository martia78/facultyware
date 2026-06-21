// controllers/dashboardController.js
const pool = require('../config/database');

exports.index = async (req, res) => {
    try {
        // Query the real professor-approved table to get the stats
        const [requests] = await pool.query(`
            SELECT status FROM student_requests WHERE request_type = 'Resignation'
        `);

        // Calculate stats for the B16 cards on the main dashboard
        const stats = {
            total: requests.length,
            // Adjust 'Pending' or 'Approved' if the database uses different words like 'Menunggu'
            kaprodi: requests.filter(r => r.status === 'Pending').length, 
            wd1: requests.filter(r => r.status === 'Approved').length 
        };

        // Render the main split dashboard
        res.render('dashboard', {
            pageTitle: 'Sistem Informasi Terpadu Fakultas',
            // Check if there is an active session from Martia's auth
            role: req.session ? req.session.role : null, 
            stats: stats
        });

    } catch (error) {
        console.error("Database Error on Main Dashboard:", error);
        
        // Failsafe: If the database is still warming up, load the dashboard anyway with zeroed stats
        res.render('dashboard', {
            pageTitle: 'Sistem Informasi Terpadu Fakultas',
            role: req.session ? req.session.role : null,
            stats: { total: 0, kaprodi: 0, wd1: 0 }
        });
    }
};