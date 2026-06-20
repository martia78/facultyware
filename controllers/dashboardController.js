const pool = require('../config/database');

exports.index = async (req, res) => {
    try {
        // Read the role from the URL (e.g., /?role=kaprodi)
        const currentRole = req.query.role || null;

        const [total] = await pool.query('SELECT COUNT(*) as count FROM b16_permohonan');
        const [pendingKaprodi] = await pool.query('SELECT COUNT(*) as count FROM b16_permohonan WHERE status = "Menunggu Review Kaprodi"');
        const [pendingWd1] = await pool.query('SELECT COUNT(*) as count FROM b16_permohonan WHERE status = "Disetujui Kaprodi"');

        res.render('dashboard', {
            role: currentRole, // Pass the role to the frontend
            stats: {
                total: total[0].count,
                kaprodi: pendingKaprodi[0].count,
                wd1: pendingWd1[0].count
            }
        });
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        res.status(500).send('Server error memuat dashboard');
    }
};