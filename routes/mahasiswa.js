const express    = require('express');
const router     = express.Router();
const mahasiswaController = require('../controllers/mahasiswaController');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/', isAuthenticated, authorize(['mahasiswa']), mahasiswaController.getDashboard);

module.exports = router;