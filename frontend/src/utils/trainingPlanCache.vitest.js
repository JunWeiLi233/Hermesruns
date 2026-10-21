import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { planRead, clearPlanReadCache, planReadOnly } from './trainingPlanCache';

let token;
beforeEach(()=>{
  vi.stubGlobal('crypto',webcrypto);localStorage.clear();
  token='opaque-session-'+crypto.randomUUID();
  localStorage.setItem('hermes_jwt',token);vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
});
afterEach(()=>{clearPlanReadCache();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('requires a still-valid server-provided offline authorization window',async()=>{
  await planRead('/api/run-plans',token,async()=>({plans:[],offlineUntil:Date.now()-1000}));
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
  await expect(planRead('/api/run-plans',token,vi.fn())).rejects.toMatchObject({code:'OFFLINE_NOT_CACHED'});
});
it('reads a captured plan only for its exact unexpired session and blocks writes',async()=>{
  const captured={ownerId:'owner-one',plans:[],offlineUntil:Date.now()+3600000};
  await planRead('/api/run-plans',token,async()=>captured);
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
  const load=vi.fn();expect(await planRead('/api/run-plans',token,load)).toEqual(captured);expect(load).not.toHaveBeenCalled();expect(planReadOnly()).toBe(true);
  localStorage.setItem('hermes_jwt','another-session');
  await expect(planRead('/api/run-plans',token,async()=>{throw new Error('network');})).rejects.toThrow('network');
});
it('never substitutes cached data for denied or missing resources',async()=>{
  await planRead('/api/run-plans',token,async()=>({ownerId:'private'}));
  for(const status of [401,403,404,500])await expect(planRead('/api/run-plans',token,async()=>{throw Object.assign(new Error('denied'),{status});})).rejects.toMatchObject({status});
  expect(Object.keys(localStorage).filter(k=>k.startsWith('hermes_plan_read_v1:'))).toHaveLength(0);
});
it('expires saved data and removes it on logout cleanup',async()=>{
  await planRead('/api/run-plans',token,async()=>({plans:[],offlineUntil:Date.now()+3600000}));
  const key=Object.keys(localStorage).find(k=>k.startsWith('hermes_plan_read_v1:')&&!k.endsWith(':authorization'));const value=JSON.parse(localStorage.getItem(key));
  localStorage.setItem(key,JSON.stringify({...value,savedAt:Date.now()-2*86400000}));vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
  await expect(planRead('/api/run-plans',token,vi.fn())).rejects.toMatchObject({code:'OFFLINE_NOT_CACHED'});clearPlanReadCache();expect(localStorage.getItem(key)).toBeNull();
});
it('evicts a missing snapshot so a later offline read cannot resurrect it',async()=>{
  await planRead('/api/run-plans',token,async()=>({plans:[],offlineUntil:Date.now()+3600000}));
  const url='/api/run-plans/owned/workouts/retired';
  await planRead(url,token,async()=>({workout:{id:'retired'}}));
  await expect(planRead(url,token,async()=>{throw Object.assign(new Error('missing'),{status:404});})).rejects.toMatchObject({status:404});
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
  await expect(planRead(url,token,vi.fn())).rejects.toMatchObject({code:'OFFLINE_NOT_CACHED'});
});
