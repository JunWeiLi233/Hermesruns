import {afterEach,expect,it,vi} from 'vitest';
import {buildHeatCoverage,bucketHeatCoverage,renderHeatTile,heatColor,workoutHits,buildHitIndex,calendarPeriod,readMapFilters,writeMapFilters,invalidMapRange} from '../workoutMapModel';
import {projectHeatCoordinate,renderHeatJob} from '../workoutHeatJob';
import {createHeatPipeline} from '../workoutHeatPipeline';

const part=(id,coordinates)=>({activityId:id,segmentId:0,coordinates});
const point=([x,y])=>({x,y});
afterEach(()=>vi.unstubAllGlobals());

it.each([9,12,15])('calibrates distinct-workout intensity without per-view normalization at zoom %s',async zoom=>{
  const center=projectHeatCoordinate([0,20],zoom),x=Math.floor(center.x),y=Math.floor(center.y),tileX=Math.floor(x/256),tileY=Math.floor(y/256);
  const route=[[0,19.9],[0,20.1]],parts=Array.from({length:8},(_,i)=>part(i,route));
  const coverage=buildHeatCoverage(parts,p=>projectHeatCoordinate(p,zoom),[x-80,y-8,x+80,y+8]);
  expect(coverage.get(`${x}:${y}`)).toBe(8);
  const tiles=await renderHeatJob({parts,zoom,bounds:[x-80,y-8,x+80,y+8]});
  const pixels=tiles.find(t=>t.key===`${tileX}:${tileY}`).data,index=((y-tileY*256)*256+x-tileX*256)*4;
  expect([...pixels.slice(index,index+3)]).toEqual(heatColor(8));expect(pixels[index+3]).toBeGreaterThan(200);
});
it('buckets raster coverage without changing tile seams or negative world coordinates',()=>{
  const coverage=new Map([['255:20',1],['256:20',64],['-1:20',8],['0:20',3],['700:700',1]]),buckets=bucketHeatCoverage(coverage);
  for(const x of [-1,0,1])expect(renderHeatTile(null,x,0,buckets)).toEqual(renderHeatTile(coverage,x,0));
});
it('keeps diagonal cell visits stable when a pan changes the clipped starting position',()=>{
  const routes=[part(1,[[-10.2,10.3],[100.8,73.7]]),part(2,[[-10.2,10.3],[20.5,27.834234234234],[100.8,73.7]])];
  const wide=buildHeatCoverage(routes,point,[0,0,100,100]),tight=buildHeatCoverage(routes,point,[25.23,0,75.19,100]);
  for(const [key,value] of wide){const x=Number(key.split(':')[0]);if(x>26&&x<74)expect(tight.get(key)).toBe(value);}
});
it('calibrates holes, gaps and sampling density independently of page fragmentation',()=>{
  const routes=[part(1,[[20,20],[80,20],[80,80],[20,80],[20,20]]),part(2,[[22,25],[78,25]]),part(3,[[20,30],[30,30]]),part(3,[[70,30],[80,30]])];
  const coverage=buildHeatCoverage(routes,point,[0,0,100,100]);
  const pixels=renderHeatTile(coverage,0,0);
  expect(pixels[(50*256+50)*4+3]).toBe(0);expect(pixels[(30*256+50)*4+3]).toBe(0);
  const fragmented=[part(1,[[20,20],[50,20]]),part(1,[[50,20],[80,20]])];
  expect([...buildHeatCoverage(fragmented,point,[0,0,100,100])]).toEqual([...buildHeatCoverage([part(1,[[20,20],[80,20]])],point,[0,0,100,100])]);
});
it('reports overlap truncation while retaining deterministic nearest choices',()=>{
  const parts=Array.from({length:20},(_,id)=>part(id+1,[[20,40],[80,40]]));
  const hits=workoutHits(buildHitIndex(parts,point,[0,0,100,100]),{x:50,y:40});
  expect(hits).toEqual({ids:['1','2','3','4','5','6','7','8'],total:20});
});
it('uses the account civil date for DST shortcuts and leap/month boundaries',()=>{
  expect(calendarPeriod('last7','America/New_York',new Date('2026-11-01T03:30:00Z'))).toEqual({from:'2026-10-25',to:'2026-10-31'});
  expect(calendarPeriod('lastMonth','Pacific/Auckland',new Date('2024-03-01T12:00Z'))).toEqual({from:'2024-02-01',to:'2024-02-29'});
  expect(calendarPeriod('thisYear','America/New_York',new Date('2026-01-01T02:00Z'))).toEqual({from:'2025-01-01',to:'2025-12-31'});
  expect(calendarPeriod('allTime')).toEqual({from:'',to:''});
});
it('round trips advanced SI filters, missing source states and full-length gear without credentials',()=>{
  const f={sport:'',gear:'source:'+'x'.repeat(160),sourceSport:'TrailRun',subtype:'race',commute:'unknown',trainer:'no',minAscentM:0,maxSpeedKmh:12.5,minHeartRate:130};
  expect(readMapFilters(writeMapFilters({...f,owner:'private'}))).toMatchObject(f);
  expect(writeMapFilters({...f,owner:'private'})).not.toContain('private');
  expect(invalidMapRange({...f,minHeartRate:160,maxHeartRate:120})).toBe(true);
  expect(invalidMapRange({...f,minAscentM:-1})).toBe(true);expect(invalidMapRange(f)).toBe(false);
});
it('coalesces worker jobs, ignores a stale completion and terminates on teardown',()=>{
  let instance;class FakeWorker {constructor(){instance=this;this.messages=[];}postMessage(m){this.messages.push(m);}terminate(){this.terminated=true;}}
  vi.stubGlobal('Worker',FakeWorker);const ready=vi.fn(),pipeline=createHeatPipeline(ready,vi.fn());
  pipeline.render({parts:[]});pipeline.render({parts:['old']});pipeline.render({parts:['latest']});
  expect(instance.messages).toHaveLength(1);instance.onmessage({data:{revision:1,tiles:[]}});
  expect(ready).not.toHaveBeenCalled();expect(instance.messages[1].job.parts).toEqual(['latest']);
  instance.onmessage({data:{revision:3,tiles:[]}});expect(ready).toHaveBeenCalledOnce();
  pipeline.destroy();expect(instance.terminated).toBe(true);
});
it('renders with a cooperative fallback when module workers are unavailable',async()=>{
  vi.stubGlobal('Worker',class {constructor(){throw new Error('unsupported');}});
  const ready=vi.fn(),error=vi.fn(),pipeline=createHeatPipeline(ready,error);
  pipeline.render({parts:[part(1,[[0,0],[0,.01]])],zoom:9,bounds:[65530,65530,65542,65542]});
  await vi.waitFor(()=>expect(ready).toHaveBeenCalled());expect(ready.mock.calls[0][1]).toBe('cooperative');expect(error).not.toHaveBeenCalled();pipeline.destroy();
});


it('transfers route geometry to the heat worker only when the route set changes',()=>{
 let worker;vi.stubGlobal('Worker',class {constructor(){worker=this;this.messages=[];}postMessage(value){this.messages.push(value);}terminate(){}});
 const ready=vi.fn(),pipeline=createHeatPipeline(ready,vi.fn()),parts=[part(1,[[0,0],[0,.01]])];
 pipeline.render({parts,zoom:14,bounds:[0,0,256,256]});expect(worker.messages[0].job.parts).toBe(parts);
 worker.onmessage({data:{revision:1,tiles:[]}});
 pipeline.render({parts,zoom:15,bounds:[256,256,512,512]});expect(worker.messages[1].job).not.toHaveProperty('parts');
 expect(worker.messages[1].job.zoom).toBe(15);worker.onmessage({data:{revision:2,tiles:[]}});
 const next=[part(2,[[1,1],[1,1.01]])];pipeline.render({parts:next,zoom:15,bounds:[256,256,512,512]});expect(worker.messages[2].job.parts).toBe(next);pipeline.destroy();
});
