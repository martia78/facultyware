const db = require('./db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS = {
  DRAFT: 0,
  MENUNGGU_PRODI: 1,
  DISETUJUI_PRODI: 2,
  DITOLAK_PRODI: 3,
  DISETUJUI_FINAL: 4,
  DITOLAK_FINAL: 5
};

const STATUS_LABEL = {
  0: 'Draft',
  1: 'Menunggu Prodi',
  2: 'Disetujui Prodi',
  3: 'Ditolak Prodi',
  4: 'Disetujui Final',
  5: 'Ditolak Final'
};

const STATUS_BADGE = {
  0: 'badge--gray',
  1: 'badge--blue',
  2: 'badge--yellow',
  3: 'badge--green',
  4: 'badge--red',
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Ambil data student berdasarkan user_id (dari session)
 */
async function getStudentByUserId(userId) {
  const [rows] = await db.query(
    `SELECT s.*, ou.name AS department_name,
            (SELECT ou2.name FROM organization_units ou2 WHERE ou2.type = 'faculty' AND ou2.id = (
              SELECT parent_id FROM organization_units WHERE id = s.department_id
            )) AS faculty_name
     FROM students s
     LEFT JOIN organization_units ou ON s.department_id = ou.id
     WHERE s.id = ?`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Buat permohonan baru (student_requests + student_request_resignation)
 * Menggunakan transaksi agar konsisten.
 */
async function createSubmission(data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Generate request number: RES-YYYYMMDD-XXXXX
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(10000 + Math.random() * 90000);
    const requestNumber = `RES-${datePart}-${randPart}`;

    // Insert ke student_requests
    const [reqResult] = await conn.query(
      `INSERT INTO student_requests
         (id, request_nunmber, request_type, title, description, status, requested_by, requested_at, created_at, updated_at)
       VALUES (NULL, ?, 'resignation', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        requestNumber,
        'Permohonan Pengunduran Diri',
        data.reason,
        STATUS.DRAFT,
        data.studentId,
      ]
    );
    const requestId = reqResult.insertId;

    // Insert ke student_request_resignation
    await conn.query(
      `INSERT INTO student_request_resignation
         (id, student_requests_id, student_address, student_hp, reasons, application_letter_file, updated_at)
       VALUES (NULL, ?, ?, ?, ?, ?, NOW())`,
      [
        requestId,
        data.address || null,
        data.phone || null,
        data.additionalNote || null,
        data.applicationLetterFile || null,
      ]
    );

    // Simpan file bukti pendukung jika ada (custom field di tabel resignation)
    if (data.supportingFile) {
      await conn.query(
        `UPDATE student_request_resignation
         SET supporting_document_file = ?
         WHERE student_requests_id = ?`,
        [data.supportingFile, requestId]
      );
    }

    await conn.commit();
    return { requestId, requestNumber };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Ambil semua submission milik student tertentu
 */
async function getSubmissionsByStudentId(studentId) {
  const [rows] = await db.query(
    `SELECT sr.id, sr.request_nunmber AS request_number, sr.status,
            sr.requested_at, sr.updated_at, sr.description,
            srr.reasons AS additional_note, srr.application_letter_file,
            srr.supporting_document_file
     FROM student_requests sr
     LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
     WHERE sr.requested_by = ? AND sr.request_type = 'resignation'
     ORDER BY sr.created_at DESC`,
    [studentId]
  );
  return rows;
}

/**
 * Ambil single submission, pastikan milik studentId tersebut
 */
async function getSubmissionById(id, studentId = null) {
  let sql = `SELECT sr.*, srr.student_address, srr.student_hp,
                    srr.reasons AS additional_note,
                    srr.application_letter_file,
                    srr.supporting_document_file,
                    sr.request_nunmber AS request_number,
                    sr.description AS reason
             FROM student_requests sr
             LEFT JOIN student_request_resignation srr ON srr.student_requests_id = sr.id
             WHERE sr.id = ? AND sr.request_type = 'resignation'`;
  const params = [id];

  if (studentId !== null) {
    sql += ' AND sr.requested_by = ?';
    params.push(studentId);
  }

  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

/**
 * Update submission (hanya boleh saat status = Draft)
 */
async function updateSubmission(id, studentId, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Pastikan status masih Draft dan milik user ini
    const [check] = await conn.query(
      'SELECT status FROM student_requests WHERE id = ? AND requested_by = ?',
      [id, studentId]
    );
    if (!check.length || check[0].status !== STATUS.DRAFT) {
      throw new Error('Permohonan tidak dapat diubah karena status bukan Draft.');
    }

    await conn.query(
      `UPDATE student_requests
       SET description = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.reason, id]
    );

    // Bangun SET dinamis untuk resignation
    const sets = [];
    const vals = [];

    if (data.address !== undefined) { sets.push('student_address = ?'); vals.push(data.address); }
    if (data.phone !== undefined) { sets.push('student_hp = ?'); vals.push(data.phone); }
    if (data.additionalNote !== undefined) { sets.push('reasons = ?'); vals.push(data.additionalNote); }
    if (data.applicationLetterFile) { sets.push('application_letter_file = ?'); vals.push(data.applicationLetterFile); }
    if (data.supportingFile) { sets.push('supporting_document_file = ?'); vals.push(data.supportingFile); }
    if (data.removeApplication) { sets.push('application_letter_file = NULL'); }
    if (data.removeSupporting) { sets.push('supporting_document_file = NULL'); }

    if (sets.length) {
      vals.push(id);
      await conn.query(
        `UPDATE student_request_resignation SET ${sets.join(', ')}, updated_at = NOW() WHERE student_requests_id = ?`,
        vals
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const fs = require('fs');
  const path = require('path');

  const [oldRows] = await pool.query(
    `SELECT
        application_letter_file,
        supporting_document_file
     FROM resignation_submissions
     WHERE id = ?`,
    [id]
  );

  const oldSubmission = oldRows[0];

  if (
    data.removeApplication &&
    oldSubmission.application_letter_file
  ) {
    const oldPath = path.join(
      process.cwd(),
      'uploads',
      'resignation-documents',
      oldSubmission.application_letter_file
    );

    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  if (
    data.removeSupporting &&
    oldSubmission.supporting_document_file
  ) {
    const oldPath = path.join(
      process.cwd(),
      'uploads',
      'resignation-documents',
      oldSubmission.supporting_document_file
    );

    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }
}

/**
 * Ubah status Draft → Diajukan
 */
async function submitSubmission(id, studentId) {
  const [result] = await db.query(
    `UPDATE student_requests
     SET status = ?, updated_at = NOW()
     WHERE id = ? AND requested_by = ? AND status = ?`,
    [STATUS.DIAJUKAN, id, studentId, STATUS.DRAFT]
  );
  if (result.affectedRows === 0) {
    throw new Error('Permohonan tidak ditemukan atau status bukan Draft.');
  }
}

/**
 * Hapus submission (hanya saat Draft)
 */
async function deleteSubmission(id, studentId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `DELETE FROM student_request_resignation WHERE student_requests_id = ?
       AND (SELECT status FROM student_requests WHERE id = ?) = ?`,
      [id, id, STATUS.DRAFT]
    );
    const [result] = await conn.query(
      `DELETE FROM student_requests WHERE id = ? AND requested_by = ? AND status = ?`,
      [id, studentId, STATUS.DRAFT]
    );
    if (result.affectedRows === 0) {
      throw new Error('Permohonan tidak ditemukan atau status bukan Draft.');
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  STATUS,
  STATUS_LABEL,
  STATUS_BADGE,
  getStudentByUserId,
  createSubmission,
  getSubmissionsByStudentId,
  getSubmissionById,
  updateSubmission,
  submitSubmission,
  deleteSubmission,
};
