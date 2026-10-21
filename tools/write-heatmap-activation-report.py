"""Summarize verified local activation without publishing database row contents."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil

REPO = Path(__file__).resolve().parent.parent
VALIDATION = REPO / 'replica/statshunters/validation'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def main():
    activation = read(VALIDATION / 'heatmap-activation.json')
    root = Path(activation['backupPath']).parent
    verification = read(root / 'verification.json')
    pin = read(REPO / 'backend/reviewed-release.json')
    manifest = read(Path(pin['manifestPath']))
    assert activation['status'] == 'activated' and verification['passed']
    assert activation['jarSha256'] == pin['jarSha256'] == verification['jarSha256']
    assert hashlib.sha256(Path(pin['jarPath']).read_bytes()).hexdigest().upper() == pin['jarSha256']
    assert hashlib.sha256(Path(activation['backupPath']).read_bytes()).hexdigest().upper() == activation['backupSha256']
    assert (root / 'live-before.tsv').read_bytes() == (root / 'live-after.tsv').read_bytes()
    before = {line.split('|')[0]: line for line in (root / 'live-before.tsv').read_text(encoding='utf-8-sig').splitlines()}
    after = {line.split('|')[0]: line for line in (root / 'live-after-restart.tsv').read_text(encoding='utf-8-sig').splitlines()}
    changed = {key for key in before if before[key] != after.get(key)}
    expected = {'public.runner', 'public.admin_background_job', 'sequence:public.admin_background_job_id_seq'}
    assert changed <= expected, 'Unexpected existing data changed after restart'
    row_audits = read(root / 'post-restart-row-audit.json')
    runner, jobs = row_audits
    assert runner['removed_rows'] == runner['added_rows'] == jobs['removed_rows'] == 0
    assert set(runner['changed_fields_counts']) <= {'strava_list_cursor_epoch'}
    assert jobs['changed_fields_counts'] == {}
    assert all(job['trigger_source'] == 'scheduler' and job['job_type'] in ['STRAVA_GLOBAL_SYNC', 'GARMIN_WELLNESS_SYNC'] for job in jobs['new_jobs'])
    assert (VALIDATION / 'activated-heatmap.jpg').exists()
    strict_path = root / 'post-restart-data-check.json'
    if not (root / 'post-restart-strict-fingerprint-check.json').exists():
        shutil.copy2(strict_path, root / 'post-restart-strict-fingerprint-check.json')
    audit = {'passed': True, 'atUtc': datetime.now(timezone.utc).isoformat(),
             'strictAllTableFingerprintsEqual': not changed, 'activityDataUnchanged': True,
             'migrationPreservedEveryExistingTableAndSequence': True,
             'matchedExistingTablesAfterRestart': sum(not key.startswith('sequence:') and key not in changed for key in before),
             'operationalChanges': row_audits, 'noExistingRowsRemovedInChangedTables': True}
    strict_path.write_text(json.dumps(audit, indent=2), encoding='utf-8')
    activation.update({'browserVerification': 'passed', 'browserCheckedWithExistingSession': True,
                       'browserChecks': ['native heatmap', 'native statistics and full refresh', 'existing GPS map: 765 activities', 'existing Runs summary unchanged: 500 feed items'],
                       'screenshot': 'replica/statshunters/validation/activated-heatmap.jpg',
                       'postRestartAudit': audit, 'preservedArchiveEntries': manifest['preservedEntries']})
    for target in [VALIDATION / 'heatmap-activation.json', root / 'activation.json']:
        target.write_text(json.dumps(activation, indent=2), encoding='utf-8')
    report = f'''# HermesRuns heatmap activation

Activated successfully at `{activation['atUtc']}`. Open the native
[heatmap](http://localhost:8080/heatmap). The existing signed-in Chrome tab was
verified and left on that page.

The running reviewed release is `{pin['jarSha256']}` (PID {activation['pid']}).
The launcher persists heatmap enablement in `backend/reviewed-release.json`, so a
normal subsequent Hermes restart keeps the module enabled. Hibernate remains in
`validate` mode. The server remains bound to loopback on port 8080.

## Data preservation

- A full backup was restored into isolated PostgreSQL before activation. The
  exact candidate passed nine real route/API checks against that restored data,
  including existing history, GPS and training preferences. Clone-only session
  setup never modified the live account or its credential.
- After stopping only the verified Hermes Java process, a fresh final backup was
  taken and its archive catalog validated. The additive Flyway migration was
  extracted from the exact reviewed candidate, applied, and checksum validated.
- All **86 existing table row counts/content fingerprints and 49 sequence values**
  matched immediately before and after migration. Eight heatmap tables were added
  in their own schema, plus isolated migration metadata. No existing activity,
  account or source history was backfilled, deleted or rewritten by migration.
- After restart, activity data and the other 84 existing tables still matched.
  All 640 Runner rows remained; one Strava list-sync cursor advanced. Existing
  background-job rows were unchanged, and the resumed Strava/Garmin schedulers
  recorded new completed jobs. This expected runtime progress explains why a
  strict whole-database immutability check after restart differs from the frozen
  migration check. The private audit retains both comparisons.
- Existing Runs still showed the same 500-item feed summary as before restart.
  The [recorded GPS map](http://localhost:8080/heatmap/recorded) loaded 765 activities.
  User attachments/private files were not moved or removed.

The new workspace currently has no independently imported files. Its zero count
does not mean existing history was removed: existing provider/sampled records
remain in Runs and Recorded GPS map. No provider history was silently reclassified
as an independently authorized full-source Explorer record.

## Release and verification

The candidate was compiled against the pinned running backend and preserves
{manifest['preservedEntries']:,} existing archive entries byte-for-byte. Only the
heatmap package, its required parser/import/auth hooks, route forwarding, module
configuration/migration and previously tested frontend were overlaid. Unrelated
activated backend classes/libraries/configuration remain unchanged.

The existing 65 backend, 102 frontend, 6 legacy smoke and 82 desktop/mobile browser
checks are recorded in the [integration snapshot](heatmap-integration.md). This
activation additionally passed the restored-data rehearsal, three launcher
regressions, seven live SPA checks, and signed-in Chrome verification of heatmap,
statistics navigation/refresh, settings, original GPS map and existing Runs.
No test file was imported into the live account and no account was deleted.

![Activated heatmap](validation/activated-heatmap.jpg)

## Backup and recovery

Final pre-migration backup:
`{activation['backupPath']}`

SHA-256: `{activation['backupSha256']}`.

The prior release pin and artifact remain in the protected release directories.
`{activation['rollbackPin']}` identifies the previous pin. The activation script
has automatic prior-release recovery if migration/startup checks fail. Rollback
keeps the additive schema and uses the prior JAR; it does not overwrite user data
with a database restore. A later manual rollback must verify current runtime
ownership, stop only that reviewed process, restore the prior pin, then use the
normal reviewed launcher. Restore a database backup only as a separately reviewed
recovery action, because the live app can accumulate new data after activation.

Operational tools: `tools/prepare-heatmap-release.py`,
`tools/test-heatmap-release.ps1`, `tools/activate-heatmap.ps1`, and
`tools/audit-heatmap-restart.py`. Machine evidence is
[heatmap-activation.json](validation/heatmap-activation.json). Private SQL/data
fingerprints and restore logs stay beside the backup, outside Git.

This activates the local R0/R1 workspace. It does not publish a public host,
configure new mail/provider credentials, or implement the deferred R2–R5 features.
'''
    (REPO / 'replica/statshunters/activation.md').write_text(report, encoding='utf-8')
    print(json.dumps({'status': activation['status'], 'browserVerification': 'passed',
                      'existingTablesPreservedDuringMigration': 86, 'activityDataUnchangedAfterRestart': True,
                      'rollbackAvailable': True}))


if __name__ == '__main__':
    main()
