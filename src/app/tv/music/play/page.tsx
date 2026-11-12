import React from 'react';

export const revalidate = 0;

export default async function TvMusicPlayPage({
  searchParams,
}: {
  searchParams: Promise<{
    streamUrl?: string;
    title?: string;
    artist?: string;
    album?: string;
    cover?: string;
  }>;
}) {
  const { streamUrl = '', title = 'Unknown Title', artist = 'Unknown Artist', album = '', cover = '' } = await searchParams;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '40px', backgroundColor: '#181818', borderRadius: '16px', border: '2px solid #333333', textAlign: 'center' }}>
      <div style={{ width: '280px', height: '280px', margin: '0 auto 28px auto', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.8)', backgroundColor: '#111111' }}>
        {cover ? (
          <img src={cover} alt={album || title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>
            🎵
          </div>
        )}
      </div>

      <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0' }}>{title}</h1>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1DB954', margin: '0 0 6px 0' }}>{artist}</h2>
      {album && <p style={{ fontSize: '15px', color: '#aaaaaa', margin: '0 0 24px 0' }}>{album}</p>}

      {/* HTML5 Audio Player */}
      <audio
        id="tv-audio"
        controls
        autoPlay
        src={streamUrl}
        style={{ width: '100%', maxWidth: '500px', margin: '0 auto 28px auto', display: 'block' }}
      >
        Your TV browser does not support HTML5 audio playback.
      </audio>

      <div>
        <button
          id="tv-audio-toggle"
          tabIndex={0}
          className="tv-btn tv-btn-play"
          style={{ fontSize: '18px', padding: '14px 28px', marginRight: '16px', cursor: 'pointer' }}
        >
          ⏯ Play / Pause
        </button>
        <button
          id="tv-audio-back"
          tabIndex={0}
          className="tv-btn tv-btn-sec"
          style={{ fontSize: '18px', padding: '14px 28px', cursor: 'pointer' }}
        >
          ◀ Return
        </button>
      </div>

      {/* ES5 TV remote listener for audio controls */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var audio = document.getElementById('tv-audio');
              var toggle = document.getElementById('tv-audio-toggle');
              var back = document.getElementById('tv-audio-back');

              if (toggle && audio) {
                toggle.onclick = function() {
                  if (audio.paused) { audio.play(); } else { audio.pause(); }
                };
              }
              if (back) {
                back.onclick = function() {
                  window.history.back();
                };
              }

              window.addEventListener('keydown', function(e) {
                var code = e.keyCode || e.which;
                if (code === 10009 || code === 27 || code === 461) {
                  e.preventDefault();
                  if (audio) { audio.pause(); }
                  window.history.back();
                  return;
                }
                if (code === 415 && audio) { audio.play(); }
                if (code === 19 && audio) { audio.pause(); }
                if (code === 413 && audio) { audio.pause(); window.history.back(); }
              });

              if (toggle) { toggle.focus(); }
            })();
          `,
        }}
      />
    </div>
  );
}
