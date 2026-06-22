const db = require('../lib/db');

/**
 * ACL khusus REST API (Postman / klien eksternal lainnya).
 * SUMBER IDENTITAS TUNGGAL: req.user, hasil decode JWT oleh middlewares/jwtAuth.js.
 * File ini TIDAK PERNAH membaca req.session — gunakan middlewares/acl.js untuk web.
 *
 * Urutan middleware di route API selalu:
 *   verifyJWT  →  authorizeApi(...) / checkPermissionApi(...)  →  controller
 *
 * Contoh penggunaan:
 *   router.get('/api/submissions',
 *     verifyJWT,
 *     authorizeApi(['admin', 'kaprodi', 'wd1']),
 *     controller.index);
 *
 *   router.post('/api/submissions',
 *     verifyJWT,
 *     checkPermissionApi('submission.create'),
 *     controller.create);
 */

const denyApi = (res, status, message) => res.status(status).json({ success: false, message });

// Cek ROLE — diutamakan baca langsung dari payload JWT (req.user.role) tanpa round-trip DB.
const authorizeApi = (requiredRoles) => {
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return denyApi(res, 401, 'Unauthorized: token tidak valid atau belum login.');
    }

    if (!req.user.role) {
      return denyApi(res, 403, 'Akses ditolak: akun Anda belum memiliki role.');
    }

    if (rolesArray.includes(req.user.role)) return next();

    return denyApi(res, 403, 'Akses ditolak: Role Anda tidak memiliki izin untuk endpoint ini.');
  };
};

// Cek PERMISSION granular — query ke role_has_permissions berdasarkan req.user.id (dari JWT).
const checkPermissionApi = (requiredPermissions) => {
  const permsArray = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return denyApi(res, 401, 'Unauthorized: token tidak valid atau belum login.');
    }

    try {
      const [rows] = await db.query(
        `SELECT DISTINCT p.name
         FROM permissions p
         JOIN role_has_permissions rhp ON p.id = rhp.permission_id
         JOIN user_has_roles uhr       ON rhp.role_id = uhr.role_id
         WHERE uhr.user_id = ?
           AND p.name IN (?)`,
        [req.user.id, permsArray]
      );

      if (rows.length > 0) return next();

      return denyApi(res, 403, 'Akses ditolak: Anda tidak memiliki izin untuk endpoint ini.');
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { authorizeApi, checkPermissionApi };
