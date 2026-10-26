import { coverage, prepareSegments } from './geometry.js';
const all = (root, name) => [...root.getElementsByTagNameNS('*',name)];
const first = (root, name) => all(root,name)[0];
const text = (root, name) => first(root,name)?.textContent.trim() || '';
const number = (root, name) => { const value=text(root,name); return value!=='' && Number.isFinite(Number(value)) ? Number(value) : null; };
function instant(value) {
  if(!value || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
export function detectSport(value) {
  const lower=value.toLowerCase();
  return /cycl|bik|rid/.test(lower)?'ride':/walk/.test(lower)?'walk':/hik/.test(lower)?'hike':/swim/.test(lower)?'swim':/run|jog/.test(lower)?'run':'other';
}
export function parseActivity(xml, filename) {
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Document declarations are not allowed. Export a plain GPX or TCX file.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(all(doc,'parsererror').length)throw new Error('The file is not valid XML. Export a fresh copy from your device.');
  const isGpx=doc.documentElement.localName==='gpx'; const isTcx=doc.documentElement.localName==='TrainingCenterDatabase';
  if(!isGpx&&!isTcx)throw new Error('Choose a GPX or TCX activity file.');
  const containers=isGpx?all(doc,'trk'):all(doc,'Activity');
  if(containers.length!==1)throw new Error('Use one activity per file. Route-only GPX belongs in the later planned-route tool.');
  const root=containers[0];
  const rawSegments=(isGpx?all(root,'trkseg'):all(root,'Track')).map(track=>(isGpx?all(track,'trkpt'):all(track,'Trackpoint')).map(p=>{
    const lat=isGpx?p.getAttribute('lat'):text(p,'LatitudeDegrees');const lon=isGpx?p.getAttribute('lon'):text(p,'LongitudeDegrees');
    return {lat:lat!==''&&lat!=null?Number(lat):NaN,lon:lon!==''&&lon!=null?Number(lon):NaN,time:instant(text(p,isGpx?'time':'Time')),ele:number(p,isGpx?'ele':'AltitudeMeters')};
  }));
  const trackTimes=rawSegments.flatMap(s=>s.map(p=>p.time).filter(Boolean));
  const startTime=trackTimes[0]||instant(text(root,isGpx?'time':'Id'))||instant(text(doc,'time'));
  if(!startTime)throw new Error('The activity needs a valid timestamp with a UTC offset. No calendar time was guessed.');
  const {segments,breaks,pointCount}=prepareSegments(rawSegments); const grid=coverage(segments);
  const laps=isTcx?all(root,'Lap'):[];
  const lapText=(lap,name)=>[...lap.children].find(child=>child.localName===name)?.textContent.trim()||'';
  const sum = name => { const values=laps.map(l=>lapText(l,name)).filter(v=>v!=='').map(Number); return values.length?values.reduce((n,v)=>n+v,0):null; };
  for(const lap of laps)for(const key of ['DistanceMeters','TotalTimeSeconds']){const raw=lapText(lap,key);if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<0))throw new Error('Distance and recording time must be finite values of zero or more.');}
  const lapMeters=sum('DistanceMeters'); const lapSeconds=sum('TotalTimeSeconds');
  if(trackTimes.some((time,index)=>index>0&&Date.parse(time)<Date.parse(trackTimes[index-1])))throw new Error('Track timestamps must be ordered. Export a fresh activity file.');
  const elapsedSeconds=trackTimes.length>1?Math.max(0,(Date.parse(trackTimes.at(-1))-Date.parse(trackTimes[0]))/1000):lapSeconds;
  let ascentM=null;for(const segment of segments)for(let i=1;i<segment.length;i++){if(segment[i].ele!=null&&segment[i-1].ele!=null){ascentM??=0;ascentM+=Math.max(0,segment[i].ele-segment[i-1].ele);}}
  const heartRates=[...all(root,'HeartRateBpm').map(p=>number(p,'Value')),...all(root,'hr').map(p=>Number(p.textContent))].filter(v=>v!=null&&Number.isFinite(v)&&v>0);
  const originalSport=isGpx?text(root,'type'):root.getAttribute('Sport')||'';
  const originalSubtype=text(root,'activitySubtype')||text(root,'subtype');
  const flag=name=>{const value=text(root,name).toLowerCase();return ['true','1'].includes(value)?true:['false','0'].includes(value)?false:null;};
  const metadata={ sport:detectSport(originalSport), subtype:['regular','workout','race'].includes(originalSubtype)?originalSubtype:'unknown', commute:flag('commute'), trainer:flag('trainer'), gear:(text(root,'equipment')||text(root,'gear')).slice(0,240)||null };
  return {name:(text(root,isGpx?'name':'Notes')||filename.replace(/\.[^.]+$/,'')).slice(0,240),startTime,...metadata,distanceKm:lapMeters!=null?lapMeters/1000:pointCount>1?grid.distanceKm:null,
    movingSeconds:lapSeconds??elapsedSeconds,elapsedSeconds,ascentM,averageHr:heartRates.length?Math.round(heartRates.reduce((n,v)=>n+v,0)/heartRates.length):null,
    segments,cells:grid.cells,pointCount,quality:{breaks,precision:'full-source',movingTimeEstimated:lapSeconds==null,gridVersion:'mercator-z14-halfopen-v1'},source:{classification:'independent_file',format:isGpx?'GPX':'TCX',filename,originalSport,originalSubtype}};
}
export const IMPORT_LIMITS={files:20,fileBytes:50*1024*1024,totalBytes:100*1024*1024,historyPoints:500_000};
export function validateFiles(files, {server=false}={}) {
  if(!files.length)throw new Error('Choose at least one activity file.');
  if(files.length>IMPORT_LIMITS.files)throw new Error('Choose no more than 20 files at a time.');
  if(files.some(f=>!(server?/\.(gpx|tcx|fit)$/i:/\.(gpx|tcx)$/i).test(f.name)))throw new Error(server?'Choose FIT, GPX or TCX activity files.':'This local workspace reads GPX and TCX. FIT needs the backend importer.');
  if(files.some(f=>f.size===0||f.size>IMPORT_LIMITS.fileBytes))throw new Error('Each file must contain data and be no larger than 50 MiB.');
  if(files.reduce((n,f)=>n+f.size,0)>IMPORT_LIMITS.totalBytes)throw new Error('Keep a batch within 100 MiB.');
}
