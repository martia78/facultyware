const express = require('express');
const router = express.Router();
const b16Controller = require('../controllers/b16Controller');

router.get('/kaprodi', b16Controller.kaprodiInbox);                  // Task 1
router.get('/request/:id', b16Controller.requestDetail);             // Task 2
router.post('/request/:id/kaprodi-review', b16Controller.kaprodiSubmit); // Task 3
router.get('/wd1', b16Controller.wd1Inbox);                          // Task 4
router.post('/request/:id/wd1-review', b16Controller.wd1Submit);     // Task 5 & 6
router.get('/radar', b16Controller.globalRadar);                     // Task 8

module.exports = router;