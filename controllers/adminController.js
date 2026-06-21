const pool = require('../lib/db');

exports.getDashboard = async (req, res) => {
    try {
        // Admin is the Radar Global - they see absolutely everything
        const [requests] = await pool.query(`
            SELECT sr.id, sr.request_nunmber AS no_surat, sr.status, sr.requested_at, s.name, s.regno
            FROM student_requests sr
            JOIN students s ON sr.requested_by = s.id
            ORDER BY sr.requested_at DESC
        `);
        
        res.render('admin/dashboard', {
            pageTitle: 'Radar Lacak Admin',
            role: req.session.role,
            user: req.session,
            requests: requests
        });
    } catch (error) {
        console.error("Admin Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};