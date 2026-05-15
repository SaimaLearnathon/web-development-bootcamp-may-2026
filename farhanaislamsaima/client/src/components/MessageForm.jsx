import { useState } from 'react';

function MessageForm({ onSend }) {
  const [text, setText] = useState('');

  function handleSubmit(e) {
    e.preventDefault();

    if (text.trim() === '') {
      return;
    }

    onSend(text);
    setText('');
  }

  return (
    <form
      className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
      onSubmit={handleSubmit}
    >
      <input
        className="input input-bordered min-w-0 flex-1 rounded-md border-slate-300 bg-slate-50 text-slate-900"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message"
      />
      <button className="btn btn-primary rounded-md px-6" type="submit">
        Send
      </button>
    </form>
  );
}

export default MessageForm;
