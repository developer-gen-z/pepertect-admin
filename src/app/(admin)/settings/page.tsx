'use client';

import { useEffect, useState } from 'react';
import { Settings, Database, Shield, Server, Globe, CheckCircle2, XCircle, Loader2, Wrench, Power, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { adminFetch } from '@/lib/admin-fetch';

interface SettingsData {
  database: {
    status: string;
    provider: string;
    type: string;
    pooler?: string;
    total: number;
    active: number;
    premium: number;
    free: number;
  };
  security: {
    authMethod: string;
    tokenExpiry: string;
    adminAuth: string;
    jwtSecretConfigured: boolean;
  };
  deployment: {
    name: string;
    url: string;
    framework: string;
    runtime: string;
    hosting: string;
    environment: string;
  };
  marketData: {
    provider: string;
    exchanges: string[];
    segments: string[];
    workerStatus: string;
    tokenStatus: string;
    tokenExpiry: string | null;
  };
  timestamps: {
    checkedAt: string;
  };
}

export default function SettingsPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Maintenance mode state
  const [maint, setMaint] = useState<{ enabled: boolean; message: string; updatedAt: string | null } | null>(null);
  const [maintLoading, setMaintLoading] = useState(true);
  const [maintSaving, setMaintSaving] = useState(false);
  const [maintMessage, setMaintMessage] = useState('');
  const [maintError, setMaintError] = useState('');
  const [maintSuccess, setMaintSuccess] = useState('');

  async function fetchMaintenance() {
    try {
      const res: any = await adminFetch('/api/admin/maintenance');
      if (res.success) {
        setMaint(res.data);
        setMaintMessage(res.data.message);
      }
    } catch (e: any) {
      if (e?.message !== 'Session expired') setMaintError('Failed to load maintenance status');
    } finally {
      setMaintLoading(false);
    }
  }

  async function toggleMaintenance(enable: boolean) {
    setMaintSaving(true);
    setMaintError('');
    setMaintSuccess('');
    try {
      const res: any = await adminFetch('/api/admin/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable, message: maintMessage }),
      });
      if (res.success) {
        setMaint(res.data);
        setMaintSuccess(res.message);
        setTimeout(() => setMaintSuccess(''), 4000);
      } else {
        setMaintError(res.error || 'Failed to update');
      }
    } catch (e: any) {
      if (e?.message !== 'Session expired') setMaintError(e?.message || 'Network error');
    } finally {
      setMaintSaving(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/settings-info', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const result = await res.json();
        
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load settings');
        }
      } catch (e) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();

    // Refresh every 60 seconds
    const interval = setInterval(fetchSettings, 60000);
    return () => clearInterval(interval);
  }, [token]);

  // Fetch maintenance status
  useEffect(() => {
    if (!token) return;
    fetchMaintenance();
  }, [token]);

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Platform configuration</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Platform configuration</p>
        </div>
        <div className="card-soft p-6 text-center">
          <p className="text-loss-red">{error}</p>
        </div>
      </div>
    );
  }

  // Default data for fallback
  const d = data || {} as SettingsData;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Platform configuration</p>
        </div>
        {data && (
          <button 
            onClick={() => window.location.reload()}
            className="text-xs text-text-secondary hover:text-brand-primary flex items-center gap-1"
          >
            <Loader2 className="h-3 w-3" />
            Refresh
          </button>
        )}
      </div>

      {/* Maintenance Mode Card — full width */}
      <div className={`card-soft p-5 border-2 ${maint?.enabled ? 'border-amber-500/40 bg-amber-500/5' : 'border-transparent'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`icon-tile ${maint?.enabled ? 'bg-amber-500/15' : 'bg-tint-green'}`}>
              {maint?.enabled
                ? <Wrench className="h-[18px] w-[18px] text-amber-500" />
                : <Power className="h-[18px] w-[18px] text-profit-green" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-base font-semibold text-text-primary">Site Mode</h2>
              <p className="text-[11px] text-text-secondary">
                Control the main website (pepertect.vercel.app) state
              </p>
            </div>
          </div>
          {/* Status badge */}
          <div className="flex items-center gap-2 shrink-0">
            {maintLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
            ) : maint?.enabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Maintenance Mode
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Production (Live)
              </span>
            )}
          </div>
        </div>

        {/* Description textarea */}
        <div className="mt-4">
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            Maintenance message (shown to users on the main site)
          </label>
          <textarea
            value={maintMessage}
            onChange={(e) => setMaintMessage(e.target.value)}
            disabled={maintSaving}
            rows={2}
            placeholder="We're performing scheduled maintenance. We'll be back shortly!"
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all disabled:opacity-60 resize-none"
          />
        </div>

        {/* Alert / success messages */}
        {maintError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-tint-red/50 border border-loss-red/20 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-loss-red shrink-0" />
            <p className="text-xs text-loss-red font-medium">{maintError}</p>
          </div>
        )}
        {maintSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-profit-green shrink-0" />
            <p className="text-xs text-profit-green font-medium">{maintSuccess}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {maint?.enabled ? (
            <button
              onClick={() => toggleMaintenance(false)}
              disabled={maintSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-profit-green hover:bg-profit-green/90 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              {maintSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              Switch to Production (Live)
            </button>
          ) : (
            <button
              onClick={() => toggleMaintenance(true)}
              disabled={maintSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              {maintSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              Enable Maintenance Mode
            </button>
          )}
          <span className="text-[10px] text-text-tertiary">
            {maint?.updatedAt && `Last changed: ${new Date(maint.updatedAt).toLocaleString()}`}
          </span>
        </div>

        <p className="mt-3 text-[10px] text-text-tertiary leading-relaxed">
          💡 When maintenance mode is ON, all visitors to pepertect.vercel.app will see the maintenance
          message above instead of the app. Toggle back to Production to make the site live again.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Database Card */}
        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-blue"><Database className="h-[18px] w-[18px] text-brand-primary" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Database</h2>
              <p className="text-[11px] text-text-secondary">{d.database?.type || 'PostgreSQL via Supabase'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Provider" value={d.database?.provider || 'PostgreSQL'} />
            {d.database?.pooler && <SettingRow label="Connection" value={`Pooler (${d.database.pooler})`} />}
            <SettingRow 
              label="Status" 
              value={d.database?.status === 'connected' ? 'Connected' : d.database?.status === 'error' ? 'Error' : 'Checking...'}
              status={d.database?.status === 'connected' ? 'active' : d.database?.status === 'error' ? 'inactive' : undefined}
            />
            
            {/* Real User Stats */}
            {data && (
              <>
                <div className="border-t border-border pt-2 mt-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-2">Users</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <SettingRow label="Total" value={`${d.database?.total || 0}`} />
                    <SettingRow label="Active" value={`${d.database?.active || 0}`} />
                    <SettingRow label="Premium" value={`${d.database?.premium || 0}`} />
                    <SettingRow label="Free" value={`${d.database?.free || 0}`} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Security Card */}
        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-green"><Shield className="h-[18px] w-[18px] text-profit-green" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Security</h2>
              <p className="text-[11px] text-text-secondary">Auth & JWT settings</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Auth Method" value={d.security?.authMethod || 'JWT (HS256)'} />
            <SettingRow label="Token Expiry" value={d.security?.tokenExpiry || '24 hours'} />
            <SettingRow label="Admin Auth" value={d.security?.adminAuth || 'Environment Credentials'} />
            <SettingRow 
              label="JWT Secret" 
              value={d.security?.jwtSecretConfigured ? 'Configured ✅' : 'Missing ❌'}
              status={d.security?.jwtSecretConfigured ? 'active' : 'inactive'}
            />
          </div>
        </div>

        {/* Deployment Card */}
        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-purple"><Server className="h-[18px] w-[18px] text-info-purple" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Deployment</h2>
              <p className="text-[11px] text-text-secondary">Hosting & runtime</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Platform" value={d.deployment?.hosting || 'Vercel'} />
            <SettingRow label="Framework" value={d.deployment?.framework || 'Next.js 16'} />
            <SettingRow label="Runtime" value={d.deployment?.runtime || 'Node.js 20.x'} />
            <SettingRow label="Environment" value={d.deployment?.environment || 'Production'} />
            {d.deployment?.url && (
              <SettingRow 
                label="App URL" 
                value={d.deployment.url.replace('https://', '')} 
              />
            )}
          </div>
        </div>

        {/* Market Data Card */}
        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-yellow"><Globe className="h-[18px] w-[18px] text-accent-gold" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Market Data</h2>
              <p className="text-[11px] text-text-secondary">Live feed configuration</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Provider" value={d.marketData?.provider || 'Upstox WebSocket'} />
            <SettingRow label="Exchanges" value={d.marketData?.exchanges?.join(', ') || 'NSE, BSE'} />
            <SettingRow label="Segments" value={d.marketData?.segments?.join(', ') || 'EQUITY, F&O'} />
            <SettingRow 
              label="Worker Status" 
              value={
                d.marketData?.workerStatus === 'connected' ? 'Connected 🟢' :
                d.marketData?.workerStatus === 'disconnected' ? 'Disconnected 🔴' :
                'Unknown ⚪'
              }
              status={d.marketData?.workerStatus === 'connected' ? 'active' : d.marketData?.workerStatus === 'disconnected' ? 'inactive' : undefined}
            />
            <SettingRow 
              label="Token Status" 
              value={
                d.marketData?.tokenStatus === 'valid' ? 'Valid ✅' :
                d.marketData?.tokenStatus === 'expired' ? 'Expired ⚠️' :
                d.marketData?.tokenStatus === 'not_configured' ? 'Not Set ❌' :
                'Unknown'
              }
              status={d.marketData?.tokenStatus === 'valid' ? 'active' : d.marketData?.tokenStatus === 'expired' ? 'inactive' : undefined}
            />
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {d.timestamps?.checkedAt && (
        <p className="text-[10px] text-text-tertiary text-center">
          Last updated: {new Date(d.timestamps.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function SettingRow({ label, value, status }: { label: string; value: string; status?: 'active' | 'inactive' }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-primary">{value}</span>
        {status === 'active' && <CheckCircle2 className="h-3.5 w-3.5 text-profit-green" />}
        {status === 'inactive' && <XCircle className="h-3.5 w-3.5 text-loss-red" />}
      </div>
    </div>
  );
}
