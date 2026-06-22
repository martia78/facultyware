const express    = require('express');
const router     = express.Router();
const wd1Controller = require('../controllers/wd1Controller');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');

router.get('/', isAuthenticated, wd1Controller.getDashboard);

// WD1 Action Routes
router.post('/request/:id/approve', isAuthenticated, wd1Controller.approveRequest);
router.post('/request/:id/reject', isAuthenticated, wd1Controller.rejectRequest);

module.exports = router;