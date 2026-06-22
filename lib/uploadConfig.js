const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../uploads/resignation-documents');

// Pastikan folder ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    // Nama file unik & tidak pernah overwrite file lain: prefix NIM (jika ada),
    // nama asli (disanitasi), timestamp, dan angka acak.
    const ext      = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const unique   = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${baseName}-${unique}${ext}`);
  },
});

// Sesuai KETENTUAN_PROJECT §9 (Upload File) & dokumen fitur: PDF only, maks 5 MB.
const MAX_APPLICATION_LETTER_SIZE = 5 * 1024 * 1024; // 5 MB

function fileFilter(_req, file, cb) {
  const isPdf = file.mimetype === 'application/pdf';
  if (file.fieldname === 'application_letter') {
    if (isPdf) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Surat Permohonan hanya boleh berformat PDF.'));
  }
  cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Field file tidak dikenali.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_APPLICATION_LETTER_SIZE,
  },
});

/**
 * Middleware siap pakai — satu field saja: 'application_letter' (Surat Permohonan).
 */
const resignationUpload = upload.fields([
  { name: 'application_letter', maxCount: 1 },
]);

/**
 * Error handler untuk multer — ubah error teknis jadi pesan ramah pengguna.
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    let message = 'Terjadi kesalahan saat mengunggah file.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Ukuran file melebihi batas maksimal 5 MB.';
    } else if (err.message) {
      message = err.message;
    }
    req.uploadError = message;
    return next();
  }
  next(err);
}

module.exports = { resignationUpload, handleUploadError, UPLOAD_DIR, MAX_APPLICATION_LETTER_SIZE };
