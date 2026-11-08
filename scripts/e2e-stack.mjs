import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const backend = resolve(process.env.HOMESTREAM_BACKEND_DIR || '../homestream-backend');
const directory = await mkdtemp(join(tmpdir(), 'homestream-browser-'));
const children = [];
const env = { HOMESTREAM_DEMO_MODE: 'true', ...process.env, DATA_DIR: directory, JELLYFIN_URL: '', JELLYFIN_API_KEY: '', SEERR_URL: '', SEERR_API_KEY: '', QBITTORRENT_URL: '', NEXT_PUBLIC_JELLYFIN_URL: '', NEXT_PUBLIC_SEERR_URL: '', NEXT_PUBLIC_QBITTORRENT_URL: '', HOMESTREAM_EXTERNAL_URL: 'http://127.0.0.1:3300', HOMESTREAM_SESSION_SECRET: 'browser-test-session-secret-32-characters', HOMESTREAM_MOBILE_TOKEN: 'browser-test-mobile-token-32-characters', HOMESTREAM_TRUSTED_PROXIES: '127.0.0.1,::1', HOST: '127.0.0.1', HOSTNAME: '127.0.0.1', NEXT_TELEMETRY_DISABLED: '1' };
children.push(spawn(process.execPath, ['dist/server.js'], { cwd: backend, env: { ...env, PORT: '3301' }, stdio: 'inherit' }));
children.push(spawn(process.execPath, ['.next/standalone/server.js'], { env: { ...env, PORT: '3302', HOMESTREAM_BACKEND_URL: 'http://127.0.0.1:3301' }, stdio: 'inherit' }));
const jellyfin = createServer((incoming,outgoing) => {
  const route = new URL(incoming.url,'http://fixture').pathname;
  outgoing.setHeader('content-type','application/json');
  if (route === '/System/Info/Public') outgoing.end(JSON.stringify({ServerName:'Test Jellyfin',Version:'10.10.0'}));
  else if (route === '/Users') outgoing.end(JSON.stringify([{Id:'viewer',Name:'Viewer',Policy:{IsAdministrator:false}}]));
  else if (route === '/Users/AuthenticateByName') { outgoing.writeHead(503); outgoing.end('{}'); }
  else if (route.includes('/Items') || route.includes('/Resume')) outgoing.end(JSON.stringify({Items:[]}));
  else outgoing.end(JSON.stringify({Items:[]}));
});
jellyfin.listen(3303,'127.0.0.1');
const gateway = createServer((incoming, outgoing) => {
  const api = incoming.url.startsWith('/api/');
  const headers = { ...incoming.headers, 'x-forwarded-for': incoming.socket.remoteAddress };
  for (const name of ['forwarded','x-real-ip','cf-connecting-ip','x-homestream-socket','x-homestream-proof']) delete headers[name];
  const upstream = request({ host: '127.0.0.1', port: api ? 3301 : 3302, method: incoming.method, path: incoming.url, headers }, response => {
    outgoing.writeHead(response.statusCode, response.headers);
    response.pipe(outgoing);
  });
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
  outgoing.on('close', () => upstream.destroy());
  incoming.pipe(upstream);
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  gateway.closeAllConnections(); gateway.close();
  jellyfin.closeAllConnections(); jellyfin.close();
  for (const child of children) child.kill('SIGTERM');
  await Promise.all(children.map(child => child.exitCode !== null ? undefined : new Promise(resolve => child.once('exit',resolve))));
  await rm(directory, { recursive:true, force:true });
}
for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => { void stop(); });
try {
  for (let attempts = 0; ; attempts++) {
    try {
      const checks = await Promise.all([fetch('http://127.0.0.1:3301/health/ready'),fetch('http://127.0.0.1:3302/health')]);
      if (checks.every(response => response.ok)) break;
    } catch {}
    if (attempts > 100 || children.some(child => child.exitCode !== null)) throw new Error('E2E services failed to start');
    await new Promise(resolve => setTimeout(resolve,250));
  }
  gateway.listen(3300,'127.0.0.1');
} catch (error) { console.error(error.message); await stop(); process.exitCode=1; }
