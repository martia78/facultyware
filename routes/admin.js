const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, authorize } = require('../middlewares/auth');

// Semua route admin wajib login dan harus ber-role 'admin'
router.use(isAuthenticated, authorize(['admin']));

// Change '/dashboard' to '/'
// router.get('/', isAuthenticated, adminController.getDashboard);
// GET /admin  &  GET /admin/dashboard
router.get('/',          adminController.getDashboard);
router.get('/dashboard', adminController.getDashboard);
 
// GET  /admin/users
router.get('/users',           adminController.getUsers);
 
// POST /admin/users/add
router.post('/users/add',      adminController.addUser);
 
// POST /admin/users/delete/:id
router.post('/users/delete/:id', adminController.deleteUser);
router.post('/users/reset-password/:id', adminController.resetPassword);
// REMOVE or COMMENT OUT the router.get('/students', ...) line
module.exports = router;