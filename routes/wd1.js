const express = require('express');
const router = express.Router();
const wd1Controller = require('../controllers/wd1Controller');
const { isAuthenticated, authorize } = require('../middlewares/auth');

// Semua route WD1 wajib login dan harus ber-role 'wd1'
router.use(isAuthenticated, authorize(['wd1']));

// 1. Catch the base URL and redirect to the dashboard
router.get('/', (req, res) => {
    res.redirect('/wd1/dashboard');
});

// 2. Catch the sidebar clicks
router.get('/dashboard', wd1Controller.getDashboard);
router.get('/profile',   wd1Controller.profile);
router.post('/profile/change-password', wd1Controller.changePassword);
router.get('/submissions', wd1Controller.getDashboard); 

// 3. The Action Routes (Updated to match Martia's frontend buttons!)
// POST /wd1/request/:id/approve
// POST /wd1/request/:id/reject
// Hanya POST — action tidak boleh ditrigger via GET/link biasa (CSRF-safe)
router.post('/request/:id/approve', wd1Controller.approveRequest);
router.post('/request/:id/reject',  wd1Controller.rejectRequest);

module.exports = router;