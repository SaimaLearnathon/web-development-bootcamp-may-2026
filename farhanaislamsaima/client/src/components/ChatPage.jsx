import ChatHeader from './ChatHeader';
import MessageForm from './MessageForm';
import MessageList from './MessageList';

function ChatPage({ messages, status, user, onLogout, onSendMessage }) {
  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-slate-800">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-4xl grid-rows-[auto_1fr_auto] gap-4">
        <ChatHeader status={status} user={user} onLogout={onLogout} />

        <section className="overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <MessageList messages={messages} currentUser={user} />
        </section>

        <MessageForm onSend={onSendMessage} />
      </div>
    </main>
  );
}

export default ChatPage;
