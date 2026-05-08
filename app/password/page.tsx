'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash, Loader2 } from 'lucide-react';

export default function PasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-muted">
            <Hash className="h-8 w-8 text-text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Antler</h1>
          <p className="mt-2 text-body text-text-secondary">
            Enter the password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-border-error bg-bg-error-subtle p-3 text-status-error-text">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="block text-label text-text-primary">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-md border border-border-subtle bg-bg-surface px-4 py-2.5 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring-accent focus:border-border-accent"
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-bg-accent-subtle hover:bg-bg-accent-subtle/90 text-body font-medium text-text-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 py-2.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
