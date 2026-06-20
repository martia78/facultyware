const bcrypt = require('bcryptjs');
const db     = require('../lib/db');

// GET / — redirect ke dashboard atau login
const index = (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
};

// GET /login
const loginPage = (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login', error: null });
};

// POST /login
const login = async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', {
      title: 'Login',
      error: 'Username dan password wajib diisi.',
    });
  }

  try {
    // Ambil user beserta role-nya sekaligus
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.name, u.password,
              r.name AS role
       FROM users u
       LEFT JOIN user_has_roles uhr ON u.id  = uhr.user_id
       LEFT JOIN roles r            ON r.id  = uhr.role_id
       WHERE u.username = ?
       LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      return res.render('login', {
        title: 'Login',
        error: 'Username atau password salah.',
      });
    }

    const user    = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render('login', {
        title: 'Login',
        error: 'Username atau password salah.',
      });
    }

    // Simpan info ke session
    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.name     = user.name;
    req.session.role     = user.role;

    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
};

// GET /dashboard — redirect sesuai role
const dashboard = (req, res, next) => {
  const role = req.session.role;

  switch (role) {
    case 'mahasiswa': return res.redirect('/mahasiswa/dashboard');
    case 'admin':     return res.redirect('/admin/dashboard');
    case 'kaprodi':   return res.redirect('/kaprodi/dashboard');
    case 'dekan':     return res.redirect('/dekan/dashboard');
    default:          return res.redirect('/login');
  }
};

// GET /logout
const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
};

module.exports = { index, loginPage, login, dashboard, logout };
