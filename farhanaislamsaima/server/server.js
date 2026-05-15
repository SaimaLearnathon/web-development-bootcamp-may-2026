require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');
const ChatMessage = require('./models/Message');
const { clearMessageCache } = require('./controllers/messageController');

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  }
});

app.use(cors({
  origin: CLIENT_URL
}));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', chatRoutes);

app.get('/', (req, res) => {
  res.send('Chat server is running');
});

io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  socket.on('joinConversation', (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);
    }
  });

  socket.on('leaveConversation', (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);
    }
  });

  socket.on('typing', (payload) => {
    if (payload?.conversationId) {
      socket.to(payload.conversationId).emit('typing', payload);
    }
  });

  socket.on('stopTyping', (payload) => {
    if (payload?.conversationId) {
      socket.to(payload.conversationId).emit('stopTyping', payload);
    }
  });

  socket.on('sendMessage', async (payload) => {
    try {
      const message = new ChatMessage(payload);
      await message.save();
      clearMessageCache(payload.conversationId);
      io.to(payload.conversationId).emit('receiveMessage', message);
      console.log('message:', payload.text);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatdb';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
