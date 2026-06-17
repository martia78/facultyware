const db = require('../lib/db');

/**
 * Middleware ACL — cek apakah user memiliki permission yang dibutuhkan.
 * Mendukung satu permission (string) atau beberapa (array) — cukup salah satu yang cocok.
 *
 * Contoh penggunaan:
 *   router.get('/submissions', isAuthenticated, checkPermission('submission.view-all'), handler);
 *   router.post('/submissions', isAuthenticated, authorize(['mahasiswa']), handler);
 */

// Cek berdasarkan PERMISSION name
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const permsArray = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    try {
      const [rows] = await db.query(
        `SELECT DISTINCT p.name
         FROM permissions p
         JOIN role_has_permissions rhp ON p.id = rhp.permission_id
         JOIN user_has_roles uhr       ON rhp.role_id = uhr.role_id
         WHERE uhr.user_id = ?
           AND p.name IN (?)`,
        [req.session.userId, permsArray]
      );

      if (rows.length > 0) return next();

      return res.status(403).render('error', {
        message: 'Akses ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.',
        error:   { status: 403, stack: '' },
      });
    } catch (err) {
      next(err);
    }
  };
};

// Cek berdasarkan ROLE name (alias praktis sesuai ketentuan soal)
const authorize = (requiredRoles) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const rolesArray = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    try {
      const [rows] = await db.query(
        `SELECT DISTINCT r.name
         FROM roles r
         JOIN user_has_roles uhr ON r.id = uhr.role_id
         WHERE uhr.user_id = ?
           AND r.name IN (?)`,
        [req.session.userId, rolesArray]
      );

      if (rows.length > 0) return next();

      return res.status(403).render('error', {
        message: 'Akses ditolak: Role Anda tidak memiliki izin untuk halaman ini.',
        error:   { status: 403, stack: '' },
      });
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { checkPermission, authorize };
