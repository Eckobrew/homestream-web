'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Home, Tv, Film, Download, Users, ChevronDown, User, Plus, Server, LogOut, Menu, Compass, ShieldCheck, ListChecks, Music, Disc, Mic2, ListMusic, BookOpen, Youtube, Layers, Settings2, PlaySquare, RefreshCw } from 'lucide-react';
import { useProfile } from '@/context/ProfileContext';

export type NavHub = 'home' | 'movies' | 'series' | 'music' | 'books' | 'youtube' | 'admin';

interface NavbarProps {
  appName?: string;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  isDemoMode?: boolean;
  activeTab: string;
  currentHub?: NavHub;
  hubTab?: string;
  onHubTabChange?: (tab: string) => void;
  canManageIntegrations?: boolean;
  onTabChange: (tab: string) => void;
  onOpenServerSetup?: () => void;
  isExternal?: boolean;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  appName,
  onSearchChange,
  searchQuery,
  activeTab,
  currentHub = 'home',
  hubTab,
  onHubTabChange,
  onTabChange,
  onOpenServerSetup,
  isExternal,
  onLogout,
  onToggleSidebar,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const { profiles, activeProfile, openSelector, selectProfile, canSwitchProfile } = useProfile();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 px-3 sm:px-6 md:px-12 py-2.5 sm:py-3 flex items-center justify-between ${
          isScrolled
            ? 'bg-[#141414] shadow-lg shadow-black/80'
            : 'bg-gradient-to-b from-black/90 via-black/40 to-transparent'
        }`}
      >
        {/* Left side: Logo & Navigation */}
        <div className="flex items-center space-x-2.5 sm:space-x-5 md:space-x-7">
          {/* Sidebar Toggle Hamburger */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 -ml-1 sm:-ml-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Browse Libraries (A–Z)"
              aria-label="Open Library Sidebar"
            >
              <Menu size={22} />
            </button>
          )}

          {/* HomeFlix Logo */}
          <div
            onClick={() => {
              onTabChange('home');
              onSearchChange('');
            }}
            className="cursor-pointer flex items-center select-none group"
          >
            <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-wider text-red-600 transition-transform group-hover:scale-105 duration-200 uppercase">
              {appName || process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream'}
            </span>
          </div>

          {/* Navigation Tabs (Desktop / Tablet) — Specific to current Hub */}
          <div className="hidden md:flex items-center space-x-5 text-sm font-medium">
            {currentHub === 'home' ? (
              <>
                <button
                  onClick={() => {
                    onTabChange('home');
                    onSearchChange('');
                  }}
                  className={`transition-colors ${
                    activeTab === 'home' && !searchQuery
                      ? 'text-white font-bold'
                      : 'text-gray-300 hover:text-gray-100'
                  }`}
                >
                  Watch Now
                </button>
                <button
                  onClick={() => onTabChange('discover')}
                  className={`transition-colors ${
                    activeTab === 'discover'
                      ? 'text-white font-bold'
                      : 'text-gray-300 hover:text-gray-100'
                  }`}
                >
                  Discover
                </button>
                <button
                  onClick={() => onTabChange('requested')}
                  className={`transition-colors ${
                    activeTab === 'requested'
                      ? 'text-white font-bold'
                      : 'text-gray-300 hover:text-gray-100'
                  }`}
                >
                  Requested
                </button>
                <a href="/tv" title="Switch to Leanback TV Mode (Smart TVs, Remotes & Game Consoles)" className="hidden xl:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 transition">TV Mode</a>
              </>
            ) : (
              (currentHub === 'movies' || currentHub === 'series'
                ? [
                    { id: 'featured', label: 'Featured' },
                    { id: 'all', label: 'All' },
                    { id: 'genres', label: 'Genres' },
                  ]
                : currentHub === 'music'
                ? [
                    { id: 'albums', label: 'Albums' },
                    { id: 'artists', label: 'Artists' },
                    { id: 'songs', label: 'Songs' },
                    { id: 'playlists', label: 'Playlists' },
                  ]
                : currentHub === 'books'
                ? [
                    { id: 'shelf', label: 'My Shelf' },
                    { id: 'discover', label: 'Discover' },
                    { id: 'downloads', label: 'Downloads' },
                  ]
                : currentHub === 'youtube'
                ? [
                    { id: 'home', label: 'Home' },
                    { id: 'search', label: 'Search' },
                    { id: 'subscriptions', label: 'Subscriptions' },
                    { id: 'queue', label: 'Queue' },
                    { id: 'archive', label: 'Archive' },
                  ]
                : [
                    { id: 'modules', label: 'Modules' },
                    { id: 'media', label: 'Media Management' },
                    { id: 'playback', label: 'Playback' },
                    { id: 'maintenance', label: 'Maintenance' },
                    { id: 'downloads', label: 'Downloads' },
                    { id: 'system', label: 'System & Profiles' },
                  ]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onHubTabChange?.(t.id)}
                  className={`transition-colors ${
                    hubTab === t.id
                      ? 'text-white font-bold'
                      : 'text-gray-300 hover:text-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right side: Search, Server Indicators, Profile */}
        <div className="flex items-center space-x-2.5 sm:space-x-4 md:space-x-5 text-gray-200">
          {/* Search bar */}
          <div
            className={`flex items-center transition-all duration-300 ${
              isSearchOpen || searchQuery
                ? 'bg-black/80 border border-white/40 px-2 sm:px-3 py-1 rounded-sm w-40 sm:w-56 md:w-72'
                : 'w-7 sm:w-8 justify-end'
            }`}
          >
            <Search
              size={18}
              className="cursor-pointer text-gray-300 hover:text-white shrink-0 sm:w-5 sm:h-5"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            />
            {(isSearchOpen || searchQuery) && (
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
                className="bg-transparent border-none text-white text-xs sm:text-sm outline-none px-1.5 sm:px-2 w-full placeholder-gray-400"
              />
            )}
            {searchQuery && (
              <X
                size={16}
                className="cursor-pointer text-gray-400 hover:text-white shrink-0"
                onClick={() => {
                  onSearchChange('');
                  setIsSearchOpen(false);
                }}
              />
            )}
          </div>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center space-x-1.5 focus:outline-none group cursor-pointer"
              aria-label="Profile menu"
              title={activeProfile ? `Profile: ${activeProfile.name}` : 'Profiles'}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded overflow-hidden border border-white/20 flex items-center justify-center font-bold text-xs text-white shadow select-none transition-transform group-hover:scale-105 bg-gradient-to-br ${
                  activeProfile?.avatarColor || 'from-red-600 to-red-800'
                }`}
              >
                {activeProfile?.avatarUrl ? (
                  <img
                    src={activeProfile.avatarUrl}
                    alt={activeProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{activeProfile?.initials || 'HF'}</span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`text-neutral-400 group-hover:text-white transition-transform hidden sm:block ${
                  isProfileMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Profile Dropdown Menu (Netflix-Style) */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md bg-[#191919] border border-neutral-800 shadow-2xl py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Active user header */}
                <div className="px-3 py-2 border-b border-neutral-800/80">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-xs text-white bg-gradient-to-br ${
                        activeProfile?.avatarColor || 'from-red-600 to-red-800'
                      }`}
                    >
                      {activeProfile?.avatarUrl ? (
                        <img
                          src={activeProfile.avatarUrl}
                          alt={activeProfile.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{activeProfile?.initials || 'HF'}</span>
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-white font-semibold text-sm truncate capitalize">
                        {activeProfile?.name || `${appName || 'HomeStream'} User`}
                      </p>
                      <p className="text-[11px] text-emerald-400 flex items-center space-x-1">
                        <span>{canSwitchProfile ? 'Active Profile' : 'Profile Locked'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Switch or manage profiles across LAN and external sessions */}
                {canSwitchProfile && (
                  <>
                    {/* Switch to other profiles */}
                    {profiles.filter((p) => p.id !== activeProfile?.id).length > 0 && (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                          Switch Profile
                        </div>
                        {profiles
                          .filter((p) => p.id !== activeProfile?.id)
                          .map((profile) => (
                            <button
                              key={profile.id}
                              onClick={() => {
                                selectProfile(profile.id);
                                setIsProfileMenuOpen(false);
                              }}
                              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-neutral-800/80 text-left transition-colors cursor-pointer group"
                            >
                              <div
                                className={`w-6 h-6 rounded shrink-0 flex items-center justify-center font-bold text-[10px] text-white bg-gradient-to-br ${
                                  profile.avatarColor
                                } group-hover:ring-1 group-hover:ring-white`}
                              >
                                {profile.avatarUrl ? (
                                  <img
                                    src={profile.avatarUrl}
                                    alt={profile.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{profile.initials}</span>
                                )}
                              </div>
                              <span className="text-neutral-300 group-hover:text-white capitalize text-xs truncate">
                                {profile.name}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}

                    <div className="border-t border-neutral-800/80 my-1" />

                    {/* Add Profile & Manage Profiles */}
                    <button
                      onClick={() => {
                        openSelector();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 flex items-center space-x-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors text-xs cursor-pointer"
                    >
                      <Plus size={15} className="text-neutral-400" />
                      <span>Add Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        openSelector();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 flex items-center space-x-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors text-xs cursor-pointer"
                    >
                      <Users size={15} className="text-neutral-400" />
                      <span>Who&apos;s watching?</span>
                    </button>
                  </>
                )}

                {onOpenServerSetup && (
                  <>
                    <div className="border-t border-neutral-800/80 my-1" />

                    <button
                      onClick={() => {
                        onOpenServerSetup();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center space-x-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors text-xs cursor-pointer"
                    >
                      <Server size={15} className="text-neutral-400" />
                      <span>Server Settings</span>
                    </button>
                  </>
                )}

                {onLogout && (
                  <>
                    <div className="border-t border-neutral-800/80 my-1" />
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 flex items-center space-x-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-xs cursor-pointer"
                    >
                      <LogOut size={15} className="text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar — Specific to current Hub */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 border-t border-neutral-800/80 backdrop-blur-lg flex items-center justify-around gap-1 overflow-x-auto py-1.5 px-1 pb-safe shadow-[0_-10px_25px_rgba(0,0,0,0.8)]">
        {currentHub === 'home' ? (
          <>
            <button
              onClick={() => {
                onTabChange('home');
                onSearchChange('');
              }}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                activeTab === 'home' && !searchQuery
                  ? 'text-red-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Home size={19} />
              <span className="text-[10px] tracking-tight">Watch Now</span>
            </button>

            <button
              onClick={() => onTabChange('discover')}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                activeTab === 'discover'
                  ? 'text-red-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Compass size={19} />
              <span className="text-[10px] tracking-tight">Discover</span>
            </button>
            <button
              onClick={() => onTabChange('requested')}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 ${
                activeTab === 'requested' ? 'text-red-500 font-bold' : 'text-neutral-400'
              }`}
            >
              <ListChecks size={19} />
              <span className="text-[10px]">Requested</span>
            </button>
          </>
        ) : currentHub === 'movies' || currentHub === 'series' ? (
          [
            { id: 'featured', label: 'Featured', icon: currentHub === 'movies' ? Film : Tv },
            { id: 'all', label: 'All', icon: Layers },
            { id: 'genres', label: 'Genres', icon: Compass },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onHubTabChange?.(id)}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                hubTab === id ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </button>
          ))
        ) : currentHub === 'music' ? (
          [
            { id: 'albums', label: 'Albums', icon: Disc },
            { id: 'artists', label: 'Artists', icon: Mic2 },
            { id: 'songs', label: 'Songs', icon: Music },
            { id: 'playlists', label: 'Playlists', icon: ListMusic },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onHubTabChange?.(id)}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                hubTab === id ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </button>
          ))
        ) : currentHub === 'books' ? (
          [
            { id: 'shelf', label: 'My Shelf', icon: BookOpen },
            { id: 'discover', label: 'Discover', icon: Compass },
            { id: 'downloads', label: 'Downloads', icon: Download },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onHubTabChange?.(id)}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                hubTab === id ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </button>
          ))
        ) : currentHub === 'youtube' ? (
          [
            { id: 'home', label: 'Home', icon: Youtube },
            { id: 'search', label: 'Search', icon: Search },
            { id: 'subscriptions', label: 'Subs', icon: Users },
            { id: 'queue', label: 'Queue', icon: Download },
            { id: 'archive', label: 'Archive', icon: Layers },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onHubTabChange?.(id)}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                hubTab === id ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </button>
          ))
        ) : (
          [
            { id: 'modules', label: 'Modules', icon: Settings2 },
            { id: 'media', label: 'Media', icon: Server },
            { id: 'playback', label: 'Playback', icon: PlaySquare },
            { id: 'maintenance', label: 'Maint', icon: RefreshCw },
            { id: 'downloads', label: 'Downloads', icon: Download },
            { id: 'system', label: 'System', icon: ShieldCheck },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onHubTabChange?.(id)}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-2.5 transition-colors ${
                hubTab === id ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
};
