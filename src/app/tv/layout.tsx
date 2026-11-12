import React from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchTvAuth } from '@/lib/tv-api';
import './tv.css';

export const metadata = {
  title: 'HomeStream TV',
  description: '10-Foot Leanback Interface for Smart TVs',
};

export default async function TvLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') || '';
  const isLoginPage = pathname === '/tv/login';

  const auth = await fetchTvAuth();

  // If external user requires auth and is not yet authenticated, redirect to /tv/login
  if (auth.requiresAuth && !auth.isAuthenticated && !isLoginPage) {
    redirect('/tv/login');
  }

  return (
    <div className="tv-root">
      {/* Top TV Navigation */}
      <header className="tv-header">
        <a href="/tv" className="tv-logo" tabIndex={0}>
          HOMESTREAM <span style={{ fontSize: '13px', color: '#aaaaaa', fontWeight: 'bold' }}>TV</span>
        </a>
        <nav className="tv-nav">
          <a href="/tv" className="tv-nav-link" tabIndex={0}>
            Home
          </a>
          <a href="/tv/tv" className="tv-nav-link" tabIndex={0}>
            TV Shows
          </a>
          <a href="/tv/movies" className="tv-nav-link" tabIndex={0}>
            Movies
          </a>
          <a href="/tv/music" className="tv-nav-link" tabIndex={0}>
            Music
          </a>
          <a href="/tv/youtube" className="tv-nav-link" tabIndex={0}>
            YouTube
          </a>
          <a href="/tv/discover" className="tv-nav-link" tabIndex={0}>
            Discover
          </a>
          <a href="/tv/requested" className="tv-nav-link" tabIndex={0}>
            Requested
          </a>
          <a href="/tv/search" className="tv-nav-link" tabIndex={0}>
            Search
          </a>

          {auth.isLocalOrTailscale ? (
            <a href="/tv/profiles" className="tv-nav-link" tabIndex={0} style={{ backgroundColor: '#2a2a2a' }}>
              Profiles
            </a>
          ) : (
            <>
              {auth.user?.name && (
                <span style={{ display: 'inline-flex', alignItems: 'center', color: '#aaaaaa', fontSize: '14px', margin: '0 8px', fontWeight: 'bold' }}>
                  👤 {auth.user.name}
                </span>
              )}
              <a href="/tv/logout" className="tv-nav-link" tabIndex={0} style={{ backgroundColor: '#4a1515', color: '#ffaaaa' }}>
                Sign Out
              </a>
            </>
          )}

          <a href="/" className="tv-nav-link" tabIndex={0} style={{ backgroundColor: '#222222', color: '#777777' }}>
            Exit TV
          </a>
        </nav>
      </header>

      {/* Main TV Page Content */}
      <main>{children}</main>

      {/* Embedded ES5 remote control handler for Tizen / Smart TV remotes */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              window.addEventListener('keydown', function(e) {
                var code = e.keyCode || e.which;
                // Tizen Return / Back (10009), WebOS Back (461), Esc (27)
                if (code === 10009 || code === 27 || code === 461) {
                  if (window.location.pathname !== '/tv') {
                    e.preventDefault();
                    window.history.back();
                  }
                }
              });

              // Initial focus on first interactive element for D-pad navigation
              window.addEventListener('DOMContentLoaded', function() {
                var first = document.querySelector('a, button, input, [tabindex="0"]');
                if (first && !document.activeElement) {
                  first.focus();
                }
              });
            })();
          `,
        }}
      />
    </div>
  );
}
