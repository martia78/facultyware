const express = require('express');
const router  = express.Router();

const apiSubmissionController = require('../../controllers/apiSubmissionController');
const { verifyJWT }     = require('../../middlewares/jwtAuth');
const { authorizeApi }  = require('../../middlewares/aclApi');
const { resignationUpload, handleUploadError } = require('../../lib/uploadConfig');
const { submissionRules, handleValidation }     = require('../../middlewares/validate');

const ALL_ROLES = ['mahasiswa', 'kaprodi', 'dekan', 'admin'];

router.get('/', verifyJWT, authorizeApi(ALL_ROLES), apiSubmissionController.index);

router.get('/:id', verifyJWT, authorizeApi(ALL_ROLES), apiSubmissionController.show);

router.post('/',
  verifyJWT, authorizeApi(['mahasiswa']),
  resignationUpload, handleUploadError,
  submissionRules, handleValidation,
  apiSubmissionController.store
);

router.put('/:id',
  verifyJWT, authorizeApi(['mahasiswa']),
  resignationUpload, handleUploadError,
  submissionRules, handleValidation,
  apiSubmissionController.update
);

router.delete('/:id', verifyJWT, authorizeApi(['mahasiswa']), apiSubmissionController.destroy);

router.patch('/:id/status',
  verifyJWT, authorizeApi(['mahasiswa', 'kaprodi', 'dekan']),
  apiSubmissionController.updateStatus
);

module.exports = router;
