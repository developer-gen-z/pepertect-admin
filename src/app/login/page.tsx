'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useAuthHydration } from '@/stores/useAuthStore';
import { useTheme } from 'next-themes';
import { Zap, Sun, Moon, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useMounted } from '@/hooks/use-mounted';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const { login, isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydration();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // Mounted check — `theme` is undefined on first paint, which caused the
  // wrong toggle icon to flash for dark-theme users.
  const mounted = useMounted();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('reason=expired')) {
      setSessionExpired(true);
    }
  }, []);

  // Already signed in? Skip the login form.
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [hydrated, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        login(data.admin, data.token);
        router.push('/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-5">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-info-purple/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary shadow-lg shadow-brand-primary/25">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-text-primary">Pepertect</h1>
            <p className="text-[11px] text-text-tertiary font-medium -mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="card-soft p-6">
          <h2 className="font-heading text-lg font-bold text-text-primary">Sign in</h2>
          <p className="text-sm text-text-secondary mt-1">Access the admin dashboard</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {sessionExpired && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5" role="alert">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  Your session has expired. Please sign in again.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="text-xs font-medium text-text-secondary block mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@pepertect.com"
                className="w-full h-10 rounded-lg border border-border bg-bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="text-xs font-medium text-text-secondary block mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full h-10 rounded-lg border border-border bg-bg-surface px-3 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-tint-red/50 border border-loss-red/20 px-3 py-2.5" role="alert">
                <AlertCircle className="h-4 w-4 text-loss-red shrink-0" />
                <p className="text-xs text-loss-red font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover transition-colors active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-[11px] text-text-tertiary">Pepertect Admin v1.0</p>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            {mounted ? (theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />) : <Moon className="h-3.5 w-3.5 invisible" />}
          </button>
        </div>
      </div>
    </div>
  );
}
