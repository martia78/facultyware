const { validationResult, body } = require('express-validator');

// Handler: kumpulkan error validasi dan kirim respons sesuai tipe request
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const errs = errors.array();

  // Untuk API request — kembalikan JSON
  if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
    return res.status(422).json({
      success: false,
      message: 'Validasi gagal.',
      errors: errs.map(e => ({ field: e.path, msg: e.msg })),
    });
  }

  // Untuk web request — simpan di req.validationErrors agar controller bisa render ulang
  req.validationErrors = errs;
  next();
};

// Rules: Login
const loginRules = [
  body('username').trim().notEmpty().withMessage('Username wajib diisi.'),
  body('password').notEmpty().withMessage('Password wajib diisi.'),
];

// Rules: Submission (server-side) — sesuai dokumen fitur "Pengajuan Pengunduran Diri"
// (Validasi Pengajuan §"Data Wajib") dan KETENTUAN_PROJECT §8 (wajib pakai express-validator).
const submissionRules = [
  body('reason')
    .trim()
    .notEmpty().withMessage('Alasan pengunduran diri wajib diisi.')
    .isLength({ max: 255 }).withMessage('Alasan pengunduran diri.'),
  body('address')
    .trim()
    .notEmpty().withMessage('Alamat wajib diisi.')
    .isLength({ max: 500 }).withMessage('Alamat maksimal 500 karakter.'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Nomor HP wajib diisi.')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Format nomor HP tidak valid.'),
  body('gpa')
    .trim()
    .notEmpty().withMessage('IPK saat ini wajib diisi.')
    .bail()
    .isFloat({ min: 0, max: 4 }).withMessage('IPK harus berupa angka antara 0.00 - 4.00.'),
  body('total_sks')
    .trim()
    .notEmpty().withMessage('Jumlah SKS saat ini wajib diisi.')
    .bail()
    .isInt({ min: 0 }).withMessage('Jumlah SKS harus berupa angka positif.'),
];

// Rules: User create/update
const userCreateRules = [
  body('username').trim().notEmpty().withMessage('Username wajib diisi.')
    .isLength({ min: 3, max: 50 }).withMessage('Username 3–50 karakter.')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username hanya boleh huruf, angka, titik, underscore, atau strip.'),
  body('name').trim().notEmpty().withMessage('Nama wajib diisi.')
    .isLength({ min: 2, max: 100 }).withMessage('Nama 2–100 karakter.'),
  body('email').optional({ checkFalsy: true })
    .isEmail().withMessage('Format email tidak valid.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password wajib diisi.')
    .isLength({ min: 6 }).withMessage('Password minimal 6 karakter.'),
  body('role_id').notEmpty().withMessage('Role wajib dipilih.'),
];

const userUpdateRules = [
  body('name').trim().notEmpty().withMessage('Nama wajib diisi.')
    .isLength({ min: 2, max: 100 }).withMessage('Nama 2–100 karakter.'),
  body('email').optional({ checkFalsy: true })
    .isEmail().withMessage('Format email tidak valid.').normalizeEmail(),
  body('password').optional({ checkFalsy: true })
    .isLength({ min: 6 }).withMessage('Password minimal 6 karakter.'),
];

// Rules: Persetujuan (catatan penolakan wajib)
const rejectionRules = [
  body('note').trim().notEmpty().withMessage('Alasan penolakan wajib diisi.')
    .isLength({ min: 3 }).withMessage('Alasan penolakan minimal 3 karakter.'),
];

module.exports = {
  handleValidation,
  loginRules,
  submissionRules,
  userCreateRules,
  userUpdateRules,
  rejectionRules,
};
