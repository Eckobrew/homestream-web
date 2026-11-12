import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchTvProfiles, fetchTvAuth } from '@/lib/tv-api';

export const metadata = {
  title: "Who's Watching? - HomeStream TV",
};

async function selectProfile(formData: FormData) {
  'use server';
  const profileId = formData.get('profileId') as string;
  if (profileId) {
    const cookieStore = await cookies();
    cookieStore.set('homeflix_profile_id', profileId, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      httpOnly: false,
    });
  }
  redirect('/tv');
}

export default async function TvProfilesPage() {
  const [auth, profileData] = await Promise.all([
    fetchTvAuth(),
    fetchTvProfiles(),
  ]);

  // If external connection: no profile switcher allowed!
  if (!auth.isLocalOrTailscale || profileData.isExternal || !profileData.canSwitchProfile) {
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
        Who&apos;s Watching?
      </h1>
      <p style={{ color: '#aaaaaa', fontSize: '18px', marginBottom: '40px' }}>
        Select your profile to customize continue watching, recommendations, and parental settings.
      </p>

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
