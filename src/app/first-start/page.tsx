'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/api/client';
import { InitialSetupModal } from '@/components/InitialSetupModal';
import { ShieldCheck, UserPlus, CheckCircle2, ArrowRight, Server, Users } from 'lucide-react';

export default function FirstStartPage() {
  const [step, setStep] = useState<'account' | 'profile' | 'integrations' | 'done'>('account');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  useEffect(() => {
    apiFetch('/api/accounts?status=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.needsFirstStart === false) {
          setStep('integrations');
        }
      })
      .catch(() => {});
  }, []);

  async function handleCreateAdminAccount(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bootstrap',
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create admin account');
      setProfileName(displayName.trim() || username.trim());
      setStep('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account setup failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateFirstProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: profileName.trim(),
          paletteIndex: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create first profile');
      setStep('integrations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400">
          <ShieldCheck size={24} />
          <span className="text-xs font-bold uppercase tracking-widest">HomeStream First Start</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold">
          {step === 'account' && 'Create your administrator account'}
          {step === 'profile' && 'Create your first profile'}
          {step === 'integrations' && 'Connect your media integrations'}
          {step === 'done' && 'HomeStream is ready'}
        </h1>

        {error && (
          <p role="alert" className="text-sm text-red-300 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {step === 'account' && (
          <form onSubmit={handleCreateAdminAccount} className="space-y-4">
            <p className="text-sm text-neutral-400">
              Set up your primary HomeStream login account. You can add additional accounts and profiles anytime in the Admin Panel.
            </p>
            <label className="block text-sm text-neutral-300">
              Username
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nathan"
                className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-black/50 p-3 text-white"
              />
            </label>
            <label className="block text-sm text-neutral-300">
              Display Name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nathan"
                className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-black/50 p-3 text-white"
              />
            </label>
            <label className="block text-sm text-neutral-300">
              Password (min 4 characters)
              <input
                required
                type="password"
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-black/50 p-3 text-white"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <UserPlus size={18} />
              <span>{busy ? 'Creating Account…' : 'Create Admin Account & Continue'}</span>
            </button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleCreateFirstProfile} className="space-y-4">
            <p className="text-sm text-neutral-400">
              Every account holds one or more viewing profiles. Create your first profile now.
            </p>
            <label className="block text-sm text-neutral-300">
              Profile Name
              <input
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Nathan"
                className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-black/50 p-3 text-white"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Users size={18} />
              <span>{busy ? 'Creating Profile…' : 'Create First Profile'}</span>
            </button>
          </form>
        )}

        {step === 'integrations' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">
              Connect Jellyfin, Jellyseerr, Radarr, Sonarr, qBittorrent, Soulseek (slskd), or TMDB.
            </p>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 font-bold flex items-center justify-center gap-2 transition"
            >
              <Server size={18} />
              <span>Open Integrations Wizard</span>
            </button>
            <a
              href="/admin"
              className="w-full py-3 rounded-lg border border-neutral-700 hover:bg-neutral-800 font-semibold flex items-center justify-center gap-2 transition text-sm"
            >
              <span>Manage Accounts &amp; Modules in Admin Panel</span>
              <ArrowRight size={16} />
            </a>
            <a
              href="/"
              className="w-full py-2.5 rounded-lg text-neutral-400 hover:text-white text-center block text-sm"
            >
              Skip to HomeStream
            </a>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 font-bold transition"
            >
              <span>Enter HomeStream</span>
              <ArrowRight size={18} />
            </a>
          </div>
        )}
      </div>

      <InitialSetupModal
        isOpen={showIntegrationsModal}
        onClose={() => setShowIntegrationsModal(false)}
        onComplete={() => {
          setShowIntegrationsModal(false);
          setStep('done');
        }}
      />
    </main>
  );
}
