'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { 
  ExternalLink, 
  RefreshCw, 
  X, 
  Wifi, 
  WifiOff, 
  Power,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface WorkerHealthResponse {
  success: boolean;
  healthy: boolean;
  workerReachable?: boolean;
  hasToken?: boolean;
  clientCount?: number;
  subscribedCount?: number;
  dataIsFlowing?: boolean;
  status?: string;
  error?: string;
  checkedAt: string;
}

interface ReconnectResponse {
  success: boolean;
  message?: string;
  action?: string;
  data?: {
    tokenPushed?: boolean;
    finalHealth?: boolean;
    hasAccessToken?: boolean;
  };
  error?: string;
  authUrl?: string;
}

export default function UpstoxReconnectBanner() {
  const { token } = useAuthStore();
  const [workerHealthy, setWorkerHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<ReconnectResponse | null>(null);
  const [showResult, setShowResult] = useState(false);
  // Track if data is actually flowing (subscribedCount > 0)
  const [dataIsFlowing, setDataIsFlowing] = useState(false);

  const checkWorkerHealth = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/worker-health', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const data: WorkerHealthResponse = await res.json();
      
      // Track real data flow
      if (data.dataIsFlowing !== undefined) {
        setDataIsFlowing(data.dataIsFlowing);
      }
      
      // Use the API's computed healthy/status — don't override locally
      // The API already uses ground truth (subscribedCount, hasToken)
      return data.healthy === true;
    } catch (e) {
      // Network error — don't assume disconnected, could be transient
      return false;
    }
  };

  const handleReconnect = async () => {
    if (!token || reconnecting) return;

    setReconnecting(true);
    setShowResult(false);
    setReconnectResult(null);

    try {
      const res = await fetch('/api/admin/worker-reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data: ReconnectResponse = await res.json();
      setReconnectResult(data);
      setShowResult(true);

      if (data.success && (data.action === 'reconnected' || data.data?.finalHealth)) {
        setTimeout(async () => {
          const isHealthy = await checkWorkerHealth();
          setWorkerHealthy(isHealthy);
          if (isHealthy) {
            setTimeout(() => setShowResult(false), 3000);
          }
        }, 3000);
      }
    } catch (e) {
      setReconnectResult({
        success: false,
        message: 'Network error. Please try again.',
        error: e instanceof Error ? e.message : 'Unknown error',
      });
      setShowResult(true);
    } finally {
      setReconnecting(false);
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
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleRefresh = async () => {
    setChecking(true);
    setShowResult(false);
    const isHealthy = await checkWorkerHealth();
    setWorkerHealthy(isHealthy);
    setChecking(false);
  };

  // Don't render while loading or if dismissed
  if (loading || dismissed) return null;

  // If data is confirmed flowing, NEVER show red — even if healthy is somehow false
  if (dataIsFlowing && workerHealthy === false) {
    // API says not healthy but data IS flowing — trust the data
    setWorkerHealthy(true);
  }

  // GREEN banner: Data is flowing = healthy
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
            Live Data Connected
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              WebSocket Active
            </span>
          </p>
          <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
            Real-time market data is flowing to website users
          </p>
          
          {showResult && reconnectResult?.success && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {reconnectResult.message || 'Reconnected successfully!'}
            </div>
          )}
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

  // RED banner: ONLY show when truly disconnected
  // Don't show if data is actually flowing OR if workerHealthy is true/null
  if (dataIsFlowing) return null;
  // If we never got a definitive answer (workerHealthy is null after loading),
  // don't show scary red banner — show nothing instead
  if (workerHealthy === null) return null;

  return (
    <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <WifiOff className="h-5 w-5 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
          Live Data Disconnected
        </p>
        <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1">
          Cloudflare Worker is not responding. Website users cannot see real-time market data.
        </p>

        {showResult && reconnectResult && (
          <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
            reconnectResult.success 
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
              : 'bg-red-500/10 text-red-700 dark:text-red-400'
          }`}>
            {reconnectResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">{reconnectResult.message}</p>
              {reconnectResult.data && (
                <p className="mt-1 opacity-75">
                  Token Pushed: {reconnectResult.data.tokenPushed ? 'Yes' : 'No'} | 
                  Final Health: {reconnectResult.data.finalHealth ? 'Healthy' : 'Pending'}
                </p>
              )}
              {/* Only show Authorize link when token is truly missing */}
              {!reconnectResult.data?.hasAccessToken && reconnectResult.authUrl && (
                <a 
                  href={reconnectResult.authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ExternalLink className="h-3 w-3" />
                  Authorize with Upstox
                </a>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white text-xs font-medium rounded-lg transition-colors disabled:cursor-wait"
          >
            {reconnecting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <Power className="h-3 w-3" />
                Reconnect WebSocket
              </>
            )}
          </button>

          <a
            href="https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=ba78a999-08c9-4d1a-a628-89788c39147d&redirect_uri=https://pepertect.vercel.app/callback"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-surface-alt border border-border text-text-secondary text-xs font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Re-authorize Upstox
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
        
        <p className="text-[10px] text-red-600/50 dark:text-red-400/40 mt-2">
          Tip: Click "Reconnect WebSocket" to push your access token to the Worker and restart the connection.
        </p>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          setShowResult(false);
        }}
        className="text-red-600/50 hover:text-red-700 dark:text-red-400/50 shrink-0"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
