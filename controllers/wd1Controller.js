const pool  = require('../lib/db');
const model = require('../lib/submissionModel');

exports.getDashboard = async (req, res, next) => {
  try {
    const S = model.STATUS;

    const [[{ menunggu }]]  = await pool.query(
      `SELECT COUNT(*) AS menunggu  FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
      [S.DISETUJUI_PRODI]
    );
    const [[{ disetujui }]] = await pool.query(
      `SELECT COUNT(*) AS disetujui FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
      [S.DISETUJUI_FINAL]
    );
    const [[{ ditolak }]]   = await pool.query(
      `SELECT COUNT(*) AS ditolak   FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
      [S.DITOLAK_FINAL]
    );

    const [requests] = await pool.query(`
      SELECT sr.id, sr.request_number AS no_surat, sr.status, sr.requested_at,
             s.name, s.regno
      FROM student_requests sr
      JOIN students s ON sr.requested_by = s.id
      WHERE sr.request_type = 'resignation' AND sr.status = ?
      ORDER BY sr.requested_at DESC
    `, [S.DISETUJUI_PRODI]);

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('wd1/dashboard', {
      pageTitle: 'Inbox Pengesahan WD I',
      role:      req.session.role,
      user:      req.session,
      requests,
      stats: { menunggu, disetujui, ditolak },
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      flash,
    });
  } catch (err) {
    next(err);
  }
};

exports.approveRequest = async (req, res, next) => {
  try {
    await model.approveByDekan(req.params.id, req.session.userId, req.body.note || '');
    req.session.flash = { type: 'success', message: 'Pengajuan berhasil disetujui dan SK diterbitkan.' };
    res.redirect('/wd1');
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message || 'Gagal menyetujui pengajuan.' };
    res.redirect(`/wd1`);
  }
};

exports.rejectRequest = async (req, res, next) => {
  try {
    const note = (req.body.note || '').trim();
    if (!note) {
      req.session.flash = { type: 'error', message: 'Alasan penolakan wajib diisi.' };
      return res.redirect('/wd1');
    }
    await model.rejectByDekan(req.params.id, req.session.userId, note);
    req.session.flash = { type: 'success', message: 'Pengajuan berhasil ditolak.' };
    res.redirect('/wd1');
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message || 'Gagal menolak pengajuan.' };
    res.redirect('/wd1');
  }
};

exports.profile = async (req, res, next) => {
  try {
    res.render('wd1/profile', {
      pageTitle: 'Profil Saya',
      currentPath: '/wd1/profile',
      user: req.session,
      flash: req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    const userId = req.session.userId;
    const db     = require('../lib/db');
    const bcrypt = require('bcryptjs');

    if (new_password.length < 8) {
      req.session.flash = { type: 'password_error', message: 'Password baru minimal 8 karakter.' };
      return res.redirect('/wd1/profile');
    }
    if (new_password !== confirm_password) {
      req.session.flash = { type: 'password_error', message: 'Konfirmasi password tidak cocok.' };
      return res.redirect('/wd1/profile');
    }
    const [[user]] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (!user || !(await bcrypt.compare(current_password, user.password))) {
      req.session.flash = { type: 'password_error', message: 'Password saat ini tidak sesuai.' };
      return res.redirect('/wd1/profile');
    }
    const hashed = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, userId]);
    req.session.flash = { type: 'password_success', message: 'Password berhasil diperbarui.' };
    res.redirect('/wd1/profile');
  } catch (err) { next(err); }
};