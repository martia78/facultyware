const express = require('express');
const router = express.Router();
const wd1Controller = require('../controllers/wd1Controller');

// 1. Catch the base URL and redirect to the dashboard
router.get('/', (req, res) => {
    res.redirect('/wd1/dashboard');
});

// 2. Catch the sidebar clicks
router.get('/dashboard', wd1Controller.getDashboard);
router.get('/submissions', wd1Controller.getDashboard); 

// 3. The Action Routes (Updated to match Martia's frontend buttons!)
// We use .all to catch it whether she built the button as a GET link or a POST form
router.all('/request/:id/approve', wd1Controller.approveRequest);
router.all('/request/:id/reject', wd1Controller.rejectRequest);

module.exports = router;