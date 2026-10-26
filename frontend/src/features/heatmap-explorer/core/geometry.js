export const GRID_ZOOM = 14;
export const GRID_SIZE = 2 ** GRID_ZOOM;
export const MAX_GAP_KM = 10;
export const MAX_POINTS = 200_000;
export const MAX_CELLS = 150_000;
export function haversine(a, b) {
  const rad = Math.PI / 180; const dlat = (b.lat-a.lat)*rad; const dlon = (b.lon-a.lon)*rad;
  const h = Math.sin(dlat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
}
export function project(point) {
  const lat = Math.max(-85.05112878,Math.min(85.05112878,point.lat))*Math.PI/180;
  return {x:(point.lon+180)/360*GRID_SIZE, y:Math.max(0,Math.min(GRID_SIZE-1e-8,(1-Math.asinh(Math.tan(lat))/Math.PI)/2*GRID_SIZE))};
}
export function cellBounds(key) {
  const [x,y] = key.split(':').map(Number); const lon = x => x/GRID_SIZE*360-180;
  const lat = y => Math.atan(Math.sinh(Math.PI*(1-2*y/GRID_SIZE)))*180/Math.PI;
  return [[lat(y+1),lon(x)],[lat(y),lon(x+1)]];
}
// Half-open cells. A diagonal through a corner enters only the diagonal cell.
// Enumerates every crossed cell before any display simplification; no point sampling.
export function segmentCells(a, b) {
  const start = project(a); const end = project(b);
  if (end.x-start.x > GRID_SIZE/2) end.x -= GRID_SIZE;
  if (end.x-start.x < -GRID_SIZE/2) end.x += GRID_SIZE;
  let x = Math.floor(start.x), y = Math.floor(start.y); const finalX = Math.floor(end.x), finalY = Math.floor(end.y);
  const dx = end.x-start.x, dy = end.y-start.y, sx = Math.sign(dx), sy = Math.sign(dy);
  const stepX = dx ? Math.abs(1/dx) : Infinity, stepY = dy ? Math.abs(1/dy) : Infinity;
  let tx = dx ? ((sx>0 ? x+1 : x)-start.x)/dx : Infinity;
  let ty = dy ? ((sy>0 ? y+1 : y)-start.y)/dy : Infinity;
  const cells = [];
  for (let guard = 0; guard < GRID_SIZE*2+4; guard++) {
    if (y>=0 && y<GRID_SIZE) cells.push(`${((x%GRID_SIZE)+GRID_SIZE)%GRID_SIZE}:${y}`);
    if(x===finalX && y===finalY) return cells;
    if (Math.abs(tx-ty)<1e-12) {x+=sx;y+=sy;tx+=stepX;ty+=stepY;}
    else if(tx<ty){x+=sx;tx+=stepX;} else {y+=sy;ty+=stepY;}
  }
  throw new Error('Track crosses too many grid cells. Split the activity file.');
}
export function prepareSegments(rawSegments) {
  const segments=[]; let breaks=0; let count=0;
  for(const source of rawSegments){let current=[]; for(const point of source){
    count++; if(count>MAX_POINTS)throw new Error('This workspace accepts at most 200,000 points per activity. No points were saved or sampled.');
    if(Number.isFinite(point.lat)&&Math.abs(point.lat)>85.05112878&&Math.abs(point.lat)<=90)throw new Error('This activity is outside the supported Mercator map latitude range. No geometry was sampled or saved.');
    if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180){if(current.length)segments.push(current);current=[];breaks++;continue;}
    if(current.length && haversine(current.at(-1),point)>MAX_GAP_KM){segments.push(current);current=[];breaks++;}
    current.push(point);
  } if(current.length)segments.push(current);}
  return {segments,breaks,pointCount:segments.reduce((n,s)=>n+s.length,0)};
}
export function coverage(segments) {
  const cells=new Set(); let distanceKm=0;
  for(const segment of segments){for(let i=0;i<segment.length;i++){
    const a=segment[i],b=segment[i+1]||a;
    for(const key of segmentCells(a,b))cells.add(key);
    if(cells.size>MAX_CELLS)throw new Error('Coverage exceeds this workspace’s limit. Use a smaller history.');
    if(i+1<segment.length)distanceKm+=haversine(a,b);
  }}
  return {cells:[...cells],distanceKm};
}
// Keep a dateline crossing short in Leaflet's unwrapped coordinate space.
export function displaySegment(segment) {
  let previous=null;
  return segment.map(p=>{let lon=p.lon;if(previous!=null){while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;}previous=lon;return [p.lat,lon];});
}
