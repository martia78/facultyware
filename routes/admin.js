const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/auth');

// Change '/dashboard' to '/'
router.get('/', isAuthenticated, adminController.getDashboard);

module.exports = router;