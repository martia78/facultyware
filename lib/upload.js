const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR  = process.env.UPLOAD_DIR || 'uploads/resignation-documents';
const MAX_SIZE    = parseInt(process.env.UPLOAD_MAX_SIZE) || 2 * 1024 * 1024; // 2 MB

// Pastikan folder upload ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext    = path.extname(file.originalname).toLowerCase();
    cb(null, `resignation-${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Hanya file PDF yang diizinkan'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = upload;
