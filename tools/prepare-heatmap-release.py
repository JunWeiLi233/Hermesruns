"""Compile a narrowly scoped heatmap overlay against the pinned running backend."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import zipfile
import shutil

REPO = Path(__file__).resolve().parent.parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main():
    pin = json.loads((REPO / 'backend/reviewed-release.json').read_text(encoding='utf-8-sig'))
    base = Path(pin['jarPath'])
    assert sha(base) == pin['jarSha256'].upper(), 'Pinned backend changed'
    prior_path = REPO / 'replica/statshunters/validation/activation-candidate.json'
    prior = json.loads(prior_path.read_text(encoding='utf-8')) if prior_path.exists() else None
    root = Path(prior['releaseRoot']) if prior and prior['baseJarSha256'] == sha(base) else REPO / '.private-backups' / ('heatmap-release-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    classes, libraries, overlay, empty = [root / part for part in ['base', 'lib', 'overlay', 'empty-source']]
    for folder in [classes, libraries, overlay, empty]:
        folder.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(base) as archive:
        for item in archive.infolist():
            target = None
            if item.filename.startswith('BOOT-INF/classes/') and item.filename.endswith('.class'):
                target = classes / item.filename.removeprefix('BOOT-INF/classes/')
            elif item.filename.startswith('BOOT-INF/lib/') and item.filename.endswith('.jar'):
                target = libraries / Path(item.filename).name
            if target:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(item))
    sources = list((REPO / 'backend/src/main/java/com/hermes/backend/explorer').glob('*.java'))
    sources.append(REPO / 'backend/src/main/java/com/hermes/backend/infrastructure/web/SpaForwardingController.java')
    for part in ['imports/ActivityFileParser', 'imports/ParsedActivityData', 'imports/ParsedTrackPoint',
                 'imports/ActivityImportService', 'imports/AbstractXmlActivityFileParser',
                 'imports/GpxActivityFileParser', 'imports/TcxActivityFileParser', 'imports/FitActivityFileParser',
                 'runner/RunnerRegistrationGuard', 'auth/LoginController']:
        sources.append(REPO / ('backend/src/main/java/com/hermes/backend/' + part + '.java'))
    result = {'releaseRoot': str(root), 'baseJarSha256': sha(base), 'overlay': str(overlay),
              'sources': {p.relative_to(REPO).as_posix(): sha(p) for p in sources}}
    (root / 'prepare.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    (REPO / 'replica/statshunters/validation/activation-candidate.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    command = ['javac', '-J-Duser.language=en', '-J-Duser.country=US', '--release', '17', '-encoding', 'UTF-8', '-parameters', '-classpath',
               str(classes) + ';' + str(libraries / '*'), '-sourcepath', str(empty), '-d', str(overlay)]
    build = subprocess.run(command + [str(p) for p in sources], capture_output=True, text=True)
    (root / 'compile.log').write_text(build.stdout + build.stderr, encoding='utf-8')
    print(json.dumps({'releaseRoot': str(root), 'compileExitCode': build.returncode}))
    if build.returncode:
        print(build.stderr[-14000:])
        raise SystemExit(build.returncode)
    acceptance = json.loads((REPO / 'replica/statshunters/validation/native-integration-summary.json').read_text(encoding='utf-8'))
    accepted_jar = REPO / acceptance['package_path']
    assert sha(accepted_jar) == acceptance['package_sha256'].upper(), 'Tested frontend artifact changed'
    for path, digest in result['sources'].items():
        recorded = acceptance['source_files_sha256'].get(path)
        if recorded:
            assert digest == recorded.upper(), 'Tested source changed: ' + path
    changes = {}
    for compiled in overlay.rglob('*.class'):
        changes['BOOT-INF/classes/' + compiled.relative_to(overlay).as_posix()] = compiled.read_bytes()
    for resource in ['application-explorer.properties', 'explorer-migrations/V001__explorer_r0_r1.sql']:
        changes['BOOT-INF/classes/' + resource] = (REPO / 'backend/src/main/resources' / resource).read_bytes()
    with zipfile.ZipFile(accepted_jar) as frontend:
        for item in frontend.infolist():
            if item.filename.startswith('BOOT-INF/classes/static/') and not item.is_dir():
                changes[item.filename] = frontend.read(item)
    jar = root / 'backend.jar'
    with zipfile.ZipFile(base) as original, zipfile.ZipFile(jar, 'w') as candidate:
        for item in original.infolist():
            replacement = changes.pop(item.filename, None)
            candidate.writestr(item, original.read(item) if replacement is None else replacement)
        for name, content in changes.items():
            candidate.writestr(name, content, compress_type=zipfile.ZIP_DEFLATED)
    changed = []
    preserved = 0
    allowed = {'BOOT-INF/classes/' + p.relative_to(overlay).as_posix() for p in overlay.rglob('*.class')}
    allowed.update('BOOT-INF/classes/' + p for p in ['application-explorer.properties', 'explorer-migrations/V001__explorer_r0_r1.sql'])
    with zipfile.ZipFile(base) as original, zipfile.ZipFile(jar) as candidate:
        for item in original.infolist():
            assert item.filename in candidate.namelist(), 'Removed active entry: ' + item.filename
            before, after = original.read(item), candidate.read(item.filename)
            if before == after:
                preserved += 1
            else:
                assert item.filename in allowed or item.filename.startswith('BOOT-INF/classes/static/'), 'Unrelated backend changed: ' + item.filename
                changed.append(item.filename)
        inventory = [{'path': item.filename, 'sha256': hashlib.sha256(candidate.read(item)).hexdigest().upper()}
                     for item in candidate.infolist() if item.filename.startswith('BOOT-INF/classes/') and not item.is_dir()]
        assert not any('ExplorerBrowserFixtures' in item.filename for item in candidate.infolist())
    previous_manifest = json.loads(Path(pin['manifestPath']).read_text(encoding='utf-8-sig'))
    manifest = {'jarPath': str(jar), 'jarSha256': sha(jar), 'previousJarSha256': sha(base),
                'baseArtifactSha256': previous_manifest['baseArtifactSha256'],
                'builtAt': datetime.now(timezone.utc).isoformat(),
                'buildMode': 'Heatmap overlay compiled against pinned backend; tested native frontend; all unrelated backend entries preserved byte-for-byte',
                'preservedEntries': preserved, 'changedExistingEntries': changed,
                'classes': [item for item in inventory if item['path'].endswith('.class')],
                'resources': [item for item in inventory if not item['path'].endswith('.class')],
                'sources': [{'path': p, 'sha256': digest} for p, digest in result['sources'].items()],
                'testedFrontendArtifactSha256': sha(accepted_jar)}
    manifest_path = root / 'release-manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    shutil.copy2(REPO / 'backend/reviewed-release.json', root / 'previous-release.json')
    pin.update({'jarPath': str(jar), 'jarSha256': sha(jar), 'manifestPath': str(manifest_path),
                'manifestSha256': sha(manifest_path),
                'heatmap': {'enabled': True, 'cookieSecure': False, 'publicUrl': 'http://localhost:8080/heatmap/',
                            'migration': 'V001__explorer_r0_r1.sql'}})
    pin_path = root / 'candidate-release.json'
    pin_path.write_text(json.dumps(pin, indent=2), encoding='utf-8')
    result.update({'jarPath': str(jar), 'candidatePinPath': str(pin_path), 'jarSha256': sha(jar),
                   'preservedEntries': preserved, 'compiledClasses': len(allowed) - 2})
    (root / 'prepare.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    prior_path.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({key: result[key] for key in ['jarPath', 'jarSha256', 'preservedEntries', 'compiledClasses']}))


if __name__ == '__main__':
    main()
