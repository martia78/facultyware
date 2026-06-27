const express = require('express');
const router  = express.Router();
const apiAuthController = require('../../controllers/apiAuthController');
const { verifyJWT } = require('../../middlewares/jwtAuth');

router.post('/login', apiAuthController.login);

router.post('/logout', verifyJWT, apiAuthController.logout);

router.get('/me', verifyJWT, apiAuthController.me);

module.exports = router;
