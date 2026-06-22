const express    = require('express');
const router     = express.Router();
const wd1Controller = require('../controllers/wd1Controller');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/', isAuthenticated, wd1Controller.getDashboard);

module.exports = router;