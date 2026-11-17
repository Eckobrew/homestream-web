# HomeStream Web

Next.js 15 App Router Web & TV UI for HomeStream.

Part of the [HomeStream](https://github.com/Eckobrew/homestream) platform.

## Features

- **Video Player (`BuiltinPlayer`)**: Adaptive `hls.js` playback, Trickplay hover seek thumbnails, multi-version & audio/subtitle track switching, Skip Intro/Credits, Watch Stats, and SyncPlay.
- **TV Mode (`/tv`)**: D-pad friendly 10-foot interface for smart TVs and set-top boxes.
- **Music (`MusicBrowser` & `MusicPlayer`)**: Browse albums, artists, and playlists; persistent volume/mute state across tracks; smooth auto-scroll to opened album/artist/playlist track listings.
- **Books (`BookReader`)**: Built-in EPUB and PDF reader.
- **Admin (`/admin`)**:
  - Integration configuration with live **Radarr/Sonarr quality profile** and **slskd audio quality** selectors.
  - Native Media Engine scan, TMDB settings, Trickplay toggle, and active stream/download management.
  - Account, profile, and Kids parental control management.

## Development

```bash
npm ci
npm run lint
npm run build
npm run test:player
npm run test:contract
```
