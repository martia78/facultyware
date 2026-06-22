const path  = require('path');
const fs    = require('fs');
const model = require('../lib/submissionModel');

function flashError(req, msg)   { req.session.flash = { type: 'error',   message: msg }; }
function flashSuccess(req, msg) { req.session.flash = { type: 'success', message: msg }; }
function popFlash(req) { const f = req.session.flash || null; delete req.session.flash; return f; }

// Cakupan akses Kaprodi: hanya pengajuan yang sudah lolos verifikasi Admin dan
// berstatus Menunggu Verifikasi Kaprodi / Disetujui Kaprodi / Ditolak Kaprodi.
// Draft (belum diajukan) dan tahap WD1 ke atas berada di luar wewenang Kaprodi.
const KAPRODI_SCOPE = [
  model.STATUS.MENUNGGU_PRODI,
  model.STATUS.DISETUJUI_PRODI,
  model.STATUS.DITOLAK_PRODI,
];

// GET /kaprodi/dashboard
const dashboard = async (req, res, next) => {
  try {
    const stats = await model.getKaprodiStats();
    const { rows: queue } = await model.getSubmissionsForKaprodi({
      status: model.STATUS.MENUNGGU_PRODI,
      page: 1,
      limit: 5,
    });

    res.render('kaprodi/dashboard', {
      title: 'Dashboard Ketua Program Studi',
      pageTitle: 'Dashboard Ketua Program Studi',
      pageSubtitle: 'Pengajuan yang menunggu keputusan Anda',
      currentPath: '/kaprodi/dashboard',
      stats, queue,
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      flash: popFlash(req),
    });
  } catch (err) { next(err); }
};

// GET /kaprodi/submissions — Halaman Daftar Pengajuan
const index = async (req, res, next) => {
  try {
    const { search = '', status = '', page = 1 } = req.query;
    const limit = 10;
    const { rows: submissions, total } = await model.getSubmissionsForKaprodi({
      search, status, page: +page, limit,
    });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.render('kaprodi/submissions/index', {
      title: 'Daftar Pengajuan',
      pageTitle: 'Daftar Pengajuan',
      pageSubtitle: 'Pengajuan pengunduran diri yang berada dalam wewenang Anda',
      currentPath: '/kaprodi/submissions',
      submissions, total, totalPages, currentPage: +page, limit, search, status,
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      STATUS: model.STATUS,
      flash: popFlash(req),
    });
  } catch (err) { next(err); }
};

// GET /kaprodi/submissions/:id — Halaman Detail Pengajuan
const show = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id);
    if (!submission || !KAPRODI_SCOPE.includes(submission.status)) {
      return res.status(404).render('error', {
        message: 'Pengajuan tidak ditemukan atau di luar wewenang Anda.',
        error: { status: 404, stack: '' },
      });
    }
    const history = await model.getApprovalHistory(req.params.id);

    res.render('kaprodi/submissions/show', {
      title: `Pengajuan #${submission.request_number}`,
      pageTitle: 'Detail Pengajuan',
      pageSubtitle: `Nomor: ${submission.request_number}`,
      currentPath: '/kaprodi/submissions',
      submission, history,
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      STATUS: model.STATUS,
      flash: popFlash(req),
    });
  } catch (err) { next(err); }
};

// POST /kaprodi/submissions/:id/approve
const approve = async (req, res, next) => {
  try {
    await model.approveByKaprodi(req.params.id, req.session.userId, '');
    flashSuccess(req, 'Pengajuan berhasil disetujui.');
  } catch (err) {
    flashError(req, err.message || 'Gagal menyetujui pengajuan.');
  }
  res.redirect('/kaprodi/dashboard');
};

// POST /kaprodi/submissions/:id/reject
const reject = async (req, res, next) => {
  try {
    if (req.validationErrors && req.validationErrors.length) {
      flashError(req, req.validationErrors[0].msg);
      return res.redirect(`/kaprodi/submissions/${req.params.id}`);
    }
    await model.rejectByKaprodi(req.params.id, req.session.userId, (req.body.note || '').trim());
    flashSuccess(req, 'Pengajuan berhasil ditolak.');
  } catch (err) {
    flashError(req, err.message || 'Gagal menolak pengajuan.');
  }
  res.redirect('/kaprodi/dashboard');
};

// GET /kaprodi/submissions/:id/document — lihat/unduh Surat Permohonan PDF
const viewDocument = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id);
    if (!submission || !KAPRODI_SCOPE.includes(submission.status) || !submission.application_letter_file) {
      return res.status(404).render('error', { message: 'Dokumen tidak ditemukan.', error: { status: 404, stack: '' } });
    }
    const filePath = path.join(__dirname, '../uploads/resignation-documents', submission.application_letter_file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).render('error', { message: 'File tidak ditemukan di server.', error: { status: 404, stack: '' } });
    }
    const isDownload = req.query.download === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${submission.application_letter_file}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
};

module.exports = { dashboard, index, show, approve, reject, viewDocument };
