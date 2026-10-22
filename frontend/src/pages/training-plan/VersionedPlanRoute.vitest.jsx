import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VersionedPlanRoute, { useVersionedPlan } from './VersionedPlanRoute';
import { planRequest } from './planApi';
vi.mock('./planApi', () => ({ planRequest: vi.fn() }));
vi.mock('../../utils/trainingPlanCache', () => ({ planRead: (_url, _token, load) => load(), preparePlanOfflineShell: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ token:'session',email:'runner@example.test' }) }));
vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ t:key=>key }) }));
afterEach(cleanup);
it('refreshes the selected prescription after a run or recovery source change', async () => {
  localStorage.clear();
  let workout = { id: 'planned-run' };
  planRequest.mockImplementation(async url => url === '/api/run-plans' ? { ownerId: 'owner', plans: [] } : { plan: { id: 'plan' }, workout });
  function Page() { const selection = useVersionedPlan(); return <span>{selection.data?.workout?.id}</span>; }
  render(<VersionedPlanRoute variant="schedule"><Page /></VersionedPlanRoute>);
  await screen.findByText('planned-run');
  workout = { id: 'completed-run-rest' };
  await act(async () => { window.dispatchEvent(new Event('hermes-recommendations-changed')); });
  await screen.findByText('completed-run-rest');
});
it('keeps the existing page and exposes the published prescription inside it', async () => {
  planRequest.mockImplementation(async url => url === '/api/run-plans' ? { ownerId:'owner',plans:[] } : { plan:{id:'plan'},workout:{id:'workout'} });
  function NativePage(){const selection=useVersionedPlan();return <main><h1>Native Schedule</h1><aside>Readiness and route</aside><span>{selection.data?.workout?.id}</span></main>;}
  render(<VersionedPlanRoute variant="schedule"><NativePage/></VersionedPlanRoute>);
  expect(await screen.findByRole('heading',{name:'Native Schedule'})).toBeInTheDocument();
  expect(screen.getByText('Readiness and route')).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByText('workout')).toBeInTheDocument());
  expect(document.querySelector('.tp-shell')).toBeNull();
});
