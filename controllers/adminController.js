// controllers/adminController.js

// 1. THE MISSING LINK: We must import the database connection and bcrypt!
const pool = require('../lib/db');
const bcrypt = require('bcryptjs');

// 2. Dashboard with Search Logic
exports.getDashboard = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        let queryStr = `
            SELECT sr.id, sr.request_nunmber AS no_surat, sr.status, sr.requested_at, s.name, s.regno
            FROM student_requests sr
            JOIN students s ON sr.requested_by = s.id
        `;
        let queryParams = [];

        if (searchQuery) {
            queryStr += ` WHERE s.name LIKE ? OR s.regno LIKE ? OR sr.request_nunmber LIKE ?`;
            const likeTerm = `%${searchQuery}%`;
            queryParams.push(likeTerm, likeTerm, likeTerm);
        }

        queryStr += ` ORDER BY sr.requested_at DESC`;

        const [requests] = await pool.query(queryStr, queryParams);
        
        res.render('admin/dashboard', {
            pageTitle: 'Radar Lacak Admin',
            role: req.session.role,
            user: req.session,
            requests: requests,
            searchQuery: searchQuery 
        });
    } catch (error) {
        console.error("Admin Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};

// 3. User Management (Read)
exports.getUsers = async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT u.id, u.username, u.name, r.name AS role 
            FROM users u
            LEFT JOIN user_has_roles uhr ON u.id = uhr.user_id
            LEFT JOIN roles r ON uhr.role_id = r.id
        `);
        res.render('admin/users', { 
            pageTitle: 'Manajemen Pengguna', 
            role: req.session.role,
            user: req.session,
            users: users 
        });
    } catch (error) {
        console.error("Error loading users:", error);
        res.status(500).send("Gagal memuat daftar pengguna.");
    }
};

// 4. User Management (Create)
exports.addUser = async (req, res, next) => {
    try {
        const { username, name, email, password, role } = req.body;

        // 1. Hash the password for security
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Insert into the main users table
        const [userResult] = await pool.query(
            "INSERT INTO users (username, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
            [username.trim(), name.trim(), email ? email.trim() : null, hashedPassword]
        );
        const userId = userResult.insertId;

        // 3. Attach the Role to the user
        let roleId = role;
        // If the form sent a text name (like 'Mahasiswa') instead of an ID number, look up the ID first
        if (isNaN(role)) {
            const [roleRows] = await pool.query("SELECT id FROM roles WHERE name = ?", [role]);
            if (roleRows.length > 0) roleId = roleRows[0].id;
        }
        
        if (roleId) {
            await pool.query("INSERT INTO user_has_roles (user_id, role_id) VALUES (?, ?)", [userId, roleId]);
        }

        // 4. THE GHOST BUG FIX: If it's a student, automatically build their academic profile!
        const [roleCheck] = await pool.query("SELECT name FROM roles WHERE id = ?", [roleId]);
        const roleName = roleCheck.length > 0 ? roleCheck[0].name.toLowerCase() : String(role).toLowerCase();

        if (roleName === 'mahasiswa' || roleName === 'student') {
            await pool.query(
                "INSERT INTO students (user_id, regno, name, department_id, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())",
                [userId, username.trim(), name.trim()] // Using username as their NIM/Regno
            );
        }

        // 5. Success! Bounce back to the user list
        res.redirect('/admin/users');
    } catch (err) {
        console.error("Error adding user:", err);
        res.status(500).send("Terjadi kesalahan saat menambah pengguna.");
    }
};

// 5. User Management (Delete)
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        
        await pool.query("DELETE FROM user_has_roles WHERE user_id = ?", [userId]);
        await pool.query("DELETE FROM users WHERE id = ?", [userId]);
        
        res.redirect('/admin/users');
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send("Gagal menghapus pengguna.");
    }
};