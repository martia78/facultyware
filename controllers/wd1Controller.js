const pool = require('../lib/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 1. DASHBOARD LOGIC (Filtered for Kaprodi Approved)
exports.getDashboard = async (req, res) => {
    try {
        const [requests] = await pool.query(`
            SELECT sr.id, sr.request_nunmber AS no_surat, sr.status, sr.requested_at, s.name, s.regno
            FROM student_requests sr
            JOIN students s ON sr.requested_by = s.id
            WHERE sr.request_type = 'Resignation' 
              AND sr.status = 'Approved_Kaprodi' 
            ORDER BY sr.requested_at DESC
        `);
        
        res.render('wd1/dashboard', {
            pageTitle: 'Inbox Pengesahan WD1',
            role: req.session.role,
            user: req.session,
            requests: requests
        });
    } catch (error) {
        console.error("WD1 Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};

// 2. APPROVE & GENERATE PDF LOGIC
exports.approveRequest = async (req, res) => {
    try {
        const requestId = req.params.id;

        const [requestData] = await pool.query(`
            SELECT sr.request_nunmber, sr.requested_at, s.name, s.regno, s.status
            FROM student_requests sr
            JOIN students s ON sr.requested_by = s.id
            WHERE sr.id = ?
        `, [requestId]);

        if (requestData.length === 0) {
            return res.status(404).send("Data tidak ditemukan.");
        }

        const data = requestData[0];
        
        // 1. AUTO-CREATE FOLDER (Prevents crashes if the folder is missing)
        const dirPath = path.join(__dirname, '../public/sk_docs');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const doc = new PDFDocument({ margin: 50 });
        const fileName = `${data.request_nunmber}.pdf`;
        const filePath = path.join(dirPath, fileName);
        
        // 2. TIE THE STREAM TO A VARIABLE SO WE CAN TRACK IT
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // --- DRAW PDF ---
        doc.fontSize(16).font('Helvetica-Bold').text('UNIVERSITAS ANDALAS', { align: 'center' });
        doc.fontSize(14).text('FAKULTAS TEKNOLOGI INFORMASI', { align: 'center' });
        doc.moveDown();
        doc.lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        doc.fontSize(14).font('Helvetica-Bold').text('SURAT KEPUTUSAN PENGUNDURAN DIRI', { align: 'center', underline: true });
        doc.fontSize(12).font('Helvetica').text(`Nomor: ${data.request_nunmber}`, { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12).font('Helvetica').text('Dengan ini, Wakil Dekan 1 Fakultas Teknologi Informasi Universitas Andalas menerangkan bahwa mahasiswa di bawah ini:', { align: 'justify' });
        doc.moveDown();
        
        doc.text(`Nama               : ${data.name}`);
        doc.text(`NIM                  : ${data.regno}`);
        doc.text(`Tanggal Masuk  : ${new Date(data.requested_at).toLocaleDateString('id-ID')}`);
        doc.moveDown();

        doc.text('Telah disetujui permohonan pengunduran dirinya secara resmi dari Universitas Andalas. Segala hak dan kewajiban akademik yang bersangkutan dinyatakan telah selesai.', { align: 'justify' });
        doc.moveDown(3);

        doc.text('Padang, ' + new Date().toLocaleDateString('id-ID'), { align: 'right' });
        doc.text('Wakil Dekan 1,', { align: 'right' });
        doc.moveDown(4);
        doc.font('Helvetica-Bold').text('Dr. Eng. Budi Rahmadya, M.Eng', { align: 'right' });
        doc.font('Helvetica').text('NIP. 197801012005011001', { align: 'right' });

        // Tell the document we are done drawing
        doc.end();

        // 3. WAIT FOR THE FILE TO BE 100% SAVED BEFORE REDIRECTING
        writeStream.on('finish', async () => {
            await pool.query("UPDATE student_requests SET status = 'Approved' WHERE id = ?", [requestId]);
            res.redirect('/wd1');
        });

        // Catch any background file errors so it doesn't crash the server
        writeStream.on('error', (err) => {
            console.error("File Write Error:", err);
            if (!res.headersSent) res.status(500).send("Gagal menyimpan PDF.");
        });

    } catch (error) {
        console.error("Error approving request:", error);
        if (!res.headersSent) res.status(500).send("Gagal menyetujui dokumen.");
    }
};

// 3. REJECT LOGIC
// POST /wd1/request/:id/reject
exports.rejectRequest = async (req, res, next) => {
  try {
    const requestId = req.params.id;
    
    // 1. Update the database status to 'Rejected'
    // (Assuming you have a submission model or database handler imported)
    await db.query(
      "UPDATE student_requests SET status = 'Rejected', updated_at = NOW() WHERE id = ?", 
      [requestId]
    );

    // 2. Optional: Add a log into an approvals/history table if Martia built one
    await db.query(
      "INSERT INTO student_request_history (student_request_id, action, notes, created_at) VALUES (?, 'Rejected', 'Ditolak oleh Wakil Dekan I', NOW())",
      [requestId]
    ).catch(e => { /* Ignore if history table structural names differ */ });

    // 3. Send a success flash notification to the dashboard screen
    req.session.flash = { 
      type: 'success', 
      message: `Permohonan #${requestId} berhasil ditolak.` 
    };

    // 4. Redirect cleanly straight back to the dashboard page
    res.redirect('/wd1/dashboard');
  } catch (err) {
    next(err);
  }
};