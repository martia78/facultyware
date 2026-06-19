const express    = require('express');
const router     = express.Router();
const mahasiswaController  = require('../controllers/mahasiswaController');
const submissionController = require('../controllers/submissionController');
const { isAuthenticated }  = require('../middlewares/auth');
const { authorize }        = require('../middlewares/acl');
const { resignationUpload, handleUploadError } = require('../lib/uploadConfig');
const { submissionRules, handleValidation }     = require('../middlewares/validate');

const isMahasiswa = [isAuthenticated, authorize(['mahasiswa'])];

router.get('/dashboard', ...isMahasiswa, mahasiswaController.dashboard);
router.get('/profile',   ...isMahasiswa, mahasiswaController.profile);

router.get('/submissions',          ...isMahasiswa, submissionController.index);
router.get('/submissions/create',   ...isMahasiswa, submissionController.createForm);
router.post('/submissions',         ...isMahasiswa, resignationUpload, handleUploadError, submissionRules, handleValidation, submissionController.store);
router.get('/submissions/:id',      ...isMahasiswa, submissionController.show);
router.get('/submissions/:id/edit', ...isMahasiswa, submissionController.editForm);
router.post('/submissions/:id',     ...isMahasiswa, resignationUpload, handleUploadError, submissionRules, handleValidation, submissionController.update);
router.post('/submissions/:id/submit',  ...isMahasiswa, submissionController.submit);
router.post('/submissions/:id/delete',  ...isMahasiswa, submissionController.destroy);
router.get('/submissions/:id/document', ...isMahasiswa, submissionController.viewDocument);
router.get('/submissions/:id/pdf',      ...isMahasiswa, mahasiswaController.exportPDF);

module.exports = router;
