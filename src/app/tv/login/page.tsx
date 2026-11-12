import React from 'react';

export const metadata = {
  title: 'Sign In - HomeStream TV',
};

export default async function TvLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div style={{ maxWidth: '600px', margin: '60px auto', padding: '40px', backgroundColor: '#1c1c1c', borderRadius: '16px', border: '2px solid #333333' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#e50914', letterSpacing: '2px', margin: '0 0 10px 0' }}>
          HOMESTREAM <span style={{ fontSize: '18px', color: '#aaaaaa' }}>TV</span>
        </h1>
        <p style={{ color: '#aaaaaa', fontSize: '16px', margin: 0 }}>
          External Internet Connection Detected. Sign in with your Jellyfin credentials to continue.
        </p>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', backgroundColor: '#4a1515', border: '2px solid #e50914', borderRadius: '8px', color: '#ffaaaa', marginBottom: '24px', fontSize: '15px', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <form action="/api/tv/login" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label htmlFor="username" style={{ display: 'block', fontSize: '15px', fontWeight: 'bold', color: '#dddddd', marginBottom: '8px' }}>
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            tabIndex={0}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              backgroundColor: '#121212',
              border: '2px solid #444444',
              borderRadius: '8px',
              color: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label htmlFor="password" style={{ display: 'block', fontSize: '15px', fontWeight: 'bold', color: '#dddddd', marginBottom: '8px' }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            tabIndex={0}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              backgroundColor: '#121212',
              border: '2px solid #444444',
              borderRadius: '8px',
              color: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          tabIndex={0}
          style={{
            marginTop: '12px',
            padding: '18px',
            backgroundColor: '#e50914',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
