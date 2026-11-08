import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const spec = JSON.parse(await readFile(new URL('../src/api/openapi.json', import.meta.url)));
assert.equal(spec.info.version, '1.2.0');
for (const name of ['home', 'profiles', 'playback', 'config', 'media/{id}', 'library/{type}', 'requested', 'music', 'music/stream', 'integrations']) assert.ok(spec.paths[`/api/v1/${name}`]);
const models = await readFile(new URL('../src/api/models.ts', import.meta.url), 'utf8');
assert.ok(!models.includes('interface ServerConfig'));
assert.ok(!models.includes('jellyfinApiKey'));
console.info('Public contract snapshot and secret separation checked');
