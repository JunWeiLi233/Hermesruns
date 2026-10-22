# Hermes integration browser checks

Run from this PR worktree against a named disposable stack. The stack uses a new H2 database and private upload folders in the OS temporary directory, strips inherited application credentials, disables provider sync and course startup seeding, and serves a fixed packaged build. Only HTTP loopback origins on an explicit port other than 8080 are accepted. Actor files must be inside this worktree's ignored `.private-backups` directory and match the running stack instance.

```powershell
$ErrorActionPreference = 'Stop'
$env:E2E_STACK_NAME = 'intervals'
$env:E2E_PORT = '18088'
Remove-Item Env:E2E_BASE_URL -ErrorAction SilentlyContinue
$env:E2E_ADMIN_COURSE_MAP = 'false'
$env:E2E_BACKEND_JAR = 'D:/path/to/immutable-test-release.jar'
$env:E2E_TRAINING_IMPORT_JOBS = 'true' # local synthetic uploads only; provider sync stays disabled
$env:E2E_CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe' # optional
node e2e/tools/stack.mjs start
if ($LASTEXITCODE -ne 0) { throw 'Disposable stack startup failed.' }
$qaRun = Join-Path (Get-Location) ('.private-backups/intervals-' + [Guid]::NewGuid().ToString('N'))
$env:HERMES_TRAINING_QA_RUN = $qaRun
try {
    & ./e2e/intervals-icu/provision.ps1 -Phase Seed -RunDirectory $qaRun
    node e2e/node_modules/playwright/cli.js test --config e2e/playwright.intervals.config.mjs --workers=1 --retries=0
    $qaExit = $LASTEXITCODE
    & ./e2e/intervals-icu/provision.ps1 -Phase PrepareCleanup -RunDirectory $qaRun
    node e2e/intervals-icu/cleanup.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic account cleanup failed.' }
    & ./e2e/intervals-icu/provision.ps1 -Phase VerifyCleanup -RunDirectory $qaRun
    if ($qaExit -ne 0) { throw 'Browser verification failed; inspect the retained results.' }
} finally {
    node e2e/tools/stack.mjs stop
}
```

The API-only provisioning alternative is `node e2e/intervals-icu/provision-isolated.mjs <private-directory>`. The legacy PowerShell phases delegate to this implementation and the guarded cleanup module. Cleanup verifies every reserved synthetic email before the first deletion, then checks that all five sessions return 401. It never opens a database connection. Stopping the named stack removes its temporary database and uploads.

Run `node tools/e2e-safety.test.mjs` to check URL, instance, private-directory, environment, legacy-entrypoint and cleanup guards. Test discovery (`--list`) works before starting a stack. Browser tests use separate synthetic client addresses and local placeholder map tiles; the app's actual Leaflet tile configuration and vector paths remain in use.

The 20 intervals tests exercise real authenticated APIs and integrated pages. Set `E2E_ADMIN_COURSE_MAP=true` to run the separate synthetic admin/passkey browser contract; enable `E2E_SYNTHETIC_ADMIN=true` before starting that stack. This admin test uses an in-memory course API fixture to check live/pending separation, vector rendering and navigation. It does not verify physical course alignment. Real service/persistence tests provide independent server coverage.

Results, screenshots and axe attachments are under `output/playwright/intervals-icu/`. The optional `plan-activation.verify.mjs` uses the same disposable actor guards and additionally requires a test release configured for experimental activation. Its software checks do not validate training outcomes.
