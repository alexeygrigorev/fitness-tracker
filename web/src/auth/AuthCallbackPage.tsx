import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';

export default function AuthCallbackPage() {
  const { completeSharedLogin } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    const state = query.get('state');
    if (!code || !state) {
      setError(query.get('error_description') || 'The sign-in response was incomplete.');
      return;
    }
    completeSharedLogin(code, state).catch((reason) =>
      setError(reason instanceof Error ? reason.message : 'Sign-in failed'));
  }, [completeSharedLogin]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Fitness Tracker</h1>
        {error ? (
          <><p role="alert" className="text-red-700 dark:text-red-300 mb-4">{error}</p><a href="/login" className="text-blue-600 dark:text-blue-400">Try again</a></>
        ) : (
          <><div className="mx-auto animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /><p className="mt-4 text-gray-600 dark:text-gray-300">Completing sign-in…</p></>
        )}
      </div>
    </main>
  );
}
