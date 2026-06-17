const express = require('express');
const router  = express.Router();

router.use('/auth', require('./auth'));

// Akan ditambahkan pada fase berikutnya:
// router.use('/submissions', require('./submissions'));

module.exports = router;
