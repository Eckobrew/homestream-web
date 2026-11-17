import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchTvProfiles, fetchTvAuth, getBackendUrl } from '@/lib/tv-api';

export const metadata: Metadata = {
  title: { absolute: "Who's Watching? · HomeStream TV" },
  robots: { index: false, follow: false },
};

async function selectProfile(formData: FormData) {
  'use server';
  const profileId = formData.get('profileId') as string;
  if (profileId) {
    const cookieStore = await cookies();
    const session = cookieStore.get('homeflix_session')?.value;
    await fetch(`${getBackendUrl()}/api/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Cookie: `homeflix_session=${session}` } : {}),
      },
      body: JSON.stringify({ action: 'select', profileId }),
    }).catch(() => null);
    cookieStore.set('homeflix_profile_id', profileId, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      httpOnly: false,
    });
  }
  redirect('/tv');
}

async function createProfile(formData: FormData) {
  'use server';
  const name = ((formData.get('name') as string) || '').trim();
  const isKids = formData.get('isKids') === 'on';
  if (!name) {
    redirect('/tv/profiles');
  }
  const cookieStore = await cookies();
  const session = cookieStore.get('homeflix_session')?.value;
  const res = await fetch(`${getBackendUrl()}/api/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Cookie: `homeflix_session=${session}` } : {}),
    },
    body: JSON.stringify({ action: 'create', name, isKids }),
  }).catch(() => null);

  if (res?.ok) {
    const data = await res.json().catch(() => null);
    const createdId = data?.profile?.id;
    if (createdId) {
      cookieStore.set('homeflix_profile_id', createdId, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
        httpOnly: false,
      });
    }
  }
  redirect('/tv');
}

export default async function TvProfilesPage() {
  const [auth, profileData] = await Promise.all([
    fetchTvAuth(),
    fetchTvProfiles(),
  ]);

  const needsSetup = Boolean(profileData.needsSetup || profileData.profiles.length === 0);
  if (!auth.isLocalOrTailscale && !profileData.canSwitchProfile && !needsSetup) {
    redirect('/tv');
  }

  const { profiles, activeProfileId } = profileData;

  const colorMap: Record<string, string> = {
    'from-red-600 to-red-800': '#b91c1c',
    'from-blue-600 to-blue-800': '#1d4ed8',
    'from-emerald-600 to-emerald-800': '#047857',
    'from-purple-600 to-purple-800': '#6d28d9',
    'from-amber-600 to-amber-800': '#b45309',
    'from-pink-600 to-pink-800': '#be185d',
    'from-cyan-600 to-cyan-800': '#0e7490',
  };

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '38px', fontWeight: 900, marginBottom: '12px', color: '#ffffff' }}>
        {needsSetup ? 'Create Your First Profile' : "Who's Watching?"}
      </h1>
      <p style={{ color: '#aaaaaa', fontSize: '18px', marginBottom: '40px' }}>
        {needsSetup
          ? 'Set up a profile to personalize continue watching, playlists, and parental controls.'
          : 'Select your profile to customize continue watching, recommendations, and parental settings.'}
      </p>

      {needsSetup && (
        <form
          action={createProfile}
          style={{
            maxWidth: '480px',
            margin: '0 auto 40px auto',
            padding: '28px',
            backgroundColor: '#1b1b1b',
            borderRadius: '16px',
            border: '2px solid #333333',
            textAlign: 'left',
          }}
        >
          <label style={{ display: 'block', fontSize: '15px', fontWeight: 'bold', color: '#cccccc', marginBottom: '8px' }}>
            Profile Name
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Nathan or Kids"
            tabIndex={0}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#262626',
              border: '2px solid #444444',
              color: '#ffffff',
              fontSize: '16px',
              marginBottom: '16px',
              boxSizing: 'border-box',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cccccc', fontSize: '15px', marginBottom: '20px', cursor: 'pointer' }}>
            <input type="checkbox" name="isKids" style={{ width: '18px', height: '18px' }} />
            <span>Kids Profile (PG-rated content only)</span>
          </label>
          <button
            type="submit"
            tabIndex={0}
            className="tv-btn tv-btn-play"
            style={{ width: '100%', padding: '14px', fontSize: '17px', cursor: 'pointer' }}
          >
            Create Profile &amp; Continue
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '30px' }}>
        {profiles.map((profile) => {
          const bg = colorMap[profile.avatarColor || ''] || '#e50914';
          const isActive = profile.id === activeProfileId;

          return (
            <form key={profile.id} action={selectProfile} style={{ margin: 0 }}>
              <input type="hidden" name="profileId" value={profile.id} />
              <button
                type="submit"
                tabIndex={0}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  borderRadius: '16px',
                  backgroundColor: '#1e1e1e',
                  width: '160px',
                }}
              >
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '12px',
                    backgroundColor: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 900,
                    color: '#ffffff',
                    marginBottom: '14px',
                    border: isActive ? '4px solid #ffffff' : '2px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {profile.initials || profile.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: isActive ? '#ffffff' : '#cccccc',
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile.name}
                </span>
                {isActive && (
                  <span
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      color: '#e50914',
                      letterSpacing: '1px',
                    }}
                  >
                    Active
                  </span>
                )}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
