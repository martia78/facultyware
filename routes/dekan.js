const express    = require('express');
const router     = express.Router();
const dekanController = require('../controllers/dekanController');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/', isAuthenticated, dekanController.getDashboard);

module.exports = router;