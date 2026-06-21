// Middleware: cek apakah user sudah login (session)
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

// Middleware: redirect ke dashboard jika sudah login
function isGuest(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

// NEW: Middleware ACL sesuai ketentuan Rubrik
function authorize(allowedRoles) {
  return (req, res, next) => {
    // 1. Pastikan user sudah login terlebih dahulu
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    // 2. Ambil role user dari session
    const userRole = req.session.role;

    // 3. Cek apakah role user ada di dalam daftar yang diizinkan
    if (!allowedRoles.includes(userRole)) {
      // WAJIB: Return 403 Forbidden sesuai rubrik
      return res.status(403).send('403 Forbidden: Anda tidak memiliki hak akses untuk halaman ini.');
    }

    // 4. Jika role sesuai, izinkan akses ke halaman
    next();
  };
}

// Export semua fungsi agar bisa digunakan di router
module.exports = { isAuthenticated, isGuest, authorize };