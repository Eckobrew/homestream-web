import { test, expect } from '@playwright/test';

test('demo browsing uses the backend and preserves deep links', async ({ page }) => {
  await page.route('**/api/v1/accounts?status=1', route => route.fulfill({ json: { needsFirstStart: false } }));
  await page.route('**/api/v1/config', route => route.fulfill({ json: { appName: 'HomeStream', isConfigured: true, isSetupNeeded: false, mediaEngine: 'native' } }));
  await page.route('**/api/v1/profiles**', route => route.fulfill({ json: { profiles: [{ id: 'demo', name: 'Demo', avatarColor: 'from-red-600', avatarBg: 'bg-red-600', initials: 'D' }], activeProfileId: 'demo', needsSetup: false, canSwitchProfile: true } }));
  const homeResponse = page.waitForResponse(response => response.url().includes('/api/v1/home') && response.ok());
  await page.goto('/');
  const home = await (await homeResponse).json();
  await expect.poll(async () => (await page.locator('h1').allTextContents()).some(title => home.heroItems.some((item: {title:string}) => title.includes(item.title)))).toBe(true);
  await page.goto(`/media/${encodeURIComponent(home.hero.id)}`);
  await expect(page).toHaveURL(new RegExp(`/media/${encodeURIComponent(home.hero.id)}$`));
  await expect(page.getByRole('heading', { name: home.hero.title, exact: true }).last()).toBeVisible();
  await page.screenshot({ path: 'test-results/browse.png', fullPage: true });
});

test('external login reports rejected credentials', async ({ page }) => {
  await page.route('**/api/v1/accounts?status=1', route => route.fulfill({ json: { needsFirstStart: false } }));
  await page.route('**/api/v1/auth', async route => {
    if (route.request().method() === 'GET') await route.fulfill({ json: { requiresAuth: true, isAuthenticated: false, isLocalOrTailscale: false } });
    else await route.continue();
  });
  await page.goto('/');
  await page.getByPlaceholder('Username', { exact: true }).fill('Viewer');
  await page.getByPlaceholder('Password', { exact: true }).fill('example-password');
  const login = page.waitForResponse(response => response.url().endsWith('/api/v1/auth') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /sign in/i }).click();
  expect((await login).status()).toBe(401);
  await expect(page.getByText('Invalid username or password')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Create your administrator account' })).toBeVisible();
  await page.getByLabel('Username').fill('audit-admin');
  await page.getByLabel('Display Name').fill('Audit Admin');
  await page.getByLabel('Password (min 4 characters)').fill('fixture-password');
  await page.getByRole('button', { name: 'Create Admin Account & Continue' }).click();
  await page.getByRole('button', { name: 'Create First Profile' }).click();
  await page.getByRole('button', { name: 'Open Integrations Wizard' }).click();
  await expect(page.getByPlaceholder('e.g. 1a2b3c4d5e...')).toBeVisible();
  const tmdbInput = page.getByPlaceholder('e.g. 1a2b3c4d5e...');
  await tmdbInput.fill('invalid-key');
  await page.getByRole('button',{name:'Next: Set Up Profiles'}).click();
  await expect(page.getByText('Could not verify TMDB API key. Check the key and try again.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await tmdbInput.fill('');
  await page.getByRole('button',{name:'Next: Set Up Profiles'}).click();
  await expect(page.getByRole('heading',{name:'Set Up Profiles',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Finish & Start Watching'}).click();
  await expect(page.getByRole('dialog',{name:'Server and profile setup'})).toHaveCount(0);
  await page.screenshot({ path: 'test-results/first-run-completed.png', fullPage: true });
  await page.goto('/first-start');
  await page.getByRole('button', { name: 'Use Native Media Engine' }).click();
  await expect(page.getByRole('heading', { name: 'HomeStream is ready' })).toBeVisible();
  expect((await (await request.get('/api/v1/config')).json()).mediaEngine).toBe('native');
});

