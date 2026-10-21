import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import HeatmapPage from '../HeatmapPage.jsx';

const mocks = vi.hoisted(() => ({fetch: vi.fn(), logout: vi.fn(), setUnit: vi.fn(), setLang: vi.fn(), setTheme: vi.fn()}));
vi.mock('../../../api', () => ({apiFetch: (...args) => mocks.fetch(...args)}));
vi.mock('../../../contexts/AuthContext', () => ({useAuth: () => ({token: 'native-owner', logout: mocks.logout})}));
vi.mock('../../../contexts/I18nContext', () => ({useI18n: () => ({t: key => key, lang: 'zh-CN', setLang: mocks.setLang})}));
vi.mock('../../../contexts/ThemeContext', () => ({useTheme: () => ({isDark: true, setTheme: mocks.setTheme})}));
vi.mock('../../../contexts/UnitContext', () => ({useUnit: () => ({unit: 'km', setUnit: mocks.setUnit})}));
vi.mock('../../../components/AuthenticatedPageChrome', () => ({default: ({children}) => <main>{children}</main>}));
vi.mock('../../../components/PageSkeleton', () => ({default: () => <p>Loading native page</p>}));
vi.mock('../WorkoutHeatmap.jsx', () => ({default: () => <h1>Full screen heat layer</h1>}));
vi.mock('../Heatmap.jsx', () => ({default: ({simple}) => <h1>{simple ? 'Full screen heat layer' : 'Recorded GPS heatmap'}</h1>}));
vi.mock('../../../features/heatmap-explorer/App.jsx', () => ({default: ({embedded, presentation, service}) => <section aria-label="Native workspace">{`${embedded}:${presentation.language}:${presentation.theme}`}<button onClick={()=>service.updatePreferences({units: 'mi'})}>Change unit</button></section>}));

const mount = path => render(<MemoryRouter initialEntries={[path || '/heatmap/activities']}><HeatmapPage/></MemoryRouter>);
beforeEach(() => {mocks.fetch.mockReset();mocks.logout.mockReset();mocks.setUnit.mockReset();mocks.setLang.mockReset();mocks.setTheme.mockReset();});

it('opens only the existing GPS heat layer at the main route, without bootstrapping an empty file workspace', () => {
  mount('/heatmap');
  expect(screen.getByRole('heading', {name:'Full screen heat layer'})).toBeVisible();
  expect(screen.queryByRole('region', {name:'Native workspace'})).not.toBeInTheDocument();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('uses the native workspace and existing language/theme when the backend is available', async () => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({available: true}), {status: 200}));
  mount();
  expect(await screen.findByRole('region', {name: 'Native workspace'})).toHaveTextContent('true:zh-CN:dark');
  expect(screen.getByRole('link', {name: 'heatmapExplorer.recordedMap'})).toHaveAttribute('href', '/heatmap/recorded');
  expect(mocks.fetch.mock.calls[0][0]).toBe('/api/profile/heatmap/explorer');
});
it('keeps existing history usable when the extension is disabled', async () => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({available: false}), {status: 200}));
  mount();
  expect(await screen.findByRole('heading', {name: 'Recorded GPS heatmap'})).toBeVisible();
  expect(screen.getByText('heatmapExplorer.workspaceUnavailable')).toBeVisible();
});
it('supports an older server without pretending the new services are connected', async () => {
  mocks.fetch.mockResolvedValue(new Response('', {status: 404}));
  mount();
  expect(await screen.findByRole('heading', {name: 'Recorded GPS heatmap'})).toBeVisible();
});
it('exposes server failure with a retry instead of silently replacing the workspace', async () => {
  mocks.fetch.mockResolvedValue(new Response('', {status: 429}));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('heatmapExplorer.workspaceError');
  expect(screen.queryByRole('heading', {name: 'Recorded GPS heatmap'})).not.toBeInTheDocument();
});
it('uses Hermes logout when the owning session expires', async () => {
  mocks.fetch.mockResolvedValue(new Response('', {status: 401}));
  mount();
  await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  expect(screen.queryByRole('region', {name: 'Native workspace'})).not.toBeInTheDocument();
});
it('opens the recorded map directly without probing the file workspace', () => {
  mount('/heatmap/recorded');
  expect(screen.getByRole('heading', {name: 'Full screen heat layer'})).toBeVisible();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('does not reset the workspace when the owning router refreshes its logout callback', async () => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({available: true}), {status: 200}));
  const view=mount();
  await screen.findByRole('region', {name: 'Native workspace'});
  mocks.logout=vi.fn();
  view.rerender(<MemoryRouter initialEntries={['/heatmap/activities']}><HeatmapPage/></MemoryRouter>);
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(screen.getByRole('region', {name: 'Native workspace'})).toBeVisible();
});
it('changes the requested global unit without replaying unrelated server language and theme', async () => {
  mocks.fetch.mockImplementation(async url=>new Response(JSON.stringify(url.includes('/profile/')?{available: true}:{units: 'mi', language: 'en', theme: 'light'}), {status: 200}));
  mount();
  fireEvent.click(await screen.findByRole('button', {name: 'Change unit'}));
  await waitFor(()=>expect(mocks.setUnit).toHaveBeenCalledWith('mile'));
  expect(mocks.setLang).not.toHaveBeenCalled();
  expect(mocks.setTheme).not.toHaveBeenCalled();
  const options=mocks.fetch.mock.calls.find(([url])=>url==='/api/explorer/preferences')[1];
  expect(options.credentials).toBe('omit');
  expect(options.headers.get('Authorization')).toBe('Bearer native-owner');
});
it('keeps the native transport active through development StrictMode effect remounts', async () => {
  mocks.fetch.mockImplementation(async url=>new Response(JSON.stringify(url.includes('/profile/')?{available:true}:{units:'mi'}),{status:200}));
  render(<StrictMode><MemoryRouter initialEntries={['/heatmap/activities']}><HeatmapPage/></MemoryRouter></StrictMode>);
  fireEvent.click(await screen.findByRole('button',{name:'Change unit'}));
  await waitFor(()=>expect(mocks.setUnit).toHaveBeenCalledWith('mile'));
});
