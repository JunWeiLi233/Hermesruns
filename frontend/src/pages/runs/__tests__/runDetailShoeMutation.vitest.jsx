import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RunDetail from '../RunDetail';
import { apiFetch, apiJson } from '../../../api';
import en from '../../../i18n/locales/en';

const t=(key,params={})=>Object.entries(params).reduce((copy,[key,value])=>copy.replaceAll(`{${key}}`,String(value)),key.split('.').reduce((v,k)=>v?.[k],en)||key);
vi.mock('../../../api',()=>({apiFetch:vi.fn(),apiJson:vi.fn(),subscribeWakeRetry:()=>()=>{}}));
vi.mock('../../../api/resourceCache',()=>({cachedApiJson:async url=>url.startsWith('/api/activities')?[]:{},invalidateResourceCache:vi.fn()}));
vi.mock('../../../contexts/AuthContext',()=>({useAuth:()=>({isAuthenticated:true})}));
vi.mock('../../../contexts/I18nContext',()=>({useI18n:()=>({lang:'en',t})}));
vi.mock('../../../components/TopbarUserMenu',()=>({default:()=>null}));
vi.mock('../../../components/TopbarNotifications',()=>({default:()=>null}));
vi.mock('../RunPaceAnalysis',()=>({default:()=>null}));
vi.mock('../RunTrainingCards',()=>({default:()=>null}));

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let runs, shoes, pendingPatch, pendingInventory, initialInventory, failMutation;
const clone=value=>JSON.parse(JSON.stringify(value));
const originalLocation=window.location.href;
beforeEach(()=>{
  sessionStorage.clear();
  runs={7:{id:7,name:'Run 7',distanceKm:6,movingTimeSeconds:1800,startTime:'2026-10-01T10:00:00',shoeId:null},8:{id:8,name:'Run 8',distanceKm:4,movingTimeSeconds:1200,startTime:'2026-10-02T10:00:00',shoeId:1,shoeName:'Adidas Ultraboost'}};
  shoes=[{id:1,brand:'Adidas',model:'Ultraboost',currentDistanceKm:4,maxDistanceKm:500},{id:2,brand:'Adidas',model:'Supernova',currentDistanceKm:0,maxDistanceKm:650}];
  pendingPatch=null;pendingInventory=null;initialInventory=null;failMutation=false;
  let inventoryReads=0;
  apiJson.mockReset();apiFetch.mockReset();
  apiJson.mockImplementation(async url=>{
    if(url.startsWith('/api/activities?id='))return clone(runs[url.split('=')[1]]);
    if(url==='/api/shoes'){
      inventoryReads++;
      if(inventoryReads===1&&initialInventory)return initialInventory.promise;
      if(inventoryReads===2&&pendingInventory)return pendingInventory.promise;
      return clone(shoes);
    }
    if(url.includes('/assign/')){
      if(pendingPatch)await pendingPatch.promise;
      if(failMutation)throw new Error('Injected mutation failure');
      const [,shoeId,activityId]=url.match(/shoes\/(\d+)\/assign\/(\d+)/).map(Number);
      const run=runs[activityId];
      if(run.shoeId)shoes.find(s=>s.id===run.shoeId).currentDistanceKm-=run.distanceKm;
      if(shoeId)shoes.find(s=>s.id===shoeId).currentDistanceKm+=run.distanceKm;
      run.shoeId=shoeId||null;
      run.shoeName=shoeId?`Adidas ${shoes.find(s=>s.id===shoeId).model}`:null;
      return {activityId,shoeId:run.shoeId,shoeName:run.shoeName};
    }
    return {};
  });
  apiFetch.mockResolvedValue({ok:true,json:async()=>[]});
});
afterEach(()=>{cleanup();vi.unstubAllEnvs();window.history.replaceState({},'',originalLocation);});

function Harness(){const navigate=useNavigate();return <><button onClick={()=>navigate('/runs/8')}>next run</button><Routes><Route path='/runs/:id' element={<RunDetail/>}/></Routes></>;}
async function open(){const result=render(<MemoryRouter initialEntries={['/runs/7']}><Harness/></MemoryRouter>);await screen.findByRole('button',{name:t('run_detail.link_shoe')});await waitFor(()=>expect(apiJson).toHaveBeenCalledWith('/api/shoes'));return result;}
const gear=()=>document.querySelector('.run-detail-gear-section');
async function choose(name){
  await act(async()=>fireEvent.click(within(gear()).getByRole('button',{name:/^(Link Shoe|Change)$/})));
  const button=await screen.findByRole('button',{name,exact:true});
  await act(async()=>fireEvent.click(button));
}
const logged=km=>t('run_detail.linked_shoe_mileage',{mileage:`${km} km`});

it('shows refreshed server inventory after assignment, transfer, unlink and relink without remounting',async()=>{
  await open();
  await choose('Adidas Supernova');
  await waitFor(()=>expect(gear()).toHaveTextContent(logged(6)));
  await choose('Adidas Ultraboost');
  await waitFor(()=>expect(gear()).toHaveTextContent(logged(10)));
  await act(async()=>fireEvent.click(within(gear()).getByRole('button',{name:'Unlink'})));
  await waitFor(()=>expect(within(gear()).getByRole('button',{name:'Link Shoe'})).toBeEnabled());
  await choose('Adidas Ultraboost');
  await waitFor(()=>expect(gear()).toHaveTextContent(logged(10)));
});

it('preserves assignment and mileage on a failed mutation and allows retry',async()=>{
  await open();failMutation=true;
  await choose('Adidas Supernova');
  expect(await screen.findByText(t('run_detail.shoe_assign_failed'))).toBeInTheDocument();
  expect(within(gear()).getByRole('button',{name:'Link Shoe'})).toBeEnabled();
  expect(gear()).not.toHaveTextContent(logged(6));
  failMutation=false;await act(async()=>fireEvent.click(within(gear()).getByRole('button',{name:'Adidas Supernova'})));
  await waitFor(()=>expect(gear()).toHaveTextContent(logged(6)));
});

it.each(['success','failure'])('ignores a late %s assignment after navigation and re-enables the next run controls',async outcome=>{
  pendingPatch=deferred();failMutation=outcome==='failure';
  await open();await choose('Adidas Supernova');
  fireEvent.click(screen.getByRole('button',{name:'next run'}));
  await screen.findByRole('heading',{name:'Run 8'});
  expect(within(gear()).getByRole('button',{name:'Change'})).toBeEnabled();
  await act(async()=>pendingPatch.resolve());
  expect(gear()).toHaveTextContent('Adidas Ultraboost');
  expect(gear()).toHaveTextContent(logged(4));
  expect(gear()).not.toHaveTextContent(t('run_detail.shoe_assign_failed'));
  expect(JSON.parse(sessionStorage.getItem('hermes_selected_run')).id).toBe(8);
  expect(JSON.parse(sessionStorage.getItem('hermes_selected_run')).shoeId).toBe(1);
});

it('does not save a late assignment in selected-run storage after unmount',async()=>{
  pendingPatch=deferred();
  const {unmount}=await open();await choose('Adidas Supernova');
  const before=sessionStorage.getItem('hermes_selected_run');unmount();
  await act(async()=>pendingPatch.resolve());
  expect(sessionStorage.getItem('hermes_selected_run')).toBe(before);
});

it.each(['success','failure'])('ignores a late %s mutation once the browser URL leaves, before a lazy route unmounts',async outcome=>{
  pendingPatch=deferred();failMutation=outcome==='failure';
  await open();await choose('Adidas Supernova');
  const before=sessionStorage.getItem('hermes_selected_run');
  window.history.pushState({},'', '/runs');
  await act(async()=>pendingPatch.resolve());
  expect(sessionStorage.getItem('hermes_selected_run')).toBe(before);
  expect(gear()).not.toHaveTextContent(logged(6));
  expect(gear()).not.toHaveTextContent(t('run_detail.shoe_assign_failed'));
});

it('ignores a late inventory refresh after leaving the mutated run',async()=>{
  await open();pendingInventory=deferred();
  await choose('Adidas Supernova');
  await waitFor(()=>expect(apiJson.mock.calls.filter(([u])=>u==='/api/shoes')).toHaveLength(2));
  fireEvent.click(screen.getByRole('button',{name:'next run'}));
  await screen.findByRole('heading',{name:'Run 8'});
  await act(async()=>pendingInventory.resolve([{...shoes[0],currentDistanceKm:999},{...shoes[1],currentDistanceKm:6}]));
  expect(gear()).not.toHaveTextContent(logged(999));
  expect(gear()).not.toHaveTextContent('Adidas Supernova');
});

it('keeps a committed assignment but shows unknown mileage without a false usage bar when inventory refresh fails',async()=>{
  await open();pendingInventory=deferred();
  await choose('Adidas Supernova');
  await act(async()=>pendingInventory.reject(new Error('Explicit inventory refresh failure')));
  await waitFor(()=>expect(gear()).toHaveTextContent('-- km logged'));
  expect(gear()).toHaveTextContent('Adidas Supernova');
  expect(gear()).toHaveTextContent(t('run_detail.shoe_linked',{shoe:'Adidas Supernova'}));
  expect(gear().querySelector('.run-detail-gear-usage')).toBeNull();
  expect(within(gear()).getByRole('button',{name:'Change'})).toBeEnabled();
});

it.each([
  ['2026-10-05T03:55:00','2026-10-04','23:55:00','Sun, Oct 4, 2026, 11:55 PM'],
  ['2026-03-08T06:55:00','2026-03-08','01:55:00','Sun, Mar 8, 2026, 01:55 AM'],
  ['2026-03-08T07:05:00','2026-03-08','03:05:00','Sun, Mar 8, 2026, 03:05 AM'],
  ['2026-11-01T05:55:00','2026-11-01','01:55:00','Sun, Nov 1, 2026, 01:55 AM'],
  ['2026-11-01T06:05:00','2026-11-01','01:05:00','Sun, Nov 1, 2026, 01:05 AM'],
])('renders account wall date/time for imported %s independently of the browser zone',async(startTime,accountLocalDate,accountLocalTime,expected)=>{
  vi.stubEnv('TZ','Asia/Tokyo');
  runs[7]={...runs[7],startTime,activityInstant:startTime+'Z',accountLocalDate,accountLocalTime,accountTimeZone:'America/New_York',timeRepresentation:'UTC_INSTANT'};
  await open();
  expect(document.querySelector('.run-detail-v2__hero')).toHaveTextContent(expected);
});
