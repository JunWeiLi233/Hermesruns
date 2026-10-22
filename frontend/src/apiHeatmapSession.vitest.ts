import { afterEach, expect, it, vi } from 'vitest';
import { apiFetch, apiJson } from './api';

afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();window.history.replaceState({},'','/');});
it('keeps an explicit native credential bound to its original owner',async()=>{
  localStorage.setItem('hermes_jwt','new-owner');
  const transport=vi.fn(async(_url:RequestInfo|URL,_options?:RequestInit)=>new Response('{}',{status:200}));vi.stubGlobal('fetch',transport);
  await apiFetch('/api/explorer/session',{headers:{Authorization:'Bearer original-owner'}});
  expect(new Headers(transport.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer original-owner');
});
it('does not let a retired request clear a newer Hermes session',async()=>{
  let finish:(value:Response)=>void=()=>{};
  vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
  localStorage.setItem('hermes_jwt','original-owner');
  const request=apiJson('/api/profile/me');
  localStorage.setItem('hermes_jwt','new-owner');
  finish(new Response('{}',{status:401}));
  await expect(request).rejects.toThrow('Unauthorized');
  expect(localStorage.getItem('hermes_jwt')).toBe('new-owner');
});
it('leaves public heatmap capability pages open after an anonymous 401',async()=>{
  window.history.replaceState({},'','/heatmap/deletion');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:401})));
  const error=vi.spyOn(console,'error');
  await expect(apiJson('/api/profile/me')).rejects.toThrow('Unauthorized');
  expect(window.location.pathname).toBe('/heatmap/deletion');
  expect(error).not.toHaveBeenCalled();
});
