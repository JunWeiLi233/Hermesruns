import {MAP_TOKENS as T} from './workoutMapTokens';

export function groupRouteParts(parts) {
  const groups=new Map();for(const part of parts){const key=String(part.activityId);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(part);}
  return groups;
}
export function coverageTileBounds([x,y],zoom=T.coverageZoom) {
  const size=2**zoom,latitude=value=>Math.atan(Math.sinh(Math.PI*(1-2*value/size)))*180/Math.PI;
  return [[latitude(y+1),x/size*360-180],[latitude(y),(x+1)/size*360-180]];
}
function clip(a,b,bounds) {
  const dx=b.x-a.x,dy=b.y-a.y;let from=0,to=1;
  const p=[-dx,dx,-dy,dy],q=[a.x-bounds[0],bounds[2]-a.x,a.y-bounds[1],bounds[3]-a.y];
  for(let i=0;i<4;i++){if(p[i]===0){if(q[i]<0)return null;continue;}const t=q[i]/p[i];if(p[i]<0)from=Math.max(from,t);else to=Math.min(to,t);if(from>to)return null;}
  return [{x:a.x+from*dx,y:a.y+from*dy},{x:a.x+to*dx,y:a.y+to*dy}];
}
function eachSpan(parts,project,bounds,visit) {
  for(const part of parts){let previous=null;for(const coordinate of part.coordinates){const point=project(coordinate);
    if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)){previous=null;continue;}
    if(previous){const span=clip(previous,point,bounds);if(span)visit(span[0],span[1],String(part.activityId));}previous=point;
  }}
}
export function buildHeatCoverage(parts,project,bounds) {
  const coverage=new Map();
  for(const group of groupRouteParts(parts).values()) {
    const visited=new Set();
    eachSpan(group,project,bounds,(a,b)=>{
      // Traverse anchored pixel cells at their actual crossings. Uniform samples
      // restarted at a clipped viewport edge can change diagonal intensity on pan.
      const dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy),endX=Math.floor(b.x),endY=Math.floor(b.y);
      // Crossings at the same corner may differ by a few projection ULPs.
      // Scale the comparison to coordinate magnitude and span length so the
      // same line cannot visit opposite side cells when its direction changes.
      const crossingTolerance=Number.EPSILON*8*Math.max(1,Math.abs(a.x),Math.abs(a.y),Math.abs(b.x),Math.abs(b.y))/Math.max(1,Math.abs(dx),Math.abs(dy));
      let x=Math.floor(a.x),y=Math.floor(a.y),tx=dx===0?Infinity:((sx>0?x+1:x)-a.x)/dx,ty=dy===0?Infinity:((sy>0?y+1:y)-a.y)/dy;
      visited.add(`${x}:${y}`);
      while(x!==endX||y!==endY){
        if(x===endX){y+=sy;ty+=Math.abs(1/dy);}
        else if(y===endY){x+=sx;tx+=Math.abs(1/dx);}
        else if(Math.abs(tx-ty)<=crossingTolerance){x+=sx;y+=sy;tx+=Math.abs(1/dx);ty+=Math.abs(1/dy);}
        else if(tx<ty){x+=sx;tx+=Math.abs(1/dx);}
        else if(ty<tx){y+=sy;ty+=Math.abs(1/dy);}
        else{x+=sx;y+=sy;tx+=Math.abs(1/dx);ty+=Math.abs(1/dy);}
        visited.add(`${x}:${y}`);
      }
    });
    for(const key of visited)coverage.set(key,(coverage.get(key)||0)+1);
  }
  return coverage;
}
export function heatColor(visits) {
  const value=Math.min(1,Math.log2(Math.max(1,visits))/Math.log2(T.heatCeiling));
  const end=T.heatStops.findIndex((stop,i)=>i>0&&stop[0]>=value),right=T.heatStops[Math.max(1,end)],left=T.heatStops[Math.max(1,end)-1];
  const fraction=(value-left[0])/(right[0]-left[0]);return left.slice(1).map((channel,i)=>Math.round(channel+(right[i+1]-channel)*fraction));
}
export function bucketHeatCoverage(coverage) {
  const buckets=new Map();
  for(const [key,visits] of coverage){const [x,y]=key.split(':').map(Number),bucket=`${Math.floor(x/T.tileSize)}:${Math.floor(y/T.tileSize)}`;
    if(!buckets.has(bucket))buckets.set(bucket,[]);buckets.get(bucket).push([x,y,visits]);}
  return buckets;
}
export function renderHeatTile(coverage,tileX,tileY,buckets) {
  const size=T.tileSize,data=new Uint8ClampedArray(size*size*4),scores=new Float32Array(size*size);
  const originX=tileX*size,originY=tileY*size,radius=T.heatHalo;
  const entries=buckets?[-1,0,1].flatMap(dx=>[-1,0,1].flatMap(dy=>buckets.get(`${tileX+dx}:${tileY+dy}`)||[])):[...coverage].map(([key,visits])=>[...key.split(':').map(Number),visits]);
  for(const [worldX,worldY,visits] of entries) {
    const x=worldX-originX,y=worldY-originY;
    if(x<-radius||x>=size+radius||y<-radius||y>=size+radius)continue;
    const color=heatColor(visits);
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
      const distance=Math.hypot(dx,dy),px=x+dx,py=y+dy;if(distance>radius||px<0||py<0||px>=size||py>=size)continue;
      const alpha=T.heatAlpha*Math.exp(-distance*distance/T.heatFalloff),score=alpha*(1+Math.log2(visits)*T.heatPriority),index=py*size+px;
      if(score<=scores[index])continue;scores[index]=score;
      data[index*4]=color[0];data[index*4+1]=color[1];data[index*4+2]=color[2];data[index*4+3]=Math.round(alpha*255);
    }
  }
  return data;
}
export function buildHitIndex(parts,project,bounds) {
  const cells=new Map(),radius=T.hitRadius,cell=T.hitCell,shared=new Map();
  eachSpan(parts,project,bounds,(a,b,id)=>{
    const first=`${a.x}:${a.y}`,second=`${b.x}:${b.y}`,key=first<second?`${first}/${second}`:`${second}/${first}`;
    if(shared.has(key)){shared.get(key).ids.add(id);return;}
    const span={a,b,ids:new Set([id])};shared.set(key,span);for(let x=Math.floor((Math.min(a.x,b.x)-radius)/cell);x<=Math.floor((Math.max(a.x,b.x)+radius)/cell);x++)
      for(let y=Math.floor((Math.min(a.y,b.y)-radius)/cell);y<=Math.floor((Math.max(a.y,b.y)+radius)/cell);y++){
        const key=`${x}:${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(span);
      }
  });return cells;
}
export function workoutHits(index,point) {
  const spans=index.get(`${Math.floor(point.x/T.hitCell)}:${Math.floor(point.y/T.hitCell)}`)||[],distance=new Map();
  for(const {a,b,ids} of spans){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length===0?0:Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length));
    const d=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
    if(d<=T.hitRadius)for(const id of ids)distance.set(id,Math.min(distance.get(id)??Infinity,d));
  }
  return {ids:[...distance].sort((a,b)=>a[1]-b[1]||Number(a[0])-Number(b[0])).slice(0,T.overlapLimit).map(([id])=>id),total:distance.size};
}
export function pickWorkouts(index,point){return workoutHits(index,point).ids;}
const strings=['q','from','to','sport','gear','sourceSport','subtype','commute','trainer'];
export const BASIC_METRICS=['minDistanceKm','maxDistanceKm','minMinutes','maxMinutes'];
export const ADVANCED_METRICS=['minAscentM','maxAscentM','minSpeedKmh','maxSpeedKmh','minHeartRate','maxHeartRate'];
export const METRIC_KEYS=[...BASIC_METRICS,...ADVANCED_METRICS];
export function readMapFilters(search='') {
  const params=new URLSearchParams(search),filters={q:'',from:'',to:'',sport:'RUN',gear:''};
  for(const key of strings)if(params.has(key))filters[key]=params.get(key).slice(0,key==='gear'?167:160);
  if(!['','RUN','NON_RUN','UNKNOWN'].includes(filters.sport))filters.sport='RUN';
  for(const key of ['commute','trainer'])if(filters[key]&&!['yes','no','unknown'].includes(filters[key]))delete filters[key];
  for(const key of METRIC_KEYS){const raw=params.get(key),value=Number(raw);if(raw!==null&&raw!==''&&Number.isFinite(value)&&value>=0&&value<=1e7)filters[key]=value;}
  return filters;
}
export function writeMapFilters(filters) {
  const params=new URLSearchParams();for(const key of strings)if(filters[key]||key==='sport'&&filters[key]==='')params.set(key,String(filters[key]).slice(0,key==='gear'?167:160));
  for(const key of METRIC_KEYS)if(Number.isFinite(filters[key])&&filters[key]>=0&&filters[key]<=1e7)params.set(key,String(filters[key]));
  return params.toString();
}
export function invalidMapRange(filters){
  if(filters.from&&filters.to&&filters.from>filters.to)return true;
  return METRIC_KEYS.some(key=>{const value=filters[key];if(value==null||value==='')return false;return !Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e7||key.startsWith('min')&&filters['max'+key.slice(3)]!=null&&filters['max'+key.slice(3)]!==''&&Number(value)>Number(filters['max'+key.slice(3)]);});
}
// Resolve shortcuts to civil dates in the account zone. Bookmarks store those
// dates, rather than a moving relative query or the browser's local timezone.
export function calendarPeriod(period,zone='UTC',now=new Date()) {
  if(period==='allTime')return {from:'',to:''};
  let parts;try{parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);}catch{return calendarPeriod(period,'UTC',now);}
  const get=key=>Number(parts.find(part=>part.type===key).value),year=get('year'),month=get('month'),day=get('day');
  const current=new Date(Date.UTC(year,month-1,day)),key=date=>date.toISOString().slice(0,10);let from=new Date(current),to=current;
  if(period==='last7'||period==='last30')from.setUTCDate(day-(period==='last7'?6:29));
  else if(period==='thisMonth')from.setUTCDate(1);
  else if(period==='lastMonth'){from=new Date(Date.UTC(year,month-2,1));to=new Date(Date.UTC(year,month-1,0));}
  else if(period==='thisYear')from=new Date(Date.UTC(year,0,1));
  else throw new Error('Unknown calendar period');
  return {from:key(from),to:key(to)};
}
