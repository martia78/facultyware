const jwt = require('jsonwebtoken');

/**
 * Middleware: verifikasi JWT pada REST API.
 * Khusus dipakai di routes/api/** — TIDAK dipakai di route web manapun.
 * Token diambil dari header Authorization: Bearer <token>.
 * Jika valid, payload disimpan di req.user (id, username, name, role).
 *
 * Contoh penggunaan:
 *   router.get('/api/submissions', verifyJWT, submissionController.index);
 */
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak ditemukan. Sertakan header Authorization: Bearer <token>.',
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Token sudah kedaluwarsa. Silakan login kembali.'
        : 'Token tidak valid.';
      return res.status(401).json({ success: false, message });
    }

    req.user = decoded; // { id, username, name, role, iat, exp }
    next();
  });
};

module.exports = { verifyJWT };
