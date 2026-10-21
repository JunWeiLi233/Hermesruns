# Hermes integration browser checks

Run from the serving checkout in PowerShell 7, with Hermes already running on port 8080 and its local PostgreSQL configuration available. The scripts verify the runtime marker and listener before provisioning five synthetic USER accounts. Session material and baseline IDs are written only to the protected, ignored run directory. No live provider, email or payment action is exercised.

Use a fresh fixture for each independent run. Cases run serially with fifteen seconds of pacing; accessibility checks wait for finite CSS motion to settle. Keep the packaged app fixed while the suite runs.

```powershell
$ErrorActionPreference='Stop'
$qaRun=Join-Path (Get-Location) ('.private-backups/replica-test-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))
& ./e2e/intervals-icu/provision.ps1 -Phase Seed -RunDirectory $qaRun
$env:HERMES_TRAINING_QA_RUN=$qaRun
Remove-Item Env:HERMES_TRAINING_AUDIT -ErrorAction SilentlyContinue
try {
    node e2e/node_modules/@playwright/test/cli.js test --config e2e/playwright.intervals.config.mjs
    $qaExit=$LASTEXITCODE
} finally {
    & ./e2e/intervals-icu/provision.ps1 -Phase PrepareCleanup -RunDirectory $qaRun
    node e2e/intervals-icu/cleanup.mjs
    if($LASTEXITCODE -ne 0){throw 'Synthetic account cleanup did not complete.'}
    & ./e2e/intervals-icu/provision.ps1 -Phase VerifyCleanup -RunDirectory $qaRun
}
if($qaExit -ne 0){throw 'Browser verification failed; review the retained evidence.'}
```

The cleanup command verifies each exact synthetic email through `/api/profile/me` before calling the real account deletion service. PostgreSQL verification checks that those accounts, profiles and captured activities are gone and every pre-test runner/activity ID remains.

Results and screenshot/axe attachments are under `output/playwright/intervals-icu/`. The HTML report is in its `report/` directory. Scope, destination decisions, reproduced defects and manual checks are documented in `replica/intervals-icu/`.

For an experimental `hermes-road-v4` release, use the same fresh provisioning and cleanup wrapper with `node e2e/intervals-icu/plan-activation.verify.mjs` as its test command. It checks that qualified approval remains false, literal experimental consent is required, stale/unauthorized activation is rejected, successful activation is idempotent, the published calendar matches the preview, and Schedule/Today display the experimental notice. It also checks that two authored sessions on one day remain supported. Evidence and screenshots are written under `output/plan-activation-review/`. These synthetic checks verify software behavior; they do not validate training outcomes.
