'use client';

import { Settings, Database, Shield, Server, Globe } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Platform configuration</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-blue"><Database className="h-[18px] w-[18px] text-brand-primary" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Database</h2>
              <p className="text-[11px] text-text-secondary">PostgreSQL via Supabase</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Provider" value="PostgreSQL" />
            <SettingRow label="Connection" value="Pooler (pgbouncer)" />
            <SettingRow label="Status" value="Connected" status="active" />
          </div>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-green"><Shield className="h-[18px] w-[18px] text-profit-green" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Security</h2>
              <p className="text-[11px] text-text-secondary">Auth & JWT settings</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Auth Method" value="JWT (HS256)" />
            <SettingRow label="Token Expiry" value="24 hours" />
            <SettingRow label="Admin Auth" value="Environment Credentials" />
          </div>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-purple"><Server className="h-[18px] w-[18px] text-info-purple" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Deployment</h2>
              <p className="text-[11px] text-text-secondary">Hosting & runtime</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Platform" value="Vercel" />
            <SettingRow label="Framework" value="Next.js 16" />
            <SettingRow label="Node" value="20.x" />
          </div>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-tile bg-tint-yellow"><Globe className="h-[18px] w-[18px] text-accent-gold" /></div>
            <div>
              <h2 className="font-heading text-base font-semibold text-text-primary">Market Data</h2>
              <p className="text-[11px] text-text-secondary">Live feed configuration</p>
            </div>
          </div>
          <div className="space-y-2">
            <SettingRow label="Provider" value="Upstox WebSocket" />
            <SettingRow label="Exchanges" value="NSE, BSE" />
            <SettingRow label="Segments" value="EQUITY, F&O" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value, status }: { label: string; value: string; status?: 'active' | 'inactive' }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-primary">{value}</span>
        {status === 'active' && <span className="h-2 w-2 rounded-full bg-profit-green" />}
      </div>
    </div>
  );
}
