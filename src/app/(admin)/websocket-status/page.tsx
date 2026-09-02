'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  Wifi, WifiOff, RefreshCw, ExternalLink, Power,
  Loader2, CheckCircle2, AlertCircle, ArrowRight,
  Globe, Activity, Users, Key, Server, Signal, AlertTriangle
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
  dataIsFlowing?: boolean;
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
  };
  error?: string;
  authUrl?: string;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'unknown';

const MAX_AUTO_RECONNECT_ATTEMPTS = 5;

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

  // Refs — FIX: the old implementation captured stale closures of these
  // values inside setTimeout chains, so the retry loop never saw the
  // incremented attempt counter and could loop forever. It also tore down
  // (and cleared) the pending retry timer whenever any dependency changed.
  const autoReconnectEnabledRef = useRef(autoReconnectEnabled);
  const autoReconnectCountRef = useRef(0);
  const reconnectingRef = useRef(false);
  const autoReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    autoReconnectEnabledRef.current = autoReconnectEnabled;
  }, [autoReconnectEnabled]);

  // Trust the API's computed status — it uses subscribedCount as ground truth
  const connectionStatus: ConnectionStatus = (() => {
    if (!healthData) return 'unknown';
    if (healthData.status === 'connected') return 'connected';
    if (healthData.status === 'connecting') return 'connecting';
    if (healthData.status === 'error') return 'error';
    if (healthData.status === 'disconnected') return 'disconnected';
    if (!healthData.workerReachable) return 'error';
    if (healthData.dataIsFlowing || healthData.healthy) return 'connected';
    if (healthData.upstoxConnecting) return 'connecting';
    return 'disconnected';
  })();

  const checkWorkerHealth = useCallback(async (): Promise<WorkerHealthResponse | null> => {
    try {
      const res = await fetch('/api/admin/worker-health', {
        method: 'GET',
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 401) return null;
      const data: WorkerHealthResponse = await res.json();
      return data;
    } catch {
      return null;
    }
  }, [token]);

  const attemptAutoReconnect = useCallback(async () => {
    if (!token || reconnectingRef.current || !autoReconnectEnabledRef.current) return;
    if (autoReconnectCountRef.current >= MAX_AUTO_RECONNECT_ATTEMPTS) return;

    reconnectingRef.current = true;
    setReconnecting(true);
    try {
      const res = await fetch('/api/admin/worker-reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data: ReconnectResponse = await res.json();
      setReconnectResult(data);

      autoReconnectCountRef.current += 1;
      setAutoReconnectCount(autoReconnectCountRef.current);

      // Wait, then re-check health
      await new Promise((r) => setTimeout(r, 3000));
      const newHealth = await checkWorkerHealth();
      if (newHealth) {
        setHealthData(newHealth);
        setLastChecked(new Date());
      }

      // Schedule the next attempt only if still unhealthy, still enabled,
      // and the attempt budget isn't exhausted (reads the REF, not stale state)
      const stillUnhealthy = !newHealth?.healthy;
      if (
        stillUnhealthy &&
        autoReconnectEnabledRef.current &&
        autoReconnectCountRef.current < MAX_AUTO_RECONNECT_ATTEMPTS
      ) {
        autoReconnectTimerRef.current = setTimeout(() => {
          autoReconnectTimerRef.current = null;
          void attemptAutoReconnect();
        }, 10000);
      }
    } catch {
      // ignore — next poll will re-evaluate
    } finally {
      reconnectingRef.current = false;
      setReconnecting(false);
    }
  }, [token, checkWorkerHealth]);

  // ── Polling effect (stable — no per-keystroke teardown) ──
  useEffect(() => {
    if (!token) return;
    let mounted = true;

    const checkStatus = async () => {
      const data = await checkWorkerHealth();
      if (!mounted || !data) return;
      setHealthData(data);
      setLoading(false);
      setLastChecked(new Date());

      const current = data.status || 'unknown';
      // FIX: auto-reconnect when ALREADY disconnected on load, not only on a
      // connected → disconnected transition (the old logic never fired if
      // you opened the page while the feed was already down).
      const needsReconnect = current === 'disconnected' || current === 'error';

      if (
        needsReconnect &&
        autoReconnectEnabledRef.current &&
        !reconnectingRef.current &&
        autoReconnectCountRef.current < MAX_AUTO_RECONNECT_ATTEMPTS &&
        !autoReconnectTimerRef.current
      ) {
        autoReconnectTimerRef.current = setTimeout(() => {
          autoReconnectTimerRef.current = null;
          void attemptAutoReconnect();
        }, 3000);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [token, checkWorkerHealth, attemptAutoReconnect]);

  // Cleanup the pending retry timer ONLY on unmount (previously the polling
  // effect's cleanup cleared it on every dependency change)
  useEffect(() => {
    return () => {
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
        autoReconnectTimerRef.current = null;
      }
    };
  }, []);

  const handleReconnect = async () => {
    if (!token || reconnectingRef.current) return;
    reconnectingRef.current = true;
    setReconnecting(true);
    setReconnectResult(null);
    try {
      const res = await fetch('/api/admin/worker-reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data: ReconnectResponse = await res.json();
      setReconnectResult(data);
      // Wait for the worker to settle before re-checking (previously the
      // spinner ended before this re-check completed)
      await new Promise((r) => setTimeout(r, 3000));
      const newHealth = await checkWorkerHealth();
      if (newHealth) { setHealthData(newHealth); setLastChecked(new Date()); }
    } catch {
      setReconnectResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      reconnectingRef.current = false;
      setReconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    const data = await checkWorkerHealth();
    if (data) { setHealthData(data); setLastChecked(new Date()); }
    setChecking(false);
    setReconnectResult(null);
  };

  const websiteUrl = 'https://pepertect.vercel.app';

  const getStatusColors = () => {
    switch (connectionStatus) {
      case 'connected':
        return { bg: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-500', textColor: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
      case 'connecting':
        return { bg: 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-500', textColor: 'text-amber-600', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
      case 'disconnected':
        return { bg: 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20', iconBg: 'bg-red-500/20', iconColor: 'text-red-500', textColor: 'text-red-600', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
      case 'error':
        return { bg: 'bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-gray-500/20', iconBg: 'bg-gray-500/20', iconColor: 'text-gray-500', textColor: 'text-gray-600', badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' };
      default:
        return { bg: 'bg-bg-surface border-border', iconBg: 'bg-gray-500/20', iconColor: 'text-text-secondary', textColor: 'text-text-secondary', badge: 'bg-gray-100 text-gray-800' };
    }
  };

  const colors = getStatusColors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary flex items-center gap-3">
          <Globe className="h-7 w-7 text-brand-primary" />
          WebSocket Status
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">Real-time monitor and manage market data connection</p>
      </div>

      {/* ALERT BANNER — Only when truly disconnected */}
      {connectionStatus === 'disconnected' && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3" role="alert">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-700 dark:text-red-300">WebSocket Disconnected - Website users cannot see live data!</p>
            <p className="text-sm text-red-600/80 mt-0.5">Market prices are not updating. Click &quot;Reconnect&quot; or enable auto-reconnect.</p>
          </div>
        </div>
      )}

      {/* Main Status Card */}
      <div className={`relative overflow-hidden rounded-2xl border p-8 ${colors.bg}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-current opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-4 rounded-2xl ${colors.iconBg}`}>
              {loading ? <Loader2 className={`h-10 w-10 animate-spin ${colors.iconColor}`} /> :
               connectionStatus === 'connected' ? <Wifi className={`h-10 w-10 ${colors.iconColor}`} /> :
               connectionStatus === 'connecting' ? <Loader2 className={`h-10 w-10 animate-spin ${colors.iconColor}`} /> :
               <WifiOff className={`h-10 w-10 ${colors.iconColor}`} />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-primary">
                {loading ? 'Checking...' :
                 connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 connectionStatus === 'error' ? 'Worker Unreachable' :
                 'Disconnected'}
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
            {!loading && (
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${colors.badge}`}>
                {connectionStatus}
              </span>
            )}
          </div>

          {/* Status Details Grid */}
          {!loading && healthData && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Worker</p>
                </div>
                <p className={`text-lg font-semibold ${healthData.workerReachable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {healthData.workerReachable ? 'Online' : 'Offline'}
                </p>
              </div>

              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Signal className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Data Flow</p>
                </div>
                <p className={`text-lg font-semibold ${(healthData.dataIsFlowing || healthData.healthy) ? 'text-emerald-600' : healthData.upstoxConnecting ? 'text-amber-600' : 'text-red-600'}`}>
                  {(healthData.dataIsFlowing || healthData.healthy) ? 'Flowing' : healthData.upstoxConnecting ? 'Connecting...' : 'Not Flowing'}
                </p>
              </div>

              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Active Clients</p>
                </div>
                <p className="text-lg font-semibold text-text-primary">{healthData.clientCount ?? 0}</p>
              </div>

              <div className="bg-bg-base/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Subscriptions</p>
                </div>
                <p className="text-lg font-semibold text-text-primary">{healthData.subscribedCount ?? 0} instruments</p>
              </div>
            </div>
          )}

          {/* Info Row */}
          {!loading && healthData && (
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                healthData.hasToken
                  ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                <Key className="h-3.5 w-3.5" />
                Token: {healthData.hasToken ? 'Valid' : 'Missing'}
              </div>
              <div className="text-text-secondary">
                Last Checked: <span className="font-medium">{lastChecked?.toLocaleTimeString() || '-'}</span>
              </div>
              {autoReconnectCount > 0 && (
                <div className="text-text-secondary">
                  Auto-Reconnect Attempts: <span className="font-medium">{autoReconnectCount}/{MAX_AUTO_RECONNECT_ATTEMPTS}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {connectionStatus === 'connected' && (
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-primary/25">
                <ExternalLink className="h-5 w-5" />
                Go to Website Dashboard
                <ArrowRight className="h-5 w-5" />
              </a>
            )}

            {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
              <button onClick={handleReconnect} disabled={reconnecting} aria-label="Reconnect WebSocket now"
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed shadow-lg shadow-red-500/25">
                {reconnecting ? <><Loader2 className="h-5 w-5 animate-spin" /> Reconnecting...</> : <><Power className="h-5 w-5" /> Reconnect Now</>}
              </button>
            )}

            <button onClick={handleRefresh} disabled={checking || loading} aria-label="Refresh status"
              className="inline-flex items-center gap-2 px-5 py-3 bg-bg-surface hover:bg-bg-surface-alt border border-border text-text-secondary font-medium rounded-xl transition-colors disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>

            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border rounded-xl cursor-pointer">
              <input type="checkbox" checked={autoReconnectEnabled} onChange={(e) => setAutoReconnectEnabled(e.target.checked)}
                aria-label="Enable auto-reconnect"
                className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary" />
              <span className="text-sm font-medium text-text-secondary">Auto-Reconnect</span>
            </label>
          </div>

          {/* Reconnect Result */}
          {reconnectResult && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${reconnectResult.success ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              {reconnectResult.success ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`font-medium ${reconnectResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{reconnectResult.message}</p>
                {reconnectResult.data && (
                  <div className="text-sm mt-1 opacity-75 space-y-1">
                    <p>Token Pushed: {reconnectResult.data.tokenPushed ? 'Yes' : 'No'}</p>
                    <p>Final Health: {reconnectResult.data.finalHealth ? 'Healthy' : 'Pending'}</p>
                  </div>
                )}
                {/* Only show Authorize link when token is truly missing and the server returned a valid URL */}
                {!reconnectResult.data?.hasAccessToken && reconnectResult.authUrl && (
                  <a href={reconnectResult.authUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-brand-primary hover:underline font-medium text-sm">
                    <ExternalLink className="h-3 w-3" />
                    Authorize with Upstox
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
            It is used to stream live stock prices and market data to your website users without page refreshes.
          </p>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-accent-gold" />
            Troubleshooting Tips
          </h3>
          <ul className="text-sm text-text-secondary space-y-2">
            <li>If disconnected during market hours, click &quot;Reconnect&quot; button</li>
            <li>Enable &quot;Auto-Reconnect&quot; for automatic recovery</li>
            <li>If reconnect fails, token may have expired - re-authorize with Upstox</li>
            <li>Worker auto-reconnects on most disconnections</li>
          </ul>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card-soft p-5">
        <h3 className="font-semibold text-text-primary mb-3">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard" className="text-sm text-brand-primary hover:underline">Back to Dashboard</a>
          <span className="text-text-tertiary">|</span>
          <a href="/settings" className="text-sm text-brand-primary hover:underline">Settings</a>
          <span className="text-text-tertiary">|</span>
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">Open Website</a>
        </div>
      </div>
    </div>
  );
}
