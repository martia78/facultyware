const db = require('../lib/db');

const denyApi = (res, status, message) => res.status(status).json({ success: false, message });

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
