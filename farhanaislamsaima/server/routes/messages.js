const express = require('express');
const {
  createMessage,
  getMessages
} = require('../controllers/messageController');

const router = express.Router();

router.get('/', getMessages);
router.post('/', createMessage);

module.exports = router;
