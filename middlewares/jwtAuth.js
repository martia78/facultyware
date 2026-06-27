const jwt = require('jsonwebtoken');

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

    req.user = decoded; 
    next();
  });
};

module.exports = { verifyJWT };
