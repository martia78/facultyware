const express    = require('express');
const router     = express.Router();
const kaprodiController = require('../controllers/kaprodiController');
const { isAuthenticated } = require('../middlewares/auth');
const { authorize }       = require('../middlewares/acl');
const { rejectionRules, handleValidation } = require('../middlewares/validate');

const isKaprodi = [isAuthenticated, authorize(['kaprodi'])];

// Redirect /kaprodi (tanpa sub-halaman) ke dashboard, bukan 404
router.get('/', (req, res) => res.redirect('/kaprodi/dashboard'));

router.get('/dashboard', ...isKaprodi, kaprodiController.dashboard);

router.get('/submissions',                ...isKaprodi, kaprodiController.index);
router.get('/submissions/:id',            ...isKaprodi, kaprodiController.show);
router.get('/submissions/:id/document',   ...isKaprodi, kaprodiController.viewDocument);
router.post('/submissions/:id/approve',   ...isKaprodi, kaprodiController.approve);
router.post('/submissions/:id/reject',    ...isKaprodi, rejectionRules, handleValidation, kaprodiController.reject);

module.exports = router;