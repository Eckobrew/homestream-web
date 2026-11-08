# HomeStream web

Independent React/Next.js/TypeScript frontend extracted from [Eckobrew/HomeStream](https://github.com/Eckobrew/HomeStream), revision `7505a9b06ce44770f7ddb86904633e478b6988e1`.

Requires Node.js 22+. Integration credentials, persistent data and FFmpeg belong in the separate `homestream-backend` repository.

```bash
npm ci
npm run dev
```

During development, Next.js forwards `/api/*` to `HOMESTREAM_BACKEND_URL` (default `http://127.0.0.1:3001`). Because this is proxied, it does not grant direct local pairing or local authentication bypass; use Jellyfin login or an authenticated setup token for development. In production the reference backend deployment routes `/api/*` directly to the backend and all other paths to this application.

```bash
npm run test:contract
npm run test:playback
npm run build
PORT=3002 HOSTNAME=127.0.0.1 npm start
```

`src/api/` is a checked-in release snapshot of `@eckobrew/homestream-api@1.1.0`, published by the backend. It contains no backend implementation or secrets. Browser API calls use the canonical `/api/v1/*` paths; existing resource URLs retain compatibility. Update the contract with `node scripts/sync-contract.mjs /path/to/unpacked/api-package`, review the diff, then run the checks above. Both applications can build and release independently.

The sitemap retrieves media links over the backend API only for a signed-in session. Background or unauthenticated requests receive static links and cannot obtain access from the UI server's private network identity. Metadata, OpenGraph images, local fonts, player behavior and deep links remain in Next.js.

The backend repository supplies the Compose/gateway deployment, LXC scripts, migration guide and improvement plan. The Docker image contains only the web runtime and has its own `/health` endpoint. Public branding and URL variables are build-time Docker arguments; no integration secret is needed to build this image.

Browser integration checks: install Chromium with `npx playwright install chromium`, build the sibling backend, then run `npm run test:e2e`. The test command starts both services and a local gateway. Set `HOMESTREAM_E2E_URL` to test an already running Compose deployment instead. First-run and login-error tests use the real API; the browsing test mocks configured profile/setup state and uses the real demo catalog.

To enable cross-repository browser checks in GitHub Actions, set `HOMESTREAM_BACKEND_REF` to a tested backend release tag or commit. Ordinary web builds remain independent when this optional integration job is disabled.

Version 1.1 unifies first-run setup, separates playback responsibilities into `src/player`, fixes per-episode progress/cancellation, and uses local demo artwork. Demo mode must be enabled on the backend. Lint enforcement covers extracted modules; the backend repository documents SQLite migration and generated Kotlin clients.

## Docker image publishing

Successful `main` CI runs publish Linux amd64 images to `ghcr.io/eckobrew/homestream-web` with `edge` and full `sha-<commit>` tags. Main publication waits for verification (and enabled browser integration checks in the web repository). Pull requests do not receive registry write access or publish images.

Pushing a `vX.Y.Z` tag publishes the corresponding version; stable version tags also update `latest`, while prereleases do not. Each publishing workflow starts the built image as UID 1001 and checks readiness before pushing that exact image. Authentication uses the workflow's short-lived `GITHUB_TOKEN`, with `packages: write` scoped to publishing; no personal token secret is required.

Use a commit tag or image digest for controlled deployments. `edge` tracks tested main and is not an automatic production redeployment. Pair tested backend/web revisions before upgrading. Newly created GHCR packages default to private; package visibility must be public to permit anonymous pulls.
