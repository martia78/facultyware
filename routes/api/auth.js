const express = require('express');
const router  = express.Router();
const apiAuthController = require('../../controllers/apiAuthController');
const { verifyJWT } = require('../../middlewares/jwtAuth');

// POST /api/auth/login — publik, tidak butuh token
router.post('/login', apiAuthController.login);

// POST /api/auth/logout — butuh token valid
router.post('/logout', verifyJWT, apiAuthController.logout);

// GET /api/auth/me — cek identitas token saat ini (memudahkan testing di Postman)
router.get('/me', verifyJWT, apiAuthController.me);

module.exports = router;
