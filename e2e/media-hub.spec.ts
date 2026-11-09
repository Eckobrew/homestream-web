import {test,expect, type Page} from '@playwright/test';
const id='11111111-1111-4111-8111-111111111111';
const video=(kind:'Movie'|'Series',title:string)=>({id:kind,title,type:kind,source:'seerr',status:'not_requested',overview:'Discovery fixture',genres:[],posterUrl:'/demo-poster.svg',backdropUrl:'/demo-backdrop.svg'});
async function fixture(page:Page){
 const mutations:Record<string,unknown>[]=[];
 await page.route('**/api/v1/auth',r=>r.fulfill({json:{requiresAuth:false,isAuthenticated:true,isLocalOrTailscale:true,canManageIntegrations:true}}));
 await page.route('**/api/v1/config',r=>r.fulfill({json:{appName:'HomeStream',isConfigured:true,isSetupNeeded:false,isJellyfinConfigured:true}}));
 await page.route('**/api/v1/profiles**',r=>r.fulfill({json:{profiles:[{id:'viewer',name:'Viewer',initials:'V'}],activeProfileId:'viewer',needsSetup:false,canSwitchProfile:true}}));
 await page.route('**/api/v1/categories/**',r=>r.fulfill({json:{sections:[]}}));
 await page.route('**/api/v1/home**',r=>r.fulfill({json:{hero:null,heroItems:[],sections:[],requestSections:[{id:'requests-popular',title:'Popular Titles',items:[video('Movie','Discover Movie'),video('Series','Discover Series')]}],isDemoMode:false,jellyfinConnected:true,seerrConnected:true}}));
 await page.route('**/api/v1/music**',async r=>{
  const url=new URL(r.request().url());
  if(url.pathname.endsWith('/request')){mutations.push(r.request().postDataJSON());await r.fulfill({json:{success:true,status:'pending',message:'Album requested'}});return;}
  if(url.pathname.endsWith('/album')){await r.fulfill({json:{album:{id,title:'Library Album',artist:'Fixture Artist',inLibrary:true,requested:false},tracks:[{id:'track-one',title:'Library Track',artist:'Fixture Artist',album:'Library Album',trackNumber:1,discNumber:1,streamUrl:'/fixture-audio.wav'}]}});return;}
  const search=Boolean(url.searchParams.get('q'));await r.fulfill({json:{configured:true,total:1,albums:[{id,title:search?'New Album':'Library Album',artist:'Fixture Artist',year:2027,inLibrary:!search,requested:false}]}});
 });
 await page.route('**/api/v1/requested',r=>r.fulfill({json:{updatedAt:'2026-11-08T12:00:00Z',warnings:['One optional service is unavailable.'],items:[{id:'film',title:'Requested Movie',kind:'movie',source:'seerr',status:'downloading',progress:55,releaseDate:'2027-04-03',downloadSpeed:1048576,etaSeconds:120},{id:'show',title:'Requested Series',kind:'tv',source:'seerr',status:'requested'},{id:'music',title:'Requested Album',kind:'music',source:'droppedneedle',artist:'Fixture Artist',status:'downloading',progress:37.5,releaseDate:'2027'}]}}));
 await page.route('**/api/v1/integrations',async r=>{
  if(r.request().method()==='POST'){mutations.push(r.request().postDataJSON());await r.fulfill({json:{success:true}});return;}
  await r.fulfill({json:{downloadsPath:'/downloads',integrations:[{id:'droppedneedle',name:'DroppedNeedle',url:'http://music.test:8688',configured:true,credentialSet:true},{id:'seerr',name:'Seerr',url:'http://seerr.test',configured:true,credentialSet:true},{id:'jellyfin',name:'Jellyfin',url:'http://jellyfin.test',configured:true,credentialSet:true},{id:'qbittorrent',name:'qBittorrent',url:'http://qb.test',configured:true,credentialSet:true,username:'fixture'}]}});
 });
 // Synthetic silent WAV: no real household media is used.
 const samples=44100*2;const wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
 await page.route('**/fixture-audio.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
 return mutations;
}
test('Discover and Requested cover movies, TV and music, with progress and date precision',async({page})=>{
 const mutations=await fixture(page);await page.goto('/?tab=discover');await expect(page.getByRole('heading',{name:'Discover',exact:true})).toBeVisible();
 await expect(page.getByText('Discover Movie',{exact:true}).first()).toBeVisible();await expect(page.getByText('Discover Series',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Music',exact:true}).click();await expect(page.getByText('Library Album',{exact:true})).toBeVisible();await expect(page.getByText('Discover Movie',{exact:true})).toHaveCount(0);
 await page.getByLabel('Search music').fill('New');await expect(page.getByText('New Album',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Request album',exact:true}).click();await expect.poll(()=>mutations.some(m=>m.musicbrainzId===id)).toBe(true);
 await page.getByRole('navigation').getByRole('button',{name:'Requested',exact:true}).click();await expect(page.getByRole('heading',{name:'Requested',exact:true})).toBeVisible();await expect(page.getByRole('progressbar',{name:'Requested Movie download progress'})).toHaveAttribute('aria-valuenow','55');await expect(page.getByText('Release year 2027')).toBeVisible();await expect(page.getByText('Release date unknown')).toBeVisible();await expect(page.getByText('Releases 3 Apr 2027')).toBeVisible();
 await page.getByRole('button',{name:'Music',exact:true}).click();await expect(page.getByText('Requested Album',{exact:true})).toBeVisible();await expect(page.getByText('Requested Movie',{exact:true})).toHaveCount(0);await page.screenshot({path:'test-results/requested-all-media.png',fullPage:true});
});
test('music player survives tab navigation and Admin preserves blank stored credentials',async({page})=>{
 const mutations=await fixture(page);await page.goto('/?tab=discover');await page.getByRole('button',{name:'Music',exact:true}).click();await page.getByRole('button',{name:'Tracks & playback'}).click();await page.getByRole('button',{name:/Library Track/}).click();await expect(page.getByRole('complementary',{name:'Music player'})).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Requested',exact:true}).click();await expect(page.getByRole('complementary',{name:'Music player'})).toBeVisible();await page.getByRole('button',{name:'Close music player'}).click();await expect(page.locator('audio')).toHaveCount(0);
 await page.getByRole('button',{name:'Admin',exact:true}).click();const form=page.locator('form').filter({has:page.getByRole('heading',{name:'DroppedNeedle',exact:true})});await expect(form.getByLabel('Companion token')).toHaveValue('');await form.getByRole('button',{name:'Save integration'}).click();await expect(form.getByText('Integration saved.')).toBeVisible();await expect.poll(()=>mutations.some(m=>m.integration==='droppedneedle'&&m.secret==='')).toBe(true);await form.getByRole('button',{name:'Test connection'}).click();await expect(form.getByText('Connection successful')).toBeVisible();await page.screenshot({path:'test-results/admin-integrations.png',fullPage:true});
});
test('mobile navigation exposes Discover and Requested next to each other',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.goto('/?tab=discover');await page.getByRole('button',{name:'Requested',exact:true}).click();await expect(page.getByRole('heading',{name:'Requested',exact:true})).toBeVisible();await page.screenshot({path:'test-results/requested-mobile.png',fullPage:true});
});
