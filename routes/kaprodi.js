const express    = require('express');
const router     = express.Router();
const kaprodiController = require('../controllers/kaprodiController');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/dashboard', isAuthenticated, authorize(['kaprodi']), kaprodiController.dashboard);

module.exports = router;
