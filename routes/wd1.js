const express = require('express');
const router = express.Router();
const wd1Controller = require('../controllers/wd1Controller');
const { isAuthenticated, authorize } = require('../middlewares/auth');

router.use(isAuthenticated, authorize(['wd1']));

router.get('/', (req, res) => {
    res.redirect('/wd1/dashboard');
});

router.get('/dashboard', wd1Controller.getDashboard);
router.get('/profile',   wd1Controller.profile);
router.post('/profile/change-password', wd1Controller.changePassword);
router.get('/submissions', wd1Controller.getDashboard); 

router.post('/request/:id/approve', wd1Controller.approveRequest);
router.post('/request/:id/reject',  wd1Controller.rejectRequest);

module.exports = router;