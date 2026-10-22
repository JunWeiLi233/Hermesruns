import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Layers, Moon, Sun } from 'lucide-react';
import { routes } from './routes.mjs';
import { WorkspaceProvider, useResource, useWorkspace } from './ui/workspace.jsx';
import { Button, Empty, Notice, SelectField, Skeleton } from './ui/components.jsx';
import '../design/tokens.css';
import '../design/styles.css';
import './tokens.css';
import './app.css';
const screens = Object.fromEntries(routes.map(r => [r.id, lazy(() => import(`./screens/${r.id}.jsx`))]));
function Shell() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width:48rem)').matches);
  useEffect(() => {
    const m = window.matchMedia('(max-width:48rem)'),
      update = () => setCompact(m.matches);
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  const w = useWorkspace(),
    roster = useResource('getRoster'),
    me = useResource('getMe'),
    location = useLocation(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    heading = useRef(null),
    route = routes.find(r => r.path === location.pathname) || routes[0],
    review = params.get('state') || 'ready';
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return <div className="icu-design training-app" data-theme={w.theme}><a className="ds-skip" href="#main" onClick={e => {
      e.preventDefault();
      document.getElementById('main').focus();
      document.getElementById('main').scrollIntoView();
    }}>Skip to workspace</a><div className="tw-local">{w.api.mode === 'http' ? 'Server mode · Hermes identity · current server authorization · providers require approval' : 'Local build · simulated accounts · saved in this browser · demo date 15 Oct 2026 · backend and providers pending'}</div><div className="tw-shell"><aside className="tw-nav"><div className="tw-logo"><Layers size={24} aria-hidden="true" />Training workspace</div><nav aria-label="Main navigation">{['training', 'analysis', 'planning', 'coaching', 'settings', 'public'].map(group => <details key={group} open={group === route.group && !compact}><summary>{group}</summary>{routes.filter(r => r.group === group).map(r => <NavLink key={r.id} to={r.path} end>{r.title}</NavLink>)}</details>)}</nav></aside><div className="tw-content"><header className="tw-bar">{w.api.mode === 'http' ? <div className="ds-stack"><span>{me.data?.name || 'Not signed in'}</span>{w.actor ? <Button onClick={async()=>{await w.api.logout();navigate('/login');}}>Sign out everywhere</Button> : <Link to="/login">Sign in</Link>}</div> : <SelectField label="Sample account" value={w.actor} onChange={e => w.switchActor(e.target.value)} options={w.api.getDemoActors().map(a => ({
            value: a.id,
            label: a.name
          }))} />}<SelectField label="Selected athlete" value={w.athleteId} onChange={e => w.setAthlete(e.target.value)} options={(roster.data?.items || []).map(a => ({
            value: a.id,
            label: `${a.name} · ${a.access}`
          }))} /><SelectField label="Open screen" value={route.path} onChange={e => navigate(e.target.value)} options={routes.map(r => ({
            value: r.path,
            label: `${r.id} · ${r.title}`
          }))} /><Button aria-label={w.theme === 'light' ? 'Use dark appearance' : 'Use light appearance'} onClick={() => w.setTheme(w.theme === 'light' ? 'dark' : 'light')}>{w.theme === 'light' ? <Moon aria-hidden="true" size={16} /> : <Sun aria-hidden="true" size={16} />}</Button></header><main id="main" className="tw-main" tabIndex={-1}><header className="tw-heading"><div><span className="ds-eyebrow">{route.id} / {me.data?.name || 'Workspace'}</span><h1 ref={heading} tabIndex={-1}>{review === 'long' ? 'An exceptionally long endurance training workspace name for review' : route.title}</h1><p>Plan sessions, understand effort and coach with explicit athlete consent.</p></div><span className="tw-muted">{me.data?.zone || 'America/New_York'}<br />Selected athlete context persists across views</span></header>{roster.data?.items.find(a => a.id === w.athleteId)?.access === 'read' && <Notice>Read-only training access. Calendar and analytical edits require accepted coaching permission.</Notice>}{w.api.mode === 'http' && !w.actor && route.group !== 'public' ? <Notice>Sign in to load your server workspace. <Link to="/login">Open sign in</Link></Notice> : review === 'loading' ? <Skeleton /> : review === 'empty' ? <Empty /> : review === 'error' ? <Notice tone="danger" alert>Unable to load this view. <Button onClick={() => setParams({})}>Retry view</Button></Notice> : review === 'denied' ? <Notice tone="warning">This athlete’s access was removed. Choose your own account or review grants.</Notice> : <Suspense fallback={<Skeleton />}><Routes>{routes.map(r => {
                const Screen = screens[r.id];
                return <Route key={r.id} path={r.path} element={<div className="tw-page"><Screen /></div>} />;
              })}<Route path="*" element={<Empty to="/calendar" action="Open calendar">Screen not found</Empty>} /></Routes></Suspense>}<details className="tw-review"><summary>Screen state review</summary><SelectField label="Review state" value={review} onChange={e => {
              const p = new URLSearchParams(params);
              p.set('state', e.target.value);
              setParams(p);
            }} options={['ready', 'empty', 'loading', 'error', 'denied', 'long']} /><p className="tw-muted">These review controls do not change permissions or stored records.</p></details></main></div></div></div>;
}
export function App() {
  return <HashRouter><WorkspaceProvider><Shell /></WorkspaceProvider></HashRouter>;
}
