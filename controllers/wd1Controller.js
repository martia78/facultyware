const pool = require('../lib/db');

exports.getDashboard = async (req, res) => {
    try {
        // WD1 needs to see all requests (eventually we will filter this to only show "Approved by Kaprodi")
        const [requests] = await pool.query(`
            SELECT sr.id, sr.request_nunmber AS no_surat, sr.status, sr.requested_at, s.name, s.regno
            FROM student_requests sr
            JOIN students s ON sr.requested_by = s.id
            WHERE sr.request_type = 'Resignation'
            ORDER BY sr.requested_at DESC
        `);
        
        res.render('wd1/dashboard', {
            pageTitle: 'Inbox Pengesahan WD1',
            role: req.session.role,
            user: req.session,
            requests: requests
        });
    } catch (error) {
        console.error("wd1 Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};
