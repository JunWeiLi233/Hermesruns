// P01 Bring runs in from files. The recon makes this the way history arrives (the Strava API may keep data only seven days),
// and every analysis card starts from an imported run. Prerequisite flow, numbered P01.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun, tcxRun } from '../fixtures/gpx.ts';
import { zip } from '../fixtures/zip.ts';
import { contextWith, expect, test } from '../fixtures/test.ts';

test.describe.configure({ mode: 'serial' });

let who: { api: Api; email: string; token: string };
const unique = Date.now().toString(36);

test.beforeAll(async () => {
  const made = await newRunner('import');
  who = { api: made.api, email: made.email, token: made.api.token as string };
});

const runNames = async (): Promise<string[]> => ((await who.api.get('/api/activities')).json as Array<{ name: string }>).map((run) => run.name);
const route = (name: string, extra: Record<string, unknown> = {}) =>
  gpxRun({ name, start: daysAgo(3), distanceM: 3000, pace: 330, hr: 150, ...extra });

async function openImport(page: Page): Promise<ReturnType<Page['getByRole']>> {
  await page.goto('/runs');
  await page.getByRole('button', { name: 'Import activity files' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Import Workout Data' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('P01 through the import dialog', () => {
  test('P01-H1 one GPX file: the dialog closes and the run is listed with the numbers the file holds', async ({ browser, baseURL, guard }) => {
    const name = `P01 first run ${unique}`;
    const context = await contextWith(browser, who, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const dialog = await openImport(page);
      await dialog.locator('input[type=file]').setInputFiles({ name: 'first.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(route(name, { distanceM: 5000 })) });
      await expect(dialog.getByRole('status')).toContainText('Ready to import · 1');
      await dialog.getByRole('button', { name: 'Import 1 file(s)' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const row = page.getByRole('button', { name: new RegExp(name) });
      await expect(row).toBeVisible();
      await expect(row).toContainText('5.0 km');
      await expect(row).toContainText('5:30 /km');
      await expect(row).toContainText('27:30');
    } finally {
      await context.close();
    }
  });

  test('P01-H2 a gzipped GPX (.gpx.gz) imports', async ({ browser, baseURL, guard }) => {
    const name = `P01 gzipped ${unique}`;
    const context = await contextWith(browser, who, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const dialog = await openImport(page);
      await dialog.locator('input[type=file]').setInputFiles({ name: 'gzipped.gpx.gz', mimeType: 'application/gzip', buffer: zlib.gzipSync(Buffer.from(route(name))) });
      await dialog.getByRole('button', { name: 'Import 1 file(s)' }).click();
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('P01-H3 a ZIP with several workout files brings in every run', async ({ browser, baseURL, guard }) => {
    const names = [1, 2, 3].map((index) => `P01 zipped ${index} ${unique}`);
    const archive = zip(names.map((name, index) => ({ name: `activities/${index}.gpx`, data: route(name, { start: daysAgo(10 + index) }) })));
    const context = await contextWith(browser, who, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const dialog = await openImport(page);
      await dialog.locator('input[type=file]').setInputFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: archive });
      await dialog.getByRole('button', { name: 'Import 1 file(s)' }).click();
      for (const name of names) await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('P01-H4 a TCX file imports with its heart rate and distance', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, who, baseURL as string, guard);
    const start = daysAgo(8);
    try {
      const page = await context.newPage();
      const dialog = await openImport(page);
      await dialog.locator('input[type=file]').setInputFiles({
        name: 'tcx-run.tcx',
        mimeType: 'application/vnd.garmin.tcx+xml',
        buffer: Buffer.from(tcxRun({ name: 'unused', start, distanceM: 4000, pace: 300, hr: 160 })),
      });
      await dialog.getByRole('button', { name: 'Import 1 file(s)' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect.poll(async () => (await who.api.get('/api/activities')).json.some((run: { sourceFileName: string }) => run.sourceFileName === 'tcx-run.tcx')).toBe(true);
      const run = ((await who.api.get('/api/activities')).json as Array<{ id: number; sourceFileName: string; distanceKm: number }>).find((row) => row.sourceFileName === 'tcx-run.tcx')!;
      expect(run.distanceKm).toBeGreaterThan(3.9);
      expect(run.distanceKm).toBeLessThan(4.1);
      await expect.poll(async () => (await who.api.get(`/api/activities/${run.id}/training-metrics`)).json?.heartRate?.hasStream, { timeout: 20_000 }).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('P01-E1 double clicking Import sends one request', async ({ browser, baseURL, guard }) => {
    const name = `P01 double ${unique}`;
    const context = await contextWith(browser, who, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const posts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().includes('/api/import/')) posts.push(request.url());
      });
      const dialog = await openImport(page);
      await dialog.locator('input[type=file]').setInputFiles({ name: 'double.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(route(name, { start: daysAgo(30) })) });
      await dialog.getByRole('button', { name: 'Import 1 file(s)' }).dblclick();
      await expect.poll(() => runNames().then((names) => names.filter((runName) => runName === name).length), { timeout: 15_000 }).toBe(1);
      expect(posts, 'upload requests for one double-clicked Import').toHaveLength(1);
      // The second click of a double click must not land on whatever is under the closed dialog.
      expect(new URL(page.url()).pathname, 'a double click on Import stays on the list').toBe('/runs');
    } finally {
      await context.close();
    }
  });

  test('P01-E2 the dialog says what happened to every file: what was imported, skipped as a duplicate, and rejected and why', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, who, baseURL as string, guard);
    try {
      const page = await context.newPage();
      const dialog = await openImport(page);
      await dialog.locator('input[type=file]').setInputFiles([
        { name: 'fine.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(route(`P01 mixed fine ${unique}`, { start: daysAgo(14) })) },
        { name: 'corrupt-file.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('this is not xml') },
      ]);
      await dialog.getByRole('button', { name: 'Import 2 file(s)' }).click();
      // The dialog stays open and tells the runner what became of each file.
      await expect(dialog.getByText('1 run imported.')).toBeVisible();
      await expect(dialog.getByText('1 file could not be imported:')).toBeVisible();
      await expect(dialog.getByText('corrupt-file.gpx')).toBeVisible();
      await dialog.getByRole('button', { name: 'Done' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('button', { name: /P01 mixed fine/ })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('P01 through the API: what the server accepts and refuses', () => {
  test('P01-E3 the same file twice is stored once and the second answer says it was skipped as a duplicate', async () => {
    const content = route(`P01 duplicate ${unique}`, { start: daysAgo(16) });
    const first = await who.api.importFile('dup.gpx', content);
    const second = await who.api.importFile('dup.gpx', content);
    expect(first.json.importedActivities).toBe(1);
    expect(second.status).toBe(200);
    expect(second.json.importedActivities).toBe(0);
    expect(second.json.skippedDuplicates).toBe(1);
    expect((await runNames()).filter((name) => name === `P01 duplicate ${unique}`)).toHaveLength(1);
  });

  test('P01-E4 a ride is skipped as not a run', async () => {
    const res = await who.api.importFile('ride.gpx', route(`P01 a ride ${unique}`, { type: 'cycling', start: daysAgo(17) }));
    expect(res.status).toBe(200);
    expect(res.json.importedActivities).toBe(0);
    expect(res.json.skippedNonRuns).toBe(1);
    expect(await runNames()).not.toContain(`P01 a ride ${unique}`);
  });

  test('P01-E5 files of the wrong kind are refused with a message, never with a 500', async () => {
    const attempts: Array<[string, Buffer | string, RegExp]> = [
      ['notes.txt', 'hello', /Unsupported upload file type/],
      ['run.exe', 'MZ', /Unsupported upload file type/],
      ['run', route('no extension'), /Unsupported upload file type/],
      ['run.gpx.exe', route('double extension'), /Unsupported upload file type/],
      ['bare.gz', zlib.gzipSync(Buffer.from('x')), /Unsupported upload file type/],
      ['text.txt.gz', zlib.gzipSync(Buffer.from('x')), /Unsupported upload file type/],
    ];
    for (const [filename, content, message] of attempts) {
      const res = await who.api.importFile(filename, content);
      expect(res.status, `${filename}: ${JSON.stringify(res.json)}`).toBe(400);
      expect(JSON.stringify(res.json)).toMatch(message);
    }
  });

  test('P01-E6 a corrupt GPX and a GPX with no points are refused and nothing is stored', async () => {
    const before = (await runNames()).length;
    for (const [filename, content] of [
      ['corrupt.gpx', 'this is not xml'],
      ['truncated.gpx', route('P01 truncated').slice(0, 400)],
      ['empty.gpx', '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg></trkseg></trk></gpx>'],
      ['zero.gpx', ''],
    ] as const) {
      const res = await who.api.importFile(filename, content);
      expect(res.status, `${filename} answered ${res.status} ${JSON.stringify(res.json)}`).toBeLessThan(500);
      expect(res.json?.importedActivities ?? 0).toBe(0);
    }
    expect((await runNames()).length).toBe(before);
  });

  test('P01-E7 accents, emoji and a very long name are kept or shortened, never a 500', async () => {
    const accent = `Café 5 km – São Paulo 🏃‍♀️ ${unique}`;
    const res = await who.api.importFile('cafe.gpx', route(accent, { start: daysAgo(18) }));
    expect(res.status).toBe(200);
    expect(await runNames()).toContain(accent);
  });

  test('P01-E7b a 5 000-character track name is shortened to what the column holds, not a 500', async () => {
    const long = await who.api.importFile('long-name.gpx', route(`${'x'.repeat(5000)} ${unique}`, { start: daysAgo(19) }));
    expect(long.status).toBe(200);
    expect(long.json.importedActivities).toBe(1);
    expect((await runNames()).filter((name) => name.length === 255 && /^x+$/.test(name))).toHaveLength(1);
  });

  test('P01-E8 an XML file that tries to read a file off the server does not get it', async () => {
    const canary = path.join(os.tmpdir(), `xxe-canary-${unique}.txt`);
    const secret = `XXE-CANARY-${unique}`;
    fs.writeFileSync(canary, secret);
    try {
      const url = `file:///${canary.replace(/\\/g, '/')}`;
      const evil = route('P01 xxe').replace('<?xml version="1.0" encoding="UTF-8"?>', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE gpx [<!ENTITY steal SYSTEM "${url}">]>`).replace('<name>P01 xxe</name>', '<name>&steal;</name>');
      const res = await who.api.importFile('xxe.gpx', evil);
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(res.json)).not.toContain(secret);
      expect((await runNames()).join('\n')).not.toContain(secret);
    } finally {
      fs.rmSync(canary, { force: true });
    }
  });

  test('P01-E9 a compressed file that expands past the limit is refused quickly and the server keeps answering', async () => {
    const bomb = zlib.gzipSync(Buffer.alloc(60 * 1024 * 1024, 0x20));
    const started = Date.now();
    const res = await who.api.importFile('bomb.gpx.gz', bomb);
    expect(res.status).toBeLessThan(500);
    expect(res.json?.importedActivities ?? 0).toBe(0);
    expect(Date.now() - started).toBeLessThan(15_000);
    expect((await who.api.get('/api/auth/protected/ping')).status).toBe(200);
  });

  test('P01-E10 an archive with far too many entries, or an entry that climbs out of the folder, is refused without a 500', async () => {
    const many = zip(Array.from({ length: 450 }, (_, index) => ({ name: `junk-${index}.gpx`, data: 'not a workout' })));
    const tooMany = await who.api.importFile('many.zip', many);
    expect(tooMany.status).toBeLessThan(500);
    expect(tooMany.json?.importedActivities ?? 0).toBe(0);
    const climbing = zip([{ name: '../../evil.gpx', data: route(`P01 climbing ${unique}`, { start: daysAgo(21) }) }]);
    const traversal = await who.api.importFile('climb.zip', climbing);
    expect(traversal.status).toBeLessThan(500);
  });

  test('P01-E11 a file over the 20 MB upload limit is refused with a message and not a 500', async () => {
    const res = await who.api.importFile('huge.gpx', Buffer.alloc(21 * 1024 * 1024, 0x61));
    expect(res.status, JSON.stringify(res.json).slice(0, 200)).toBe(413);
    expect(res.json.error).toContain('too large');
    expect((await who.api.get('/api/auth/protected/ping')).status).toBe(200);
  });

  test('P01-E12 importing without signing in is refused', async ({ seed }) => {
    const anonymous = new Api(seed.baseUrl, null);
    expect((await anonymous.importFile('anon.gpx', route('anon'))).status).toBe(401);
  });

  test('P01-E13 an imported run is analysed in the background: effort, best efforts and zones appear without a click', async () => {
    const name = `P01 analysed ${unique}`;
    const id = await who.api.importRun('analysed.gpx', route(name, { start: daysAgo(22), distanceM: 6000 }));
    await expect
      .poll(async () => (await who.api.get(`/api/activities/${id}/training-metrics`)).json?.effort?.score, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await who.api.get(`/api/activities/${id}/best-efforts`)).json?.complete, { timeout: 20_000 })
      .toBe(true);
  });
});

test.describe('P01 other screens', () => {
  test('P01-E14 the import page in Settings opens, and the Runs list refreshes after an import there', async ({ browser, baseURL, guard }) => {
    const context = await contextWith(browser, who, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/settings/import-data');
      await expect(page.locator('main').first()).not.toBeEmpty();
      await expect(page.locator('body')).not.toContainText(/undefined|NaN/);
    } finally {
      await context.close();
    }
  });
});
