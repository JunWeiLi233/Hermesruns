import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../contexts/I18nContext';
import { UnitProvider } from '../../../contexts/UnitContext';
import { WorkspaceProvider } from '../ui/workspace';
import Compare from './S12';
import { comparisonPlot, heartRateAverage } from './comparisonChart';

let client, activities, saved;
beforeEach(() => {
  localStorage.setItem('hermes_lang', 'en');
  localStorage.setItem('hermes_unit', 'km');
  activities = Array.from({ length: 6 }, (_, i) => ({ id: `a${i + 1}`, title: `Run ${i + 1}`, date: `2026-10-${String(12 - i).padStart(2, '0')}`, minutes: 52 + i, distanceKm: 10.4 + i, averageHeartRate: 163 - i, samples: [{ hr: 140 }, { hr: 160 }, { hr: null }, { hr: 165 }] }));
  saved = [{ id: 'saved', name: 'Tempo vs tempo', activityIds: ['a1', 'a4'], offset: 2 }];
  let refresh;
  client = {
    getActor: () => 'runner', getSecurityKey: () => 'runner', subscribe: fn => { refresh = fn; return () => {}; },
    getActivities: vi.fn(async () => ({ items: activities })),
    getComparisons: vi.fn(async () => ({ items: saved })),
    getActivityOverlays: vi.fn(async ({ activityIds }) => ({ items: activityIds.map(id => activities.find(activity => activity.id === id)) })),
    saveComparison: vi.fn(async payload => { saved = [...saved, { id: 'new', ...payload }]; refresh(); return { id: 'new', ...payload }; }),
  };
});
afterEach(cleanup);
function mount() { return render(<MemoryRouter><I18nProvider><UnitProvider><WorkspaceProvider client={client}><Compare /></WorkspaceProvider></UnitProvider></I18nProvider></MemoryRouter>); }

it('searches names and civil dates without removing selected traces and enforces the four-session limit', async () => {
  mount();
  expect(await screen.findByText('2 of 4 selected')).toBeVisible();
  await waitFor(() => expect(client.getActivityOverlays).toHaveBeenLastCalledWith({ activityIds: ['a1', 'a2'] }));
  const boxes = screen.getAllByRole('checkbox');
  fireEvent.click(boxes[2]); fireEvent.click(boxes[3]);
  expect(screen.getByText('4 of 4 selected · max reached')).toBeVisible();
  expect(boxes[4]).toBeDisabled();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '2026-10-11' } });
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Remove Run 1' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Run 1' }));
  expect(screen.getByText('3 of 4 selected')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not found' } });
  expect(screen.getByText('No session matches “not found”.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }));
  expect(screen.getByText('Pick two or more sessions on the left to overlay them.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save comparison' })).toBeDisabled();
});

it('loads a saved comparison in order, shifts later traces, saves a trimmed name and refreshes saved pills', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Tempo vs tempo' }));
  expect(screen.getByLabelText('Comparison name')).toHaveValue('Tempo vs tempo');
  expect(screen.getByRole('slider')).toHaveValue('2');
  await waitFor(() => expect(client.getActivityOverlays).toHaveBeenLastCalledWith({ activityIds: ['a1', 'a4'] }));
  fireEvent.change(screen.getByLabelText('Comparison name'), { target: { value: '  My tempo  ' } });
  fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save comparison' }));
  await waitFor(() => expect(client.saveComparison).toHaveBeenCalledWith({ activityIds: ['a1', 'a4'], name: 'My tempo', offset: 5 }));
  expect(await screen.findByText('Comparison saved.')).toBeVisible();
  expect(await screen.findByRole('button', { name: 'My tempo' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Comparison name'), { target: { value: ' ' } });
  expect(screen.getByRole('button', { name: 'Save comparison' })).toBeDisabled();
  expect(screen.queryByText('Comparison saved.')).not.toBeInTheDocument();
});

it('reports missing streams and save failures without making up values', async () => {
  activities = activities.map(activity => ({ ...activity, samples: [], averageHeartRate: null, distanceKm: null }));
  client.saveComparison.mockRejectedValue(new Error('Could not save'));
  const { container } = mount();
  expect(await screen.findByText('No recorded heart-rate samples for these sessions.')).toBeVisible();
  expect(container.querySelector('.comparison-plot path')).toHaveAttribute('d', '');
  expect(container.querySelector('.comparison-session-metrics strong')).toHaveTextContent('—');
  fireEvent.click(screen.getByRole('button', { name: 'Save comparison' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
});

it('formats distance in the account unit and preserves the authorized civil date', async () => {
  localStorage.setItem('hermes_unit', 'mile');
  mount();
  expect(await screen.findByText('6.5 mi')).toBeVisible();
  expect(screen.getByText('Mon, Oct 12 · avg 163 bpm')).toBeVisible();
});

it('never connects a missing sample or shifts the first trace', () => {
  const traces = [{ samples: [{ hr: 140 }, { hr: null }, { hr: 150 }, { hr: 155 }] }, { samples: [{ hr: 160 }, { hr: 165 }] }];
  const plot = comparisonPlot(traces, 5);
  expect(plot.lines[0].path.match(/M/g)).toHaveLength(2);
  expect(plot.lines[0].path).toMatch(/^M0\.00,/);
  expect(plot.lines[1].path).toMatch(/^M83\.33,/);
  expect(plot.lastSample).toBe(6);
  expect(heartRateAverage({ samples: [{ hr: null }, { hr: 0 }, { hr: 150 }, { hr: 160 }, { hr: 999 }] })).toBe(155);
  expect(heartRateAverage({ samples: [{ hr: null }] })).toBeNull();
});
