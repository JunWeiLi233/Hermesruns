#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

/** Read-only HTTP probe; bounded workers can also exercise concurrent authenticated reads. */
export async function runProbe({ url, users = 1, requestsPerUser = 1, timeoutMs = 10000, token = '' } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.');
  }
  for (const [name, value, max] of [['users', users, 500], ['requestsPerUser', requestsPerUser, 1000], ['timeoutMs', timeoutMs, 60000]]) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}.`);
  }
  if (users * requestsPerUser > 10000) throw new Error('Limit the probe to 10,000 requests per run.');
  const samples = []; const statuses = {}; let succeeded = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: users }, async () => {
    for (let i = 0; i < requestsPerUser; i++) {
      const before = performance.now();
      let status = 'network-error';
      try {
        const response = await fetch(target, {
          redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        status = String(response.status);
        const body = await response.text();
        let healthy = response.ok;
        if (target.pathname === '/internal/ready') {
          try { healthy = healthy && JSON.parse(body).status === 'UP'; }
          catch { healthy = false; }
        }
        if (healthy) succeeded++;
        else if (response.ok) status += '-invalid-health';
      } catch { /* The result reports failures without printing URLs, credentials or response bodies. */ }
      statuses[status] = (statuses[status] || 0) + 1;
      samples.push(performance.now() - before);
    }
  }));
  samples.sort((a, b) => a - b);
  const total = samples.length;
  const percentile = p => Math.round(samples[Math.max(0, Math.ceil(total * p) - 1)] * 100) / 100;
  return { passed: succeeded === total, users, total, succeeded, failed: total - succeeded, statuses,
    durationMs: Math.round(performance.now() - started), p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: percentile(1) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2); const options = { url: process.env.HERMES_UPTIME_URL, token: process.env.HERMES_PROBE_TOKEN };
    const names = { '--url': 'url', '--users': 'users', '--requests-per-user': 'requestsPerUser', '--timeout-ms': 'timeoutMs' };
    for (let i = 0; i < args.length; i += 2) {
      const name = names[args[i]];
      if (!name || args[i + 1] === undefined) throw new Error('Use --url, --users, --requests-per-user, --timeout-ms.');
      options[name] = name === 'url' ? args[i + 1] : Number(args[i + 1]);
    }
    const result = await runProbe(options);
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
  } catch (error) { console.error(`Probe failed: ${error.message}`); process.exitCode = 1; }
}
