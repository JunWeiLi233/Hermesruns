import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpApi } from '../core/http-api.js';
import { DEFAULT_PREFS, EMPTY_FILTER } from '../core/model.js';
import { validateFiles } from '../core/parser.js';

const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
function transport({onRequest,revision=7}={}){
  return vi.fn(async(path,options)=>{
    const url=new URL(path,'http://localhost');const handled=onRequest?.(url,options);if(handled)return handled;
    if(url.pathname==='/api/explorer/session')return response({opened:true,csrf:'synthetic-csrf',revision,preferences:DEFAULT_PREFS});
    if(url.pathname==='/api/explorer/preferences')return response({preferences:DEFAULT_PREFS,filter:EMPTY_FILTER,revision});
    if(url.pathname==='/api/explorer/activities')return response({items:[],total:0,historyCount:0,revision});
    if(url.pathname==='/api/explorer/map/summary')return response({count:0,cells:0,revision});
    if(url.pathname==='/api/explorer/statistics/all')return response({section:'all',data:{totals:{count:0}},revision});
    if(url.pathname==='/api/explorer/filter-options')return response({gear:[],sports:[],revision});
    return response({accepted:true,revision});
  });
}
afterEach(()=>sessionStorage.clear());
describe('Hermes Explorer HTTP boundary',()=>{
  it('uses same-origin cookies and in-memory CSRF without persisting authentication',async()=>{
    const fetcher=transport({onRequest:(url)=>url.pathname.endsWith('/login')?response({opened:true,csrf:'proof'}):null});const api=createHttpApi({fetcher,pollMs:0});
    await api.login({email:'invented@example.test',password:'synthetic-only',persistent:false});await api.setFilter({...EMPTY_FILTER,sport:'ride'});
    const [,options]=fetcher.mock.calls.at(-1);expect(options.credentials).toBe('same-origin');expect(options.headers['X-Explorer-CSRF']).toBe('proof');expect(options.headers).not.toHaveProperty('Authorization');
    expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);api.dispose();
  });
  it('only publishes a view when every panel has the same revision',async()=>{
    let conflicts=0;const fetcher=transport({revision:9,onRequest:url=>url.pathname.endsWith('/summary')&&conflicts++===0?response({message:'Dataset changed'},409):null});
    const api=createHttpApi({fetcher,pollMs:0});await api.bootstrap();const view=await api.getView();expect(view.revision).toBe(9);expect(view.summary.revision).toBe(9);
    expect(fetcher.mock.calls.filter(([url])=>url==='/api/explorer/preferences')).toHaveLength(2);api.dispose();
  });
  it('rejects a continuously changing dataset instead of mixing panels',async()=>{
    const fetcher=transport({onRequest:url=>url.pathname.endsWith('/filter-options')?response({gear:[],sports:[],revision:999}):null});const api=createHttpApi({fetcher,pollMs:0});
    await expect(api.getView()).rejects.toMatchObject({status:409});api.dispose();
  });
  it('keeps mutation preconditions at the displayed revision when polling sees a newer one',async()=>{
    let polled=false;const fetcher=transport({onRequest:url=>url.pathname==='/api/explorer/session'&&polled?response({opened:true,csrf:'proof',revision:8}):null});const api=createHttpApi({fetcher,pollMs:0});
    await api.getView();polled=true;await api.bootstrap();await api.updatePreferences({...DEFAULT_PREFS,units:'mi',reportEmail:'never-in-general-patch@example.test'});
    const [,options]=fetcher.mock.calls.at(-1);expect(options.headers['If-Match']).toBe('7');expect(JSON.parse(options.body)).not.toHaveProperty('reportEmail');api.dispose();
  });
  it('sends arbitrary filter text in a validated request body instead of the URL',async()=>{
    const fetcher=transport();const api=createHttpApi({fetcher,pollMs:0});await api.getActivities({filter:{...EMPTY_FILTER,name:'Invented private title'},limit:25,cursor:50,revision:7});
    const [path,options]=fetcher.mock.calls.at(-1);expect(path).not.toContain('private');expect(options.method).toBe('POST');expect(JSON.parse(options.body).name).toBe('Invented private title');expect(path).toContain('cursor=50');api.dispose();
  });
  it('uploads the original FIT file with attestation and an idempotency key',async()=>{
    const fetcher=transport();const api=createHttpApi({fetcher,pollMs:0});const file=new File(['invented-fit'], 'invented.fit');validateFiles([file],{server:true});expect(()=>validateFiles([file])).toThrow('FIT needs');
    await api.importActivities({files:[file],attested:true,idempotencyKey:'invented-request'});const [,options]=fetcher.mock.calls.at(-1);
    expect(options.body.get('files').name).toBe('invented.fit');expect(options.body.get('attested')).toBe('true');expect(options.headers['Idempotency-Key']).toBe('invented-request');expect(options.headers).not.toHaveProperty('Content-Type');api.dispose();
  });
  it('retries detail composition across a concurrent dataset change',async()=>{
    let tries=0;const fetcher=transport({onRequest:url=>url.pathname.endsWith('/42')?response({activity:{id:42},revision:10}):url.pathname.endsWith('/42/track')?++tries===1?response({message:'Changed'},409):response({segments:[],cells:[],quality:{precision:'full-source'},revision:10}):null});
    const api=createHttpApi({fetcher,pollMs:0});expect((await api.getActivity(42)).activity.id).toBe(42);expect(tries).toBe(2);api.dispose();
  });
  it('retains only a deletion capability and waits for the server completion receipt',async()=>{
    const fetcher=transport({onRequest:url=>url.pathname.endsWith('/account/deletion')?response({state:'queued',token:'invented-receipt'},202):url.pathname.endsWith('/deletion-receipt')?response({state:'running'}):null});const api=createHttpApi({fetcher,pollMs:0});
    expect((await api.deleteWorkspace({confirmation:'DELETE',password:'synthetic-only'})).state).toBe('queued');expect((await api.getDeletionReceipt()).state).toBe('running');expect(sessionStorage.length).toBe(1);expect(sessionStorage.getItem('explorer-deletion-receipt')).toBe('invented-receipt');api.dispose();
  });
  it('clears the in-memory CSRF proof after an expired session response',async()=>{
    let expired=false;const fetcher=transport({onRequest:url=>expired&&url.pathname==='/api/explorer/preferences'?response({message:'Sign in'},401):null});const api=createHttpApi({fetcher,pollMs:0});await api.bootstrap();expired=true;
    await expect(api.getPreferences()).rejects.toMatchObject({status:401});await api.requestPasswordReset({email:'invented@example.test'});expect(fetcher.mock.calls.at(-1)[1].headers).not.toHaveProperty('X-Explorer-CSRF');api.dispose();
  });
});
