// controllers/mahasiswaController.js
const pool = require('../lib/db');

exports.getDashboard = async (req, res) => {
    try {
        // req.session.username holds the NIM (e.g., '2211521000')
        const nim = req.session.username; 

        // 1. Get the Student Profile
        const [studentRows] = await pool.query('SELECT id, name, regno, status FROM students WHERE regno = ?', [nim]);
        
        if (studentRows.length === 0) {
            return res.status(404).send("Profil mahasiswa tidak ditemukan. Hubungi Admin.");
        }
        
        const student = studentRows[0];

        // 2. Get their Request History
        const [requests] = await pool.query(`
            SELECT id, request_nunmber AS no_surat, status, requested_at 
            FROM student_requests 
            WHERE requested_by = ?
            ORDER BY requested_at DESC
        `, [student.id]);

        // 3. Send data to the View
        res.render('mahasiswa/dashboard', {
            pageTitle: 'Dashboard Mahasiswa',
            role: req.session.role,
            student: student,
            requests: requests
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).send("Terjadi kesalahan pada server.");
    }
};