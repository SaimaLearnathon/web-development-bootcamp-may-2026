const Message = require('../models/Message');

async function getMessages(req, res) {
  try {
    const messages = await Message.find().sort({ createdAt: 1 }).limit(100);
    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Could not get messages' });
  }
}

async function createMessage(req, res) {
  const { user, text } = req.body;

  if (!user || !text) {
    return res.status(400).json({
      error: 'Name and message are required'
    });
  }

  try {
    const message = new Message({ user, text });
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Could not save message' });
  }
}

module.exports = {
  getMessages,
  createMessage
};
