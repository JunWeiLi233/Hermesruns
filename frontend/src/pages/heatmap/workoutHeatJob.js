import {MAP_TOKENS as T} from './workoutMapTokens';
import {buildHeatCoverage,bucketHeatCoverage,renderHeatTile,groupRouteParts} from './workoutMapModel';

export function projectHeatCoordinate([lat,lon],zoom) {
  const sine=Math.sin(Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180),scale=T.tileSize*2**zoom;
  return {x:scale*(lon/360+.5),y:scale*(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))};
}
// Same algorithm in worker and fallback; a workout's page fragments are grouped
// before deduplication. Raster tiles only inspect their nine neighbouring buckets.
export async function renderHeatJob({parts,zoom,bounds},yieldControl=async()=>{}) {
  const coverage=new Map();let count=0;
  for(const routes of groupRouteParts(parts).values()) {
    const single=buildHeatCoverage(routes,p=>projectHeatCoordinate(p,zoom),bounds);
    for(const [key,visits] of single)coverage.set(key,(coverage.get(key)||0)+visits);
    if(++count%T.heatYieldWorkouts===0)await yieldControl();
  }
  const buckets=bucketHeatCoverage(coverage),tiles=[];
  for(let x=Math.floor(bounds[0]/T.tileSize);x<=Math.floor(bounds[2]/T.tileSize);x++)
    for(let y=Math.floor(bounds[1]/T.tileSize);y<=Math.floor(bounds[3]/T.tileSize);y++) {
      tiles.push({key:`${x}:${y}`,data:renderHeatTile(null,x,y,buckets)});await yieldControl();
    }
  return tiles;
}
