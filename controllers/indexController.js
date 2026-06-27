const bcrypt = require('bcryptjs');
const db     = require('../lib/db');

const index = (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
};

const loginPage = (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login', error: null });
};

const login = async (req, res, next) => {
  const { username, password } = req.body;

  const cleanPassword = password ? password.trim() : '';

  if (!username || !password) {
    return res.render('login', {
      title: 'Login',
      error: 'Username dan password wajib diisi.',
    });
  }

  try {
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
      console.log("❌ LOGIN FAILED: Username not found in database."); 
      return res.render('login', {
        title: 'Login',
        error: 'Username atau password salah.',
      });
    }

    const user    = rows[0];
    const isMatch = await bcrypt.compare(cleanPassword, user.password);

    if (!isMatch) {
      return res.render('login', {
        title: 'Login',
        error: 'Username atau password salah.',
      });
    }

    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.name     = user.name;
    req.session.role     = user.role;

    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
};

const dashboard = (req, res, next) => {
  const role = req.session.role;

  switch (role) {
    case 'mahasiswa': 
        return res.redirect('/mahasiswa');
    case 'admin':     
        return res.redirect('/admin');
    case 'kaprodi':   
        return res.redirect('/kaprodi');
    case 'wd1':       
        return res.redirect('/wd1');
    default:          
        return res.redirect('/login'); 
  }
};

const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/'); 
  });
};

module.exports = { index, loginPage, login, dashboard, logout };