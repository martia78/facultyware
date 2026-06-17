const express    = require('express');
const router     = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/dashboard', isAuthenticated, authorize(['admin']), adminController.dashboard);

module.exports = router;
