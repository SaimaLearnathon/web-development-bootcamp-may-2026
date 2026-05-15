function ChatHeader({ status, user, onLogout }) {
  return (
    <header className="navbar rounded-lg border border-slate-200 bg-white px-4 shadow-sm">
      <div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Chat Room</h1>
          <p className="text-sm text-slate-500">{status}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="avatar placeholder">
          <div className="w-9 rounded-full bg-primary text-primary-content">
            <span>{user.name.slice(0, 1).toUpperCase()}</span>
          </div>
        </div>

        <div className="hidden sm:block">
          <p className="text-sm font-medium text-slate-800">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>

        <button
          className="btn btn-sm rounded-md border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          type="button"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export default ChatHeader;
