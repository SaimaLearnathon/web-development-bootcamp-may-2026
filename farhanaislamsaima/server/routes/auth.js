const express = require('express');
const {
  googleLogin,
  loginUser,
  registerUser
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);

module.exports = router;
