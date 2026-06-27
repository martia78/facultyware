const express        = require('express');
const router         = express.Router();
const indexController = require('../controllers/indexController');
const { isAuthenticated, isGuest } = require('../middlewares/auth');

router.get('/login',    isGuest,         indexController.loginPage);
router.post('/login',   isGuest,         indexController.login);
router.get('/logout',   isAuthenticated, indexController.logout);
router.get('/dashboard', isAuthenticated, indexController.dashboard);

module.exports = router;
