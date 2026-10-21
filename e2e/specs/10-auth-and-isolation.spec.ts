// X01 Signing in, signing out, and keeping runners apart. Not a flow of the recon, but every flow depends on it, and "second user's data
// must be invisible" and "wrong password" are on the checklist for each of them. Numbered X01.
import fs from 'node:fs';
import path from 'node:path';
import { Api, newRunner, strongPassword } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { startStack, type NamedStack } from '../fixtures/stack.ts';
import { contextWith, expect, expectNoRawKeys, test } from '../fixtures/test.ts';

// These tests start signed out and make their own runners.
test.use({ storageState: { cookies: [], origins: [] } });

const unique = Date.now().toString(36);

test.describe('X01 signing in through the page', () => {
  test('X01-H1 a runner signs in with email and password and lands inside the app, with the token kept for the next visit', async ({ page }) => {
    const made = await newRunner('login');
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email Address' }).fill(made.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(made.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/(profile|runs|analysis|today-run)/);
    expect(await page.evaluate(() => localStorage.getItem('hermes_jwt'))).toBeTruthy();
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('X01-N1 a wrong password is refused with a message, nothing is stored, and the page stays put', async ({ page, guard }) => {
    guard.allow(/status of 401/);
    const made = await newRunner('login2');
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email Address' }).fill(made.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(`${made.password}x`);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/Invalid password\/username/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('hermes_jwt'))).toBeNull();
  });

  test('X01-N2 an unknown email and a wrong password get the same answer, so the form does not reveal who has an account', async ({ seed }) => {
    const made = await newRunner('login3');
    const wrong = await new Api(seed.baseUrl).request('POST', '/api/auth/login', { body: { email: made.email, password: 'definitely-wrong-1A!' }, token: null });
    const unknown = await new Api(seed.baseUrl).request('POST', '/api/auth/login', { body: { email: `nobody-${unique}@example.com`, password: 'definitely-wrong-1A!' }, token: null });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.json).toEqual(wrong.json);
  });

  test('X01-E1 email case and surrounding spaces do not stop a sign-in; empty or oversized fields are refused, never a 500', async ({ seed }) => {
    const made = await newRunner('login4');
    const api = new Api(seed.baseUrl);
    const variants = [made.email.toUpperCase(), `  ${made.email}  `];
    for (const email of variants) {
      const res = await api.request('POST', '/api/auth/login', { body: { email, password: made.password }, token: null });
      expect(res.status, `login as "${email}"`).toBe(200);
    }
    const refused: Array<unknown> = [
      { email: '', password: '' },
      { email: made.email },
      { password: made.password },
      { email: 'x'.repeat(300), password: made.password },
      { email: made.email, password: 'p'.repeat(600) },
      { email: made.email, password: made.password, admin: true },
      { email: ['a@b.c'], password: made.password },
    ];
    for (const body of refused) {
      const res = await api.request('POST', '/api/auth/login', { body, token: null });
      expect([400, 401], JSON.stringify(body).slice(0, 80)).toContain(res.status);
    }
  });

  test('X01-E1b a login sent with the wrong content type is refused with 415 or 400, not a 500', async ({ seed }) => {
    const notJson = await fetch(`${seed.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' }, body: 'hello' });
    expect([400, 415]).toContain(notJson.status);
  });

  test('X01-E2 a second sign-in as the same runner signs the first one out (current behaviour, a product decision to confirm)', async ({ seed }) => {
    const made = await newRunner('login5');
    const first = new Api(seed.baseUrl);
    await first.login(made.email, made.password);
    expect((await first.get('/api/auth/protected/ping')).status).toBe(200);
    const second = new Api(seed.baseUrl);
    await second.login(made.email, made.password);
    expect((await second.get('/api/auth/protected/ping')).status).toBe(200);
    expect((await first.get('/api/auth/protected/ping')).status, 'the first device after the second signed in').toBe(401);
  });

  test('X01-H2 signing out from Settings clears the token here and ends the session on the server', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    const made = await newRunner('logout');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/settings?section=account');
      await page.getByRole('button', { name: /^Log out/ }).click();
      const confirm = page.getByRole('dialog');
      if (await confirm.count()) await confirm.getByRole('button', { name: /log out|sign out|confirm/i }).last().click();
      await expect(page).toHaveURL(/\/($|login)/);
      expect(await page.evaluate(() => localStorage.getItem('hermes_jwt'))).toBeNull();
      expect((await made.api.get('/api/auth/protected/ping')).status, 'the old token after logging out').toBe(401);
    } finally {
      await context.close();
    }
  });
});

test.describe('X01 sign-up', () => {
  test('X01-H3 a new runner creates an account from the page and can sign in with it', async ({ page }) => {
    const email = `e2e-signup-${unique}@example.com`;
    const password = strongPassword();
    await page.goto('/signup');
    await page.getByRole('textbox', { name: 'Email Address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm password' }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText(/Account created\./)).toBeVisible();
    await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible();
    const api = new Api((await page.evaluate(() => location.origin)));
    expect((await api.request('POST', '/api/auth/login', { body: { email, password }, token: null })).status).toBe(200);
  });

  test('X01-N3 the sign-up page refuses a weak password, a password that does not match, and a bad address, saying why', async ({ page }) => {
    await page.goto('/signup');
    const email = page.getByRole('textbox', { name: 'Email Address' });
    const password = page.getByRole('textbox', { name: 'Password', exact: true });
    const confirm = page.getByRole('textbox', { name: 'Confirm password' });
    const submit = page.getByRole('button', { name: 'Create account' });
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/auth/signup')) posts.push(request.postData() ?? '');
    });
    await email.fill(`weak-${unique}@example.com`);
    await password.fill('abc');
    await confirm.fill('abc');
    await submit.click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await password.fill(strongPassword());
    await confirm.fill('Not-the-same-1!');
    await submit.click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await email.fill('not-an-address');
    await password.fill('Fine-Password-123!');
    await confirm.fill('Fine-Password-123!');
    await submit.click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    expect(posts, 'nothing is sent while the form is invalid').toEqual([]);
  });

  test('X01-N4 the API refuses a taken address, a disposable one, a weak password and unexpected fields', async ({ seed }) => {
    const made = await newRunner('taken');
    const api = new Api(seed.baseUrl);
    const taken = await api.request('POST', '/api/auth/signup', { body: { email: made.email, password: strongPassword() }, token: null });
    expect(taken.status).toBe(409);
    const weak = await api.request('POST', '/api/auth/signup', { body: { email: `weak2-${unique}@example.com`, password: 'abc' }, token: null });
    expect(weak.status).toBe(400);
    expect(weak.json.code).toBe('WEAK_PASSWORD');
    const disposable = await api.request('POST', '/api/auth/signup', { body: { email: `x-${unique}@mailinator.com`, password: strongPassword() }, token: null });
    expect(disposable.status).toBe(400);
    const extra = await api.request('POST', '/api/auth/signup', { body: { email: `extra-${unique}@example.com`, password: strongPassword(), role: 'ADMIN' }, token: null });
    expect(extra.status).toBe(400);
    const login = await api.request('POST', '/api/auth/login', { body: { email: `extra-${unique}@example.com`, password: 'x' }, token: null });
    expect(login.status).toBe(401);
  });

  test('X01-N5 asking for a password reset answers the same for an address that exists and one that does not', async ({ seed }) => {
    const made = await newRunner('reset');
    const api = new Api(seed.baseUrl);
    const known = await api.request('POST', '/api/auth/password-reset/request', { body: { email: made.email }, token: null });
    const unknown = await new Api(seed.baseUrl).request('POST', '/api/auth/password-reset/request', { body: { email: `nobody-${unique}@example.com` }, token: null });
    expect(known.status).toBe(unknown.status);
    expect(known.json).toEqual(unknown.json);
  });
});

test.describe('X01 limits on guessing passwords', () => {
  test('X01-N6 ten wrong passwords lock that address out, even for the right password', async ({ seed }) => {
    const made = await newRunner('lock');
    const attacker = new Api(seed.baseUrl);
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const res = await attacker.request('POST', '/api/auth/login', { body: { email: made.email, password: `wrong-${attempt}-Aa1!` }, token: null });
      expect(res.status, `attempt ${attempt}`).toBe(401);
    }
    const locked = await attacker.request('POST', '/api/auth/login', { body: { email: made.email, password: made.password }, token: null });
    expect(locked.status).toBe(429);
    expect(JSON.stringify(locked.json)).toMatch(/Too many failed attempts/);
  });

  test('X01-N6b behind a proxy of ours the client is the address the proxy added: what the client wrote in front of it changes nothing, and another client is not locked out with it', async ({ seed }) => {
    // The suite's stack trusts the connections from this machine, as it would a proxy in front of the app. A proxy adds the address it got
    // the request from on the right; whatever a client wrote is on the left.
    const made = await newRunner('lock-proxy');
    const suffix = () => Math.floor(1 + Math.random() * 253);
    const attacker = `203.0.113.${suffix()}`;
    const bystander = `198.51.100.${suffix()}`;
    const login = (password: string, forwarded: string) => {
      const api = new Api(seed.baseUrl);
      api.clientIp = forwarded;
      return api.request('POST', '/api/auth/login', { body: { email: made.email, password }, token: null });
    };
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await login(`wrong-${attempt}-Aa1!`, `192.0.2.${attempt}, ${attacker}`)).status, `attempt ${attempt}`).toBe(401);
    }
    const locked = await login(made.password, `192.0.2.99, ${attacker}`);
    expect(locked.status, 'the attacker with yet another address written in front').toBe(429);
    const other = await login(made.password, bystander);
    expect(other.status, 'somebody else behind the same proxy').toBe(200);
  });
});

test.describe('X01 limits on guessing passwords, on a stack that trusts no proxy', () => {
  // How the app is reached directly: the address is the connection's own, and X-Forwarded-For is whatever the client chose to write
  // (BUG-001: until then it was believed from anyone, so every request could be somebody new).
  let strict: NamedStack;
  test.beforeAll(async () => {
    test.setTimeout(360_000);
    strict = await startStack({ name: 'strict', port: 18082, env: { APP_TRUSTED_PROXIES: 'none' } });
  });
  test.afterAll(async () => {
    await strict?.stop();
  });

  test('X01-N7 the lock follows the connection, not a header the client chooses', async () => {
    const email = `lock-${unique}@example.com`;
    const password = strongPassword();
    await new Api(strict.baseUrl).signUp(email, password);
    const attempt = (secret: string) => {
      const api = new Api(strict.baseUrl); // a new made-up address for every request
      return api.request('POST', '/api/auth/login', { body: { email, password: secret }, token: null });
    };
    for (let tries = 1; tries <= 10; tries += 1) {
      expect((await attempt(`wrong-${tries}-Aa1!`)).status, `attempt ${tries}`).toBe(401);
    }
    // The same client, the same connection, one more header: it is still the one that was locked out.
    const res = await attempt(password);
    expect(res.status, 'a locked-out client that changes X-Forwarded-For').toBe(429);
    expect(JSON.stringify(res.json)).toMatch(/Too many failed attempts/);
  });

  test('X01-N8 the sign-up cap of eight an hour per address cannot be stepped around with a header either', async () => {
    const statuses: number[] = [];
    for (let tries = 0; tries < 12; tries += 1) {
      const api = new Api(strict.baseUrl); // a new made-up address for every request
      const res = await api.request('POST', '/api/auth/signup', { body: { email: `cap-${unique}-${tries}@example.com`, password: strongPassword() }, token: null });
      statuses.push(res.status);
    }
    expect(statuses.filter((status) => status === 429).length, 'sign-ups refused after the cap from one connection').toBeGreaterThan(0);
    expect(statuses.filter((status) => status < 300).length, 'sign-ups let through, with the ones the lock test made').toBeLessThanOrEqual(8);
    // And the part the header must not be able to undo: one more that names an address nobody has used.
    const other = new Api(strict.baseUrl);
    other.clientIp = '203.0.113.200';
    const res = await other.request('POST', '/api/auth/signup', { body: { email: `cap-${unique}-other@example.com`, password: strongPassword() }, token: null });
    expect(res.status, 'a new address made up by the client is not a new allowance').toBe(429);
  });
});

test.describe('X01 one runner cannot reach another runner\'s data', () => {
  const readRoutes = ['points', 'analytics', 'telemetry', 'hr-samples', 'improvement', 'elevation/status', 'pace-profile', 'best-efforts', 'matches'];

  test('X01-N9 every route that takes a run id answers 404 for a run that is not yours, and never shows its data', async ({ seed }) => {
    const b = new Api(seed.baseUrl, seed.b.token);
    for (const suffix of readRoutes) {
      const res = await b.get(`/api/activities/${seed.ids.hills}/${suffix}`);
      expect(res.status, `GET /api/activities/{id}/${suffix}`).toBe(404);
      expect(JSON.stringify(res.json)).not.toContain('E2E Hill intervals');
    }
    expect((await b.post(`/api/activities/${seed.ids.hills}/elevation/recalibrate`, {})).status, 'recalibrate').toBe(404);
    expect((await b.patch(`/api/activities/${seed.ids.hills}`, { perceivedExertion: 5 })).status, 'rate').toBe(404);
    expect((await b.patch(`/api/activities/${seed.ids.hills}/best-efforts/1km`, { elapsedSeconds: 200 })).status, 'edit a best effort').toBe(404);
    const a = new Api(seed.baseUrl, seed.a.token);
    const efforts = (await a.get(`/api/activities/${seed.ids.hills}/best-efforts`)).json.efforts as Array<{ distanceKey: string; edited: boolean }>;
    expect(efforts.find((effort) => effort.distanceKey === '1km')!.edited, 'the other runner could not edit it').toBe(false);
  });

  test('X01-N10 deleting a run that is not yours is refused and the run stays', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const b = new Api(seed.baseUrl, seed.b.token);
    const id = await a.importRun('probe.gpx', gpxRun({ name: `X01 probe ${unique}`, start: daysAgo(45), distanceM: 3000, pace: 330 }));
    try {
      expect((await b.delete(`/api/activities/${id}`)).status).toBe(404);
      expect(((await a.get('/api/activities')).json as Array<{ id: number }>).some((run) => run.id === id)).toBe(true);
    } finally {
      await a.delete(`/api/activities/${id}`);
    }
  });

  test('X01-N11 lists and previews hold only your own runs', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const b = new Api(seed.baseUrl, seed.b.token);
    const aIds = ((await a.get('/api/activities')).json as Array<{ id: number }>).map((run) => run.id);
    const listing = (await b.get('/api/activities')).json as Array<{ id: number }>;
    expect(listing.filter((run) => aIds.includes(run.id))).toEqual([]);
    const previews = await b.get(`/api/activities/route-previews?ids=${aIds.join(',')}`);
    expect(previews.status).toBe(200);
    expect(previews.json).toEqual([]);
    const records = await b.get('/api/training/best-efforts');
    expect(JSON.stringify(records.json)).not.toContain('E2E');
  });

  test('X01-N12 a signed-out caller gets 401 from every one of those routes, and so does a made-up token', async ({ seed }) => {
    for (const token of [null, 'not-a-token', 'Bearer', '0'.repeat(36)]) {
      const caller = new Api(seed.baseUrl, null);
      for (const suffix of readRoutes) {
        const res = await caller.request('GET', `/api/activities/${seed.ids.hills}/${suffix}`, { token });
        expect(res.status, `GET .../${suffix} with ${JSON.stringify(token)}`).toBe(401);
      }
    }
  });

  test('X01-E3 ids that are not ids are refused with 400 or 404, never a 500', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    for (const id of ['0', '-1', 'abc', '9223372036854775807', '99999999999999999999', '1.5', '%00', '1%20OR%201=1']) {
      for (const suffix of ['pace-profile', 'best-efforts', 'matches', 'training-metrics', 'analytics']) {
        const res = await a.get(`/api/activities/${id}/${suffix}`);
        expect([400, 404], `GET /api/activities/${id}/${suffix}`).toContain(res.status);
      }
    }
  });
});

test.describe('X01 the public side of the app', () => {
  for (const [url, heading] of [
    ['/', /Running analytics you can check/],
    ['/login', /Welcome back/],
    ['/signup', /Create your account/],
    ['/forgot-password', /Recover your password/],
    ['/terms', /Terms/],
    ['/privacy', /Privacy/],
  ] as const) {
    test(`X01-E4 ${url} opens signed out with its heading, no console error and no raw translation key`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await page.waitForTimeout(500);
      await expectNoRawKeys(page);
    });
  }

  test('X01-E5 the landing page leads to sign-up and sign-in', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Start free' }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign In' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('X01-E6 every file the build puts in the static folder is served without signing in', async ({ seed }) => {
    const root = path.resolve(import.meta.dirname, '..', '..', 'backend', 'target', 'classes', 'static');
    test.skip(!fs.existsSync(root), 'no built frontend next to this suite');
    const files: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile()) files.push(`/${entry.name}`);
      else if (entry.name === 'images') {
        for (const image of fs.readdirSync(path.join(root, 'images'), { withFileTypes: true })) if (image.isFile()) files.push(`/images/${image.name}`);
      }
    }
    const assets = fs.existsSync(path.join(root, 'assets')) ? fs.readdirSync(path.join(root, 'assets')).slice(0, 25) : [];
    for (const asset of assets) files.push(`/assets/${asset}`);
    const anonymous = new Api(seed.baseUrl, null);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const res = await fetch(seed.baseUrl + file, { headers: { 'X-Forwarded-For': anonymous.clientIp ?? '' } });
      await res.arrayBuffer();
      expect(res.status, `GET ${file}`).toBe(200);
    }
  });

  test('X01-E7 every page of the app can be opened directly (a refresh or a bookmark) and answers with the app', async ({ seed }) => {
    const paths = [
      '/', '/login', '/signup', '/forgot-password', '/terms', '/privacy', '/profile', '/runs', '/runs/1', '/analysis', '/analysis/load-balance',
      '/analysis/intensity', '/analysis/injury-risk', '/analysis/coach-insight', '/heatmap', '/weather', '/prediction/5k', '/prediction/marathon',
      '/today-run', '/rewards', '/settings', '/settings/import-data', '/shoes', '/shoes/add', '/shoe-catalog', '/races', '/races/details/1', '/schedule', '/muscle-training',
    ];
    for (const route of paths) {
      const res = await fetch(seed.baseUrl + route, { headers: { 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' } });
      expect(res.status, `GET ${route}`).toBe(200);
      expect(res.headers.get('content-type'), `GET ${route}`).toContain('text/html');
      await res.text();
    }
  });

  test('X01-E8 an address the app does not know opens the app or a not-found page, not a JSON error about a session token', async ({ page, seed, guard }) => {
    guard.allow(/status of 404/); // the page is not there, and the answer says so
    const headers = { Accept: 'text/html', 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' };
    for (const route of ['/support', '/pricing', '/about', '/help', '/an/old/bookmark']) {
      const res = await fetch(`${seed.baseUrl}${route}`, { headers });
      const body = await res.text();
      expect(res.headers.get('content-type'), route).toContain('text/html');
      expect(res.status, `${route}: the page is not there, and a crawler is told so`).toBe(404);
      expect(body, route).toContain('<div id="root"');
    }
    // A script that asks for JSON, a write, a file name or an API address still gets the plain refusal.
    const json = await fetch(`${seed.baseUrl}/support`, { headers: { Accept: 'application/json', 'X-Forwarded-For': headers['X-Forwarded-For'] } });
    expect(json.status).toBe(401);
    await json.text();
    const api = await fetch(`${seed.baseUrl}/api/no-such-thing`, { headers });
    expect(api.status, 'an API address is never answered with the app').toBe(401);
    expect(api.headers.get('content-type')).toContain('json');
    await api.text();
    // In a tab the app opens (its router takes an unknown address to the start page).
    await page.goto('/support');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await page.content()).not.toContain('Invalid or expired session token');
  });

  test('X01-E9 pages carry the browser protections the app promises: CSP, no sniffing, no framing, a referrer policy', async ({ seed }) => {
    const res = await fetch(`${seed.baseUrl}/`, { headers: { 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' } });
    await res.text();
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    const api = await fetch(`${seed.baseUrl}/api/auth/providers`, { headers: { 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' } });
    await api.text();
    expect(api.headers.get('cache-control')).toContain('no-store');
  });

  test('X01-E10 another website cannot read the API from a visitor\'s browser: a cross-origin preflight is not approved', async ({ seed }) => {
    const res = await fetch(`${seed.baseUrl}/api/activities`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization', 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('X01-E11 the public sign-in, sign-up and recovery pages each have a title of their own', async ({ page }) => {
    const expected: Array<[string, string]> = [
      ['/login', 'Sign in | HermesRuns'],
      ['/signup', 'Create your account | HermesRuns'],
      ['/forgot-password', 'Reset your password | HermesRuns'],
    ];
    for (const [url, title] of expected) {
      await page.goto(url);
      await expect(page, url).toHaveTitle(title);
    }
  });

  test('X01-E12 the circle at the top right has the same letter on every page, taken from the display name and not from the address (BUG-028)', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('avatar');
    expect((await made.api.request('PATCH', '/api/profile/me/name', { body: { displayName: 'Zed Runner' } })).status).toBeLessThan(300);
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      for (const url of ['/profile', '/runs', '/analysis', '/settings', '/shoes', '/races', '/schedule', '/prediction/10k', '/shoes/add', '/shoe-catalog']) {
        await page.goto(url);
        await expect(page.locator('.runner-shell-avatar').first(), url).toHaveText('Z');
      }
    } finally {
      await context.close();
    }
  });

  test('X01-E11b every page of the signed-in app has a title of its own, in English and in Chinese', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('titles');
    const pages: Array<[string, string, string]> = [
      ['/profile', 'Home | HermesRuns', '主页 | HermesRuns'],
      ['/runs', 'Runs | HermesRuns', '跑步记录 | HermesRuns'],
      ['/analysis', 'Analysis | HermesRuns', '分析 | HermesRuns'],
      ['/analysis/pace-curve', 'Pace curve | HermesRuns', '配速曲线 | HermesRuns'],
      ['/analysis/vo2max-estimates', 'VO2max estimates | HermesRuns', 'VO2max 估算 | HermesRuns'],
      ['/training-log', 'Training log | HermesRuns', '训练日志 | HermesRuns'],
      ['/settings', 'Settings | HermesRuns', '设置 | HermesRuns'],
      ['/shoes', 'Shoes | HermesRuns', '跑鞋 | HermesRuns'],
      ['/races', 'Races | HermesRuns', '赛事 | HermesRuns'],
      ['/schedule', 'Schedule | HermesRuns', '计划 | HermesRuns'],
      ['/prediction/10k', '10K prediction | HermesRuns', '10 公里预测 | HermesRuns'],
    ];
    for (const lang of ['en', 'zh-CN'] as const) {
      const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
      try {
        // Some pages hold a frame with no storage of its own (the map's); the script is for the page, not for it.
        await context.addInitScript((value) => {
          try {
            localStorage.setItem('hermes_lang', value);
          } catch {
            /* a frame that may not read storage */
          }
        }, lang);
        const page = await context.newPage();
        const seen: string[] = [];
        for (const [url, english, chinese] of pages) {
          await page.goto(url);
          const title = lang === 'en' ? english : chinese;
          await expect(page, `${url} in ${lang}`).toHaveTitle(title);
          seen.push(title);
        }
        expect(new Set(seen).size, 'no two pages share a title').toBe(pages.length);
      } finally {
        await context.close();
      }
    }
  });
});
