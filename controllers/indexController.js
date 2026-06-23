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

  // 1. FORCE REMOVE HIDDEN SPACES (This is the critical fix!)
  const cleanPassword = password ? password.trim() : '';

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
      console.log("❌ LOGIN FAILED: Username not found in database."); // ADD THIS
      return res.render('login', {
        title: 'Login',
        error: 'Username atau password salah.',
      });
    }

    const user    = rows[0];

    // 2. THE X-RAY LOGS: Let's see exactly how long the strings are
    // console.log("--- BCRYPT DIAGNOSTIC ---");
    // console.log("Raw Input Password Length:", cleanPassword.length, "(Should be 11)");
    // console.log("DB Hash Length:", user.password.length, "(MUST be exactly 60)");
    // console.log("DB Hash Value:", user.password);

// 3. COMPARE USING THE CLEANED PASSWORD
    const isMatch = await bcrypt.compare(cleanPassword, user.password);
    // console.log("🔑 BCRYPT MATCH RESULT:", isMatch);
    // console.log("-------------------------");

    // ADD THESE TWO LINES
    // console.log("✅ USER FOUND:", user.username, "| ROLE:", user.role);
    // console.log("🔑 BCRYPT MATCH RESULT:", isMatch);

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
    case 'mahasiswa': 
        return res.redirect('/mahasiswa');
    case 'admin':     
        return res.redirect('/admin');
    case 'kaprodi':   
        return res.redirect('/kaprodi');
    case 'wd1':       
        return res.redirect('/wd1');
    default:          
        return res.redirect('/login'); // Failsafe: Send unknown users to the Master Portal
  }
};

// GET /logout
const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    // After logout, returning to the Master Portal looks much more professional
    res.redirect('/'); 
  });
};

module.exports = { index, loginPage, login, dashboard, logout };