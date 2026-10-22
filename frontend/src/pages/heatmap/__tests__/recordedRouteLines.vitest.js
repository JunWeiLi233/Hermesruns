import { expect, it, vi } from 'vitest';
import { loadRecordedRoutes, normalizeRecordedRoute, paintRecordedRouteLines } from '../recordedRouteLines.js';

const point = (latitude, longitude) => ({latitude,longitude});
const route = (activityId, points) => ({activityId,points,availability:'READY'});
it('preserves the recorded sequence around turns and never sorts a route by coordinates', () => {
  const trace = [point(40.7,-74),point(40.701,-74),point(40.701,-74.001),point(40.7,-74.001)];
  expect(normalizeRecordedRoute(route(1,trace))).toEqual({activityId:'1',segments:[trace.map(p=>[p.latitude,p.longitude])]});
});
it('breaks at invalid positions and large GPS gaps without connecting across them', () => {
  const trace = [point(40.7,-74),point(40.701,-74),point(NaN,-74),point(40.702,-74),point(40.703,-74),point(41,-74),point(41.001,-74)];
  expect(normalizeRecordedRoute(route(1,trace)).segments).toEqual([
    [[40.7,-74],[40.701,-74]],[[40.702,-74],[40.703,-74]],[[41,-74],[41.001,-74]],
  ]);
  expect(normalizeRecordedRoute(route(2,[point(0,0),point(40.7,-74)] )).segments).toEqual([]);
});
it('draws separate solid red route paths with a fixed pixel width and no point markers', () => {
  const context = {beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),arc:vi.fn()};
  const routes = [normalizeRecordedRoute(route(1,[point(40.7,-74),point(40.701,-74)])),
    normalizeRecordedRoute(route(2,[point(40.7,-73.99),point(40.701,-73.99)]))];
  paintRecordedRouteLines(context,routes,([x,y])=>({x,y}));
  expect(context.moveTo.mock.calls).toEqual([[40.7,-74],[40.7,-73.99]]);
  expect(context.lineTo.mock.calls).toEqual([[40.701,-74],[40.701,-73.99]]);
  expect(context.strokeStyle).toBe('#ff3038');
  expect(context.lineWidth).toBe(1.6);
  expect(context.stroke).toHaveBeenCalledTimes(1);
  expect(context.arc).not.toHaveBeenCalled();
});
it('loads ordered geometry in bounded batches, deduplicates IDs and rejects unrequested routes', async () => {
  const ids = Array.from({length:105},(_,i)=>i+1);
  const fetchJson = vi.fn(async url => [...new URL(url,'http://test').searchParams.get('ids').split(',').map(id=>route(Number(id),[point(40.7,-74),point(40.701,-74)])),route(999,[point(40.7,-74),point(40.701,-74)])]);
  const onBatch = vi.fn();
  await loadRecordedRoutes([...ids,1,NaN,-3],{fetchJson,onBatch,signal:new AbortController().signal});
  expect(fetchJson).toHaveBeenCalledTimes(3);
  for(const [url] of fetchJson.mock.calls) expect(new URL(url,'http://test').searchParams.get('ids').split(',').length).toBeLessThanOrEqual(50);
  expect(onBatch.mock.calls.flatMap(([batch])=>batch).map(r=>r.activityId).sort((a,b)=>a-b)).toEqual(ids.map(String));
});
it('stops before the next batch when aborted and propagates failures for retry', async () => {
  const controller = new AbortController();
  const fetchJson = vi.fn(async()=>{controller.abort();return [];});
  await loadRecordedRoutes(Array.from({length:101},(_,i)=>i+1),{fetchJson,onBatch:vi.fn(),signal:controller.signal});
  expect(fetchJson).toHaveBeenCalledTimes(1);
  await expect(loadRecordedRoutes([1],{fetchJson:async()=>{throw new Error('offline');},onBatch:vi.fn(),signal:new AbortController().signal})).rejects.toThrow('offline');
});
it('fails visibly on an invalid response and retains terminal routes with no GPS', async () => {
  await expect(loadRecordedRoutes([1],{fetchJson:async()=>({}),onBatch:vi.fn(),signal:new AbortController().signal})).rejects.toThrow();
  const onBatch = vi.fn();
  await loadRecordedRoutes([1,2],{fetchJson:async()=>[route(1,[])],onBatch,signal:new AbortController().signal});
  expect(onBatch.mock.calls[0][0]).toEqual([{activityId:'1',segments:[]},{activityId:'2',segments:[]}]);
});
