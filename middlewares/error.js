const createError = require('http-errors');

// 404 handler
const notFoundHandler = (req, res, next) => {
  next(createError(404));
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  const status  = err.status || 500;
  const message = err.message || 'Terjadi kesalahan pada server';

  res.locals.message = message;
  res.locals.error   = req.app.get('env') === 'development' ? err : {};

  // Jika request API (Accept: application/json atau path /api/*)
  if (req.xhr || req.path.startsWith('/api/') ||
      req.headers.accept?.includes('application/json')) {
    return res.status(status).json({ success: false, message });
  }

  res.status(status);
  res.render('error', { message, error: res.locals.error });
};

module.exports = { notFoundHandler, errorHandler };
