const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../lib/db');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Response: { success, message, data: { token, user } }
 */
const login = async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username dan password wajib diisi.',
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.name, u.password,
              r.name AS role
       FROM users u
       LEFT JOIN user_has_roles uhr ON u.id = uhr.user_id
       LEFT JOIN roles r           ON r.id = uhr.role_id
       WHERE u.username = ?
       LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.',
      });
    }

    const user    = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.',
      });
    }

    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda belum memiliki role. Hubungi administrator.',
      });
    }

    const payload = {
      id:       user.id,
      username: user.username,
      name:     user.name,
      role:     user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data: {
        token,
        token_type: 'Bearer',
        expires_in: JWT_EXPIRES_IN,
        user: payload,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * JWT bersifat stateless, sehingga "logout" di sisi server hanya bersifat
 * informatif — client (Postman / aplikasi lain) wajib membuang token yang
 * tersimpan di sisi mereka. Endpoint ini tetap memerlukan token valid
 * (lewat middleware verifyJWT) agar konsisten dengan ketentuan soal.
 */
const logout = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logout berhasil. Hapus token pada sisi client.',
    data: {},
  });
};

/**
 * GET /api/auth/me
 * Mengembalikan identitas pemilik token saat ini — berguna untuk
 * memverifikasi token di Postman tanpa perlu memanggil endpoint lain.
 */
const me = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Token valid.',
    data: { user: req.user },
  });
};

module.exports = { login, logout, me };
