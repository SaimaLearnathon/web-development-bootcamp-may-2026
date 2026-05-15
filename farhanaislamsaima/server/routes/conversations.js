const express = require('express');
const {
  createConversation,
  getConversations,
  getUsers,
  leaveConversation
} = require('../controllers/conversationController');

const router = express.Router();

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/users', getUsers);
router.patch('/:id/leave', leaveConversation);

module.exports = router;
