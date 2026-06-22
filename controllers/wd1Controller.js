const pool = require('../lib/db');

exports.getDashboard = async (req, res) => {
    try {
        // TASK 1 FIX: We restrict the query to ONLY show Kaprodi-approved documents
        const [requests] = await pool.query(`
            SELECT sr.id, sr.request_nunmber AS no_surat, sr.status, sr.requested_at, s.name, s.regno
            FROM student_requests sr
            JOIN students s ON sr.requested_by = s.id
            WHERE sr.request_type = 'Resignation' 
              AND sr.status = 'Approved_Kaprodi' 
            ORDER BY sr.requested_at DESC
        `);
        
        res.render('wd1/dashboard', {
            pageTitle: 'Inbox Pengesahan WD1',
            role: req.session.role,
            user: req.session,
            requests: requests
        });
    } catch (error) {
        console.error("WD1 Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};

exports.approveRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        // Update status to Approved (Final)
        await pool.query("UPDATE student_requests SET status = 'Approved' WHERE id = ?", [requestId]);
        res.redirect('/wd1');
    } catch (error) {
        console.error("Error approving request:", error);
        res.status(500).send("Gagal menyetujui dokumen.");
    }
};

exports.rejectRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const catatan = req.body.catatan || 'Ditolak oleh Wakil Dekan 1'; // Optional: If you add a notes text box later
        // Update status to Rejected
        await pool.query("UPDATE student_requests SET status = 'Rejected' WHERE id = ?", [requestId]);
        res.redirect('/wd1');
    } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).send("Gagal menolak dokumen.");
    }
};