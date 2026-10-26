import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/locales/en.js';
import { apiJson } from '../../../api';
import Dashboard from '../Dashboard.jsx';

const t = (key, params = {}) => String(key.split('.').reduce((value, part) => value?.[part], en) ?? key)
  .replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
const adminSession = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'admin@example.com', logout: adminSession.logout }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t, lang: 'en' }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../components/AdminCourseMapPreview', () => ({ default: ({ preview }) => <div data-testid="map">{preview?.summary || 'Empty map'}</div> }));
vi.mock('../../../data/worldRaceCatalog.js', () => ({ standardCityRoadMarathonCatalog: [
  { id: 'alpha', name: 'Alpha Marathon', city: 'Alpha', country: 'Japan', distanceKm: 42.195, lat: 35, lng: 139, officialWebsite: 'https://example.com/alpha' },
  { id: 'beta', name: 'Beta Marathon', city: 'Beta', country: 'France', distanceKm: 42.195, lat: 48, lng: 2 },
  { id: 'missing', name: 'Missing Marathon', city: 'Missing', distanceKm: 42.195 },
] }));

const pending = { routePoints: [{ lat: 35, lng: 139 }, { lat: 35.1, lng: 139.1 }], overlayBounds: { north: 35.2, south: 35, east: 139.2, west: 139 }, confidence: 95, imageUrl: '/uploads/alpha.png', summary: 'Pending source summary' };
const live = { ...pending, routePoints: [...pending.routePoints, { lat: 35.2, lng: 139.2 }], summary: 'Live source summary' };
let records;
let timelineRequests;
const workspace = () => screen.getByRole('region', { name: t('dashboard.review_workspace_kicker') });
const rail = () => screen.getByRole('region', { name: t('dashboard.tab_course_maps') });
const click = (key) => fireEvent.click(screen.getByRole('button', { name: t(key), exact: true }));
function RouteControls() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/dashboard')}>Navigate to overview</button><button onClick={() => navigate('/dashboard/course-maps')}>Navigate to maps</button></>;
}
async function openDashboard(withRouteControls = false) {
  render(<MemoryRouter initialEntries={['/dashboard/course-maps']}>{withRouteControls && <RouteControls />}<Dashboard /></MemoryRouter>);
  await screen.findByRole('button', { name: /Alpha Marathon/ });
  await waitFor(() => expect(within(workspace()).getByTestId('map')).toHaveTextContent('Pending source summary'));
}

beforeEach(() => {
  records = [
    { raceId: 'alpha', raceName: 'Alpha Marathon', city: 'Alpha', pendingPreview: pending, live, currentLivePreview: live },
    { raceId: 'beta', raceName: 'Beta Marathon', city: 'Beta', live, currentLivePreview: live },
  ];
  timelineRequests = {};
  apiJson.mockImplementation(async (path, options = {}) => {
    const url = new URL(path, 'http://localhost');
    if (url.pathname === '/api/auth/protected/ping') return { role: 'ADMIN' };
    if (url.pathname === '/api/admin/overview') return { kpis: [] };
    if (url.pathname === '/api/admin/queues') return {};
    if (/\/scan-timeline$/.test(url.pathname)) {
      const id = url.pathname.split('/')[4];
      return timelineRequests[id] ? timelineRequests[id]() : [];
    }
    if (url.pathname === '/api/admin/race-course-maps') return records;
    if (/\/api\/admin\/race-course-maps\/[^/]+$/.test(url.pathname)) return records.find(item => item.raceId === url.pathname.split('/').at(-1));
    if (url.pathname.endsWith('/accept-live')) {
      records[0] = { ...records[0], pendingPreview: null };
      return { published: true };
    }
    if (/\/pending\/(scan|reanalyze|upload)$/.test(url.pathname)) return { jobId: 'job-1' };
    if (url.pathname === '/api/admin/jobs/job-1') return { status: 'COMPLETED', summary: 'Processing completed' };
    if (url.pathname === '/api/admin/marathon-pipeline/run') return { jobId: 'pipeline-1' };
    if (url.pathname === '/api/admin/marathon-pipeline/jobs/pipeline-1') return { state: 'SUCCESS' };
    if (options.method) throw new Error(`Unexpected action ${path}`);
    return { items: [], totalItems: 0, totalPages: 0, page: 0 };
  });
});

describe('course map dashboard interactions', () => {
  it.each([true, false])('keeps the latest inventory result when older requests finish later (latest failure: %s)', async latestFails => {
    await openDashboard(true);
    const original = apiJson.getMockImplementation();
    const requests = [];
    apiJson.mockImplementation((path, options) => path === '/api/admin/race-course-maps'
      ? new Promise((resolve, reject) => requests.push({ resolve, reject })) : original(path, options));
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to overview', exact: true }));
    await screen.findByRole('heading', { name: 'Overview', exact: true });
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    const olderCount = requests.length;
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to maps', exact: true }));
    await waitFor(() => expect(requests.length).toBeGreaterThan(olderCount));

    await act(async () => {
      if (latestFails) requests.at(-1).reject(new TypeError('Failed to fetch'));
      else requests.at(-1).resolve(records);
    });
    await act(async () => {
      for (const request of requests.slice(0, -1)) {
        if (latestFails) request.resolve(records);
        else request.reject(new TypeError('Failed to fetch'));
      }
    });

    if (latestFails) {
      expect(within(workspace()).getByRole('alert')).toHaveTextContent(t('dashboard.course_maps_load_error'));
      expect(within(workspace()).getByRole('button', { name: t('admin.console.publish_map') })).toBeDisabled();
    } else {
      expect(within(workspace()).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(workspace()).getByRole('button', { name: t('admin.console.publish_map') })).toBeEnabled();
    }
  });

  it('retains a loaded preview and blocks actions when refreshing its detail fails', async () => {
    await openDashboard();
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => path === '/api/admin/race-course-maps/alpha'
      ? Promise.reject(new TypeError('Failed to fetch')) : original(path, options));
    fireEvent.click(within(rail()).getByRole('button', { name: /Alpha Marathon/ }));

    await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent(t('dashboard.course_maps_load_error')));
    expect(within(workspace()).getByTestId('map')).toHaveTextContent('Pending source summary');
    expect(within(workspace()).getByRole('button', { name: t('admin.console.publish_map') })).toBeDisabled();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_upload') })).toBeDisabled();

    apiJson.mockImplementation(original);
    fireEvent.click(within(rail()).getByRole('button', { name: /Alpha Marathon/ }));
    await waitFor(() => expect(within(workspace()).queryByRole('alert')).not.toBeInTheDocument());
    expect(within(workspace()).getByRole('button', { name: t('admin.console.publish_map') })).toBeEnabled();
  });

  it('keeps the saved queue preview when a newly selected record cannot load', async () => {
    await openDashboard();
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => path === '/api/admin/race-course-maps/beta'
      ? Promise.reject(new TypeError('Failed to fetch')) : original(path, options));
    fireEvent.click(within(rail()).getByRole('button', { name: /Beta Marathon/ }));

    await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent(t('dashboard.course_maps_load_error')));
    expect(within(workspace()).getByTestId('map')).toHaveTextContent('Live source summary');
    expect(within(workspace()).getAllByRole('definition').map(node => node.textContent))
      .toEqual([t('dashboard.review_panel_live'), '3']);
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_source_scan') })).toBeDisabled();
  });

  it('keeps the inventory when its reload fails and clears the error after recovery', async () => {
    await openDashboard();
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => path === '/api/admin/race-course-maps'
      ? Promise.reject(new TypeError('Failed to fetch')) : original(path, options));
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Overview', exact: true }));
    await screen.findByRole('heading', { name: 'Overview', exact: true });
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /^Course maps/i }));

    await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent(t('dashboard.course_maps_load_error')));
    expect(within(rail()).getByRole('button', { name: /Alpha Marathon/ })).toHaveTextContent(t('dashboard.review_state_pending'));
    expect(within(workspace()).getByRole('button', { name: t('admin.console.publish_map') })).toBeDisabled();

    apiJson.mockImplementation(original);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Overview', exact: true }));
    await screen.findByRole('heading', { name: 'Overview', exact: true });
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /^Course maps/i }));
    await waitFor(() => expect(within(workspace()).queryByRole('alert')).not.toBeInTheDocument());
    expect(within(workspace()).getByRole('button', { name: t('admin.console.publish_map') })).toBeEnabled();
  });

  it('offers sidebar sign-out rather than an exit into the runner application', async () => {
    await openDashboard();
    expect(screen.queryByRole('button', { name: t('admin.console.back_to_app') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('admin.console.sign_out'), exact: true }));
    expect(adminSession.logout).toHaveBeenCalledOnce();
  });
  it('keeps fresh analysis available but disables direct export for an unverified recovered image', async () => {
    records[0].pendingPreview = { ...pending, source: 'official-source-recovered', routePoints: [], overlayBounds: null };
    await openDashboard();
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_reanalyze') })).toBeEnabled();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeDisabled();
    expect(within(workspace()).getByText(t('dashboard.course_maps_recovered_alignment_hint'))).toBeInTheDocument();
  });
  it('offers source recovery and disables jobs and publication for a missing file', async () => {
    records[0].pendingPreview = { ...pending, sourceAvailable: false };
    await openDashboard();
    expect(within(workspace()).queryByRole('button', { name: t('admin.console.publish_map') })).not.toBeInTheDocument();
    expect(within(workspace()).getByText(t('dashboard.course_maps_source_missing_error'))).toBeInTheDocument();
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_reanalyze') })).toBeDisabled();
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_source_scan') })).toBeDisabled();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeDisabled();
    expect(within(workspace()).getAllByRole('button', { name: t('dashboard.course_maps_upload') }).every(button => !button.disabled)).toBe(true);
  });

  it('does not recommend publishing a route that fails the geography check', async () => {
    records[0].pendingPreview = { ...pending, alignmentAccepted: false };
    await openDashboard();
    expect(within(workspace()).queryByRole('button', { name: t('admin.console.publish_map') })).not.toBeInTheDocument();
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_reanalyze') })).toBeEnabled();
  });

  it('does not send an interactive route page to image extraction', async () => {
    records[0].pendingPreview = { ...pending, source: 'admin-official-strava-route', imageUrl: 'https://strava-embeds.com/route/123' };
    await openDashboard();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeDisabled();
  });
  it('filters locally without restarting bootstrap or replacing the search input', async () => {
    await openDashboard();
    const input = screen.getByRole('searchbox');
    input.focus();
    const initialPings = apiJson.mock.calls.filter(([path]) => path === '/api/auth/protected/ping').length;
    fireEvent.change(input, { target: { value: 'Japan' } });
    expect(screen.getByRole('searchbox')).toBe(input);
    expect(input).toHaveFocus();
    expect(within(rail()).queryByRole('button', { name: /Beta Marathon/ })).not.toBeInTheDocument();
    await waitFor(() => expect(apiJson.mock.calls.filter(([path]) => path === '/api/auth/protected/ping')).toHaveLength(initialPings));
  });

  it('selects a course in the filtered queue and clears actions for an empty result', async () => {
    await openDashboard();
    click('admin.console.live');
    await waitFor(() => expect(within(workspace()).getByRole('heading', { name: 'Beta Marathon' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } });
    await waitFor(() => expect(within(workspace()).queryByRole('button')).not.toBeInTheDocument());
    expect(within(workspace()).queryByRole('heading')).not.toBeInTheDocument();
  });

  it('switches source, point count and summary with the preview tab', async () => {
    await openDashboard();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    click('admin.console.live_on_app');
    const facts = within(workspace()).getAllByRole('definition');
    expect(facts.map(node => node.textContent)).toEqual([t('dashboard.review_panel_live'), '3']);
    expect(within(workspace()).getAllByText('Live source summary')).toHaveLength(2);
    click('admin.console.new_preview');
    expect(within(workspace()).getAllByRole('definition').map(node => node.textContent)).toEqual([t('dashboard.review_panel_pending'), '2']);
  });

  it('shows zero points for an absent preview rather than invented geometry', async () => {
    await openDashboard();
    click('admin.console.missing');
    await waitFor(() => expect(within(workspace()).getByRole('heading', { name: 'Missing Marathon' })).toBeInTheDocument());
    expect(within(workspace()).getAllByRole('definition').map(node => node.textContent)).toEqual([t('dashboard.review_state_missing'), '0']);
  });

  it('keeps the extraction pipeline available for a pending source', async () => {
    await openDashboard();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeEnabled();
  });

  it('shows publish errors and re-enables the publish button', async () => {
    await openDashboard();
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => path.endsWith('/accept-live') ? Promise.reject(new Error('Publish service unavailable')) : original(path, options));
    click('admin.console.publish_map');
    await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent('Publish service unavailable'));
    expect(screen.getByRole('button', { name: t('admin.console.publish_map') })).toBeEnabled();
  });

  it.each(['race_course_map_pending_missing', "No such file or directory: 'local-course-map:missing.png'"])(
  'retains a missing-source failure and explains how to recover (%s)', async failure => {
    await openDashboard();
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => path === '/api/admin/jobs/job-1'
      ? Promise.resolve({ status: 'FAILED', summary: `Course-map source scan failed: ${failure}` }) : original(path, options));
    click('dashboard.course_maps_source_scan');
    await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent(t('dashboard.course_maps_source_missing_error')));
    expect(screen.getByRole('button', { name: t('dashboard.course_maps_source_scan') })).toBeEnabled();
  });

  it('disables extraction for geometry that has no source image', async () => {
    records[0] = { ...records[0], pendingPreview: { ...pending, imageUrl: '' } };
    await openDashboard();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    expect(within(workspace()).getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeDisabled();
  });

  it('publishes the pending map and refreshes the live view', async () => {
    await openDashboard();
    click('admin.console.new_preview');
    click('admin.console.publish_map');
    await waitFor(() => expect(apiJson).toHaveBeenCalledWith('/api/admin/race-course-maps/alpha/accept-live', { method: 'POST' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: t('admin.console.publish_map') })).not.toBeInTheDocument());
    expect(within(workspace()).getByTestId('map')).toHaveTextContent('Live source summary');
  });

  it('uploads an image with metadata, resets the chooser and refreshes history', async () => {
    await openDashboard();
    const input = document.querySelector('input[type="file"]');
    const file = new File(['map bytes'], 'official-map.png', { type: 'image/png' });
    const initialHistoryCalls = apiJson.mock.calls.filter(([path]) => path.endsWith('/alpha/scan-timeline')).length;
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText('Processing completed');
    const payload = JSON.parse(apiJson.mock.calls.find(([path]) => path.endsWith('/pending/upload'))[1].body);
    expect(payload).toMatchObject({ raceName: 'Alpha Marathon', fileName: 'official-map.png', imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
    expect(input.value).toBe('');
    expect(apiJson.mock.calls.filter(([path]) => path.endsWith('/alpha/scan-timeline')).length).toBeGreaterThan(initialHistoryCalls);
  });

  it('rejects an unsupported file without submitting an upload', async () => {
    await openDashboard();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['text'], 'not-a-map.txt', { type: 'text/plain' })] } });
    await screen.findByText(t('dashboard.course_maps_file_type_error'));
    expect(apiJson.mock.calls.some(([path]) => path.endsWith('/pending/upload'))).toBe(false);
  });

  it('does not replace the selected course history with a late response from another course', async () => {
    let resolveAlpha;
    timelineRequests.alpha = () => new Promise(resolve => { resolveAlpha = resolve; });
    timelineRequests.beta = async () => [{ stage: 'Beta history', status: 'SUCCESS' }];
    await openDashboard();
    fireEvent.click(within(rail()).getByRole('button', { name: /Beta Marathon/ }));
    await within(workspace()).findByText('Beta history');
    resolveAlpha([{ stage: 'Stale Alpha history', status: 'SUCCESS' }]);
    await waitFor(() => expect(within(workspace()).queryByText('Stale Alpha history')).not.toBeInTheDocument());
    expect(within(workspace()).getByText('Beta history')).toBeInTheDocument();
  });

  it('passes the official website to extraction and displays a pipeline failure', async () => {
    await openDashboard();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => path === '/api/admin/marathon-pipeline/run'
      ? Promise.reject(new Error('Pipeline service unavailable')) : original(path, options));
    click('dashboard.course_maps_run_pipeline');
    await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent('Pipeline service unavailable'));
    const payload = JSON.parse(apiJson.mock.calls.find(([path]) => path === '/api/admin/marathon-pipeline/run')[1].body);
    expect(payload).toMatchObject({ raceId: 'alpha', officialWebsite: 'https://example.com/alpha', imageFilePath: '/uploads/alpha.png' });
    expect(payload).not.toHaveProperty('website');
  });

  it.each(['SUCCESS', 'FAILURE'])('handles a terminal pipeline %s response', async state => {
    await openDashboard();
    fireEvent.click(within(workspace()).getByText(t('admin.console.source_and_tools')));
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation((path, options) => {
      if (path === '/api/admin/marathon-pipeline/jobs/pipeline-1') {
        if (state === 'SUCCESS') records[0] = { ...records[0], pendingPreview: { ...pending, summary: 'Extracted map ready' } };
        return Promise.resolve({ state, error: 'Route extraction failed' });
      }
      return original(path, options);
    });
    click('dashboard.course_maps_run_pipeline');
    expect(screen.getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeDisabled();
    if (state === 'SUCCESS') {
      await waitFor(() => expect(within(workspace()).getByTestId('map')).toHaveTextContent('Extracted map ready'), { timeout: 4000 });
    } else {
      await waitFor(() => expect(within(workspace()).getByRole('alert')).toHaveTextContent('Route extraction failed'), { timeout: 4000 });
    }
    expect(screen.getByRole('button', { name: t('dashboard.course_maps_run_pipeline') })).toBeEnabled();
  });

  it('accepts a PDF upload and submits its file name and data URL', async () => {
    await openDashboard();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['%PDF-1.4'], 'official-map.pdf', { type: 'application/pdf' })] } });
    await screen.findByText('Processing completed');
    const payload = JSON.parse(apiJson.mock.calls.find(([path]) => path.endsWith('/pending/upload'))[1].body);
    expect(payload).toMatchObject({ fileName: 'official-map.pdf', imageDataUrl: expect.stringMatching(/^data:application\/pdf;base64,/) });
  });

  it.each(['scan', 'reanalyze'])('runs %s with the course metadata and refreshes history', async action => {
    await openDashboard();
    const initialHistoryCalls = apiJson.mock.calls.filter(([path]) => path.endsWith('/alpha/scan-timeline')).length;
    click(action === 'scan' ? 'dashboard.course_maps_source_scan' : 'dashboard.course_maps_reanalyze');
    await waitFor(() => expect(apiJson).toHaveBeenCalledWith(`/api/admin/race-course-maps/alpha/pending/${action}`, expect.objectContaining({ method: 'POST' })));
    const payload = JSON.parse(apiJson.mock.calls.find(([path]) => path.endsWith(`/pending/${action}`))[1].body);
    expect(payload).toMatchObject({ raceName: 'Alpha Marathon', website: 'https://example.com/alpha', lat: 35, lng: 139, distanceKm: 42.195 });
    await screen.findByText('Processing completed');
    expect(apiJson.mock.calls.filter(([path]) => path.endsWith('/alpha/scan-timeline')).length).toBeGreaterThan(initialHistoryCalls);
  });
});
