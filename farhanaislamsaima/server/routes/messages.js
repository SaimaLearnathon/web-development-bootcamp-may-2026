const express = require('express');
const Message = require('../models/Message');

const router = express.Router();

router.get('/', async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 }).limit(100);
  res.json(messages);
});

router.post('/', async (req, res) => {
  const { user, text } = req.body;
  if (!user || !text) {
    return res.status(400).json({ error: 'User and text are required' });
  }

  const message = new Message({ user, text });
  await message.save();
  res.status(201).json(message);
});

module.exports = router;
