'use client';

import { useEffect, useState } from 'react';
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
  Globe
} from 'lucide-react';

interface WorkerHealthResponse {
  success: boolean;
  healthy: boolean;
  status?: number;
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

export default function WebSocketStatusPage() {
  const { token } = useAuthStore();
  const [workerHealthy, setWorkerHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<ReconnectResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Check worker health
  const checkWorkerHealth = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/worker-health', {
        method: 'GET',
        cache: 'no-store',
      });
      const data: WorkerHealthResponse = await res.json();
      return data.healthy === true;
    } catch (e) {
      console.error('[WebSocketStatus] Health check failed:', e);
      return false;
    }
  };

  // Reconnect WebSocket
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

      // If successful, re-check health after delay
      if (data.success) {
        setTimeout(async () => {
          const isHealthy = await checkWorkerHealth();
          setWorkerHealthy(isHealthy);
          setLastChecked(new Date());
        }, 3000);
      }
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

  // Initial load and periodic check
  useEffect(() => {
    if (!token) return;

    const checkStatus = async () => {
      const isHealthy = await checkWorkerHealth();
      setWorkerHealthy(isHealthy);
      setLoading(false);
      setLastChecked(new Date());
    };

    checkStatus();
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const handleRefresh = async () => {
    setChecking(true);
    const isHealthy = await checkWorkerHealth();
    setWorkerHealthy(isHealthy);
    setLastChecked(new Date());
    setChecking(false);
    setReconnectResult(null);
  };

  // Website URL
  const websiteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pepertect.vercel.app';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary flex items-center gap-3">
          <Globe className="h-7 w-7 text-brand-primary" />
          WebSocket Status
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Monitor and manage real-time market data connection
        </p>
      </div>

      {/* Main Status Card */}
      <div className={`relative overflow-hidden rounded-2xl border p-8 ${
        workerHealthy === true 
          ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' 
          : workerHealthy === false
            ? 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20'
            : 'bg-bg-surface border-border'
      }`}>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-current opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative">
          {/* Status Icon & Title */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-4 rounded-2xl ${
              workerHealthy === true 
                ? 'bg-emerald-500/20' 
                : workerHealthy === false
                  ? 'bg-red-500/20'
                  : 'bg-gray-500/20'
            }`}>
              {loading ? (
                <Loader2 className="h-10 w-10 animate-spin text-text-secondary" />
              ) : workerHealthy === true ? (
                <Wifi className="h-10 w-10 text-emerald-500" />
              ) : (
                <WifiOff className="h-10 w-10 text-red-500" />
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-text-primary">
                {loading ? 'Checking...' :
                 workerHealthy === true ? '✅ Connected' :
                 workerHealthy === false ? '❌ Disconnected' : 'Unknown Status'}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {workerHealthy === true 
                  ? 'WebSocket is connected and streaming live market data'
                  : workerHealthy === false
                    ? 'WebSocket is disconnected - website users cannot see live data'
                    : 'Checking connection status...'}
              </p>
            </div>
          </div>

          {/* Status Details */}
          {!loading && (
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="bg-bg-base/50 rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Connection</p>
                <p className={`text-lg font-semibold mt-1 ${
                  workerHealthy === true ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {workerHealthy === true ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="bg-bg-base/50 rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Provider</p>
                <p className="text-lg font-semibold mt-1 text-text-primary">Upstox</p>
              </div>
              <div className="bg-bg-base/50 rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Last Checked</p>
                <p className="text-sm font-medium mt-1 text-text-primary">
                  {lastChecked?.toLocaleTimeString() || '-'}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* CONNECTED STATE: Go to Website Dashboard */}
            {workerHealthy === true && (
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

            {/* DISCONNECTED STATE: Retry Connection */}
            {workerHealthy === false && (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait shadow-lg shadow-red-500/25"
              >
                {reconnecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Power className="h-5 w-5" />
                    Retry WebSocket Connection
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
                  <p className="text-sm mt-1 opacity-75">
                    Token Pushed: {reconnectResult.data.tokenPushed ? '✅' : '❌'} | 
                    Final Health: {reconnectResult.data.finalHealth ? '✅' : '⏳'}
                  </p>
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
            <li>• If disconnected during market hours, click &quot;Retry&quot; button</li>
            <li>• If retry fails, token may have expired - re-authorize with Upstox</li>
            <li>• Worker auto-reconnects on most disconnections</li>
            <li>• Check Settings page for detailed configuration info</li>
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
        </div>
      </div>
    </div>
  );
}
