const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, authorize } = require('../middlewares/auth');

router.use(isAuthenticated, authorize(['admin']));

router.get('/',          adminController.getDashboard);
router.get('/dashboard', adminController.getDashboard);
 
router.get('/users',           adminController.getUsers);
router.post('/users/add',      adminController.addUser);
router.post('/users/delete/:id', adminController.deleteUser);
router.post('/users/reset-password/:id', adminController.resetPassword);

module.exports = router;