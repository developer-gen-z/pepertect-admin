'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  ExternalLink, 
  Power,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Globe,
  Activity,
  Users,
  Key,
  Server,
  Signal,
  AlertTriangle
} from 'lucide-react';

interface WorkerHealthResponse {
  success: boolean;
  healthy: boolean;
  workerReachable?: boolean;
  upstoxReady?: boolean;
  upstoxConnecting?: boolean;
  hasToken?: boolean;
  clientCount?: number;
  subscribedCount?: number;
  status?: string;
  data?: any;
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
    workerWasHealthy?: boolean;
    reconnectTriggered?: boolean;
  };
  error?: string;
  authUrl?: string;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'unknown';

export default function WebSocketStatusPage() {
  const { token } = useAuthStore();
  const [healthData, setHealthData] = useState<WorkerHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<ReconnectResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(true);
  const [autoReconnectCount, setAutoReconnectCount] = useState(0);
  const autoReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<string>('unknown');

  // Derive connection status from health data
  const connectionStatus: ConnectionStatus = (() => {
    if (!healthData) return 'unknown';
    if (!healthData.workerReachable) return 'error';
    if (healthData.upstoxReady) return 'connected';
    if (healthData.upstoxConnecting) return 'connecting';
    return 'disconnected';
  })();

  // Check worker health with REAL /stats endpoint
  const checkWorkerHealth = useCallback(async (): Promise<WorkerHealthResponse | null> => {
    try {
      const res = await fetch('/api/admin/worker-health', {
        method: 'GET',
        cache: 'no-store',
      });
      const data: WorkerHealthResponse = await res.json();
      return data;
    } catch (e) {
      console.error('[WebSocketStatus] Health check failed:', e);
      return null;
    }
  }, []);

  // Auto-reconnect when disconnected
  const attemptAutoReconnect = useCallback(async () => {
    if (!token || reconnecting || !autoReconnectEnabled) return false;

    console.log('[WebSocketStatus] Auto-reconnecting...');
    setReconnecting(true);

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
      setAutoReconnectCount(prev => prev + 1);

      // Check status after reconnect attempt
      setTimeout(async () => {
        const newHealth = await checkWorkerHealth();
        if (newHealth) {
          setHealthData(newHealth);
          setLastChecked(new Date());
          // If still disconnected and auto-reconnect is on, try again
          if (!newHealth.healthy && autoReconnectEnabled && autoReconnectCount < 5) {
            autoReconnectTimerRef.current = setTimeout(attemptAutoReconnect, 10000);
          }
        }
        setReconnecting(false);
      }, 3000);

      return data.success;
    } catch (e) {
      console.error('[WebSocketStatus] Auto-reconnect failed:', e);
      setReconnecting(false);
      return false;
    }
  }, [token, reconnecting, autoReconnectEnabled, autoReconnectCount, checkWorkerHealth]);

  // Manual reconnect handler
  const handleReconnect = async () => {
    if (!token || reconnecting) return;

    setReconnecting(true);
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

      // Re-check health after delay
      setTimeout(async () => {
        const newHealth = await checkWorkerHealth();
        if (newHealth) {
          setHealthData(newHealth);
          setLastChecked(new Date());
        }
      }, 3000);
    } catch (e) {
      setReconnectResult({
        success: false,
        message: 'Network error. Please try again.',
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setReconnecting(false);
    }
  };

  // Initial load + periodic check + auto-reconnect logic
  useEffect(() => {
    if (!token) return;

    let mounted = true;

    const checkStatus = async () => {
      const data = await checkWorkerHealth();
      if (!mounted) return;
      
      if (data) {
        setHealthData(data);
        setLoading(false);
        setLastChecked(new Date());

        const currentStatus = data.status || 'unknown';
        
        // Auto-reconnect trigger: status changed from connected to disconnected
        if (
          autoReconnectEnabled &&
          prevStatusRef.current === 'connected' && 
          currentStatus === 'disconnected' &&
          !reconnecting
        ) {
          console.log('[WebSocketStatus] WS disconnected! Triggering auto-reconnect...');
          // Small delay before attempting reconnect
          autoReconnectTimerRef.current = setTimeout(attemptAutoReconnect, 3000);
        }

        prevStatusRef.current = currentStatus;
      }
    };

    checkStatus();
    
    // Check every 10 seconds for real-time monitoring
    const interval = setInterval(checkStatus, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
      }
    };
  }, [token, autoReconnectEnabled, reconnecting, checkWorkerHealth, attemptAutoReconnect]);

  const handleRefresh = async () => {
    setChecking(true);
    const data = await checkWorkerHealth();
    if (data) {
      setHealthData(data);
      setLastChecked(new Date());
    }
    setChecking(false);
    setReconnectResult(null);
  };

  // Website URL
  const websiteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pepertect.vercel.app';

  // Status colors based on actual connection state
  const getStatusColors = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          bg: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
          iconBg: 'bg-emerald-500/20',
          iconColor: 'text-emerald-500',
          textColor: 'text-emerald-600',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        };
      case 'connecting':
        return {
          bg: 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20',
          iconBg: 'bg-amber-500/20',
          iconColor: 'text-amber-500',
          textColor: 'text-amber-600',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        };
      case 'disconnected':
        return {
          bg: 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20',
          iconBg: 'bg-red-500/20',
          iconColor: 'text-red-500',
          textColor: 'text-red-600',
          badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-gray-500/20',
          iconBg: 'bg-gray-500/20',
          iconColor: 'text-gray-500',
          textColor: 'text-gray-600',
          badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
        };
      default:
        return {
          bg: 'bg-bg-surface border-border',
          iconBg: 'bg-gray-500/20',
          iconColor: 'text-text-secondary',
          textColor: 'text-text-secondary',
          badge: 'bg-gray-100 text-gray-800',
        };
    }
  };

  const colors = getStatusColors();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary flex items-center gap-3">
          <Globe className="h-7 w-7 text-brand-primary" />
          WebSocket Status
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Real-time monitor and manage market data connection
        </p>
      </div>

      {/* ALERT BANNER - When Disconnected */}
      {connectionStatus === 'disconnected' && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-700 dark:text-red-300">
              ⚠️ WebSocket Disconnected - Website users cannot see live data!
            </p>
            <p className="text-sm text-red-600/80 mt-0.5">
              Market prices are not updating. Click &quot;Reconnect&quot; or enable auto-reconnect.
            </p>
          </div>
        </div>
      )}

      {/* Main Status Card */}
      <div className={`relative overflow-hidden rounded-2xl border p-8 ${colors.bg}`}>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-current opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative">
          {/* Status Icon & Title */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-4 rounded-2xl ${colors.iconBg}`}>
              {loading ? (
                <Loader2 className={`h-10 w-10 animate-spin ${colors.iconColor}`} />
              ) : connectionStatus === 'connected' ? (
                <Wifi className={`h-10 w-10 ${colors.iconColor}`} />
              ) : connectionStatus === 'connecting' ? (
                <Loader2 className={`h-10 w-10 animate-spin ${colors.iconColor}`} />
              ) : (
                <WifiOff className={`h-10 w-10 ${colors.iconColor}`} />
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-text-primary">
                {loading ? 'Checking...' :
                 connectionStatus === 'connected' ? '✅ Connected' :
                 connectionStatus === 'connecting' ? '🔄 Connecting...' :
                 connectionStatus === 'error' ? '❌ Worker Unreachable' :
                 '❌ Disconnected'}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {connectionStatus === 'connected' 
                  ? 'WebSocket is connected and streaming live market data'
                  : connectionStatus === 'connecting'
                    ? 'Attempting to establish WebSocket connection...'
                    : connectionStatus === 'error'
                      ? 'Cloudflare Worker is not reachable'
                      : 'WebSocket is disconnected - website users see stale data'}
              </p>
            </div>

            {/* Status Badge */}
            {!loading && (
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${colors.badge}`}>
                {connectionStatus}
              </span>
            )}
          </div>

          {/* Status Details Grid */}
          {!loading && healthData && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {/* Worker Status */}
              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Worker</p>
                </div>
                <p className={`text-lg font-semibold ${healthData.workerReachable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {healthData.workerReachable ? '✅ Online' : '❌ Offline'}
                </p>
              </div>

              {/* Upstox WS Status */}
              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Signal className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Upstox WS</p>
                </div>
                <p className={`text-lg font-semibold ${healthData.upstoxReady ? 'text-emerald-600' : healthData.upstoxConnecting ? 'text-amber-600' : 'text-red-600'}`}>
                  {healthData.upstoxReady ? '✅ Connected' : healthData.upstoxConnecting ? '🔄 Connecting...' : '❌ Down'}
                </p>
              </div>

              {/* Active Clients */}
              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Active Clients</p>
                </div>
                <p className="text-lg font-semibold text-text-primary">
                  {healthData.clientCount ?? 0}
                </p>
              </div>

              {/* Subscriptions */}
              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Subscriptions</p>
                </div>
                <p className="text-lg font-semibold text-text-primary">
                  {healthData.subscribedCount ?? 0} instruments
                </p>
              </div>
            </div>
          )}

          {/* Additional Info Row */}
          {!loading && healthData && (
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                healthData.hasToken 
                  ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' 
                  : 'bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                <Key className="h-3.5 w-3.5" />
                Token: {healthData.hasToken ? 'Valid ✅' : 'Missing ❌'}
              </div>
              
              <div className="text-text-secondary">
                Last Checked: <span className="font-medium">{lastChecked?.toLocaleTimeString() || '-'}</span>
              </div>

              {autoReconnectCount > 0 && (
                <div className="text-text-secondary">
                  Auto-Reconnect Attempts: <span className="font-medium">{autoReconnectCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* CONNECTED STATE: Go to Website Dashboard */}
            {connectionStatus === 'connected' && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-primary/25"
              >
                <ExternalLink className="h-5 w-5" />
                Go to Website Dashboard
                <ArrowRight className="h-5 w-5" />
              </a>
            )}

            {/* DISCONNECTED/ERROR STATE: Retry Connection */}
            {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed shadow-lg shadow-red-500/25"
              >
                {reconnecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <Power className="h-5 w-5" />
                    Reconnect Now
                  </>
                )}
              </button>
            )}

            {/* Refresh Button (always visible) */}
            <button
              onClick={handleRefresh}
              disabled={checking || loading}
              className="inline-flex items-center gap-2 px-5 py-3 bg-bg-surface hover:bg-bg-surface-alt border border-border text-text-secondary font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>

            {/* Auto-Reconnect Toggle */}
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={autoReconnectEnabled}
                onChange={(e) => setAutoReconnectEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-sm font-medium text-text-secondary">
                Auto-Reconnect
              </span>
            </label>
          </div>

          {/* Reconnect Result Message */}
          {reconnectResult && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
              reconnectResult.success
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {reconnectResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  reconnectResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {reconnectResult.message}
                </p>
                {reconnectResult.data && (
                  <div className="text-sm mt-1 opacity-75 space-y-1">
                    <p>Token Pushed: {reconnectResult.data.tokenPushed ? '✅' : '❌'}</p>
                    <p>Final Health: {reconnectResult.data.finalHealth ? '✅' : '⏳'}</p>
                    <p>Reconnect Triggered: {reconnectResult.data.reconnectTriggered ? '✅' : '❌'}</p>
                  </div>
                )}
                {reconnectResult.authUrl && (
                  <a
                    href={reconnectResult.authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Authorize with Upstox →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Stats Card */}
      {!loading && healthData?.data?.stats && (
        <div className="card-soft p-5">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-primary" />
            Detailed Worker Statistics
          </h3>
          <pre className="text-xs bg-bg-base p-4 rounded-xl overflow-auto max-h-48 text-text-secondary">
            {JSON.stringify(healthData.data.stats, null, 2)}
          </pre>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-soft p-5">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-brand-primary" />
            What is WebSocket?
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            WebSocket provides real-time bidirectional communication between your server and clients.
            It&apos;s used to stream live stock prices, order updates, and market data to your website users
            without requiring page refreshes.
          </p>
        </div>

        <div className="card-soft p-5">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-accent-gold" />
            Troubleshooting Tips
          </h3>
          <ul className="text-sm text-text-secondary space-y-2">
            <li>• If disconnected during market hours, click &quot;Reconnect&quot; button</li>
            <li>• Enable &quot;Auto-Reconnect&quot; for automatic recovery</li>
            <li>• If reconnect fails, token may have expired - re-authorize with Upstox</li>
            <li>• Worker auto-reconnects on most disconnections</li>
            <li>• Check this page every few minutes during trading hours</li>
          </ul>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card-soft p-5">
        <h3 className="font-semibold text-text-primary mb-3">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard" className="text-sm text-brand-primary hover:underline">← Back to Dashboard</a>
          <span className="text-text-tertiary">|</span>
          <a href="/settings" className="text-sm text-brand-primary hover:underline">Settings</a>
          <span className="text-text-tertiary">|</span>
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
            Open Website ↗
          </a>
          <span className="text-text-tertiary">|</span>
          <a href="https://upstox-realtime.hzero9393.workers.dev/stats" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
            Worker Stats ↗
          </a>
        </div>
      </div>
    </div>
  );
}
