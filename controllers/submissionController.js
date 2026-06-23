const path = require('path');
const fs   = require('fs');
const model = require('../lib/submissionModel');
const { MAX_APPLICATION_LETTER_SIZE } = require('../lib/uploadConfig');

function flashError(req, msg)   { req.session.flash = { type: 'error',   message: msg }; }
function flashSuccess(req, msg) { req.session.flash = { type: 'success', message: msg }; }
function popFlash(req) { const f = req.session.flash || null; delete req.session.flash; return f; }

// Normalisasi error express-validator ({ path, msg, ... }) ke bentuk yang
// dipakai view ({ field, msg }).
function normalizeValidationErrors(req) {
  return (req.validationErrors || []).map(e => ({ field: e.path, msg: e.msg }));
}

function deleteUploadedFiles(files) {
  files.forEach(f => {
    if (!f) return;
    const fp = path.join(__dirname, '../uploads/resignation-documents', f.filename);
    if (fs.existsSync(fp)) {
      try { fs.unlinkSync(fp); } catch (e) { /* abaikan */ }
    }
  });
}

function renderForm(res, options) {
  const { title, pageTitle, pageSubtitle, currentPath, action, method = 'POST',
    student, submission = null, errors = [], flash = null, readonly = false, history = [], timeline = [] } = options;
  res.render('mahasiswa/submissions/form', {
    title, pageTitle, pageSubtitle, currentPath, action, method,
    student, submission, errors, flash, readonly, history, timeline,
    STATUS_LABEL: model.STATUS_LABEL,
    STATUS_BADGE: model.STATUS_BADGE,
    STATUS: model.STATUS,
  });
}

// GET /mahasiswa/submissions
const index = async (req, res, next) => {
  try {
    const { search = '', page = 1 } = req.query;
    const limit = 10;
    const student = await model.getStudentByUserId(req.session.userId);
    const { rows: submissions, total } = await model.getSubmissionsByStudentId(
      req.session.userId, { search, page: +page, limit }
    );
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const flash = popFlash(req);
    res.render('mahasiswa/submissions/index', {
      title: 'Riwayat Pengajuan',
      pageTitle: 'Riwayat Pengajuan',
      pageSubtitle: 'Daftar semua permohonan pengunduran diri Anda',
      currentPath: '/mahasiswa/submissions',
      student, submissions, total, totalPages, currentPage: +page, limit, search, flash,
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      STATUS: model.STATUS,
    });
  } catch (err) { next(err); }
};

// GET /mahasiswa/submissions/create
const createForm = async (req, res, next) => {
  try {
    // Blokir jika sudah ada pengajuan yang disetujui final — tidak perlu ajukan lagi
    const { rows: allSubmissions } = await model.getSubmissionsByStudentId(req.session.userId, { limit: 5 });
    const approved = allSubmissions.find(s => s.status === model.STATUS.DISETUJUI_FINAL);
    if (approved) {
      flashError(req, 'Pengajuan pengunduran diri Anda telah disetujui secara final. Tidak dapat membuat pengajuan baru.');
      return res.redirect('/mahasiswa/dashboard');
    }

    // Ketentuan Pengajuan Ganda: cek dulu apakah masih ada pengajuan aktif.
    const active = await model.getActiveSubmission(req.session.userId);
    if (active) {
      if (active.status === model.STATUS.DRAFT) {
        // Draft yang belum selesai diisi → arahkan lanjut mengedit draft itu,
        // bukan membuat draft baru yang terpisah.
        flashError(req, 'Anda masih memiliki Draft pengajuan yang belum diajukan. Lanjutkan mengisi draft tersebut terlebih dahulu.');
        return res.redirect(`/mahasiswa/submissions/${active.id}/edit`);
      }
      // Menunggu Verifikasi Kaprodi / Diproses WD I → diblokir total sampai selesai/ditolak.
      flashError(req, `Anda masih memiliki pengajuan aktif (${model.STATUS_LABEL[active.status]}). Tidak dapat membuat pengajuan baru sampai proses sebelumnya selesai atau ditolak.`);
      return res.redirect(`/mahasiswa/submissions/${active.id}`);
    }

    const student = await model.getStudentByUserId(req.session.userId);
    const flash = popFlash(req);
    renderForm(res, {
      title: 'Ajukan Pengunduran Diri',
      pageTitle: 'Formulir Pengunduran Diri',
      pageSubtitle: 'Isi data berikut untuk mengajukan permohonan',
      currentPath: '/mahasiswa/submissions/create',
      action: '/mahasiswa/submissions',
      student, flash,
    });
  } catch (err) { next(err); }
};

// POST /mahasiswa/submissions
const store = async (req, res, next) => {
  try {
    const appLetterFile = req.files?.application_letter?.[0] || null;

    // Ketentuan Pengajuan Ganda — cek ulang di server (race-condition safety),
    // jangan percaya penuh pada guard di createForm.
    const active = await model.getActiveSubmission(req.session.userId);
    if (active) {
      if (appLetterFile) deleteUploadedFiles([appLetterFile]);
      flashError(req, active.status === model.STATUS.DRAFT
        ? 'Anda masih memiliki Draft pengajuan yang belum diajukan.'
        : `Anda masih memiliki pengajuan aktif (${model.STATUS_LABEL[active.status]}).`);
      return res.redirect(active.status === model.STATUS.DRAFT
        ? `/mahasiswa/submissions/${active.id}/edit`
        : `/mahasiswa/submissions/${active.id}`);
    }

    if (req.uploadError) {
      const student = await model.getStudentByUserId(req.session.userId);
      return renderForm(res, {
        title: 'Ajukan Pengunduran Diri', pageTitle: 'Formulir Pengunduran Diri',
        pageSubtitle: 'Isi data berikut untuk mengajukan permohonan',
        currentPath: '/mahasiswa/submissions/create', action: '/mahasiswa/submissions',
        student, errors: [{ msg: req.uploadError, field: 'application_letter' }], submission: req.body,
      });
    }

    const errors = normalizeValidationErrors(req);

    if (!appLetterFile) {
      errors.push({ msg: 'Surat Permohonan (PDF) wajib diunggah.', field: 'application_letter' });
    } else if (appLetterFile.size > MAX_APPLICATION_LETTER_SIZE) {
      errors.push({ msg: 'Surat Permohonan (PDF) maksimal 5 MB.', field: 'application_letter' });
    }

    if (errors.length) {
      if (appLetterFile) deleteUploadedFiles([appLetterFile]);
      const student = await model.getStudentByUserId(req.session.userId);
      return renderForm(res, {
        title: 'Ajukan Pengunduran Diri', pageTitle: 'Formulir Pengunduran Diri',
        pageSubtitle: 'Isi data berikut untuk mengajukan permohonan',
        currentPath: '/mahasiswa/submissions/create', action: '/mahasiswa/submissions',
        student, errors, submission: req.body,
      });
    }

    const { reason, address, phone, gpa, total_sks } = req.body;
    const { requestId } = await model.createSubmission({
      studentId: req.session.userId, reason: reason.trim(),
      address: address.trim(), phone: phone.trim(),
      gpa: parseFloat(gpa), totalSks: parseInt(total_sks, 10),
      applicationLetterFile: appLetterFile.filename,
    });
    flashSuccess(req, 'Permohonan berhasil disimpan sebagai Draft.');
    res.redirect(`/mahasiswa/submissions/${requestId}`);
  } catch (err) { next(err); }
};

// GET /mahasiswa/submissions/:id
const show = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id, req.session.userId);
    if (!submission) return res.status(404).render('error', { message: 'Permohonan tidak ditemukan.', error: { status: 404, stack: '' } });
    const student  = await model.getStudentByUserId(req.session.userId);
    const history  = await model.getApprovalHistory(req.params.id);
    const timeline = model.buildTimeline(submission, history);
    const flash    = popFlash(req);
    renderForm(res, {
      title: `Permohonan #${submission.request_number}`,
      pageTitle: 'Detail Permohonan',
      pageSubtitle: `Nomor: ${submission.request_number}`,
      currentPath: '/mahasiswa/submissions',
      action: `/mahasiswa/submissions/${submission.id}`,
      student, submission, flash, history, timeline,
      readonly: true, // Halaman detail SELALU readonly — field tidak boleh diketik di sini.
                       // Tombol aksi (Ajukan/Edit/Hapus) diatur terpisah oleh submission.status di view.
    });
  } catch (err) { next(err); }
};

// GET /mahasiswa/submissions/:id/edit
const editForm = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id, req.session.userId);
    if (!submission) return res.status(404).render('error', { message: 'Tidak ditemukan.', error: { status: 404, stack: '' } });
    if (submission.status !== model.STATUS.DRAFT) {
      flashError(req, 'Hanya bisa diubah saat status Draft.');
      return res.redirect(`/mahasiswa/submissions/${submission.id}`);
    }
    const student = await model.getStudentByUserId(req.session.userId);
    renderForm(res, {
      title: 'Edit Permohonan', pageTitle: 'Edit Permohonan',
      pageSubtitle: `Nomor: ${submission.request_number}`,
      currentPath: '/mahasiswa/submissions',
      action: `/mahasiswa/submissions/${submission.id}`,
      student, submission, flash: popFlash(req),
    });
  } catch (err) { next(err); }
};

// POST /mahasiswa/submissions/:id (update)
const update = async (req, res, next) => {
  try {
    const appLetterUpload = req.files?.application_letter?.[0] || null;

    if (req.uploadError) {
      const submission = await model.getSubmissionById(req.params.id, req.session.userId);
      const student = await model.getStudentByUserId(req.session.userId);
      return renderForm(res, {
        title: 'Edit Permohonan', pageTitle: 'Edit Permohonan',
        pageSubtitle: `Nomor: ${submission?.request_number || ''}`,
        currentPath: '/mahasiswa/submissions',
        action: `/mahasiswa/submissions/${req.params.id}`,
        student, submission: { ...submission, ...req.body },
        errors: [{ msg: req.uploadError, field: 'application_letter' }],
      });
    }

    const errors = normalizeValidationErrors(req);

    if (appLetterUpload && appLetterUpload.size > MAX_APPLICATION_LETTER_SIZE) {
      errors.push({ msg: 'Surat Permohonan (PDF) maksimal 5 MB.', field: 'application_letter' });
    }

    if (errors.length) {
      if (appLetterUpload) deleteUploadedFiles([appLetterUpload]);
      const submission = await model.getSubmissionById(req.params.id, req.session.userId);
      const student = await model.getStudentByUserId(req.session.userId);
      return renderForm(res, {
        title: 'Edit Permohonan', pageTitle: 'Edit Permohonan',
        pageSubtitle: '', currentPath: '/mahasiswa/submissions',
        action: `/mahasiswa/submissions/${req.params.id}`,
        student, submission: { ...submission, ...req.body }, errors,
      });
    }

    const { reason, address, phone, gpa, total_sks } = req.body;
    await model.updateSubmission(req.params.id, req.session.userId, {
      reason: reason.trim(), address: address.trim(), phone: phone.trim(),
      gpa: parseFloat(gpa), totalSks: parseInt(total_sks, 10),
      applicationLetterFile: appLetterUpload?.filename || undefined,
    });
    flashSuccess(req, appLetterUpload ? 'Permohonan berhasil diperbarui — Surat Permohonan berhasil diganti.' : 'Permohonan berhasil diperbarui.');
    res.redirect(`/mahasiswa/submissions/${req.params.id}`);
  } catch (err) {
    if (err.message?.includes('Draft')) { flashError(req, err.message); return res.redirect(`/mahasiswa/submissions/${req.params.id}`); }
    next(err);
  }
};

// POST /mahasiswa/submissions/:id/submit
const submit = async (req, res, next) => {
  try {
    await model.submitSubmission(req.params.id, req.session.userId);
    flashSuccess(req, 'Permohonan pengunduran diri berhasil diajukan.');
    res.redirect(`/mahasiswa/submissions/${req.params.id}`);
  } catch (err) {
    if (err.message?.includes('Draft') || err.message?.includes('wajib diunggah') || err.message?.includes('Data belum lengkap')) {
      flashError(req, err.message); return res.redirect(`/mahasiswa/submissions/${req.params.id}`);
    }
    next(err);
  }
};

// POST /mahasiswa/submissions/:id/delete
const destroy = async (req, res, next) => {
  try {
    await model.deleteSubmission(req.params.id, req.session.userId);
    flashSuccess(req, 'Draft berhasil dihapus.');
    res.redirect('/mahasiswa/dashboard');
  } catch (err) {
    if (err.message?.includes('Draft')) { flashError(req, err.message); return res.redirect(`/mahasiswa/submissions/${req.params.id}`); }
    next(err);
  }
};

// GET /mahasiswa/submissions/:id/document — lihat/unduh Surat Permohonan
// (akses terproteksi ACL, BUKAN lewat static /uploads publik, sesuai
// KETENTUAN_PROJECT §6: ACL wajib diterapkan pada Download Dokumen.)
const viewDocument = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id, req.session.userId);
    if (!submission || !submission.application_letter_file) {
      return res.status(404).render('error', { message: 'Dokumen tidak ditemukan.', error: { status: 404, stack: '' } });
    }
    const filePath = path.join(__dirname, '../uploads/resignation-documents', submission.application_letter_file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).render('error', { message: 'File tidak ditemukan di server.', error: { status: 404, stack: '' } });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${submission.application_letter_file}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
};

module.exports = { index, createForm, store, show, editForm, update, submit, destroy, viewDocument };