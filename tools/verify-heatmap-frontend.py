"""Approve only the tested static UI overlay, with every backend entry preserved."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VALIDATION = ROOT / 'replica/statshunters/validation'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest().upper()
pin = read(ROOT / 'backend/reviewed-release.json')
candidate = read(VALIDATION / 'simple-heatmap-candidate.json')
next_pin = read(Path(candidate['candidatePinPath']))
manifest = read(Path(next_pin['manifestPath']))
assert manifest['previousJarSha256'] == pin['jarSha256']
assert sha(Path(pin['jarPath'])) == pin['jarSha256']
assert sha(Path(candidate['jarPath'])) == next_pin['jarSha256']
units = read(VALIDATION / 'simple-heatmap-tests.json')
browser = read(VALIDATION / 'simple-heatmap-browser.json')
assert units['success'] and units['numPassedTests'] == 34 and units['numFailedTests'] == 0
assert browser['status'] == 'passed' and len(browser['checks']) == 2
preserved = 0
with zipfile.ZipFile(pin['jarPath']) as base, zipfile.ZipFile(candidate['jarPath']) as release:
    for item in base.infolist():
        if item.is_dir() or item.filename.startswith('BOOT-INF/classes/static/'):
            continue
        assert base.read(item) == release.read(item.filename), 'Backend entry changed: ' + item.filename
        preserved += 1
    old_names = set(base.namelist())
    for item in release.infolist():
        if not item.is_dir() and item.filename not in old_names:
            assert item.filename.startswith('BOOT-INF/classes/static/'), 'Unexpected backend addition'
    static = ROOT / 'backend/src/main/resources/static'
    for path in static.rglob('*'):
        if path.is_file():
            assert path.read_bytes() == release.read('BOOT-INF/classes/static/' + path.relative_to(static).as_posix())
result = {'passed': True, 'frontendOnly': True, 'jarSha256': next_pin['jarSha256'],
          'previousJarSha256': pin['jarSha256'], 'preservedNonStaticEntries': preserved,
          'databaseMigrationRequired': False, 'unitTests': 34, 'browserViewports': ['desktop', 'mobile']}
(Path(candidate['releaseRoot']) / 'verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
