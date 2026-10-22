import {expect,it} from 'vitest';
import {buildHeatCoverage,renderHeatTile,buildHitIndex,pickWorkouts,groupRouteParts,readMapFilters,writeMapFilters} from '../workoutMapModel.js';

const line=(id,coords)=>({activityId:id,segmentId:0,part:0,coordinates:coords});
const project=([x,y])=>({x,y});
it('rasterizes continuous route spans, even with no recorded points in their middle',()=>{
  const coverage=buildHeatCoverage([line(1,[[20,40],[80,40]])],project,[0,0,100,100]);
  expect(coverage.get('50:40')).toBe(1);
  expect(coverage.has('50:50')).toBe(false);
});
it('counts a workout once per cell regardless of sampling, laps, or overlapping page fragments',()=>{
  const once=buildHeatCoverage([line(1,[[20,40],[80,40]])],project,[0,0,100,100]);
  const repeated=buildHeatCoverage([line(1,[[20,40],[50,40],[80,40],[20,40]]),line(1,[[20,40],[80,40]])],project,[0,0,100,100]);
  expect([...repeated]).toEqual([...once]);
  const two=buildHeatCoverage([line(1,[[20,40],[80,40]]),line(2,[[20,40],[80,40]])],project,[0,0,100,100]);
  expect(two.get('50:40')).toBe(2);
});
it('keeps the interior between parallel routes transparent and distinguishes repeated coverage',()=>{
  const coverage=buildHeatCoverage([line(1,[[20,38],[80,38]]),line(2,[[20,46],[80,46]])],project,[0,0,100,100]);
  const raster=renderHeatTile(coverage,0,0);
  expect(raster[(42*256+50)*4+3]).toBe(0);
  expect(raster[(38*256+50)*4+3]).toBeGreaterThan(0);
  const busy=new Map(coverage);busy.set('50:38',64);
  expect(renderHeatTile(busy,0,0)[(38*256+50)*4]).toBeGreaterThan(raster[(38*256+50)*4]);
});
it('clips long offscreen spans before rasterization and leaves the input untouched',()=>{
  const coords=Object.freeze([Object.freeze([-1e8,40]),Object.freeze([1e8,40])]);
  const coverage=buildHeatCoverage([line(1,coords)],project,[0,0,100,100]);
  expect(coverage.size).toBeLessThanOrEqual(102);expect(coverage.get('50:40')).toBe(1);
});
it('returns all nearby workout identities at an overlap without connecting separate source segments',()=>{
  const parts=[line(7,[[20,40],[80,40]]),line(8,[[20,40],[80,40]]),line(9,[[20,60],[80,60]])];
  const index=buildHitIndex(parts,project,[0,0,100,100]);
  expect(pickWorkouts(index,{x:50,y:42})).toEqual(['7','8']);
  expect(pickWorkouts(index,{x:50,y:90})).toEqual([]);
  expect(groupRouteParts(parts).size).toBe(3);
});
it('round-trips bounded canonical filters in bookmarks without carrying credentials',()=>{
  const filters={q:'Evening & trail',from:'2026-10-01',to:'2026-10-19',sport:'RUN',gear:'8',minDistanceKm:5,maxMinutes:90};
  const query=writeMapFilters(filters);expect(readMapFilters(query)).toMatchObject(filters);
  expect(writeMapFilters({...filters,token:'secret',ownerId:4})).not.toContain('secret');
  expect(readMapFilters('?minDistanceKm=NaN').minDistanceKm).toBeUndefined();
});
