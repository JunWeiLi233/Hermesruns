import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runProbe } from './service-probe.mjs';

async function serverFor(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('concurrent clients finish every request and measure bounded concurrency', async () => {
  let active = 0; let peak = 0;
  await serverFor(async (_request, response) => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 10));
    response.setHeader('Content-Type', 'application/json');
    response.end('{"status":"UP"}'); --active;
  }, async origin => {
    const result = await runProbe({ url: `${origin}/internal/ready`, users: 12, requestsPerUser: 3 });
    assert.equal(result.passed, true);
    assert.equal(result.total, 36); assert.equal(result.succeeded, 36);
    assert.ok(peak > 1 && peak <= 12); assert.ok(result.p95Ms >= 0);
  });
});

test('redirect, HTML, unhealthy status and non-2xx are failures', async () => {
  for (const [status, body] of [[302, '{}'], [200, '<html>login</html>'], [200, '{"status":"DOWN"}'], [503, '{"status":"DOWN"}']]) {
    await serverFor((_request, response) => { response.writeHead(status, { Location: '/login' }); response.end(body); }, async origin => {
      const result = await runProbe({ url: `${origin}/internal/ready` });
      assert.equal(result.passed, false); assert.equal(result.failed, 1);
    });
  }
});

test('timeout fails within the request deadline', async () => {
  await serverFor(() => {}, async origin => {
    const started = Date.now();
    const result = await runProbe({ url: `${origin}/internal/ready`, timeoutMs: 40 });
    assert.equal(result.passed, false); assert.ok(Date.now() - started < 1000);
  });
});

test('rejects unsafe or unbounded arguments before making requests', async () => {
  for (const options of [{ users: 0 }, { users: 501 }, { requestsPerUser: 1001 }, { timeoutMs: -1 }, { url: 'file:///tmp/data' }, { url: 'http://user:password@localhost/' }]) {
    await assert.rejects(runProbe({ url: 'http://127.0.0.1:1/internal/ready', ...options }));
  }
});
