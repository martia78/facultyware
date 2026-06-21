const pool = require('../config/database');

const B16Model = {
    // Task 1: Get only requests waiting for Kaprodi
    getPendingKaprodi: async (search = '') => {
        let query = "SELECT * FROM b16_permohonan WHERE status = 'Menunggu Review Kaprodi'";
        const params = [];
        if (search) {
            query += " AND (student_name LIKE ? OR student_nim LIKE ? OR title LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const [rows] = await pool.query(query, params);
        return rows;
    },

    // Task 2: Get a single specific request's full details
    getById: async (id) => {
        const [rows] = await pool.query("SELECT * FROM b16_permohonan WHERE id = ?", [id]);
        return rows[0];
    },

    // Task 3: Update Kaprodi status and notes
    updateKaprodiReview: async (id, status, notes) => {
        return await pool.query("UPDATE b16_permohonan SET status = ?, kaprodi_notes = ? WHERE id = ?", [status, notes, id]);
    },

    // Task 4: Get only requests approved by Kaprodi for WD1 view
    getApprovedByKaprodi: async () => {
        const [rows] = await pool.query("SELECT * FROM b16_permohonan WHERE status = 'Disetujui Kaprodi'");
        return rows;
    },

    // Task 5 & 6: WD1 Final Decision and SK attachment
    updateWD1Review: async (id, status, notes, nomorSk) => {
        return await pool.query("UPDATE b16_permohonan SET status = ?, wd1_notes = ?, nomor_sk = ? WHERE id = ?", [status, notes, nomorSk, id]);
    },

    // Task 8: Global Search Engine for all official tracking criteria
    globalSearch: async (search = '', status = '') => {
        let query = "SELECT * FROM b16_permohonan WHERE 1=1";
        const params = [];
        if (status) {
            query += " AND status = ?";
            params.push(status);
        }
        if (search) {
            query += " AND (student_name LIKE ? OR student_nim LIKE ? OR title LIKE ? OR nomor_sk LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += " ORDER BY id DESC";
        const [rows] = await pool.query(query, params);
        return rows;
    }
};

module.exports = B16Model;