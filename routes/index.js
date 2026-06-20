const express        = require('express');
const router         = express.Router();
const indexController = require('../controllers/indexController');
const { isAuthenticated, isGuest } = require('../middlewares/auth');

// Root
router.get('/', indexController.index);

// Auth
router.get('/login',    isGuest,         indexController.loginPage);
router.post('/login',   isGuest,         indexController.login);
router.get('/logout',   isAuthenticated, indexController.logout);

// Dashboard router (redirect sesuai role)
router.get('/dashboard', isAuthenticated, indexController.dashboard);

module.exports = router;
