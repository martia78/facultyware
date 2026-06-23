const path  = require('path');
const fs    = require('fs');
const model = require('../lib/submissionModel');
const { MAX_APPLICATION_LETTER_SIZE } = require('../lib/uploadConfig');

// ─── Helper respons konsisten {success, message, data} ───────────────────────
const ok      = (res, message, data = {}, status = 200) => res.status(status).json({ success: true, message, data });
const fail    = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

function deleteUploadedFile(file) {
  if (!file) return;
  const fp = path.join(__dirname, '../uploads/resignation-documents', file.filename);
  if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (e) { /* abaikan */ } }
}

// Cakupan akses per role (sama dengan yang dipakai versi web — lihat
// controllers/submissionController.js & kaprodiController.js)
const KAPRODI_SCOPE = [model.STATUS.MENUNGGU_PRODI, model.STATUS.DISETUJUI_PRODI, model.STATUS.DITOLAK_PRODI];
const WD1_SCOPE     = [model.STATUS.DISETUJUI_PRODI, model.STATUS.DISETUJUI_FINAL, model.STATUS.DITOLAK_FINAL];

// Pastikan req.user (role tertentu) berhak melihat `submission` ini.
// Return true/false — pemanggil yang menentukan respons 403/404.
function canView(user, submission) {
  if (!submission) return false;
  switch (user.role) {
    case 'mahasiswa': return submission.requested_by === user.id;
    case 'kaprodi':   return KAPRODI_SCOPE.includes(submission.status);
    case 'wd1':       return WD1_SCOPE.includes(submission.status);
    case 'admin':     return true;
    default:          return false;
  }
}

// ─── GET /api/submissions ─────────────────────────────────────────────────────
const index = async (req, res, next) => {
  try {
    const { search = '', status = '', page = 1 } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    let result;

    switch (req.user.role) {
      case 'mahasiswa':
        result = await model.getSubmissionsByStudentId(req.user.id, { search, page: pageNum, limit });
        break;
      case 'kaprodi':
        result = await model.getSubmissionsForKaprodi({ search, status, page: pageNum, limit });
        break;
      case 'wd1':
        result = await model.getSubmissionsForDekan({ search, status, page: pageNum, limit });
        break;
      case 'admin':
        result = await model.getAllSubmissions({ search, status, page: pageNum, limit });
        break;
      default:
        return fail(res, 403, 'Role Anda tidak memiliki akses ke daftar pengajuan.');
    }

    const { rows, total } = result;
    return ok(res, 'Daftar pengajuan berhasil diambil.', {
      submissions: rows,
      pagination: {
        total,
        page: pageNum,
        limit,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/submissions/:id ─────────────────────────────────────────────────
const show = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id);
    if (!submission) return fail(res, 404, 'Pengajuan tidak ditemukan.');
    if (!canView(req.user, submission)) return fail(res, 403, 'Anda tidak memiliki akses ke pengajuan ini.');

    const history = await model.getApprovalHistory(req.params.id);
    return ok(res, 'Detail pengajuan berhasil diambil.', { submission, history });
  } catch (err) { next(err); }
};

// ─── POST /api/submissions (mahasiswa) ────────────────────────────────────────
const store = async (req, res, next) => {
  try {
    const appLetterFile = req.files?.application_letter?.[0] || null;

    // Ketentuan Pengajuan Ganda
    const active = await model.getActiveSubmission(req.user.id);
    if (active) {
      deleteUploadedFile(appLetterFile);
      return fail(res, 409, active.status === model.STATUS.DRAFT
        ? 'Anda masih memiliki Draft pengajuan yang belum diajukan.'
        : `Anda masih memiliki pengajuan aktif (${model.STATUS_LABEL[active.status]}).`,
        { data: { active_submission_id: active.id } });
    }

    if (req.uploadError) {
      return fail(res, 422, req.uploadError);
    }

    const errors = (req.validationErrors || []).map(e => ({ field: e.path, msg: e.msg }));
    if (!appLetterFile) {
      errors.push({ field: 'application_letter', msg: 'Surat Permohonan (PDF) wajib diunggah.' });
    } else if (appLetterFile.size > MAX_APPLICATION_LETTER_SIZE) {
      errors.push({ field: 'application_letter', msg: 'Surat Permohonan (PDF) maksimal 5 MB.' });
    }
    if (errors.length) {
      deleteUploadedFile(appLetterFile);
      return fail(res, 422, 'Validasi gagal.', { errors });
    }

    const { reason, address, phone, gpa, total_sks } = req.body;
    const { requestId, requestNumber } = await model.createSubmission({
      studentId: req.user.id, reason: reason.trim(),
      address: address.trim(), phone: phone.trim(),
      gpa: parseFloat(gpa), totalSks: parseInt(total_sks, 10),
      applicationLetterFile: appLetterFile.filename,
    });

    return ok(res, 'Permohonan berhasil disimpan sebagai Draft.', {
      id: requestId, request_number: requestNumber,
    }, 201);
  } catch (err) { next(err); }
};

// ─── PUT /api/submissions/:id (mahasiswa, draft only) ─────────────────────────
const update = async (req, res, next) => {
  try {
    const appLetterFile = req.files?.application_letter?.[0] || null;
    const existing = await model.getSubmissionById(req.params.id, req.user.id);

    if (!existing) {
      deleteUploadedFile(appLetterFile);
      return fail(res, 404, 'Pengajuan tidak ditemukan atau bukan milik Anda.');
    }
    if (existing.status !== model.STATUS.DRAFT) {
      deleteUploadedFile(appLetterFile);
      return fail(res, 400, 'Pengajuan hanya dapat diubah saat status masih Draft.');
    }
    if (req.uploadError) return fail(res, 422, req.uploadError);

    const errors = (req.validationErrors || []).map(e => ({ field: e.path, msg: e.msg }));
    if (appLetterFile && appLetterFile.size > MAX_APPLICATION_LETTER_SIZE) {
      errors.push({ field: 'application_letter', msg: 'Surat Permohonan (PDF) maksimal 5 MB.' });
    }
    if (errors.length) {
      deleteUploadedFile(appLetterFile);
      return fail(res, 422, 'Validasi gagal.', { errors });
    }

    const { reason, address, phone, gpa, total_sks } = req.body;
    await model.updateSubmission(req.params.id, req.user.id, {
      reason: reason.trim(), address: address.trim(), phone: phone.trim(),
      gpa: parseFloat(gpa), totalSks: parseInt(total_sks, 10),
      applicationLetterFile: appLetterFile?.filename || undefined,
    });

    return ok(res, 'Permohonan berhasil diperbarui.', { id: parseInt(req.params.id, 10) });
  } catch (err) {
    if (err.message?.includes('Draft')) return fail(res, 400, err.message);
    next(err);
  }
};

// ─── DELETE /api/submissions/:id (mahasiswa, draft only) ──────────────────────
const destroy = async (req, res, next) => {
  try {
    await model.deleteSubmission(req.params.id, req.user.id);
    return ok(res, 'Draft berhasil dihapus.', {});
  } catch (err) {
    if (err.message?.includes('Draft')) return fail(res, 400, err.message);
    next(err);
  }
};

// ─── PATCH /api/submissions/:id/status ─────────────────────────────────────────
// Body: { status: <int>, note?: <string> }
// Satu endpoint generik untuk SEMUA transisi status, sesuai peran token JWT:
//   mahasiswa -> Draft(0) => Menunggu Prodi(1)            [submit]
//   kaprodi   -> Menunggu Prodi(1) => Disetujui(2)/Ditolak(3)
//   wd1       -> Disetujui Prodi(2) => Disetujui Final(4)/Ditolak Final(5)
const updateStatus = async (req, res, next) => {
  try {
    const id = req.params.id;
    const targetStatus = parseInt(req.body.status, 10);
    const note = (req.body.note || '').trim();

    if (Number.isNaN(targetStatus)) {
      return fail(res, 422, 'Field status wajib diisi dengan kode status yang valid.');
    }

    const submission = await model.getSubmissionById(id);
    if (!submission) return fail(res, 404, 'Pengajuan tidak ditemukan.');

    const { role, id: userId } = req.user;
    const S = model.STATUS;

    try {
      if (role === 'mahasiswa') {
        if (submission.requested_by !== userId) return fail(res, 403, 'Pengajuan ini bukan milik Anda.');
        if (submission.status !== S.DRAFT || targetStatus !== S.MENUNGGU_PRODI) {
          return fail(res, 400, 'Transisi status tidak valid. Mahasiswa hanya dapat mengajukan Draft menjadi Menunggu Verifikasi Kaprodi.');
        }
        await model.submitSubmission(id, userId);
      } else if (role === 'kaprodi') {
        if (submission.status !== S.MENUNGGU_PRODI) {
          return fail(res, 400, 'Pengajuan ini tidak dalam status Menunggu Verifikasi Kaprodi.');
        }
        if (targetStatus === S.DISETUJUI_PRODI) {
          await model.approveByKaprodi(id, userId, note);
        } else if (targetStatus === S.DITOLAK_PRODI) {
          if (!note) return fail(res, 422, 'Alasan penolakan (note) wajib diisi.');
          await model.rejectByKaprodi(id, userId, note);
        } else {
          return fail(res, 400, 'Status tujuan tidak valid untuk Kaprodi.');
        }
      } else if (role === 'wd1') {
        if (submission.status !== S.DISETUJUI_PRODI) {
          return fail(res, 400, 'Pengajuan ini belum disetujui Kaprodi / sudah diproses lebih lanjut.');
        }
        if (targetStatus === S.DISETUJUI_FINAL) {
          await model.approveByDekan(id, userId, note);
        } else if (targetStatus === S.DITOLAK_FINAL) {
          if (!note) return fail(res, 422, 'Alasan penolakan (note) wajib diisi.');
          await model.rejectByDekan(id, userId, note);
        } else {
          return fail(res, 400, 'Status tujuan tidak valid untuk Wakil Dekan I.');
        }
      } else {
        return fail(res, 403, 'Role Anda tidak memiliki izin mengubah status pengajuan.');
      }
    } catch (modelErr) {
      // Error dari model (mis. race condition, status sudah berubah duluan)
      return fail(res, 400, modelErr.message || 'Gagal mengubah status pengajuan.');
    }

    const updated = await model.getSubmissionById(id);
    return ok(res, 'Status pengajuan berhasil diperbarui.', { submission: updated });
  } catch (err) { next(err); }
};

module.exports = { index, show, store, update, destroy, updateStatus };