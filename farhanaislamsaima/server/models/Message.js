const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  text: { type: String, trim: true },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);
