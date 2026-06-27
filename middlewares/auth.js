function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

function isGuest(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

function authorize(allowedRoles) {
  return (req, res, next) => {
    
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const userRole = req.session.role;

    if (!allowedRoles.includes(userRole)) {
      
      return res.status(403).send('403 Forbidden: Anda tidak memiliki hak akses untuk halaman ini.');
    }

    next();
  };
}

module.exports = { isAuthenticated, isGuest, authorize };