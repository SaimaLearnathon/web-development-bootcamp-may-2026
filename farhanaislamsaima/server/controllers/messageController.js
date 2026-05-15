const Message = require('../models/Message');
const {
  clearCache,
  getCache,
  setCache
} = require('../utils/cache');

async function getMessages(req, res) {
  const { conversationId } = req.query;

  if (!conversationId) {
    return res.status(400).json({ error: 'Conversation id is required' });
  }

  const cacheKey = `messages:${conversationId}`;
  const cachedMessages = getCache(cacheKey);

  if (cachedMessages) {
    return res.json(cachedMessages);
  }

  try {
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(100);

    setCache(cacheKey, messages, 15000);
    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Could not get messages' });
  }
}

async function createMessage(req, res) {
  const { conversationId, senderId, user, text, imageUrl } = req.body;

  if (!conversationId || !user || (!text && !imageUrl)) {
    return res.status(400).json({
      error: 'Conversation, name, and message content are required'
    });
  }

  try {
    const message = new Message({ conversationId, senderId, user, text, imageUrl });
    await message.save();
    clearCache(`messages:${conversationId}`);
    res.status(201).json(message);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Could not save message' });
  }
}

function clearMessageCache(conversationId) {
  clearCache(`messages:${conversationId}`);
}

module.exports = {
  clearMessageCache,
  getMessages,
  createMessage
};
