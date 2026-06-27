const pool   = require('../lib/db');
const bcrypt = require('bcryptjs');
const model  = require('../lib/submissionModel');


function handleError(res, next, err, message) {
  console.error(message, err);
  next(err);
}


exports.getDashboard = async (req, res, next) => {
  try {
    const searchQuery = req.query.search || '';
    let queryStr = `
      SELECT sr.id, sr.request_number AS no_surat, sr.status, sr.requested_at,
             s.name, s.regno
      FROM student_requests sr
      LEFT JOIN students s ON sr.requested_by = s.id
    `;
    const queryParams = [];
    if (searchQuery) {
      queryStr += ` WHERE s.name LIKE ? OR s.regno LIKE ? OR sr.request_number LIKE ?`;
      const likeTerm = `%${searchQuery}%`;
      queryParams.push(likeTerm, likeTerm, likeTerm);
    }
    queryStr += ` ORDER BY sr.requested_at DESC`;

    const [requests] = await pool.query(queryStr, queryParams);
    res.render('admin/dashboard', {
      pageTitle: 'Radar Lacak Admin',
      role: req.session.role,
      user: req.session,
      requests,
      searchQuery,
    });
  } catch (err) { handleError(res, next, err, 'Admin Dashboard Error:'); }
};


exports.getUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.username, u.name, r.name AS role
      FROM users u
      LEFT JOIN user_has_roles uhr ON u.id = uhr.user_id
      LEFT JOIN roles r ON uhr.role_id = r.id
      ORDER BY u.created_at DESC
    `);
    const [roles] = await pool.query(`SELECT id, name FROM roles ORDER BY name`);
    const flash = req.session.flash || null;
    delete req.session.flash;
    res.render('admin/users', {
      pageTitle: 'Manajemen Pengguna',
      role: req.session.role,
      user: req.session,
      users,
      roles,
      flash,
    });
  } catch (err) { handleError(res, next, err, 'Error loading users:'); }
};


exports.addUser = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { username, name, password } = req.body;

    const formRole = req.body.role || req.body.role_id; 

    const hashedPassword = await bcrypt.hash(password.trim(), 12);

    const [result] = await conn.query(
      'INSERT INTO users (username, name, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [username.trim(), name.trim(), hashedPassword]
    );
    const newUserId = result.insertId;


    let resolvedRoleId = parseInt(formRole, 10);
    if (isNaN(resolvedRoleId)) {
      const [[r]] = await conn.query('SELECT id FROM roles WHERE name = ?', [formRole]);
      if (!r) throw new Error(`Role '${formRole}' tidak ditemukan.`);
      resolvedRoleId = r.id;
    }
    await conn.query(
      'INSERT INTO user_has_roles (user_id, role_id) VALUES (?, ?)',
      [newUserId, resolvedRoleId]
    );

   
    const [[roleRow]] = await conn.query('SELECT name FROM roles WHERE id = ?', [resolvedRoleId]);
    if (roleRow && roleRow.name === 'mahasiswa') {
      const [[dept]] = await conn.query(
        "SELECT id FROM organization_units WHERE type = 'department' LIMIT 1"
      );
      const departmentId = dept ? dept.id : 2;
      await conn.query(
        'INSERT INTO students (id, name, regno, department_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [newUserId, name.trim(), username.trim(), departmentId]
      );
    }

    await conn.commit();
    res.redirect('/admin/users');
  } catch (err) {
    await conn.rollback();
    handleError(res, next, err, 'Error adding user:');
  } finally {
    conn.release();
  }
};


exports.deleteUser = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.params.id;

    
    await conn.query(`
      DELETE srr FROM student_request_resignation srr
      JOIN student_requests sr ON sr.id = srr.student_requests_id
      WHERE sr.requested_by = ?
    `, [userId]);

    
    await conn.query(
      'DELETE FROM student_requests WHERE requested_by = ?',
      [userId]
    );

    
    await conn.query('DELETE FROM students WHERE id = ?', [userId]);
    await conn.query('DELETE FROM user_has_roles WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);

    await conn.commit();
    res.redirect('/admin/users');
  } catch (err) {
    await conn.rollback();
    handleError(res, next, err, 'Error deleting user:');
  } finally {
    conn.release();
  }
};


exports.getStudents = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const page   = Math.max(parseInt(req.query.page) || 1, 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM students s
       LEFT JOIN organization_units ou ON s.department_id = ou.id
       WHERE s.name LIKE ? OR s.regno LIKE ?`,
      [like, like]
    );
    const [students] = await pool.query(
      `SELECT s.id, s.name, s.regno,
              COALESCE(ou.name, '—') AS department_name,
              (SELECT COUNT(*) FROM student_requests sr
               WHERE sr.requested_by = s.id AND sr.request_type = 'resignation') AS total_requests
       FROM students s
       LEFT JOIN organization_units ou ON s.department_id = ou.id
       WHERE s.name LIKE ? OR s.regno LIKE ?
       ORDER BY s.name ASC
       LIMIT ? OFFSET ?`,
      [like, like, limit, offset]
    );
    res.render('admin/students', {
      pageTitle: 'Data Mahasiswa',
      user: req.session,
      role: req.session.role,
      students,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page,
      search,
    });
  } catch (err) { handleError(res, next, err, 'Error loading students:'); }
};


exports.resetPassword = async (req, res, next) => {
  try {
    const bcrypt   = require('bcryptjs');
    const targetId = req.params.id;
    const newPass  = req.body.new_password || '';

    if (newPass.length < 8) {
      req.session.flash = { type: 'error', message: 'Password baru minimal 8 karakter.' };
      return res.redirect('/admin/users');
    }

    const hashed = await bcrypt.hash(newPass, 12);
    await pool.query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashed, targetId]
    );

    req.session.flash = { type: 'success', message: 'Password user berhasil direset.' };
    res.redirect('/admin/users');
  } catch (err) {
    handleError(res, next, err, 'Error resetting password:');
  }
};
