const express    = require('express');
const router     = express.Router();
const wd1Controller = require('../controllers/wd1Controller');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/dashboard', isAuthenticated, authorize(['wakil dekan 1']), wd1Controller.dashboard);

module.exports = router;
