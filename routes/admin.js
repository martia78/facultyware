const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/auth');

// Change '/dashboard' to '/'
router.get('/', isAuthenticated, adminController.getDashboard);
router.get('/dashboard', isAuthenticated, adminController.getDashboard);
router.get('/users', isAuthenticated, adminController.getUsers);
router.post('/users/add', isAuthenticated, adminController.addUser);
router.post('/users/delete/:id', isAuthenticated, adminController.deleteUser);
// REMOVE or COMMENT OUT the router.get('/students', ...) line
module.exports = router;