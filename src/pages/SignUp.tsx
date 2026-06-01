import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Lock, UserRound } from 'lucide-react';

interface Props {
  onSignUp: (username: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; message?: string }>;
}

export default function SignUp({ onSignUp }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    const result = await onSignUp(username, password, rememberMe);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Could not create account. Username may already be in use.');
      return;
    }

    setSuccessMessage(result.message || 'Account request submitted. An admin must approve your access before you can sign in.');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-800 to-emerald-700 px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-green-200/30 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Leaf className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-green-900">Create Account</h1>
            <p className="mt-1 text-sm text-gray-600">Sign up for access to the farm dashboard. New accounts require admin approval.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="form-input auth-input"
                  placeholder="Choose a username"
                  autoComplete="username"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="form-input auth-input"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="form-input auth-input"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
              />
              Keep me signed in on this device
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            {successMessage && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{successMessage}</div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting Request...' : 'Request Access'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-700">
            Already have an account?{' '}
            <Link to="/signin" className="font-semibold text-green-800 hover:text-green-900 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
