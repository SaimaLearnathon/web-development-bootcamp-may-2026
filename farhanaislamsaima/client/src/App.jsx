import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

function App() {
  const [user, setUser] = useState('Guest');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    fetch('/api/messages')
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch(console.error);

    socket.on('receiveMessage', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off('receiveMessage');
    };
  }, []);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    const newMessage = { user, text };
    socket.emit('sendMessage', newMessage);
    setText('');
  };

  return (
    <div className="app-shell">
      <header>
        <h1>MERN Live Chat</h1>
        <label>
          Your name
          <input value={user} onChange={(e) => setUser(e.target.value)} />
        </label>
      </header>

      <section className="chat-window">
        {messages.map((message) => (
          <div key={message._id || message.createdAt} className="message-item">
            <strong>{message.user}:</strong>
            <span>{message.text}</span>
          </div>
        ))}
      </section>

      <form className="chat-form" onSubmit={sendMessage}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default App;
