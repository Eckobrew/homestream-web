import { test, expect } from '@playwright/test';

test('demo browsing uses the backend and preserves deep links', async ({ page }) => {
  await page.route('**/api/v1/config', route => route.fulfill({ json: { appName: 'HomeStream', isConfigured: true, isSetupNeeded: false, isJellyfinConfigured: true } }));
  await page.route('**/api/v1/profiles**', route => route.fulfill({ json: { profiles: [{ id: 'demo', name: 'Demo', avatarColor: 'from-red-600', avatarBg: 'bg-red-600', initials: 'D' }], activeProfileId: 'demo', needsSetup: false, canSwitchProfile: true } }));
  const homeResponse = page.waitForResponse(response => response.url().includes('/api/v1/home') && response.ok());
  await page.goto('/');
  const home = await (await homeResponse).json();
  await expect.poll(async () => (await page.locator('h1').allTextContents()).some(title => home.heroItems.some((item: {title:string}) => title.includes(item.title)))).toBe(true);
  await page.goto(`/media/${encodeURIComponent(home.hero.id)}`);
  await expect(page).toHaveURL(new RegExp(`media=${encodeURIComponent(home.hero.id)}`));
  await page.screenshot({ path: 'test-results/browse.png', fullPage: true });
});

test('external login reports backend connection errors', async ({ page }) => {
  await page.route('**/api/v1/auth', async route => {
    if (route.request().method() === 'GET') await route.fulfill({ json: { requiresAuth: true, isAuthenticated: false, isLocalOrTailscale: false } });
    else await route.continue();
  });
  await page.goto('/');
  await page.getByPlaceholder('Jellyfin Username').fill('Viewer');
  await page.getByPlaceholder('Jellyfin Password').fill('example-password');
  const login = page.waitForResponse(response => response.url().endsWith('/api/v1/auth') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /sign in/i }).click();
  expect((await login).status()).toBe(503);
  await expect(page.getByText('Jellyfin is not configured on the server')).toBeVisible();
});

test('gateway serves web UI, canonical API and first-run setup', async ({ page, request }) => {
  expect((await request.get('/health')).ok()).toBeTruthy();
  const discovery = await request.get('/api/mobile/v1/discovery');
  expect(discovery.ok()).toBeTruthy();
  expect((await discovery.json()).localPairing).toBe(false);
  const home = await request.get('/api/v1/home');
  expect(home.ok()).toBeTruthy();
  expect((await home.json()).isDemoMode).toBe(true);
  await page.goto('/');
  await expect(page.getByPlaceholder('https://jellyfin.example.com or http://192.168.1.50:8096')).toBeVisible();
  const url = page.getByPlaceholder('https://jellyfin.example.com or http://192.168.1.50:8096');
  await url.fill('http://127.0.0.1:1');
  await page.getByPlaceholder(/^e.g. 32ba/).fill('fixture-jellyfin-api-key');
  await page.getByRole('button',{name:'Next: Set Up Profiles'}).click();
  await expect(page.getByText('Could not connect to Jellyfin. Check the URL and API key, then try again.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await url.fill('http://127.0.0.1:3303');
  await page.getByRole('button',{name:'Next: Set Up Profiles'}).click();
  await expect(page.getByRole('heading',{name:'Set Up Profiles',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Finish|Start Watching|Import.*Start/i}).click();
  await expect(page.getByRole('dialog',{name:'Server and profile setup'})).toHaveCount(0);
  await page.screenshot({ path: 'test-results/first-run-completed.png', fullPage: true });
});

