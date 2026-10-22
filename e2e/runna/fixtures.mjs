import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, createWriteStream, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { resolve, delimiter, sep } from 'node:path';
import { createServer } from 'node:http';
import { isolatedBackendEnvironment } from '../fixtures/safety.mjs';
const root = resolve(import.meta.dirname, '../..');
mkdirSync(resolve(root, 'output/run-plan-qa'), { recursive: true });
// Freeze compiled resources: another Maven compile must not remove a class before a fixture loads it.
const runtimeParent = resolve(root, 'output/run-plan-qa');
const runtime = mkdtempSync(resolve(runtimeParent, 'runtime-'));
const baseline=process.env.HERMES_PLAN_QA_BASELINE;
if(!baseline||!resolve(baseline).startsWith(runtimeParent+sep))throw new Error('Set HERMES_PLAN_QA_BASELINE to an existing isolated QA runtime snapshot under output/run-plan-qa');
const compiled=resolve(baseline);
cpSync(resolve(compiled, 'classes'), resolve(runtime, 'classes'), { recursive: true });
cpSync(resolve(compiled, 'test-classes'), resolve(runtime, 'test-classes'), { recursive: true });
// Production resources must precede the minimal index.html used by MVC unit tests.
const cp = [resolve(runtime, 'classes'), resolve(runtime, 'test-classes'), readFileSync(resolve(root, '.workspace/run-plan-classpath.txt'), 'utf8').trim()].join(delimiter);
const ready = new Set(); const children = [];
const health = createServer((req, res) => { res.writeHead(ready.size === 2 ? 200 : 503); res.end(ready.size === 2 ? 'ready' : 'starting'); }).listen(4330, '127.0.0.1');
for (const [port, approval] of [[4331, 'hermes-road-v4'], [4332, '']]) {
  const dataDir=resolve(runtime,`data-${port}`);mkdirSync(dataDir,{recursive:true});
  const env={...isolatedBackendEnvironment(process.env,{port,dataDir,dbUrl:'jdbc:h2:mem:plan-browser;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE',runnerPassword:''}),APP_LOCAL_SHARED_RUNNER_ENABLED:'false'};
  const log = createWriteStream(resolve(root, `output/run-plan-qa/fixture-${port}.log`));
  const child = spawn('java', ['-Dspring.devtools.restart.enabled=false', '-Dhermes.plan.browser-harness=true', '-Dhermes.plan.pace-fixtures=true', `-Dhermes.plan.browser-port=${port}`, `-Dhermes.plan.browser-approval=${approval}`, '-cp', cp, 'com.hermes.backend.coaching.plan.RunPlanBrowserHarness'], { cwd: runtime, env, windowsHide: true });
  children.push(child); child.stdout.pipe(log); child.stderr.pipe(log);
  let tail = ''; child.stdout.on('data', data => { tail = (tail + data).slice(-4000); if (tail.includes('Local plan browser fixture ready')) ready.add(port); });
  child.on('exit', code => {
    if (!stopping) { console.error(`Fixture ${port} exited ${code}; see output/run-plan-qa/fixture-${port}.log`); shutdown(); process.exitCode = 1; }
    if (children.every(c => c.exitCode !== null || c.signalCode !== null) && runtime.startsWith(runtimeParent + sep)) rmSync(runtime, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
}
let stopping = false;
function shutdown() { stopping = true; children.forEach(c => c.kill()); health.close(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown); process.on('exit', shutdown);
