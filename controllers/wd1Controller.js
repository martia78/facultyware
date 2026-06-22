const pool  = require('../lib/db');
const model = require('../lib/submissionModel');

exports.getDashboard = async (req, res) => {
  try {
    const { rows: queue } = await model.getSubmissionsForDekan({
      status: model.STATUS.DISETUJUI_PRODI,
      page: 1,
      limit: 10,
    });

    // Hitung stats langsung dari DB
    const [[{ menunggu }]] = await pool.query(
      `SELECT COUNT(*) AS menunggu FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
      [model.STATUS.DISETUJUI_PRODI]
    );
    const [[{ disetujui }]] = await pool.query(
      `SELECT COUNT(*) AS disetujui FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
      [model.STATUS.DISETUJUI_FINAL]
    );
    const [[{ ditolak }]] = await pool.query(
      `SELECT COUNT(*) AS ditolak FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
      [model.STATUS.DITOLAK_FINAL]
    );

    res.render('wd1/dashboard', {
      pageTitle: 'Inbox Pengesahan WD1',
      role: req.session.role,
      user: req.session,
      requests: queue,
      stats: { menunggu, disetujui, ditolak },
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      STATUS: model.STATUS,
      flash: null,
    });
  } catch (error) {
    console.error('WD1 Dashboard Error:', error);
    res.status(500).send('Server Error');
  }
};

exports.approveRequest = async (req, res) => {
  try {
    await model.approveByDekan(req.params.id, req.session.userId, req.body.note || '');
    res.redirect('/wd1');
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).send('Gagal menyetujui dokumen.');
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    await model.rejectByDekan(req.params.id, req.session.userId, req.body.note || 'Ditolak oleh Wakil Dekan 1');
    res.redirect('/wd1');
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).send('Gagal menolak dokumen.');
  }
};