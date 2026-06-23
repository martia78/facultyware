const db    = require('../lib/db');
const model = require('../lib/submissionModel');

exports.index = async (req, res, next) => {
  try {
    const stats = await model.getStats();

    res.render('dashboard', {
      pageTitle: 'Sistem Informasi Terpadu Fakultas',
      role:      req.session ? req.session.role : null,
      stats,
    });
  } catch (err) {
    next(err);
  }
};