import { it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
vi.stubGlobal('crypto',webcrypto);
import { createHttpClient } from './http.mjs';
it('reuses a logical command key after an ambiguous lost response',async()=>{
  const keys=[];let lost=true;
  const api=createHttpClient({getToken:()=> 'test-only',fetchImpl:async(url,options)=>{keys.push(options.headers['Idempotency-Key']);if(lost){lost=false;throw new TypeError('Lost response');}return {ok:true,status:200,json:async()=>({id:'one-message'})};}});
  const body={conversationId:'thread',body:'Original note'};
  await expect(api.sendMessage(body)).rejects.toThrow('Lost response');await api.sendMessage(body);expect(keys[1]).toBe(keys[0]);
  await api.sendMessage(body);expect(keys[2]).not.toBe(keys[1]);
});
it('discards the command key after a definitive validation failure',async()=>{
  const keys=[];
  const api=createHttpClient({getToken:()=> 'test-only',fetchImpl:async(url,options)=>{keys.push(options.headers['Idempotency-Key']);return {ok:false,status:422,json:async()=>({code:'INVALID_BODY'})};}});
  const body={conversationId:'thread',body:'Original note'};
  await expect(api.sendMessage(body)).rejects.toMatchObject({status:422});await expect(api.sendMessage(body)).rejects.toMatchObject({status:422});expect(keys[1]).not.toBe(keys[0]);
});
it('uses HttpOnly-cookie transport with CSRF and an automatic command key', async () => {
  const calls=[];
  const api=createHttpClient({fetchImpl:async (url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,json:async()=>url.endsWith('/auth/csrf')?{token:'csrf-test',headerName:'X-TRAINING-CSRF'}:{id:'saved'}};
  }});
  await api.createEvent({athleteId:'subject',title:'Original session',date:'2026-10-15',minutes:20});
  expect(calls[0].url).toBe('/api/training/auth/csrf');
  expect(calls[1].options.credentials).toBe('same-origin');
  expect(calls[1].options.headers['X-TRAINING-CSRF']).toBe('csrf-test');
  expect(calls[1].options.headers['Idempotency-Key']).toMatch(/^[\w-]{36}$/);
  expect(calls[1].options.headers.Authorization).toBeUndefined();
});
it('bootstraps the current actor from the server and never stores credentials', async()=>{
  const api=createHttpClient({fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:'server-identity',name:'Athlete',revision:1})})});
  await api.getMe();expect(api.getActor()).toBe('server-identity');expect(api.getDemoActors()).toEqual([]);
});
it('uses same-origin bearer transport, revision and idempotency headers', async () => {
  let received;
  const api = createHttpClient({
    getToken: () => 'test-only',
    fetchImpl: async (url, options) => {
      received = {
        url,
        options
      };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'entry'
        })
      };
    }
  });
  await api.createEvent({
    athleteId: 'subject',
    title: 'Planned',
    date: '2026-10-15',
    minutes: 40,
    key: 'request-1',
    revision: 3
  });
  expect(received.url).toBe('/api/training/athletes/subject/events');
  expect(received.options.headers).toMatchObject({
    Authorization: 'Bearer test-only',
    'If-Match': '3',
    'Idempotency-Key': 'request-1'
  });
  expect(received.options.credentials).toBe('omit');
  expect(JSON.parse(received.options.body).athleteId).toBeUndefined();
});
it('propagates structured access failures to the same screen boundary', async () => {
  const api = createHttpClient({
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        code: 'unavailable'
      })
    })
  });
  await expect(api.getActivity({
    activityId: 'missing'
  })).rejects.toMatchObject({
    status: 404
  });
});
