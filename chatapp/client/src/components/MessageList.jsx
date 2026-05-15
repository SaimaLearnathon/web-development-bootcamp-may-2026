function getInitial(name) {
  return name ? name.slice(0, 1).toUpperCase() : '?';
}

function getMessageTime(date) {
  if (!date) {
    return '';
  }

  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function MessageList({ messages, currentUser }) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-500">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isMine = message.user === currentUser.name;
        const time = getMessageTime(message.createdAt);

        return (
          <div
            key={message._id || message.createdAt}
            className={`flex items-end gap-2 ${
              isMine ? 'justify-end' : 'justify-start'
            }`}
          >
            {!isMine && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                {getInitial(message.user)}
              </div>
            )}

            <div
              className={`max-w-[75%] ${
                isMine ? 'items-end text-right' : 'items-start text-left'
              } flex flex-col`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium">{message.user}</span>
                {time && <span>{time}</span>}
              </div>

              <div
                className={`rounded-lg px-4 py-2 text-sm leading-6 shadow-sm ${
                  isMine
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {message.text}
              </div>
            </div>

            {isMine && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {getInitial(message.user)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;
