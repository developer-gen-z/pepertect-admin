'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { AlertTriangle, ExternalLink, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';

interface TokenStatus {
  hasToken: boolean;
  isActive: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  userEmail: string | null;
  isAdminMode: boolean;
}

export default function UpstoxReconnectBanner() {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token) return;
    
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/upstox-status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setStatus(data.data);
        }
      } catch (err) {
        console.error('Failed to check Upstox status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    // Check every 60 seconds
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [token]);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/admin/upstox-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setChecking(false);
    }
  };

  // Don't render while loading or if dismissed
  if (loading || dismissed) return null;

  // Don't show banner if token is active and not expired
  if (status?.isActive && !status?.isExpired) {
    return (
      <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-3">
        <Wifi className="h-4 w-4 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Upstox Connected
          </p>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">
            {status.userEmail ? `Account: ${status.userEmail}` : 'Admin token active'} • 
            {status.expiresAt ? ` Expires ${new Date(status.expiresAt).toLocaleString('en-IN')}` : ' Active'}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-emerald-600/50 hover:text-emerald-700 dark:text-emerald-400/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Show warning/reconnect banner when token is expired or missing
  return (
    <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          ⚠️ Admin: Upstox Token Expired / Not Connected
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
          {status?.hasToken 
            ? 'The Upstox access token has expired. Real-time market data may not be available.'
            : 'No Upstox token found. Connect your Upstox account to enable real-time data for all users.'
          }
        </p>
        <div className="flex items-center gap-2 mt-3">
          <a
            href="https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=undefined"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Connect Upstox
          </a>
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-surface-alt border border-border text-text-secondary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600/50 hover:text-amber-700 dark:text-amber-400/50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
