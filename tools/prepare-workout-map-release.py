"""Scope a heat-layer backend/frontend overlay to the currently pinned release."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,subprocess,zipfile
R=Path(__file__).resolve().parent.parent
sha=lambda b:hashlib.sha256(b).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
pin=read(R/'backend/reviewed-release.json');base=Path(pin['jarPath']);assert sha(base.read_bytes())==pin['jarSha256']
root=R/'.private-backups'/('workout-map-release-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
for folder in ['base','lib','overlay','empty-source']:(root/folder).mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(base) as z:
 for item in z.infolist():
  target=None
  if item.filename.startswith('BOOT-INF/classes/') and item.filename.endswith('.class'):target=root/'base'/item.filename.removeprefix('BOOT-INF/classes/')
  elif item.filename.startswith('BOOT-INF/lib/') and item.filename.endswith('.jar'):target=root/'lib'/Path(item.filename).name
  if target:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(item))
sources=list((R/'backend/src/main/java/com/hermes/backend/heatmap').glob('*.java'))+[R/f'backend/src/main/java/com/hermes/backend/explorer/{name}.java' for name in ['ExplorerStore','ExplorerInvalidation']]
cmd=['javac','-J-Duser.language=en','--release','17','-encoding','UTF-8','-parameters','-classpath',str(root/'base')+';'+str(root/'lib/*'),'-sourcepath',str(root/'empty-source'),'-d',str(root/'overlay')]+[str(p) for p in sources]
result=subprocess.run(cmd,capture_output=True,text=True);(root/'compile.log').write_text(result.stdout+result.stderr,encoding='utf-8')
if result.returncode:print(result.stderr[-12000:]);raise SystemExit(result.returncode)
changes={}
for p in (root/'overlay').rglob('*.class'):
 name=p.relative_to(root/'overlay').as_posix()
 assert name.startswith('com/hermes/backend/heatmap/') or name.split('$')[0].removesuffix('.class') in ['com/hermes/backend/explorer/ExplorerStore','com/hermes/backend/explorer/ExplorerInvalidation'],name
 changes['BOOT-INF/classes/'+name]=p.read_bytes()
allowed=set(changes)
for p in (R/'backend/src/main/resources/static').rglob('*'):
 if p.is_file():changes['BOOT-INF/classes/static/'+p.relative_to(R/'backend/src/main/resources/static').as_posix()]=p.read_bytes()
jar=root/'backend.jar';preserved=0;changed=[]
with zipfile.ZipFile(base) as old,zipfile.ZipFile(jar,'w') as new:
 for item in old.infolist():
  if item.filename.startswith('BOOT-INF/classes/static/'):continue
  before=old.read(item);after=changes.pop(item.filename,before);new.writestr(item,after)
  if before!=after:assert item.filename in allowed;changed.append(item.filename)
  elif not item.is_dir():preserved+=1
 for name,body in changes.items():new.writestr(name,body,compress_type=zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(base) as old,zipfile.ZipFile(jar) as new:
 for item in old.infolist():
  if item.is_dir() or item.filename.startswith('BOOT-INF/classes/static/') or item.filename in allowed:continue
  assert old.read(item)==new.read(item.filename),'Unrelated active artifact changed: '+item.filename
previous=read(Path(pin['manifestPath']));manifest={**previous,'jarPath':str(jar),'jarSha256':sha(jar.read_bytes()),'previousJarSha256':pin['jarSha256'],'builtAt':datetime.now(timezone.utc).isoformat(),'buildMode':'Scoped recorded-workout map overlay; no schema/resource/library changes','preservedNonStaticEntries':preserved,'changedExistingClasses':changed,'sources':{str(p.relative_to(R)).replace('\\','/'):sha(p.read_bytes()) for p in sources}}
with zipfile.ZipFile(jar) as z:
 manifest['classes']=[{'path':i.filename,'sha256':sha(z.read(i))} for i in z.infolist() if i.filename.endswith('.class') and i.filename.startswith('BOOT-INF/classes/')]
 manifest['resources']=[{'path':i.filename,'sha256':sha(z.read(i))} for i in z.infolist() if not i.is_dir() and not i.filename.endswith('.class') and i.filename.startswith('BOOT-INF/classes/')]
manifestPath=root/'release-manifest.json';manifestPath.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
nextPin={**pin,'jarPath':str(jar),'jarSha256':manifest['jarSha256'],'manifestPath':str(manifestPath),'manifestSha256':sha(manifestPath.read_bytes())}
pinPath=root/'candidate-release.json';pinPath.write_text(json.dumps(nextPin,indent=2),encoding='utf-8')
(root/'previous-release.json').write_text(json.dumps(pin,indent=2),encoding='utf-8')
candidate={'releaseRoot':str(root),'jarPath':str(jar),'jarSha256':nextPin['jarSha256'],'baseJarSha256':pin['jarSha256'],'candidatePinPath':str(pinPath),'preservedNonStaticEntries':preserved,'changedExistingClasses':changed,'compiledClasses':sorted(allowed),'schemaChanged':False}
(R/'replica/statshunters/validation/workout-map-candidate.json').write_text(json.dumps(candidate,indent=2),encoding='utf-8')
print(json.dumps(candidate,indent=2))
