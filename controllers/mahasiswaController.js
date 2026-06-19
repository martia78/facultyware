const model = require('../lib/submissionModel');
const PDFDocument = require('pdfkit');

function popFlash(req) { const f = req.session.flash || null; delete req.session.flash; return f; }

// Kata ringkas untuk angka besar di kartu "Status Pengajuan" — terpisah dari
// STATUS_LABEL (yang dipakai di badge & tabel) supaya tidak mengubah teks
// yang sudah dipakai di halaman/role lain.
const STATUS_HEADLINE = {
  0: 'Draft',
  1: 'Pending',
  2: 'Diproses',
  3: 'Ditolak',
  4: 'Disetujui',
  5: 'Ditolak',
};

// Tahap aktif saat ini, dipakai di kolom "Tahap Saat Ini" pada tabel riwayat.
const CURRENT_STAGE = {
  0: 'Belum Diajukan',
  1: 'Verifikasi Kaprodi',
  2: 'Verifikasi WD I',
  3: 'Selesai (Ditolak)',
  4: 'Selesai',
  5: 'Selesai (Ditolak)',
};

// GET /mahasiswa/dashboard
const dashboard = async (req, res, next) => {
  try {
    const student = await model.getStudentByUserId(req.session.userId);
    const { rows: submissions, total } = await model.getSubmissionsByStudentId(req.session.userId, { limit: 100 });

    // "Pengajuan aktif" = pengajuan yang belum mencapai status final
    // (Draft / Menunggu Verifikasi Kaprodi / Diproses WD I). Jika pengajuan
    // terakhir sudah Disetujui/Ditolak, dashboard kembali menampilkan
    // "Belum Ada Pengajuan Aktif" meskipun riwayat tetap ada di tabel bawah.
    const active = submissions.find(s => model.ACTIVE_STATUSES.includes(s.status)) || null;
    const recent3 = submissions.slice(0, 3);
    const history = active ? await model.getApprovalHistory(active.id) : [];
    const timeline = model.buildTimeline(active, history);

    res.render('mahasiswa/dashboard', {
      title: 'Dashboard Mahasiswa',
      pageTitle: 'Dashboard Mahasiswa',
      pageSubtitle: null,
      currentPath: '/mahasiswa/dashboard',
      student, latest: active, recent3, timeline,
      totalSubmissions: submissions.length,
      STATUS_LABEL: model.STATUS_LABEL,
      STATUS_BADGE: model.STATUS_BADGE,
      STATUS_HEADLINE,
      CURRENT_STAGE,
      STATUS: model.STATUS,
      flash: popFlash(req),
    });
  } catch (err) { next(err); }
};

// GET /mahasiswa/profile
const profile = async (req, res, next) => {
  try {
    const student = await model.getStudentByUserId(req.session.userId);
    res.render('mahasiswa/profile', {
      title: 'Profil Mahasiswa',
      pageTitle: 'Profil Mahasiswa',
      pageSubtitle: null,
      currentPath: '/mahasiswa/profile',
      student,
      flash: popFlash(req),
    });
  } catch (err) { next(err); }
};

// GET /mahasiswa/submissions/:id/pdf
const exportPDF = async (req, res, next) => {
  try {
    const submission = await model.getSubmissionById(req.params.id, req.session.userId);
    if (!submission) return res.status(404).render('error', { message: 'Tidak ditemukan.', error: { status: 404, stack: '' } });
    if (submission.status !== model.STATUS.DISETUJUI_FINAL) {
      return res.status(403).render('error', { message: 'SK PDF hanya tersedia untuk permohonan yang telah disetujui final.', error: { status: 403, stack: '' } });
    }

    const history = await model.getApprovalHistory(req.params.id);
    const dekanApproval = history.find(h => h.level === 'dekan');
    const kaprodiApproval = history.find(h => h.level === 'kaprodi');
    const fmt = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

    const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 72, right: 72 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SK-${submission.request_number}.pdf"`);
    doc.pipe(res);

    doc.fontSize(14).font('Helvetica-Bold').text('UNIVERSITAS ANDALAS', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('FAKULTAS TEKNOLOGI INFORMASI', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).stroke();
    doc.moveDown(1);
    doc.fontSize(13).font('Helvetica-Bold').text('SURAT KEPUTUSAN PENGUNDURAN DIRI', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text(`Nomor: ${submission.request_number}`, { align: 'center' });
    doc.moveDown(1.5);

    const fields = [
      ['Nama Mahasiswa', submission.student_name || '—'],
      ['NIM', submission.student_nim || '—'],
      ['Program Studi', submission.department_name || '—'],
      ['Tanggal Pengajuan', fmt(submission.requested_at)],
      ['Disetujui Kaprodi', kaprodiApproval ? fmt(kaprodiApproval.created_at) : '—'],
      ['Keputusan Akhir (WD I)', dekanApproval ? fmt(dekanApproval.created_at) : '—'],
      ['Status Akhir', model.STATUS_LABEL[submission.status] || '—'],
    ];
    fields.forEach(([label, value]) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${label}:`, { continued: false });
      doc.font('Helvetica').text(value, { indent: 20 });
      doc.moveDown(0.3);
    });

    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').text('Alasan Pengunduran Diri:');
    doc.font('Helvetica').text(submission.reason || '—', { indent: 20 });

    if (dekanApproval?.approval_reason) {
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text('Catatan Wakil Dekan I:');
      doc.font('Helvetica').text(dekanApproval.approval_reason, { indent: 20 });
    }

    doc.moveDown(3);
    doc.fontSize(11).font('Helvetica').text('Padang, ' + fmt(new Date()), { align: 'right' });
    doc.text('Wakil Dekan I,', { align: 'right' });
    doc.moveDown(3);
    doc.font('Helvetica-Bold').text(dekanApproval?.approver_name || 'Wakil Dekan I', { align: 'right' });
    doc.font('Helvetica').text('NIP. ..................', { align: 'right' });
    doc.end();
  } catch (err) { next(err); }
};

module.exports = { dashboard, exportPDF, profile };
