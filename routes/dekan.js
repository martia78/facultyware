const express    = require('express');
const router     = express.Router();
const dekanController = require('../controllers/dekanController');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/dashboard', isAuthenticated, authorize(['dekan']), dekanController.dashboard);

module.exports = router;
