import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let directory:string;
let video:Buffer;
test.beforeAll(() => {
  directory=mkdtempSync(join(tmpdir(),'homestream-player-'));
  const file=join(directory,'fixture.webm');
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=black:s=320x180:r=24:d=60','-c:v','libvpx','-g','24','-b:v','100k',file]);
  video=readFileSync(file);
});
test.afterAll(() => rmSync(directory,{recursive:true,force:true}));
const episodes=[1,2].map(number=>({id:`episode${number}`,name:`Episode ${number}`,seasonNumber:1,episodeNumber:number,durationMinutes:1,thumbnailUrl:'/demo-poster.svg',playbackPositionTicks:number===1?100000000:0}));
const series={id:'series',title:'Test Series',type:'Series',source:'native',status:'available',overview:'Player fixture',genres:[],posterUrl:'/demo-poster.svg',backdropUrl:'/demo-backdrop.svg',playableEpisodeId:'episode1',durationMinutes:1,playbackPositionTicks:100000000,seasons:[{id:'season1',seasonNumber:1,name:'Season 1',episodeCount:2,episodes}]};
async function fixture(page:import('@playwright/test').Page,fail=false) {
  const progress:Record<string,unknown>[]=[];
  await page.route('**/api/v1/accounts?status=1', route => route.fulfill({ json: { needsFirstStart: false } }));
  await page.route('**/api/v1/config',route=>route.fulfill({json:{appName:'HomeStream',isConfigured:true,isSetupNeeded:false,mediaEngine:'native'}}));
  await page.route('**/api/v1/profiles**',route=>route.fulfill({json:{profiles:[{id:'viewer',name:'Viewer'}],activeProfileId:'viewer',needsSetup:false}}));
  await page.route('**/api/v1/home**',route=>route.fulfill({json:{hero:null,sections:[],heroItems:[],isDemoMode:false}}));
  await page.route('**/api/v1/media/**',route=>route.fulfill({json:{item:series}}));
  await page.route('**/api/v1/subtitles**',route=>route.fulfill({json:{subtitles:[{id:'english',index:0,title:'English',language:'en',src:'/fixture.vtt'}]}}));
  await page.route('**/fixture.vtt',route=>route.fulfill({contentType:'text/vtt',body:'WEBVTT\n\n00:00:00.000 --> 00:01:00.000\nTest captions\n'}));
  await page.route('**/fixture.webm**',route=>{
    const range=route.request().headers()['range'];
    const match=/bytes=(\d+)-(\d*)/.exec(range||'');
    const start=match?Number(match[1]):0;const end=match?.[2]?Math.min(Number(match[2]),video.length-1):video.length-1;
    return route.fulfill({status:match?206:200,contentType:'video/webm',headers:{'Accept-Ranges':'bytes',...(match?{'Content-Range':`bytes ${start}-${end}/${video.length}`}:{})},body:video.subarray(start,end+1)});
  });
  await page.route('**/api/v1/playback?**',route=>route.fulfill(fail?{status:503,json:{error:'Test upstream unavailable'}}:{json:{streamUrl:'/fixture.webm',isTranscoding:false,durationSeconds:60,contentType:'video/webm'}}));
  await page.route('**/api/v1/playback/progress',route=>{progress.push(route.request().postDataJSON());return route.fulfill({json:{success:true}});});
  return progress;
}
test('resume, pause, seek, subtitles, episode changes and close preserve the playback session',async({page})=>{
  const progress=await fixture(page);
  await page.goto('/?watch=series');
  const player=page.locator('[data-playback-state]');
  await expect(player).toHaveAttribute('data-playback-state','playing');
  await expect.poll(()=>page.locator('video').first().evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeGreaterThan(9);
  await page.keyboard.press('k');
  await expect(player).toHaveAttribute('data-playback-state','paused');
  await page.keyboard.press('ArrowRight');
  await expect.poll(()=>page.locator('video').first().evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeGreaterThan(19);
  await page.keyboard.press('c');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect.poll(()=>page.locator('video').first().evaluate(video=>(video as HTMLVideoElement).textTracks[0]?.mode)).toBe('showing');
  await page.keyboard.press('n');
  await expect.poll(()=>progress.some(value=>value.itemId==='episode1'&&value.isStopped===true)).toBe(true);
  await expect(page.getByText(/Episode 2/).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(player).toHaveCount(0);
  await expect.poll(()=>progress.some(value=>value.itemId==='episode2'&&value.isStopped===true)).toBe(true);
  const count=progress.length;
  await page.clock.install();await page.clock.runFor(11000);
  expect(progress.length).toBe(count);
});
test('unavailable negotiation shows an error and can be closed',async({page})=>{
  await fixture(page,true);
  await page.goto('/?watch=series');
  await expect(page.locator('[data-playback-state]')).toHaveAttribute('data-playback-state','error');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-playback-state]')).toHaveCount(0);
});

test('HLS plays from an extensionless URL and surfaces an unavailable manifest', async ({ page }) => {
  await fixture(page);
  const playlistFile = join(directory, 'fixture.m3u8');
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=24:d=16',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '24',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0', playlistFile,
  ]);
  let failManifest = false;
  await page.route('**/fixture-hls**', route => {
    const asset = new URL(route.request().url()).searchParams.get('asset');
    if (asset) return route.fulfill({ contentType: 'video/mp2t', body: readFileSync(join(directory, asset)) });
    if (failManifest) return route.fulfill({ status: 404 });
    const playlist = readFileSync(playlistFile, 'utf8').replace(/^(fixture\d+\.ts)$/gm, '?asset=$1');
    return route.fulfill({ contentType: 'application/vnd.apple.mpegurl', body: playlist });
  });
  await page.route('**/api/v1/playback?**', route => route.fulfill({
    json: { streamUrl: '/fixture-hls', isTranscoding: true, durationSeconds: 16, contentType: 'application/vnd.apple.mpegurl' },
  }));
  await page.goto('/?watch=series');
  const player = page.locator('[data-playback-state]');
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  await expect.poll(() => page.locator('video').first().evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(9);
  failManifest = true;
  await page.reload();
  await expect(player).toHaveAttribute('data-playback-state', 'error');
});

test('version changes preserve position and use their own subtitles, trickplay and skip chapters', async ({ page }) => {
  await fixture(page);
  const versions = [{ id: 'original', label: 'Original' }, { id: 'alternate', label: 'Alternate' }];
  await page.route('**/api/v1/playback?**', route => {
    const version = new URL(route.request().url()).searchParams.get('versionId') || 'original';
    const audio = new URL(route.request().url()).searchParams.get('audioIndex');
    return route.fulfill({ json: {
      streamUrl: `/fixture.webm?version=${version}&audio=${audio || 'auto'}`, isTranscoding: false, durationSeconds: 60, contentType: 'video/webm',
      audioTracks: [{ index: 1, title: 'Original audio' }, { index: 2, title: 'Alternate audio' }],
      versions, trickplayUrl: `/fixture-trickplay.vtt?version=${version}`,
      skipSegments: [
        { type: 'intro', startSeconds: 9, endSeconds: 24 },
        { type: 'credits', startSeconds: 40, endSeconds: 55 },
      ],
    } });
  });
  await page.route('**/api/v1/subtitles**', route => {
    const version = new URL(route.request().url()).searchParams.get('versionId');
    return route.fulfill({ json: { subtitles: version === 'alternate'
      ? [{ id: 'alternate-sub', index: 0, title: 'Alternate captions', language: 'en', src: '/fixture.vtt', isForced: true }]
      : [] } });
  });
  await page.route('**/fixture-trickplay.vtt**', route => route.fulfill({
    contentType: 'text/vtt',
    body: 'WEBVTT\n\n00:00:00.000 --> 00:01:00.000\n/demo-poster.svg#xywh=32,16,160,90\n',
  }));
  await page.goto('/?watch=series');
  const video = page.locator('video').first();
  const videoTime = () => video.evaluate(el => (el as HTMLVideoElement).currentTime);
  await expect.poll(videoTime).toBeGreaterThan(9);
  await page.getByRole('combobox', { name: 'Select video version' }).selectOption('alternate');
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentSrc)).toContain('version=alternate');
  await expect.poll(videoTime).toBeGreaterThan(9);
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).textTracks[0]?.mode)).toBe('showing');
  await page.getByRole('combobox', { name: 'Select audio track' }).selectOption('2');
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentSrc)).toContain('audio=2');
  await expect.poll(videoTime).toBeGreaterThan(9);
  const seek = page.getByRole('slider', { name: 'Seek time' });
  await seek.hover();
  const sprite = page.locator('[style*="background-image"][style*="demo-poster.svg"]').filter({ visible: true });
  await expect(sprite).toHaveCSS('background-position', '-32px -16px');
  await page.getByRole('button', { name: 'Skip Intro' }).click();
  await expect.poll(videoTime).toBeGreaterThanOrEqual(24);
  await video.evaluate(el => { (el as HTMLVideoElement).currentTime = 43; });
  await page.getByRole('button', { name: 'Skip Credits' }).click();
  await expect.poll(videoTime).toBeGreaterThanOrEqual(55);
});
