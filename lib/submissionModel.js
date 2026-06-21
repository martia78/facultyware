const db = require('./db');
const fs = require('fs');
const path = require('path');

// ─── Konstanta Status ──────────────────────────────────────────────────────────
// Catatan: kode status tetap dipecah 6 nilai secara internal (membedakan
// ditolak-oleh-Kaprodi vs ditolak-oleh-WD1) supaya riwayat/audit trail tetap
// presisi. Untuk tampilan ke mahasiswa, label dipetakan ke kosakata baku pada
// dokumen fitur: Draft, Menunggu Verifikasi Kaprodi, Diproses WD I, Disetujui,
// Ditolak.
const STATUS = {
  DRAFT: 0,
  MENUNGGU_PRODI: 1,
  DISETUJUI_PRODI: 2,
  DITOLAK_PRODI: 3,
  DISETUJUI_FINAL: 4,
  DITOLAK_FINAL: 5,
};

// Status yang masih dianggap "pengajuan aktif" (belum final).
const ACTIVE_STATUSES = [STATUS.DRAFT, STATUS.MENUNGGU_PRODI, STATUS.DISETUJUI_PRODI];
// Status yang memblokir pembuatan pengajuan baru (Ketentuan Pengajuan Ganda).
const BLOCKING_STATUSES = [STATUS.MENUNGGU_PRODI, STATUS.DISETUJUI_PRODI];

const STATUS_LABEL = {
  0: 'Draft',
  1: 'Menunggu Verifikasi Kaprodi',
  2: 'Diproses WD I',
  3: 'Ditolak',
  4: 'Disetujui',
  5: 'Ditolak',
};

const STATUS_BADGE = {
  0: 'badge--gray',
  1: 'badge--yellow',
  2: 'badge--blue',
  3: 'badge--red',
  4: 'badge--green',
  5: 'badge--red',
};

// ─── Student ──────────────────────────────────────────────────────────────────
async function getStudentByUserId(userId) {
  const [rows] = await db.query(
    `SELECT s.*, u.email,
            ou.name AS department_name,
            (SELECT ou2.name FROM organization_units ou2
             WHERE ou2.type = 'faculty'
               AND ou2.id = (SELECT parent_id FROM organization_units WHERE id = s.department_id)
            ) AS faculty_name
     FROM students s
     LEFT JOIN users u ON u.id = s.id
     LEFT JOIN organization_units ou ON s.department_id = ou.id
     WHERE s.id = ?`,
    [userId]
  );
  return rows[0] || null;
}

// ─── Semua mahasiswa (untuk admin) ────────────────────────────────────────────
async function getAllStudents({ search = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.regno, s.email, s.year, s.status,
            ou.name AS department_name
     FROM students s
     LEFT JOIN organization_units ou ON s.department_id = ou.id
     WHERE s.name LIKE ? OR s.regno LIKE ?
     ORDER BY s.name ASC
     LIMIT ? OFFSET ?`,
    [searchParam, searchParam, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM students s
     WHERE s.name LIKE ? OR s.regno LIKE ?`,
    [searchParam, searchParam]
  );
  return { rows, total };
}

// ─── Ketentuan Pengajuan Ganda ─────────────────────────────────────────────────
// Mengembalikan pengajuan resignation milik mahasiswa yang masih "aktif"
// (Draft, Menunggu Verifikasi Kaprodi, atau Diproses WD I), atau null jika
// tidak ada. Dipakai untuk:
//  - Dashboard: menentukan pengajuan mana yang ditampilkan sebagai "aktif".
//  - createForm/store: mencegah mahasiswa membuat pengajuan baru selama masih
//    ada pengajuan yang berjalan (jika Draft → diarahkan lanjut mengisi draft
//    tsb; jika Menunggu Kaprodi/Diproses WD I → diblokir total).
async function getActiveSubmission(studentId) {
  const [rows] = await db.query(
    `SELECT id, request_nunmber AS request_number, status
     FROM student_requests
     WHERE requested_by = ? AND request_type = 'resignation'
       AND status IN (?, ?, ?)
     ORDER BY created_at DESC
     LIMIT 1`,
    [studentId, STATUS.DRAFT, STATUS.MENUNGGU_PRODI, STATUS.DISETUJUI_PRODI]
  );
  return rows[0] || null;
}

// ─── Create Submission ────────────────────────────────────────────────────────
async function createSubmission(data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(10000 + Math.random() * 90000);
    const requestNumber = `RES-${datePart}-${randPart}`;

    // Catatan: requested_at SENGAJA tidak diisi di sini — kolom ini merepresentasikan
    // tanggal pengajuan benar-benar DIAJUKAN (lihat submitSubmission), bukan tanggal
    // draft dibuat. Tanggal draft dibuat sudah terekam lewat created_at.
    const [reqResult] = await conn.query(
      `INSERT INTO student_requests
         (request_nunmber, request_type, title, description, status, requested_by, created_at, updated_at)
       VALUES (?, 'resignation', 'Permohonan Pengunduran Diri', ?, ?, ?, NOW(), NOW())`,
      [requestNumber, data.reason, STATUS.DRAFT, data.studentId]
    );
    const requestId = reqResult.insertId;

    await conn.query(
      `INSERT INTO student_request_resignation
         (student_requests_id, student_address, student_hp, current_gpa, current_credits, reasons, application_letter_file, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [requestId, data.address || null, data.phone || null, data.gpa ?? null, data.totalSks ?? null, data.additionalNote || null, data.applicationLetterFile || null]
    );

    await conn.commit();
    return { requestId, requestNumber };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Get Submissions By Student ───────────────────────────────────────────────
async function getSubmissionsByStudentId(studentId, { search = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;
  const [rows] = await db.query(
    `SELECT sr.id, sr.request_nunmber AS request_number, sr.status,
            sr.requested_at, sr.created_at, sr.updated_at, sr.description AS reason,
            srr.reasons AS additional_note, srr.application_letter_file
     FROM student_requests sr
     LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
     WHERE sr.requested_by = ? AND sr.request_type = 'resignation'
       AND (sr.request_nunmber LIKE ? OR sr.description LIKE ?)
     ORDER BY sr.created_at DESC
     LIMIT ? OFFSET ?`,
    [studentId, searchParam, searchParam, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM student_requests
     WHERE requested_by = ? AND request_type = 'resignation'
       AND (request_nunmber LIKE ? OR description LIKE ?)`,
    [studentId, searchParam, searchParam]
  );
  return { rows, total };
}

// ─── Get All Submissions (Admin/Kaprodi/Dekan) ────────────────────────────────
async function getAllSubmissions({ search = '', status = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;
  const conditions = [`sr.request_type = 'resignation'`];
  const params = [];

  if (search) {
    conditions.push(`(s.name LIKE ? OR s.regno LIKE ? OR sr.request_nunmber LIKE ?)`);
    params.push(searchParam, searchParam, searchParam);
  }
  if (status !== '' && status !== null && status !== undefined) {
    conditions.push(`sr.status = ?`);
    params.push(parseInt(status));
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await db.query(
    `SELECT sr.id, sr.request_nunmber AS request_number, sr.status,
            sr.requested_at, sr.updated_at, sr.description AS reason,
            s.name AS student_name, s.regno AS student_nim,
            ou.name AS department_name,
            srr.application_letter_file
     FROM student_requests sr
     LEFT JOIN students s ON s.id = sr.requested_by
     LEFT JOIN organization_units ou ON s.department_id = ou.id
     LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
     ${where}
     ORDER BY sr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM student_requests sr
     LEFT JOIN students s ON s.id = sr.requested_by
     ${where}`,
    params
  );
  return { rows, total };
}

// ─── Get Submissions For Kaprodi (status 1) ───────────────────────────────────
async function getSubmissionsForKaprodi({ search = '', status = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;
  const conditions = [`sr.request_type = 'resignation'`, `sr.status IN (1, 2, 3)`];
  const params = [];

  if (search) {
    conditions.push(`(s.name LIKE ? OR s.regno LIKE ? OR sr.request_nunmber LIKE ?)`);
    params.push(searchParam, searchParam, searchParam);
  }
  if (status !== '' && status !== null) {
    conditions.push(`sr.status = ?`);
    params.push(parseInt(status));
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await db.query(
    `SELECT sr.id, sr.request_nunmber AS request_number, sr.status,
            sr.requested_at, sr.updated_at, sr.description AS reason,
            s.name AS student_name, s.regno AS student_nim,
            ou.name AS department_name,
            srr.application_letter_file
     FROM student_requests sr
     LEFT JOIN students s ON s.id = sr.requested_by
     LEFT JOIN organization_units ou ON s.department_id = ou.id
     LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
     ${where}
     ORDER BY sr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM student_requests sr
     LEFT JOIN students s ON s.id = sr.requested_by
     ${where}`,
    params
  );
  return { rows, total };
}

// ─── Get Submissions For Dekan (status 2,4,5) ─────────────────────────────────
async function getSubmissionsForDekan({ search = '', status = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;
  const conditions = [`sr.request_type = 'resignation'`, `sr.status IN (2, 4, 5)`];
  const params = [];

  if (search) {
    conditions.push(`(s.name LIKE ? OR s.regno LIKE ? OR sr.request_nunmber LIKE ?)`);
    params.push(searchParam, searchParam, searchParam);
  }
  if (status !== '' && status !== null) {
    conditions.push(`sr.status = ?`);
    params.push(parseInt(status));
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await db.query(
    `SELECT sr.id, sr.request_nunmber AS request_number, sr.status,
            sr.requested_at, sr.updated_at, sr.description AS reason,
            s.name AS student_name, s.regno AS student_nim,
            ou.name AS department_name,
            srr.application_letter_file,
            a.approval_reason AS kaprodi_note,
            a.approved_by AS kaprodi_by,
            a.updated_at AS kaprodi_at
     FROM student_requests sr
     LEFT JOIN students s ON s.id = sr.requested_by
     LEFT JOIN organization_units ou ON s.department_id = ou.id
     LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
     LEFT JOIN student_request_resignation_approvals a ON a.student_request_resignation_id = srr.id AND a.level = 'kaprodi'
     ${where}
     ORDER BY sr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM student_requests sr
     LEFT JOIN students s ON s.id = sr.requested_by
     ${where}`,
    params
  );
  return { rows, total };
}

// ─── Get Single Submission ────────────────────────────────────────────────────
async function getSubmissionById(id, studentId = null) {
  let sql = `SELECT sr.id, sr.request_nunmber AS request_number, sr.status,
                    sr.requested_at, sr.created_at, sr.updated_at, sr.description AS reason,
                    sr.requested_by,
                    srr.id AS resignation_id,
                    srr.student_address, srr.student_hp, srr.current_gpa AS gpa, srr.current_credits AS total_sks,
                    srr.reasons AS additional_note,
                    srr.application_letter_file,
                    s.name AS student_name, s.regno AS student_nim,
                    ou.name AS department_name,
                    u.email AS student_email
             FROM student_requests sr
             LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
             LEFT JOIN students s ON s.id = sr.requested_by
             LEFT JOIN organization_units ou ON s.department_id = ou.id
             LEFT JOIN users u ON u.id = sr.requested_by
             WHERE sr.id = ? AND sr.request_type = 'resignation'`;
  const params = [id];
  if (studentId !== null) {
    sql += ' AND sr.requested_by = ?';
    params.push(studentId);
  }
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

// ─── Update Submission ────────────────────────────────────────────────────────
async function updateSubmission(id, studentId, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [check] = await conn.query(
      'SELECT status, id FROM student_requests WHERE id = ? AND requested_by = ?',
      [id, studentId]
    );
    if (!check.length || check[0].status !== STATUS.DRAFT) {
      throw new Error('Permohonan tidak dapat diubah karena status bukan Draft.');
    }

    // Ambil nama file lama dulu (sebelum di-update) supaya bisa dihapus dari
    // disk jika digantikan file baru — file lama otomatis dihapus saat
    // mahasiswa mengunggah file pengganti (tombol "Ganti File").
    const [[oldFiles]] = await conn.query(
      `SELECT application_letter_file
       FROM student_request_resignation WHERE student_requests_id = ?`,
      [id]
    );

    await conn.query(
      `UPDATE student_requests SET description = ?, updated_at = NOW() WHERE id = ?`,
      [data.reason, id]
    );

    const sets = [];
    const vals = [];
    const filesToDelete = [];

    if (data.address !== undefined) { sets.push('student_address = ?'); vals.push(data.address); }
    if (data.phone !== undefined) { sets.push('student_hp = ?'); vals.push(data.phone); }
    if (data.gpa !== undefined) { sets.push('current_gpa = ?'); vals.push(data.gpa); }
    if (data.totalSks !== undefined) { sets.push('current_credits = ?'); vals.push(data.totalSks); }
    if (data.additionalNote !== undefined) { sets.push('reasons = ?'); vals.push(data.additionalNote); }

    if (data.applicationLetterFile) {
      sets.push('application_letter_file = ?'); vals.push(data.applicationLetterFile);
      if (oldFiles?.application_letter_file) filesToDelete.push(oldFiles.application_letter_file);
    }

    if (sets.length) {
      vals.push(id);
      await conn.query(
        `UPDATE student_request_resignation SET ${sets.join(', ')}, updated_at = NOW() WHERE student_requests_id = ?`,
        vals
      );
    }

    await conn.commit();

    // Hapus file fisik lama dari disk SETELAH transaksi berhasil di-commit.
    // Dilakukan di luar transaksi DB karena ini operasi filesystem, bukan SQL.
    if (filesToDelete.length > 0) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'resignation-documents');
      filesToDelete.forEach(fname => {
        const fpath = path.join(uploadDir, fname);
        if (fs.existsSync(fpath)) {
          try { fs.unlinkSync(fpath); } catch (e) { /* abaikan jika file sudah tidak ada / terkunci */ }
        }
      });
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Submit (Draft → Menunggu Prodi) ─────────────────────────────────────────
async function submitSubmission(id, studentId) {
  // Pastikan dokumen wajib sudah terlampir sebelum mengizinkan submit —
  // mencegah Draft "kosong" diajukan lewat panggilan langsung ke endpoint ini.
  const [rows] = await db.query(
    `SELECT sr.status, srr.application_letter_file
     FROM student_requests sr
     LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
     WHERE sr.id = ? AND sr.requested_by = ?`,
    [id, studentId]
  );
  if (!rows.length || rows[0].status !== STATUS.DRAFT) {
    throw new Error('Permohonan tidak ditemukan atau status bukan Draft.');
  }
  if (!rows[0].application_letter_file) {
    throw new Error('Surat Permohonan (PDF) wajib diunggah sebelum mengajukan permohonan.');
  }

  const [result] = await db.query(
    `UPDATE student_requests SET status = ?, requested_at = NOW(), updated_at = NOW()
     WHERE id = ? AND requested_by = ? AND status = ?`,
    [STATUS.MENUNGGU_PRODI, id, studentId, STATUS.DRAFT]
  );
  if (result.affectedRows === 0) {
    throw new Error('Permohonan tidak ditemukan atau status bukan Draft.');
  }
}

// ─── Delete Submission ────────────────────────────────────────────────────────
async function deleteSubmission(id, studentId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Ambil file dulu untuk dihapus
    const [fileRows] = await conn.query(
      `SELECT srr.application_letter_file
       FROM student_request_resignation srr
       JOIN student_requests sr ON sr.id = srr.student_requests_id
       WHERE sr.id = ? AND sr.requested_by = ? AND sr.status = ?`,
      [id, studentId, STATUS.DRAFT]
    );

    await conn.query(
      `DELETE srr FROM student_request_resignation srr
       JOIN student_requests sr ON sr.id = srr.student_requests_id
       WHERE sr.id = ? AND sr.requested_by = ? AND sr.status = ?`,
      [id, studentId, STATUS.DRAFT]
    );
    const [result] = await conn.query(
      `DELETE FROM student_requests WHERE id = ? AND requested_by = ? AND status = ?`,
      [id, studentId, STATUS.DRAFT]
    );
    if (result.affectedRows === 0) {
      throw new Error('Permohonan tidak ditemukan atau status bukan Draft.');
    }

    // Hapus file fisik
    if (fileRows.length > 0 && fileRows[0].application_letter_file) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'resignation-documents');
      const fpath = path.join(uploadDir, fileRows[0].application_letter_file);
      if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Kaprodi: Approve ────────────────────────────────────────────────────────
async function approveByKaprodi(id, approverId, note = '') {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [check] = await conn.query(
      `SELECT sr.status, srr.id AS resignation_id
       FROM student_requests sr
       LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
       WHERE sr.id = ? AND sr.status = ?`,
      [id, STATUS.MENUNGGU_PRODI]
    );
    if (!check.length) throw new Error('Permohonan tidak ditemukan atau tidak dalam status yang valid.');

    await conn.query(
      `UPDATE student_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      [STATUS.DISETUJUI_PRODI, id]
    );

    // Log approval
    const resignationId = check[0].resignation_id;
    if (resignationId) {
      await conn.query(
        `INSERT INTO student_request_resignation_approvals
           (student_request_resignation_id, level, approved_by, approval_reason, approval_position, status, updated_at, created_at)
         VALUES (?, 'kaprodi', ?, ?, 'Ketua Program Studi', ?, NOW(), NOW())`,
        [resignationId, approverId, note, STATUS.DISETUJUI_PRODI]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Kaprodi: Reject ─────────────────────────────────────────────────────────
async function rejectByKaprodi(id, approverId, note = '') {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [check] = await conn.query(
      `SELECT sr.status, srr.id AS resignation_id
       FROM student_requests sr
       LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
       WHERE sr.id = ? AND sr.status = ?`,
      [id, STATUS.MENUNGGU_PRODI]
    );
    if (!check.length) throw new Error('Permohonan tidak ditemukan atau tidak dalam status Menunggu Prodi.');

    await conn.query(
      `UPDATE student_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      [STATUS.DITOLAK_PRODI, id]
    );

    const resignationId = check[0].resignation_id;
    if (resignationId) {
      await conn.query(
        `INSERT INTO student_request_resignation_approvals
           (student_request_resignation_id, level, approved_by, approval_reason, approval_position, status, updated_at, created_at)
         VALUES (?, 'kaprodi', ?, ?, 'Ketua Program Studi', ?, NOW(), NOW())`,
        [resignationId, approverId, note, STATUS.DITOLAK_PRODI]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Dekan/WD1: Approve Final ────────────────────────────────────────────────
async function approveByDekan(id, approverId, note = '') {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [check] = await conn.query(
      `SELECT sr.status, srr.id AS resignation_id
       FROM student_requests sr
       LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
       WHERE sr.id = ? AND sr.status = ?`,
      [id, STATUS.DISETUJUI_PRODI]
    );
    if (!check.length) throw new Error('Permohonan tidak ditemukan atau belum disetujui Kaprodi.');

    await conn.query(
      `UPDATE student_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      [STATUS.DISETUJUI_FINAL, id]
    );

    const resignationId = check[0].resignation_id;
    if (resignationId) {
      await conn.query(
        `INSERT INTO student_request_resignation_approvals
           (student_request_resignation_id, level, approved_by, approval_reason, approval_position, status, updated_at, created_at)
         VALUES (?, 'dekan', ?, ?, 'Wakil Dekan I', ?, NOW(), NOW())`,
        [resignationId, approverId, note, STATUS.DISETUJUI_FINAL]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Dekan/WD1: Reject Final ─────────────────────────────────────────────────
async function rejectByDekan(id, approverId, note = '') {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [check] = await conn.query(
      `SELECT sr.status, srr.id AS resignation_id
       FROM student_requests sr
       LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
       WHERE sr.id = ? AND sr.status = ?`,
      [id, STATUS.DISETUJUI_PRODI]
    );
    if (!check.length) throw new Error('Permohonan tidak ditemukan atau belum disetujui Kaprodi.');

    await conn.query(
      `UPDATE student_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      [STATUS.DITOLAK_FINAL, id]
    );

    const resignationId = check[0].resignation_id;
    if (resignationId) {
      await conn.query(
        `INSERT INTO student_request_resignation_approvals
           (student_request_resignation_id, level, approved_by, approval_reason, approval_position, status, updated_at, created_at)
         VALUES (?, 'dekan', ?, ?, 'Wakil Dekan I', ?, NOW(), NOW())`,
        [resignationId, approverId, note, STATUS.DITOLAK_FINAL]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Riwayat Approval ─────────────────────────────────────────────────────────
async function getApprovalHistory(submissionId) {
  const [rows] = await db.query(
    `SELECT a.level, a.approval_reason, a.approval_position, a.status, a.created_at,
            u.name AS approver_name
     FROM student_request_resignation_approvals a
     JOIN student_request_resignation srr ON srr.id = a.student_request_resignation_id
     JOIN student_requests sr ON sr.id = srr.student_requests_id
     LEFT JOIN users u ON u.id = a.approved_by
     WHERE sr.id = ?
     ORDER BY a.created_at ASC`,
    [submissionId]
  );
  return rows;
}

// ─── Tracking Status (timeline 5 langkah) ─────────────────────────────────────
// Membangun representasi "Tracking Status" sesuai contoh pada dokumen fitur:
//   ✓ Draft
//   ✓ Diajukan
//   ● Menunggu Verifikasi Kaprodi
//   ○ Menunggu Verifikasi WD I
//   ○ Selesai
// state per-step: 'done' | 'current' | 'pending' | 'rejected' | 'skipped'
function buildTimeline(submission, history = []) {
  if (!submission) return [];
  const st = submission.status;
  const kaprodi = history.find(h => h.level === 'kaprodi');
  const dekan = history.find(h => h.level === 'dekan');

  const steps = [];

  // 1. Draft — selalu selesai begitu pengajuan dibuat (baik masih draft atau sudah lanjut).
  steps.push({ key: 'draft', title: 'Draft', date: submission.created_at || null, state: 'done' });

  // 2. Diajukan
  const sudahDiajukan = st !== STATUS.DRAFT;
  steps.push({
    key: 'diajukan',
    title: 'Diajukan',
    date: sudahDiajukan ? submission.requested_at : null,
    state: sudahDiajukan ? 'done' : 'current',
  });

  // 3. Menunggu Verifikasi Kaprodi
  let kaprodiState;
  if (kaprodi) {
    kaprodiState = kaprodi.status === STATUS.DITOLAK_PRODI ? 'rejected' : 'done';
  } else if (st === STATUS.MENUNGGU_PRODI) {
    kaprodiState = 'current';
  } else {
    kaprodiState = 'pending';
  }
  steps.push({
    key: 'kaprodi',
    title: 'Menunggu Verifikasi Kaprodi',
    date: kaprodi ? kaprodi.created_at : null,
    state: kaprodiState,
  });

  // 4. Menunggu Verifikasi WD I
  let wd1State;
  if (dekan) {
    wd1State = dekan.status === STATUS.DITOLAK_FINAL ? 'rejected' : 'done';
  } else if (st === STATUS.DISETUJUI_PRODI) {
    wd1State = 'current';
  } else if (kaprodi && kaprodi.status === STATUS.DITOLAK_PRODI) {
    wd1State = 'skipped';
  } else {
    wd1State = 'pending';
  }
  steps.push({
    key: 'wd1',
    title: 'Menunggu Verifikasi WD I',
    date: dekan ? dekan.created_at : null,
    state: wd1State,
  });

  // 5. Selesai
  let selesaiState;
  if (st === STATUS.DISETUJUI_FINAL) selesaiState = 'done';
  else if (st === STATUS.DITOLAK_FINAL || st === STATUS.DITOLAK_PRODI) selesaiState = 'rejected';
  else selesaiState = 'pending';
  steps.push({
    key: 'selesai',
    title: 'Selesai',
    date: (st === STATUS.DISETUJUI_FINAL || st === STATUS.DITOLAK_FINAL) ? dekan?.created_at : null,
    state: selesaiState,
  });

  return steps;
}

// ─── User Management (Admin) ──────────────────────────────────────────────────
async function getAllUsers({ search = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.name, u.email, u.created_at,
            GROUP_CONCAT(r.name) AS roles
     FROM users u
     LEFT JOIN user_has_roles uhr ON uhr.user_id = u.id
     LEFT JOIN roles r ON r.id = uhr.role_id
     WHERE u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [searchParam, searchParam, searchParam, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(DISTINCT u.id) AS total FROM users u
     WHERE u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?`,
    [searchParam, searchParam, searchParam]
  );
  return { rows, total };
}

async function getUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.name, u.email,
            r.name AS role, r.id AS role_id
     FROM users u
     LEFT JOIN user_has_roles uhr ON uhr.user_id = u.id
     LEFT JOIN roles r ON r.id = uhr.role_id
     WHERE u.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getAllRoles() {
  const [rows] = await db.query('SELECT id, name FROM roles ORDER BY name');
  return rows;
}

async function createUser(data) {
  const bcrypt = require('bcryptjs');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const hash = await bcrypt.hash(data.password, 12);
    const [result] = await conn.query(
      `INSERT INTO users (username, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [data.username, data.name, data.email, hash]
    );
    const userId = result.insertId;
    if (data.roleId) {
      await conn.query(`INSERT INTO user_has_roles (user_id, role_id) VALUES (?, ?)`, [userId, data.roleId]);
    }
    // Jika mahasiswa, insert ke tabel students juga
    if (data.roleName === 'mahasiswa') {
      const [[{ maxId }]] = await conn.query('SELECT COALESCE(MAX(id),0)+1 AS maxId FROM students');
      await conn.query(
        `INSERT INTO students (id, name, regno, email, year, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [userId, data.name, data.nim || data.username, data.email, new Date().getFullYear()]
      );
    }
    await conn.commit();
    return userId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateUser(id, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const sets = ['name = ?', 'email = ?', 'updated_at = NOW()'];
    const vals = [data.name, data.email];
    if (data.password) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(data.password, 12);
      sets.push('password = ?');
      vals.push(hash);
    }
    vals.push(id);
    await conn.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (data.roleId) {
      await conn.query(`DELETE FROM user_has_roles WHERE user_id = ?`, [id]);
      await conn.query(`INSERT INTO user_has_roles (user_id, role_id) VALUES (?, ?)`, [id, data.roleId]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function deleteUser(id) {
  // Pastikan user bukan admin terakhir atau mahasiswa dengan submission aktif
  await db.query(`DELETE FROM user_has_roles WHERE user_id = ?`, [id]);
  await db.query(`DELETE FROM users WHERE id = ?`, [id]);
}

async function resetPassword(id, newPassword) {
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query(`UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`, [hash, id]);
}

// ─── Stats untuk dashboard ───────────────────────────────────────────────────
// ─── Stats untuk dashboard Kaprodi ────────────────────────────────────────────
// "Menunggu" dihitung langsung dari status saat ini (status=1).
// "Disetujui"/"Ditolak" dihitung dari LOG approval (level='kaprodi'), bukan dari
// status saat ini — supaya angkanya tidak berubah/hilang setelah WD1 memproses
// lebih lanjut (status berubah dari 2 → 4/5).
async function getKaprodiStats() {
  const [[{ menunggu }]] = await db.query(
    `SELECT COUNT(*) AS menunggu FROM student_requests
     WHERE request_type = 'resignation' AND status = ?`,
    [STATUS.MENUNGGU_PRODI]
  );
  const [[{ disetujui }]] = await db.query(
    `SELECT COUNT(*) AS disetujui FROM student_request_resignation_approvals
     WHERE level = 'kaprodi' AND status = ?`,
    [STATUS.DISETUJUI_PRODI]
  );
  const [[{ ditolak }]] = await db.query(
    `SELECT COUNT(*) AS ditolak FROM student_request_resignation_approvals
     WHERE level = 'kaprodi' AND status = ?`,
    [STATUS.DITOLAK_PRODI]
  );
  return { menunggu, disetujui, ditolak };
}

// ─── Stats untuk dashboard ───────────────────────────────────────────────────
async function getStats() {
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM student_requests WHERE request_type = 'resignation'`
  );
  const [[{ menunggu }]] = await db.query(
    `SELECT COUNT(*) AS menunggu FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
    [STATUS.MENUNGGU_PRODI]
  );
  const [[{ disetujui }]] = await db.query(
    `SELECT COUNT(*) AS disetujui FROM student_requests WHERE request_type = 'resignation' AND status = ?`,
    [STATUS.DISETUJUI_FINAL]
  );
  const [[{ ditolak }]] = await db.query(
    `SELECT COUNT(*) AS ditolak FROM student_requests WHERE request_type = 'resignation' AND status IN (?,?)`,
    [STATUS.DITOLAK_PRODI, STATUS.DITOLAK_FINAL]
  );
  return { total, menunggu, disetujui, ditolak };
}

module.exports = {
  STATUS,
  STATUS_LABEL,
  STATUS_BADGE,
  ACTIVE_STATUSES,
  BLOCKING_STATUSES,
  getStudentByUserId,
  getAllStudents,
  getActiveSubmission,
  createSubmission,
  getSubmissionsByStudentId,
  getAllSubmissions,
  getSubmissionsForKaprodi,
  getSubmissionsForDekan,
  getSubmissionById,
  updateSubmission,
  submitSubmission,
  deleteSubmission,
  approveByKaprodi,
  rejectByKaprodi,
  approveByDekan,
  rejectByDekan,
  getApprovalHistory,
  buildTimeline,
  getAllUsers,
  getUserById,
  getAllRoles,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getKaprodiStats,
  getStats,
};
