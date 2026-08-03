'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { getSignupMode } from '../lib/utils';

type Mode = 'login' | 'register';

const AuthPortal = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch the signup mode on mount.
  useEffect(() => {
    getSignupMode()
      .then((m) => setSignupOpen(m === 'open'))
      .catch(() => setSignupOpen(false));
  }, []);

  // If signup is closed and the user somehow toggled to register, go back to login.
  useEffect(() => {
    if (signupOpen === false && mode === 'register') {
      setMode('login');
    }
  }, [signupOpen, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);

    const supabase = createClient();

    try {
      if (mode === 'register') {
        // 1) Create the auth user (email + password). Supabase hashes the
        //    password — we never touch plaintext.
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (signUpError) throw signUpError;

        // 2) Ensure the profile row carries the chosen username. The DB trigger
        //    auto-creates a profile from the email; we overwrite with the
        //    user's explicit choice once we have a session/user id.
        const userId = data.user?.id;
        if (userId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ id: userId, username, display_name: username });
          if (profileError) throw profileError;
        }

        setMessage(
          'Registration submitted. Check your email to confirm your account (if confirmation is enabled), then sign in.',
        );
        setMode('login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // Signed in — go to the app.
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 border rounded-lg bg-white text-gray-900 shadow">
      <h2 className="text-xl font-semibold mb-4">
        {mode === 'login' ? 'Sign in' : 'Register'}
      </h2>

      {signupOpen === false && mode === 'register' && (
        <p className="text-sm text-red-600 mb-4">
          Self-registration is currently closed. Contact an administrator to
          request an account.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="username" className="block mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
          />
        </div>

        <div>
          <label htmlFor="password" className="block mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={busy || signupOpen === false}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        {mode === 'login' ? (
          signupOpen === false ? (
            <span>Registration is closed.</span>
          ) : (
            <>
              No account?{' '}
              <button
                className="text-blue-600 underline"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setMessage(null);
                }}
              >
                Register
              </button>
            </>
          )
        ) : (
          <>
            Already registered?{' '}
            <button
              className="text-blue-600 underline"
              onClick={() => {
                setMode('login');
                setError(null);
                setMessage(null);
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
};

export default AuthPortal;
