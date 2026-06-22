const path = require('path');
const fs   = require('fs');
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

    const logoPath = path.join(__dirname, '../public/assets/images/logo-unand.png');
    const marginL = 60, marginR = 60;
    const pageW    = 595.28;
    const pageH    = 841.89;
    const contentW = pageW - marginL - marginR;

    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: marginL, right: marginR }, autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SK-${submission.request_number}.pdf"`);
    doc.pipe(res);

    // ── KOP SURAT ────────────────────────────────────────────────────────────
    const logoSize = 58;
    const kopY     = 40;
    const textX    = marginL + logoSize + 10;
    const textW    = contentW - logoSize - 10;

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, marginL, kopY, { width: logoSize, height: logoSize });
    }
    doc.font('Helvetica-Bold').fontSize(13)
       .text('UNIVERSITAS ANDALAS', textX, kopY + 4, { width: textW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10)
       .text('FAKULTAS TEKNOLOGI INFORMASI', textX, kopY + 20, { width: textW, align: 'center' });
    doc.font('Helvetica').fontSize(8)
       .text('Kampus Unand Limau Manis, Padang 25163 | Telp. (0751) 71307 | www.ft.unand.ac.id', textX, kopY + 34, { width: textW, align: 'center' });

    const lineY = kopY + logoSize + 5;
    doc.moveTo(marginL, lineY).lineTo(pageW - marginR, lineY).lineWidth(2.5).stroke('#000');
    doc.moveTo(marginL, lineY + 3.5).lineTo(pageW - marginR, lineY + 3.5).lineWidth(0.5).stroke('#000');
    doc.lineWidth(1).fillColor('#000');

    // ── JUDUL ────────────────────────────────────────────────────────────────
    doc.y = lineY + 14;
    doc.font('Helvetica-Bold').fontSize(12).text('SURAT KEPUTUSAN PENGUNDURAN DIRI MAHASISWA', marginL, doc.y, { width: contentW, align: 'center' });
    doc.font('Helvetica').fontSize(9).text(`Nomor: ${submission.request_number}`, marginL, doc.y + 2, { width: contentW, align: 'center' });

    const judulLineY = doc.y + 14;
    doc.moveTo(marginL + 60, judulLineY).lineTo(pageW - marginR - 60, judulLineY).lineWidth(0.5).stroke('#888');
    doc.lineWidth(1);
    doc.y = judulLineY + 10;

    // ── HELPER ───────────────────────────────────────────────────────────────
    const col1W = 130, col2W = contentW - col1W;

    const row = (label, value, bold = false) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9.5).text(label, marginL, y, { width: col1W });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).text(value, marginL + col1W, y, { width: col2W });
      doc.y += 2;
    };

    const section = (label) => {
      doc.y += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(label, marginL, doc.y);
      doc.y += 1;
      doc.moveTo(marginL, doc.y).lineTo(pageW - marginR, doc.y).lineWidth(0.4).stroke('#bbb');
      doc.lineWidth(1).fillColor('#000');
      doc.y += 6;
    };

    // ── DATA MAHASISWA ───────────────────────────────────────────────────────
    section('DATA MAHASISWA');
    row('Nama Mahasiswa', submission.student_name || '—');
    row('NIM', submission.student_nim || '—');
    row('Program Studi', submission.department_name || '—');

    // ── DATA PENGAJUAN ───────────────────────────────────────────────────────
    section('DATA PENGAJUAN');
    row('Nomor Pengajuan', submission.request_number);
    row('Tanggal Pengajuan', fmt(submission.requested_at));
    row('Alasan Pengunduran Diri', submission.reason || '—');

    // ── RIWAYAT PERSETUJUAN ──────────────────────────────────────────────────
    section('RIWAYAT PERSETUJUAN');
    row('Disetujui Kaprodi', kaprodiApproval ? `${kaprodiApproval.approver_name || 'Kaprodi'} — ${fmt(kaprodiApproval.created_at)}` : '—');
    row('Disetujui WD I', dekanApproval ? `${dekanApproval.approver_name || 'Wakil Dekan I'} — ${fmt(dekanApproval.created_at)}` : '—');
    if (dekanApproval?.approval_reason) row('Catatan WD I', dekanApproval.approval_reason);
    row('Status Akhir', 'DISETUJUI', true);

    // ── TANDA TANGAN (posisi absolut agar tidak meluber ke hal. 2) ───────────
    const ttdY = pageH - 220;
    const ttdX = pageW - marginR - 170;
    doc.font('Helvetica').fontSize(9.5)
       .text(`Padang, ${fmt(dekanApproval?.created_at || new Date())}`, ttdX, ttdY, { width: 170, align: 'center' });
    doc.font('Helvetica').fontSize(9.5)
       .text('Wakil Dekan I,', ttdX, ttdY + 14, { width: 170, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(9.5)
       .text(dekanApproval?.approver_name || 'Wakil Dekan I FTI', ttdX, ttdY + 75, { width: 170, align: 'center', underline: true });
    doc.font('Helvetica').fontSize(9.5)
       .text('NIP. ......................', ttdX, ttdY + 89, { width: 170, align: 'center' });

    // ── FOOTER ───────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(7.5).fillColor('#888')
       .text('Dokumen ini diterbitkan secara elektronik oleh Sistem Informasi Fakultas Teknologi Informasi Universitas Andalas.', marginL, ttdY + 110, { width: contentW, align: 'center' });

    doc.end();
  } catch (err) { next(err); }
};

module.exports = { dashboard, exportPDF, profile };