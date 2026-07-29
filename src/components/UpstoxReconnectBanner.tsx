'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { AlertTriangle, ExternalLink, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';

interface WorkerHealthResponse {
  success: boolean;
  healthy: boolean;
  status?: number;
  data?: any;
  error?: string;
  checkedAt: string;
}

export default function UpstoxReconnectBanner() {
  const { token } = useAuthStore();
  const [workerHealthy, setWorkerHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  // Check worker health via API proxy (avoids CORS issues)
  const checkWorkerHealth = async (): Promise<boolean> => {
    try {
      console.log('[UpstoxBanner] Checking worker health via API...');
      const res = await fetch('/api/admin/worker-health', {
        method: 'GET',
        cache: 'no-store',
      });
      const data: WorkerHealthResponse = await res.json();
      console.log('[UpstoxBanner] Worker health response:', data);
      return data.healthy === true;
    } catch (e) {
      console.error('[UpstoxBanner] Worker health check failed:', e);
      return false;
    }
  };

  useEffect(() => {
    if (!token) return;
    
    const checkStatus = async () => {
      const isHealthy = await checkWorkerHealth();
      setWorkerHealthy(isHealthy);
      setLoading(false);
    };

    checkStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleRefresh = async () => {
    setChecking(true);
    const isHealthy = await checkWorkerHealth();
    setWorkerHealthy(isHealthy);
    setChecking(false);
  };

  // Don't render while loading or if dismissed
  if (loading || dismissed) return null;

  // Show GREEN "Connected" banner when worker is healthy
  if (workerHealthy === true) {
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

  // Show WARNING/DISCONNECTED banner when worker is not healthy
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
            href="https://api.upstox.com/v2/login/authorization/dialog?response_type=code"
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
