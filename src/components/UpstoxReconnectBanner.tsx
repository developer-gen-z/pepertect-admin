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
  workerConnected: boolean;
  dbConnected: boolean;
}

// Cloudflare Worker URL - read from env or use default
const WORKER_URL = process.env.NEXT_PUBLIC_UPSTOX_WORKER_URL || 
                   'https://upstox-realtime.hzero9393.workers.dev';

export default function UpstoxReconnectBanner() {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  // CLIENT-SIDE worker health check (works even if DB is down!)
  const checkWorkerHealth = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      // Use relative URL or absolute URL
      const workerHealthUrl = `${WORKER_URL.replace(/\/ws$/, '')}/health`;
      
      const res = await fetch(workerHealthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store', // Don't cache
      });
      
      clearTimeout(timeout);
      
      if (!res.ok) return false;
      
      const data = await res.json();
      console.log('[UpstoxBanner] Worker health response:', data);
      
      // Accept multiple response formats
      return data.ok === true ||
             data.connected === true || 
             data.status === 'connected' || 
             data.status === 'ok';
    } catch (e) {
      console.error('[UpstoxBanner] Worker health check failed:', e);
      return false;
    }
  };

  useEffect(() => {
    if (!token) return;
    
    const checkStatus = async () => {
      try {
        // Try server API first
        const apiRes = await fetch('/api/admin/upstox-status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const apiData = await apiRes.json();
        
        if (apiData.success) {
          // If API says worker is NOT connected, do our own client-side check
          // This handles cases where server can't reach worker but client can
          if (!apiData.data.workerConnected) {
            console.log('[UpstoxBanner] Server says disconnected, checking from client...');
            const clientWorkerOk = await checkWorkerHealth();
            if (clientWorkerOk) {
              // Client can reach worker! Override with connected status
              setStatus({
                ...apiData.data,
                workerConnected: true,
                isActive: true,
                hasToken: true,
                isExpired: false,
              });
              setLoading(false);
              return;
            }
          }
          setStatus(apiData.data);
        }
      } catch (err) {
        console.error('Failed to check Upstox status via API:', err);
        
        // Fallback: direct client-side worker check
        console.log('[UpstoxBanner] Trying direct worker check...');
        const workerOk = await checkWorkerHealth();
        setStatus({
          hasToken: workerOk,
          isActive: workerOk,
          expiresAt: null,
          isExpired: !workerOk,
          userEmail: 'admin@pepertect.com',
          isAdminMode: true,
          workerConnected: workerOk,
          dbConnected: false,
        });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      // Do both checks
      const [apiRes, workerOk] = await Promise.all([
        fetch('/api/admin/upstox-status', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).catch(() => ({ success: false })),
        checkWorkerHealth(),
      ]);
      
      if (apiRes.success) {
        // If client can reach worker but server can't, use client status
        if (!apiRes.data.workerConnected && workerOk) {
          setStatus({
            ...apiRes.data,
            workerConnected: true,
            isActive: true,
            hasToken: true,
            isExpired: false,
          });
        } else {
          setStatus(apiRes.data);
        }
      } else {
        setStatus({
          hasToken: workerOk,
          isActive: workerOk,
          expiresAt: null,
          isExpired: !workerOk,
          userEmail: 'admin@pepertect.com',
          isAdminMode: true,
          workerConnected: workerOk,
          dbConnected: false,
        });
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setChecking(false);
    }
  };

  // Don't render while loading or if dismissed
  if (loading || dismissed) return null;

  // Determine overall connection state
  const isLiveConnected = status?.workerConnected === true;

  // Show GREEN "Connected" banner when live data is flowing
  if (isLiveConnected && status) {
    return (
      <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Wifi className="h-5 w-5 text-emerald-500" />
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            ✅ Live Data Connected
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              WebSocket Active
            </span>
          </p>
          <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
            Cloudflare Worker Connected • Real-time market data flowing to website users
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="text-emerald-600/50 hover:text-emerald-700 dark:text-emerald-400/50 transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-emerald-600/50 hover:text-emerald-700 dark:text-emerald-400/50 transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Show WARNING/DISCONNECTED banner when no live data
  return (
    <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <WifiOff className="h-5 w-5 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
          ⚠️ Live Data Disconnected
        </p>
        <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1">
          Cloudflare Worker is not responding. Website users cannot see real-time market data.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <a
            href={`https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.NEXT_PUBLIC_UPSTOX_API_KEY || ''}&redirect_uri=${encodeURIComponent(process.env.UPSTOX_REDIRECT_URI || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Reconnect Upstox
          </a>
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-surface-alt border border-border text-text-secondary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
            Check Again
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-red-600/50 hover:text-red-700 dark:text-red-400/50 shrink-0"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
