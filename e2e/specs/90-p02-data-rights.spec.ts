// P02 Your data is yours: download it all, delete it all. The recon's prerequisite 2 (a self-serve export and delete), and a legal
// duty under the Strava API terms. Prerequisite flow, numbered P02.
import type { Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { unzip } from '../fixtures/unzip.ts';
import { contextFor, contextWith, expect, test } from '../fixtures/test.ts';

const unique = Date.now().toString(36);

async function exportZip(api: Api, tracks = false): Promise<{ status: number; headers: Headers; files: Map<string, Buffer>; raw: Buffer }> {
  const res = await fetch(`${api.baseUrl}/api/account/export${tracks ? '?tracks=true' : ''}`, {
    headers: { Authorization: `Bearer ${api.token}`, 'X-Forwarded-For': api.clientIp ?? '' },
  });
  const raw = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, files: res.ok ? unzip(raw) : new Map(), raw };
}

const csvRows = (file: Buffer | undefined): string[][] =>
  (file?.toString('utf8') ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map((line) => line.split(','));

test.describe('P02 download your data', () => {
  test('P02-H1 the export is a ZIP with the profile, every run, the best efforts, shoes and races, named with today\'s date', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const runs = (await a.get('/api/activities')).json as Array<{ id: number; name: string }>;
    const out = await exportZip(a);
    expect(out.status).toBe(200);
    expect(out.headers.get('content-type')).toContain('application/zip');
    expect(out.headers.get('content-disposition')).toMatch(/attachment; filename="hermes-export-\d{4}-\d{2}-\d{2}\.zip"/);
    expect(out.headers.get('cache-control')).toContain('no-store');
    for (const name of ['README.txt', 'profile.json', 'runs.csv', 'best-efforts.csv', 'shoes.csv', 'races.csv']) expect(out.files.has(name), `${name} in the archive`).toBe(true);
    const rows = csvRows(out.files.get('runs.csv'));
    expect(rows.length, 'one row per run').toBe(runs.length);
    const names = out.files.get('runs.csv')!.toString('utf8');
    for (const run of runs.filter((row) => row.name.startsWith('E2E '))) expect(names).toContain(run.name);
    const efforts = csvRows(out.files.get('best-efforts.csv'));
    const ids = new Set(runs.map((run) => String(run.id)));
    expect(efforts.length).toBeGreaterThan(0);
    for (const row of efforts) expect(ids.has(row[0]), `best effort of run ${row[0]} belongs to this runner`).toBe(true);
  });

  test('P02-H2 no password, token or hash is in the export', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const out = await exportZip(a);
    expect(out.status).toBe(200);
    // The README says there are none ("no passwords or tokens"), so it is not data to scan.
    const everything = [...out.files.entries()].filter(([name]) => name !== 'README.txt').map(([, file]) => file.toString('utf8')).join('\n');
    expect(everything).not.toMatch(/password|passwd|secret|sessionToken|session_token|accessToken|access_token|refreshToken|refresh_token|\$2[aby]\$|pbkdf2/i);
    expect(everything).not.toContain(seed.a.token);
    const profile = JSON.parse(out.files.get('profile.json')!.toString('utf8'));
    expect(Object.keys(profile).join(' ')).not.toMatch(/password|token|secret|hash/i);
  });

  test('P02-H3 with GPS tracks the archive holds one GPX file per run that has a track', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const out = await exportZip(a, true);
    expect(out.status).toBe(200);
    const gpx = [...out.files.keys()].filter((name) => name.endsWith('.gpx'));
    expect(gpx.length).toBeGreaterThanOrEqual(11); // the eleven seeded GPX runs, plus the mock Strava runs that carry points
    const hills = [...out.files.entries()].find(([name, data]) => name.endsWith('.gpx') && data.toString('utf8').includes('E2E Hill intervals'));
    expect(hills, 'the hill run has its own GPX file').toBeTruthy();
    expect(hills![1].toString('utf8')).toContain('<trkpt');
  });

  test('P02-H4 another runner\'s export has none of this runner\'s runs', async ({ seed }) => {
    const b = new Api(seed.baseUrl, seed.b.token);
    const out = await exportZip(b);
    expect(out.status).toBe(200);
    expect(csvRows(out.files.get('runs.csv'))).toEqual([]);
    expect([...out.files.values()].map((file) => file.toString('utf8')).join('\n')).not.toContain('E2E Hill intervals');
  });

  test('P02-E1 signed out there is no export', async ({ seed }) => {
    const anonymous = new Api(seed.baseUrl, null);
    const res = await fetch(`${seed.baseUrl}/api/account/export`, { headers: { 'X-Forwarded-For': anonymous.clientIp ?? '' } });
    expect(res.status).toBe(401);
  });

  test('P02-E2 run names that a spreadsheet would run as formulas are made harmless in runs.csv, and quotes survive', async () => {
    const made = await newRunner('csv');
    const names = [`=HYPERLINK("http://example.test/","click me") ${unique}`, `+1+1 ${unique}`, `-2+3 ${unique}`, `@SUM(1,1) ${unique}`, `say "hi", ok ${unique}`];
    for (const [index, name] of names.entries()) await made.api.importRun(`formula-${index}.gpx`, gpxRun({ name, start: daysAgo(3 + index), distanceM: 3000, pace: 330 }));
    const out = await exportZip(made.api);
    const lines = out.files.get('runs.csv')!.toString('utf8').split(/\r?\n/).filter(Boolean).slice(1);
    expect(lines).toHaveLength(names.length);
    for (const line of lines) {
      const field = line.match(/^\d+,("(?:[^"]|"")*"|[^,]*),/)![1].replace(/^"/, '');
      expect(field, `name field of: ${line.slice(0, 60)}`).not.toMatch(/^[=+\-@]/);
    }
    expect(lines.join('\n')).toContain('"say ""hi"", ok');
  });

  test('P02-E3 two exports at once: one may be told to wait, neither fails', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const b = new Api(seed.baseUrl, seed.a.token);
    const [one, two] = await Promise.all([exportZip(a, true), exportZip(b, true)]);
    for (const out of [one, two]) expect([200, 429]).toContain(out.status);
    expect([one.status, two.status]).toContain(200);
  });

  test('P02-E4 Settings: Download saves the ZIP, and ticking "Include GPS tracks" makes it larger', async ({ browser, baseURL, seed, guard }) => {
    const context = await contextFor(browser, 'a', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/settings?section=account');
      const panel = page.getByRole('tabpanel', { name: 'Account' });
      const sizes: number[] = [];
      for (const withTracks of [false, true]) {
        if (withTracks) await panel.getByRole('checkbox', { name: /Include GPS tracks/ }).check();
        const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download' }).click()]);
        expect(download.suggestedFilename()).toMatch(/^hermes-export-\d{4}-\d{2}-\d{2}\.zip$/);
        const stream = await download.createReadStream();
        let bytes = 0;
        for await (const chunk of stream) bytes += (chunk as Buffer).length;
        sizes.push(bytes);
      }
      expect(sizes[1]).toBeGreaterThan(sizes[0]);
      expect(seed.baseUrl).toBeTruthy();
    } finally {
      await context.close();
    }
  });
});

test.describe('P02 delete your account', () => {
  async function openDeleteDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
    await page.goto('/settings?section=account');
    await page.getByRole('tabpanel', { name: 'Account' }).getByRole('button', { name: 'Delete…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test('P02-H5 the dialog needs the word DELETE, Cancel keeps the account, and the right word removes it for good', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    const made = await newRunner('gone');
    await made.api.importRun('gone-1.gpx', gpxRun({ name: `P02 doomed ${unique}`, start: daysAgo(3), distanceM: 4000, pace: 330, hr: 150 }));
    await made.api.put('/api/training/zones', { maxHeartRateBpm: 180 });
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const dialog = await openDeleteDialog(page);
      const confirm = dialog.getByRole('button', { name: 'Delete account' });
      const box = dialog.getByRole('textbox', { name: 'Type DELETE to confirm' });
      await expect(confirm).toBeDisabled();
      for (const wrong of ['delete', 'DELET', 'Delete', ' DELETE x', '']) {
        await box.fill(wrong);
        await expect(confirm, `"${wrong}" is not the word`).toBeDisabled();
      }
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect((await made.api.get('/api/auth/protected/ping')).status).toBe(200);

      await (await openDeleteDialog(page)).getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('DELETE');
      await page.getByRole('dialog').getByRole('button', { name: 'Delete account' }).click();
      await expect(page).toHaveURL(/\/($|login)/);
      expect(await page.evaluate(() => localStorage.getItem('hermes_jwt'))).toBeNull();

      // Gone: the old token, the old password.
      expect((await made.api.get('/api/auth/protected/ping')).status).toBe(401);
      const again = new Api(made.api.baseUrl);
      const login = await again.request('POST', '/api/auth/login', { body: { email: made.email, password: made.password }, token: null });
      expect(login.status).toBe(401);

      // Signing up again with the same address gives an empty account: nothing of the old one is left.
      await again.signUp(made.email, made.password);
      expect(((await again.get('/api/activities')).json as unknown[]).length).toBe(0);
      const zones = (await again.get('/api/training/zones')).json;
      expect(zones.maxHeartRate).toEqual({ bpm: 190, source: 'DEFAULT' });
      const out = await exportZip(again);
      expect(csvRows(out.files.get('runs.csv'))).toEqual([]);
      expect(csvRows(out.files.get('best-efforts.csv'))).toEqual([]);
      expect([...out.files.values()].map((file) => file.toString('utf8')).join('\n')).not.toContain('P02 doomed');
    } finally {
      await context.close();
    }
  });

  test('P02-E5 deleting one account leaves everybody else\'s data alone', async ({ seed }) => {
    const a = new Api(seed.baseUrl, seed.a.token);
    const before = ((await a.get('/api/activities')).json as unknown[]).length;
    const made = await newRunner('gone2');
    await made.api.importRun('gone2.gpx', gpxRun({ name: `P02 other ${unique}`, start: daysAgo(4), distanceM: 3000, pace: 330 }));
    expect((await made.api.delete('/api/account', { confirm: 'DELETE' })).status).toBe(200);
    expect(((await a.get('/api/activities')).json as unknown[]).length).toBe(before);
    expect((await a.get(`/api/activities/${seed.ids.hills}/best-efforts`)).status).toBe(200);
  });

  test('P02-E6 the API wants the exact word, and a signed-out call is refused', async ({ seed }) => {
    const made = await newRunner('gone3');
    for (const body of [undefined, {}, { confirm: 'delete' }, { confirm: 'DELETE ' }, { confirm: 'yes' }]) {
      const res = await made.api.request('DELETE', '/api/account', { body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.code).toBe('CONFIRMATION_REQUIRED');
    }
    expect((await made.api.get('/api/auth/protected/ping')).status).toBe(200);
    const anonymous = new Api(seed.baseUrl, null);
    expect((await anonymous.delete('/api/account', { confirm: 'DELETE' })).status).toBe(401);
    expect((await made.api.delete('/api/account', { confirm: 'DELETE' })).status).toBe(200);
  });

  test('P02-E7 a second tab of a deleted account lands on the sign-in page, not on an error', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    const made = await newRunner('gone4');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/runs');
      await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
      expect((await made.api.delete('/api/account', { confirm: 'DELETE' })).status).toBe(200);
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator('body')).not.toContainText(/Something went wrong/);
    } finally {
      await context.close();
    }
  });
});
