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
const episodes=[1,2].map(number=>({id:`episode${number}`,jellyfinId:`episode${number}`,name:`Episode ${number}`,seasonNumber:1,episodeNumber:number,durationMinutes:1,thumbnailUrl:'/demo-poster.svg',playbackPositionTicks:number===1?100000000:0}));
const series={id:'series',jellyfinId:'series',title:'Test Series',type:'Series',source:'jellyfin',status:'available',overview:'Player fixture',genres:[],posterUrl:'/demo-poster.svg',backdropUrl:'/demo-backdrop.svg',playableEpisodeId:'episode1',durationMinutes:1,playbackPositionTicks:100000000,seasons:[{id:'season1',seasonNumber:1,name:'Season 1',episodeCount:2,episodes}]};
async function fixture(page:import('@playwright/test').Page,fail=false) {
  const progress:Record<string,unknown>[]=[];
  await page.route('**/api/v1/config',route=>route.fulfill({json:{appName:'HomeStream',isConfigured:true,isSetupNeeded:false,isJellyfinConfigured:true}}));
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
