const express = require('express');
const router  = express.Router();

const apiSubmissionController = require('../../controllers/apiSubmissionController');
const { verifyJWT }     = require('../../middlewares/jwtAuth');
const { authorizeApi }  = require('../../middlewares/aclApi');
const { resignationUpload, handleUploadError } = require('../../lib/uploadConfig');
const { submissionRules, handleValidation }     = require('../../middlewares/validate');

const ALL_ROLES = ['mahasiswa', 'kaprodi', 'dekan', 'admin'];

// GET /api/submissions — daftar pengajuan, cakupan tergantung role token
router.get('/', verifyJWT, authorizeApi(ALL_ROLES), apiSubmissionController.index);

// GET /api/submissions/:id — detail pengajuan (ACL dicek di controller, bukan cuma role)
router.get('/:id', verifyJWT, authorizeApi(ALL_ROLES), apiSubmissionController.show);

// POST /api/submissions — buat draft baru (mahasiswa)
router.post('/',
  verifyJWT, authorizeApi(['mahasiswa']),
  resignationUpload, handleUploadError,
  submissionRules, handleValidation,
  apiSubmissionController.store
);

// PUT /api/submissions/:id — ubah draft (mahasiswa)
router.put('/:id',
  verifyJWT, authorizeApi(['mahasiswa']),
  resignationUpload, handleUploadError,
  submissionRules, handleValidation,
  apiSubmissionController.update
);

// DELETE /api/submissions/:id — hapus draft (mahasiswa)
router.delete('/:id', verifyJWT, authorizeApi(['mahasiswa']), apiSubmissionController.destroy);

// PATCH /api/submissions/:id/status — transisi status (mahasiswa/kaprodi/dekan, divalidasi di controller)
router.patch('/:id/status',
  verifyJWT, authorizeApi(['mahasiswa', 'kaprodi', 'dekan']),
  apiSubmissionController.updateStatus
);

module.exports = router;
