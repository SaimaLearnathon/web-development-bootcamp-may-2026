import { useState } from 'react';

function AuthPage({ mode, message, onModeChange, onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isLogin = mode === 'login';

  function handleSubmit(e) {
    e.preventDefault();

    onSubmit({
      name,
      email,
      password
    });
  }

  function switchMode(nextMode) {
    setPassword('');
    onModeChange(nextMode);
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-800">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-5xl items-center gap-10 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <p className="mb-3 text-sm font-semibold text-blue-600">MERN Chat</p>
          <h1 className="max-w-xl text-5xl font-bold leading-tight text-slate-900">
            Talk with your friends in one simple room.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
            This chat app keeps the layout clean and the code easy to follow.
            Register once, log in, and start sending messages.
          </p>
        </section>

        <section className="w-full rounded-lg border border-slate-200 bg-white shadow-md">
          <div className="p-7 sm:p-8">
            <div>
              <p className="mb-1 text-sm text-blue-600">Welcome</p>
              <h2 className="text-3xl font-semibold leading-tight text-slate-900">
                {isLogin ? 'Login' : 'Create account'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {isLogin
                  ? 'Enter your email and password to open the chat.'
                  : 'Create a small account before joining the chat.'}
              </p>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              {!isLogin && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Name
                  </span>
                  <input
                    className="input input-bordered w-full rounded-md border-slate-300 bg-slate-50 text-slate-900"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </span>
                <input
                  className="input input-bordered w-full rounded-md border-slate-300 bg-slate-50 text-slate-900"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </span>
                <input
                  className="input input-bordered w-full rounded-md border-slate-300 bg-slate-50 text-slate-900"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>

              {message && (
                <div className="alert alert-error rounded-md py-3 text-sm">
                  {message}
                </div>
              )}

              <button className="btn btn-primary mt-2 w-full rounded-md" type="submit">
                {isLogin ? 'Login' : 'Register'}
              </button>
            </form>

            <div className="divider my-5 text-xs">or</div>

            <div className="text-center text-sm text-slate-500">
              {isLogin ? 'Need an account?' : 'Already registered?'}
              <button
                className="btn btn-link btn-sm px-2 text-blue-600"
                type="button"
                onClick={() => switchMode(isLogin ? 'register' : 'login')}
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default AuthPage;
