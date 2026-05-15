const Conversation = require('../models/Conversation');
const User = require('../models/User');
const {
  clearCache,
  getCache,
  setCache
} = require('../utils/cache');

function normalizeConversation(conversation, currentUserId) {
  const participants = conversation.participants.map((participant) => ({
    id: participant._id,
    name: participant.name,
    email: participant.email
  }));

  let name = conversation.name;

  if (conversation.type === 'direct') {
    const otherUser = participants.find(
      (participant) => participant.id.toString() !== currentUserId
    );
    name = otherUser ? otherUser.name : 'Direct chat';
  }

  return {
    id: conversation._id,
    name,
    type: conversation.type,
    participants,
    createdAt: conversation.createdAt
  };
}

async function getUsers(req, res) {
  const cacheKey = 'users:list';
  const cachedUsers = getCache(cacheKey);

  if (cachedUsers) {
    return res.json(cachedUsers);
  }

  try {
    const users = await User.find()
      .select('_id name email')
      .sort({ name: 1 });

    const cleanUsers = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email
    }));

    setCache(cacheKey, cleanUsers, 60000);
    res.json(cleanUsers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Could not get users' });
  }
}

async function getConversations(req, res) {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'User id is required' });
  }

  const cacheKey = `conversations:${userId}`;
  const cachedConversations = getCache(cacheKey);

  if (cachedConversations) {
    return res.json(cachedConversations);
  }

  try {
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name email')
      .sort({ updatedAt: -1 });

    const cleanConversations = conversations.map((conversation) => (
      normalizeConversation(conversation, userId)
    ));

    setCache(cacheKey, cleanConversations, 30000);
    res.json(cleanConversations);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Could not get conversations' });
  }
}

async function createConversation(req, res) {
  const { creatorId, participantIds, name, type } = req.body;

  if (!creatorId || !Array.isArray(participantIds) || !type) {
    return res.status(400).json({ message: 'Conversation details are required' });
  }

  const uniqueParticipantIds = [...new Set([creatorId, ...participantIds])];

  if (type === 'direct' && uniqueParticipantIds.length !== 2) {
    return res.status(400).json({ message: 'Direct chat needs exactly two users' });
  }

  if (type === 'group' && uniqueParticipantIds.length < 3) {
    return res.status(400).json({ message: 'Group chat needs at least three users' });
  }

  if (type === 'group' && !name?.trim()) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  try {
    if (type === 'direct') {
      const oldConversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: uniqueParticipantIds, $size: 2 }
      }).populate('participants', 'name email');

      if (oldConversation) {
        return res.status(200).json(normalizeConversation(oldConversation, creatorId));
      }
    }

    const conversation = new Conversation({
      name: type === 'group' ? name.trim() : '',
      type,
      participants: uniqueParticipantIds,
      createdBy: creatorId
    });

    await conversation.save();
    await conversation.populate('participants', 'name email');
    clearCache('conversations:');

    res.status(201).json(normalizeConversation(conversation, creatorId));
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Could not create conversation' });
  }
}

async function leaveConversation(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'User id is required' });
  }

  try {
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({ message: 'Only group chats can be left' });
    }

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === userId
    );

    if (!isParticipant) {
      return res.status(400).json({ message: 'You are not in this group' });
    }

    conversation.participants = conversation.participants.filter(
      (participantId) => participantId.toString() !== userId
    );

    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(id);
      clearCache('conversations:');
      return res.json({ message: 'Left group' });
    }

    await conversation.save();
    clearCache('conversations:');

    res.json({ message: 'Left group' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Could not leave group' });
  }
}

module.exports = {
  clearCache,
  createConversation,
  getConversations,
  getUsers,
  leaveConversation
};
