import {expect,it,vi} from 'vitest';
import {coverageTileBounds} from '../workoutMapModel';
import {loadNewWorkoutTiles,loadWorkoutTiles} from '../useWorkoutMap';
const mocks=vi.hoisted(()=>({api:vi.fn()}));vi.mock('../../../api',()=>({apiJson:(...args)=>mocks.api(...args)}));
it('pages complete coverage and rejects repeated or missing cells',async()=>{
 const first={tileZoom:14,tileCount:501,newTileCount:501,cells:Array.from({length:500},(_,x)=>[x,1]),snapshot:'one',complete:false,nextCursor:'next'};
 mocks.api.mockResolvedValue({tileZoom:14,tileCount:501,newTileCount:501,cells:[[500,1]],snapshot:'one',complete:true,nextCursor:null});
 expect(await loadNewWorkoutTiles(1,'one',new AbortController().signal,first)).toHaveLength(501);
 mocks.api.mockResolvedValue({tileZoom:14,tileCount:501,newTileCount:501,cells:[[0,1]],snapshot:'one',complete:true,nextCursor:null});
 await expect(loadNewWorkoutTiles(1,'one',new AbortController().signal,first)).rejects.toThrow('incomplete');
 await expect(loadNewWorkoutTiles(1,'one',new AbortController().signal,{...first,newTileCount:null})).rejects.toThrow('unavailable');
});
it('maps half-open coverage cells to stable geographic rectangles',()=>{
 const [[south,west],[north,east]]=coverageTileBounds([8192,8191]);expect(south).toBeCloseTo(0,10);expect(west).toBe(0);expect(north).toBeGreaterThan(0);expect(east).toBeCloseTo(360/16384,10);
});
it('rejects stale first-page cells before highlighting a newer workout snapshot',async()=>{
 const first={tileZoom:14,tileCount:1,newTileCount:1,cells:[[4824,6150]],snapshot:'old',complete:true,nextCursor:null};
 await expect(loadNewWorkoutTiles(1,'current',new AbortController().signal,first)).rejects.toThrow();
});
it('honors the same bounded cooldown before reading new-cell counts',async()=>{
 vi.useFakeTimers();mocks.api.mockReset();
 const first={tileZoom:14,tileCount:1,newTileCount:1,cells:[[4824,6150]],snapshot:'one',complete:true,nextCursor:null};
 mocks.api.mockRejectedValueOnce(Object.assign(new Error('throttled'),{status:429,retryAfter:'1'})).mockResolvedValue(first);
 try {
  const result=loadWorkoutTiles(1,'one',new AbortController().signal);await vi.advanceTimersByTimeAsync(999);expect(mocks.api).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);expect(await result).toEqual(first);expect(mocks.api).toHaveBeenCalledTimes(2);
 } finally {vi.useRealTimers();}
});
