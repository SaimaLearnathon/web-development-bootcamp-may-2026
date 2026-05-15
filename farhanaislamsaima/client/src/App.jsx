import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import apiClient from './api/apiClient';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import {
  getSavedUser,
  removeUser,
  saveUser
} from './utils/storage';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
const socket = io(socketUrl);

function App() {
  const [user, setUser] = useState(getSavedUser);
  const [mode, setMode] = useState('login');
  const [authMessage, setAuthMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    if (!user) {
      return;
    }

    setStatus(socket.connected ? 'Connected' : 'Connecting...');

    async function loadMessages() {
      try {
        const res = await apiClient.get('/messages');
        setMessages(res.data);
      } catch (err) {
        console.log(err);
        setStatus('Could not load old messages');
      }
    }

    loadMessages();

    socket.on('connect', () => {
      setStatus('Connected');
    });

    socket.on('receiveMessage', (msg) => {
      setMessages((oldMessages) => [...oldMessages, msg]);
    });

    socket.on('disconnect', () => {
      setStatus('Disconnected');
    });

    return () => {
      socket.off('connect');
      socket.off('receiveMessage');
      socket.off('disconnect');
    };
  }, [user]);

  async function handleAuth(formData) {
    const url = mode === 'login' ? '/auth/login' : '/auth/register';

    setAuthMessage('');

    try {
      const res = await apiClient.post(url, formData);

      saveUser(res.data.user);
      setUser(res.data.user);
    } catch (err) {
      const message = err.response?.data?.message || 'Server is not responding';
      setAuthMessage(message);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setAuthMessage('');
  }

  function logout() {
    removeUser();
    setUser(null);
    setMessages([]);
  }

  function sendMessage(text) {
    socket.emit('sendMessage', {
      user: user.name,
      text
    });
  }

  if (!user) {
    return (
      <AuthPage
        mode={mode}
        message={authMessage}
        onModeChange={changeMode}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <ChatPage
      messages={messages}
      status={status}
      user={user}
      onLogout={logout}
      onSendMessage={sendMessage}
    />
  );
}

export default App;
