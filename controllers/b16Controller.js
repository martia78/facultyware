const B16Model = require('../models/b16Model');
const nodemailer = require('nodemailer');

// Task 7: Production Email Engine (Uses real environment variables for deployment)
const sendLiveNotification = async (targetEmail, studentName, title, newStatus, notes) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS  
            }
        });

        await transporter.sendMail({
            from: `"Layanan Akademik UNAND" <${process.env.EMAIL_USER}>`,
            to: targetEmail,
            subject: `Update Alur Pengajuan: ${newStatus}`,
            html: `
                <h3>Yth. ${studentName},</h3>
                <p>Status pengajuan dokumen berkas Anda mengenai <b>"${title}"</b> telah mengalami perubahan.</p>
                <p><strong>Status Terbaru:</strong> <span style="color: green; font-weight: bold;">${newStatus}</span></p>
                <p><strong>Catatan Pemeriksa:</strong> ${notes || '-'}</p>
                <hr>
                <p><small>Sistem Informasi Akademik Kelompok B16 UNAND.</small></p>
            `
        });
        console.log(`Live email sent to ${targetEmail}`);
    } catch (err) {
        console.error('Nodemailer Error: ', err.message);
    }
};

// Task 1: Render Kaprodi Inbox Feature Page
exports.kaprodiInbox = async (req, res) => {
    const search = req.query.search || '';
    const requests = await B16Model.getPendingKaprodi(search);
    res.render('b16/kaprodi_inbox', { requests, search });
};

// Task 2: Render Isolated Request Details Page
exports.requestDetail = async (req, res) => {
    const request = await B16Model.getById(req.params.id);
    if (!request) return res.status(404).send('Berkas tidak ditemukan');
    res.render('b16/request_detail', { request });
};

// Task 3: Handle Kaprodi Decision Action
exports.kaprodiSubmit = async (req, res) => {
    const { id } = req.params;
    const { action, notes } = req.body;
    const finalStatus = action === 'Setuju' ? 'Disetujui Kaprodi' : 'Ditolak';

    const request = await B16Model.getById(id);
    await B16Model.updateKaprodiReview(id, finalStatus, notes);

    // Trigger Task 7
    await sendLiveNotification(request.student_email, request.student_name, request.title, finalStatus, notes);
    res.redirect('/b16/kaprodi');
};

// Task 4: Render WD1 Review Queue Feature Page
exports.wd1Inbox = async (req, res) => {
    const requests = await B16Model.getApprovedByKaprodi();
    res.render('b16/wd1_inbox', { requests });
};

// Task 5 & 6: Handle WD1 Final Decision & Generate Official Decree Document String
exports.wd1Submit = async (req, res) => {
    const { id } = req.params;
    const { action, notes } = req.body;
    
    let finalStatus = 'Ditolak';
    let generatedSK = null;

    if (action === 'Setuju') {
        finalStatus = 'Disetujui WD1 (Selesai)';
        // Task 6 Engine Requirement
        generatedSK = `SK/UNAND/FISI/2026/00${id}`;
    }

    const request = await B16Model.getById(id);
    await B16Model.updateWD1Review(id, finalStatus, notes, generatedSK);

    // Trigger Task 7
    await sendLiveNotification(request.student_email, request.student_name, request.title, finalStatus, notes);
    res.redirect('/b16/wd1');
};

// Task 8: Dedicated Multi-Criteria Global Search Radar Page
exports.globalRadar = async (req, res) => {
    const search = req.query.search || '';
    const status = req.query.status || '';
    const records = await B16Model.globalSearch(search, status);
    res.render('b16/global_radar', { records, search, status });
};