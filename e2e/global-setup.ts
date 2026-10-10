// Runs once before the suite: signs in the seeded runner, fills its account with the seed runs through the real
// import route, waits for the background analysis, and prepares two more runners (B and C) with signed-in browser
// states. Safe to run again against the same stack: it reuses what is already there.
//
// Sign-ups are limited to 8 per hour per address, so accounts are kept in .auth/accounts.json and reused while the
// stack that knows them is up. A restarted stack has a new database, the saved login fails and the account is remade.
import fs from 'node:fs';
import path from 'node:path';
import { Api, eventually, stackState, strongPassword } from './fixtures/api.ts';
import { seedRuns, SEED_RUNS } from './fixtures/seed.ts';

const authDir = path.resolve(import.meta.dirname, '.auth');

interface Account {
  email: string;
  password: string;
}

function writeBrowserState(file: string, baseUrl: string, token: string, email: string): void {
  fs.writeFileSync(
    path.join(authDir, file),
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: baseUrl,
          localStorage: [
            { name: 'hermes_jwt', value: token },
            { name: 'hermes_email', value: email },
          ],
        },
      ],
    }),
    { mode: 0o600 },
  );
}

export default async function globalSetup(): Promise<void> {
  const state = stackState();
  fs.mkdirSync(authDir, { recursive: true });

  // --- Runner A: the local shared runner (Pro, 21 mock Strava runs) plus the seed runs.
  const a = new Api(state.baseUrl);
  const loginA = await a.login(state.runnerEmail, state.runnerPassword);
  const ids = await seedRuns(a);
  await eventually(async () => {
    for (const run of SEED_RUNS) {
      const id = ids[run.key];
      const metrics = await a.get(`/api/activities/${id}/training-metrics`);
      const efforts = await a.get(`/api/activities/${id}/best-efforts`);
      const matches = await a.get(`/api/activities/${id}/matches`);
      if (!metrics.ok || !metrics.json?.computedAt) return false;
      if (!efforts.ok || efforts.json?.complete !== true) return false;
      if (!matches.ok || matches.json?.complete !== true) return false;
    }
    return true;
  }, 'the seed runs to be analysed');
  // A previous run that was stopped half way may have left a seed run edited: put A back to its baseline.
  const zones = (await a.get('/api/training/zones')).json;
  if (zones.maxHeartRate.bpm !== 192 || zones.heartRate.source !== 'AUTO') {
    await a.put('/api/training/zones', { maxHeartRateBpm: 192, resetHeartRateBoundaries: true });
    await eventually(async () => (await a.get(`/api/activities/${ids.hills}/training-metrics`)).json?.heartRate?.maxHeartRateBpm === 192, 'A\'s runs to be recomputed for its own zones');
  }
  for (const run of SEED_RUNS) {
    const id = ids[run.key];
    await a.patch(`/api/activities/${id}`, { perceivedExertion: null });
    const efforts = ((await a.get(`/api/activities/${id}/best-efforts`)).json?.efforts ?? []) as Array<{ distanceKey: string; edited: boolean; hidden: boolean }>;
    for (const effort of efforts) {
      if (effort.edited) await a.patch(`/api/activities/${id}/best-efforts/${effort.distanceKey}`, { elapsedSeconds: null });
      if (effort.hidden) await a.patch(`/api/activities/${id}/best-efforts/${effort.distanceKey}`, { hidden: false });
    }
  }
  writeBrowserState('runner-a.json', state.baseUrl, loginA.token, loginA.email);

  // --- Runners B and C: ordinary free runners made through the sign-up route.
  const accountsFile = path.join(authDir, 'accounts.json');
  const accounts: Record<string, Account> = fs.existsSync(accountsFile) ? JSON.parse(fs.readFileSync(accountsFile, 'utf8')) : {};
  const others: Record<string, { email: string; token: string }> = {};
  for (const label of ['b', 'c']) {
    const api = new Api(state.baseUrl);
    let account: Account | undefined = accounts[label];
    if (account) {
      try {
        await api.login(account.email, account.password);
      } catch {
        account = undefined;
      }
    }
    if (!account) {
      account = { email: `e2e-${label}-${Date.now().toString(36)}@example.com`, password: strongPassword() };
      await api.signUp(account.email, account.password);
      accounts[label] = account;
    }
    others[label] = { email: account.email, token: api.token as string };
    writeBrowserState(`runner-${label}.json`, state.baseUrl, api.token as string, account.email);
  }
  fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2), { mode: 0o600 });

  fs.writeFileSync(
    path.join(authDir, 'seed.json'),
    JSON.stringify({ baseUrl: state.baseUrl, ids, a: { email: loginA.email, token: loginA.token }, ...others }, null, 2),
    { mode: 0o600 },
  );
}
