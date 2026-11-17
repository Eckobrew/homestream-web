import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/playback-capabilities.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
const { browserPlaybackParameters, browserDecoderParameters } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const codecs = browserPlaybackParameters(mime => mime.includes('avc1') || mime.includes('av01') || mime === 'audio/mpeg' ? 'probably' : '');
assert.equal(codecs.get('receiver'), 'browser');
assert.equal(codecs.get('videoCodecs'), 'h264,av1');
assert.equal(codecs.get('audioCodecs'), 'mp3');
assert.ok(!codecs.get('videoCodecs').includes('hevc'));
assert.equal(browserPlaybackParameters(() => '').get('videoCodecs'), '');
console.log('Browser capability checks passed: advertised codecs follow actual decoder support.');

assert.equal(browserPlaybackParameters(mime => mime.includes('hev1.') ? 'probably' : '').get('videoCodecs'), 'hevc');
assert.equal(browserPlaybackParameters(mime => mime.includes('ec-3') ? 'probably' : '').get('audioCodecs'), 'eac3');
const hd = await browserDecoderParameters(() => 'probably', async config => ({ supported: config.video.width <= 1920 && !config.video.contentType.includes('hvc1.2.') && !config.video.contentType.includes('hev1.2.') }));
const profiles = JSON.parse(hd.get('videoCapabilities'));
assert.ok(profiles.every(p => p.width === 1920 && p.height === 1080));
assert.deepEqual(profiles.find(p => p.codec === 'hevc').profiles, ['main']);
const noDecoder = await browserDecoderParameters(() => 'probably', async () => ({ supported: false }));
assert.equal(noDecoder.get('videoCodecs'), '');
const unavailable = await browserDecoderParameters(() => 'probably', async () => { throw new Error('API unavailable'); });
assert.equal(unavailable.has('videoCapabilities'), false);
assert.ok(unavailable.get('videoCodecs').includes('hevc'));
console.log('Dynamic profile, resolution, alias, audio, and API fallback checks passed.');
