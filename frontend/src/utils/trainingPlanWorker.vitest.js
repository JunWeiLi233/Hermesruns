import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {expect,it,vi} from 'vitest';

it('warms unique uncached public assets with at most four concurrent requests',async()=>{
  const handlers={};let inFlight=0,peak=0;
  const origin='https://hermes.test';const existing=new Set([`${origin}/assets/saved.js`]);
  const cache={match:vi.fn(async url=>existing.has(String(url))),put:vi.fn(async url=>existing.add(String(url)))};
  const fetch=vi.fn(async url=>{inFlight++;peak=Math.max(peak,inFlight);await new Promise(resolve=>setTimeout(resolve,1));inFlight--;return {ok:true,url};});
  runInNewContext(readFileSync(resolve('public/training-plan-sw.js'),'utf8'),{
    self:{location:{origin},addEventListener:(name,handler)=>{handlers[name]=handler;}},caches:{open:async()=>cache},URL,fetch,
  });
  const urls=[`${origin}/assets/saved.js`,...Array.from({length:12},(_,i)=>`${origin}/assets/${i}.js`),`${origin}/assets/0.js`,`${origin}/api/run-plans`,'https://foreign.test/assets/private.js'];
  const tasks=[];for(let i=0;i<2;i++)handlers.message({data:{type:'CACHE_PLAN_ASSETS',urls},waitUntil:promise=>tasks.push(promise)});await Promise.all(tasks);
  expect(peak).toBeLessThanOrEqual(4);expect(fetch).toHaveBeenCalledTimes(12);
  expect(fetch.mock.calls.every(([url])=>url.startsWith(`${origin}/assets/`))).toBe(true);
});
