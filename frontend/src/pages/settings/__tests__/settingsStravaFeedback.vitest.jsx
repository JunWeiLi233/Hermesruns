import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Settings from '../Settings';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

const state=vi.hoisted(()=>({lang:'en',configured:false,error:null,answer:null}));
const t=key=>key.split('.').reduce((v,k)=>v?.[k],state.lang==='en'?en:zh)||key;
const originalLocation=window.location.href;
vi.mock('../../../api',()=>({apiFetch:vi.fn(),apiJson:vi.fn(),subscribeWakeRetry:()=>()=>{}}));
vi.mock('../../../api/resourceCache',()=>({invalidateResourceCache:vi.fn()}));
vi.mock('../../../contexts/AuthContext',()=>({useAuth:()=>({isAuthenticated:true,authHydrated:true,logout:vi.fn()})}));
vi.mock('../../../contexts/I18nContext',()=>({useI18n:()=>({lang:state.lang,t,locale:{label:state.lang==='en'?'English':'简体中文'},setLang:vi.fn()})}));
vi.mock('../../../contexts/ThemeContext',()=>({useTheme:()=>({theme:'light',setTheme:vi.fn()})}));
vi.mock('../../../contexts/UnitContext',()=>({useUnit:()=>({unit:'km',setUnit:vi.fn()})}));
vi.mock('../../../components/TopbarUserMenu',()=>({default:()=>null}));
vi.mock('../../../components/TopbarNotifications',()=>({default:()=>null}));
beforeEach(()=>{
  state.lang='en';state.configured=false;state.error=Object.assign(new Error('Strava sign-in is not configured.'),{status:503});state.answer=null;
  localStorage.clear();apiJson.mockReset();
  apiJson.mockImplementation(async url=>{
    if(url==='/api/profile/me')return {displayName:'Fictional UI',timeZone:'UTC'};
    if(url==='/api/auth/strava/status')return {linked:false,configured:state.configured};
    if(url==='/api/activities')return [];
    if(url==='/api/auth/strava/link-url'){
      if(state.answer)return state.answer.promise;
      if(state.error)throw state.error;
      return {};
    }
    return {};
  });
});
afterEach(()=>{cleanup();window.history.replaceState({},'',originalLocation);});
function Harness(){const navigate=useNavigate();return <><button onClick={()=>navigate('/away')}>leave settings</button><Routes><Route path='/settings' element={<Settings/>}/><Route path='/away' element={<h1>Away</h1>}/></Routes></>;}
async function open(){render(<MemoryRouter initialEntries={['/settings?section=connections']}><Harness/></MemoryRouter>);await screen.findByRole('button',{name:t('settings.stitch_connect'),exact:true});}
const links=()=>apiJson.mock.calls.filter(([u])=>u==='/api/auth/strava/link-url');

it.each(['en','zh-CN'])('announces a localized missing-configuration error and offers a working retry in %s',async lang=>{
  state.lang=lang;await open();
  fireEvent.click(screen.getByRole('button',{name:t('settings.stitch_connect'),exact:true}));
  const status=await screen.findByRole('status');
  expect(status).toHaveTextContent(t('common.strava_not_configured'));
  const retry=within(status).getByRole('button',{name:t('settings.training_retry')});
  expect(retry).toBeEnabled();fireEvent.click(retry);
  await waitFor(()=>expect(links()).toHaveLength(2));
  await waitFor(()=>expect(retry).toBeEnabled());
});

it('shows generic localized feedback for transport failures or an empty successful response',async()=>{
  state.configured=true;state.error=new Error('Network offline');await open();
  fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}));
  expect(await screen.findByRole('status')).toHaveTextContent(t('profile.strava_link_start_failed'));
  state.error=null;
  fireEvent.click(screen.getByRole('button',{name:t('settings.training_retry')}));
  await waitFor(()=>expect(links()).toHaveLength(2));
  expect(screen.getByRole('status')).toHaveTextContent(t('profile.strava_link_start_failed'));
});

it('keeps a successful authorization redirect working after retry',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}));
  const status=await screen.findByRole('status');
  const fallback=apiJson.getMockImplementation();
  apiJson.mockImplementation(url=>url==='/api/auth/strava/link-url'?Promise.resolve({url:'#oauth-success'}):fallback(url));
  fireEvent.click(within(status).getByRole('button',{name:t('settings.training_retry')}));
  await waitFor(()=>expect(window.location.hash).toBe('#oauth-success'));
  expect(screen.queryByText(t('common.strava_not_configured'))).not.toBeInTheDocument();
});

it('does not redirect from a request completed after Settings unmounts',async()=>{
  let resolve;state.answer={promise:new Promise(done=>{resolve=done;})};
  await open();fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'leave settings'}));
  await screen.findByRole('heading',{name:'Away'});
  await act(async()=>resolve({url:'#late-oauth'}));
  expect(window.location.hash).not.toBe('#late-oauth');
});

it.each(['success','failure'])('ignores late OAuth %s once the browser URL leaves, before a lazy route unmounts',async outcome=>{
  let resolve,reject;state.answer={promise:new Promise((done,fail)=>{resolve=done;reject=fail;})};
  await open();fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}));
  window.history.pushState({},'', '/runs');
  await act(async()=>outcome==='success'?resolve({url:'#late-oauth'}):reject(state.error));
  expect(window.location.hash).not.toBe('#late-oauth');
  expect(screen.queryByText(t('common.strava_not_configured'))).not.toBeInTheDocument();
});
