import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../api';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import SettingsTrainingZones from './SettingsTrainingZones';

vi.mock('../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));

const makeT = (dictionary) => (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
const t = makeT(en);

function zones({ maxBpm = 190, maxSource = 'DEFAULT', source = 'AUTO', boundaries = [114, 133, 152, 171], suggestion = null, recomputeQueued = null } = {}) {
  const edges = [null, ...boundaries, null];
  return {
    maxHeartRate: { bpm: maxBpm, source: maxSource },
    suggestedMaxHeartRate: suggestion,
    heartRate: {
      source,
      boundaries,
      defaultBoundaries: [114, 133, 152, 171],
      zones: [1, 2, 3, 4, 5].map((zone) => ({
        zone,
        fromBpm: zone === 1 ? null : edges[zone - 1],
        toBpm: zone === 5 ? null : edges[zone] - 1,
      })),
    },
    limits: { minMaxHeartRate: 120, maxMaxHeartRate: 230, defaultMaxHeartRate: 190, minBoundary: 40, maxBoundary: 230 },
    recomputeQueued,
  };
}

let server;
const putCalls = () => apiJson.mock.calls.filter(([url, options]) => url === '/api/training/zones' && options?.method === 'PUT');
const getCalls = () => apiJson.mock.calls.filter(([url, options]) => url === '/api/training/zones' && !options?.method);

beforeEach(() => {
  server = zones();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (url !== '/api/training/zones') return {};
    if (options?.method === 'PUT') return server.afterPut(JSON.parse(options.body));
    return server;
  });
});
afterEach(() => cleanup());

async function open(props = {}) {
  const view = render(<SettingsTrainingZones t={t} active {...props} />);
  await screen.findByRole('textbox', { name: t('settings.training_max_label') });
  return view;
}

const boundaryInput = (zone) => screen.getByRole('textbox', { name: t('settings.training_boundary_label', { n: zone }) });
const maxInput = () => screen.getByRole('textbox', { name: t('settings.training_max_label') });

describe('loading', () => {
  it('waits until the Training tab is opened before it asks the server', async () => {
    const { rerender } = render(<SettingsTrainingZones t={t} active={false} />);
    expect(getCalls()).toHaveLength(0);
    rerender(<SettingsTrainingZones t={t} active />);
    await screen.findByRole('textbox', { name: t('settings.training_max_label') });
    expect(getCalls()).toHaveLength(1);
    rerender(<SettingsTrainingZones t={t} active={false} />);
    rerender(<SettingsTrainingZones t={t} active />);
    expect(getCalls()).toHaveLength(1);
  });

  it('shows the current zones: the assumed max heart rate, the boundaries and every zone range', async () => {
    await open();
    expect(maxInput()).toHaveValue('190');
    expect(screen.getByText(t('settings.training_max_source_default', { bpm: 190 }))).toBeInTheDocument();
    expect([2, 3, 4, 5].map((zone) => boundaryInput(zone).value)).toEqual(['114', '133', '152', '171']);
    expect(screen.getByText(t('settings.training_boundaries_auto'))).toBeInTheDocument();
    const preview = screen.getByRole('list', { name: t('settings.training_preview_title') });
    const rows = within(preview).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Zone 1 · Recovery');
    expect(rows[0]).toHaveTextContent('under 114 bpm');
    expect(rows[4]).toHaveTextContent('Zone 5 · Maximum');
    expect(rows[4]).toHaveTextContent('171 bpm and up');
    expect(screen.getByRole('button', { name: t('settings.training_max_save') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('settings.training_boundaries_save') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: t('settings.training_max_clear') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('settings.training_boundaries_reset') })).not.toBeInTheDocument();
  });

  it('says so when the zones cannot be loaded, and loads them on retry', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    render(<SettingsTrainingZones t={t} active />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.training_load_error'));
    await user.click(screen.getByRole('button', { name: t('settings.training_retry') }));
    expect(await screen.findByRole('textbox', { name: t('settings.training_max_label') })).toBeInTheDocument();
    expect(getCalls()).toHaveLength(2);
  });

  it('treats an answer without zones as a failure', async () => {
    apiJson.mockResolvedValueOnce({});
    render(<SettingsTrainingZones t={t} active />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.training_load_error'));
  });

  it('is written in Chinese when the translator is Chinese', async () => {
    const tZh = makeT(zh);
    render(<SettingsTrainingZones t={tZh} active />);
    await screen.findByRole('textbox', { name: tZh('settings.training_max_label') });
    expect(screen.getByText(tZh('settings.training_boundaries_auto'))).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: tZh('settings.training_preview_title') })).getAllByRole('listitem')[0]).toHaveTextContent('区间 1 · 恢复');
  });
});

describe('max heart rate', () => {
  it('saves a new max heart rate and shows the zones the server worked out', async () => {
    server.afterPut = (body) => {
      expect(body).toEqual({ maxHeartRateBpm: 186 });
      server = zones({ maxBpm: 186, maxSource: 'PROFILE', boundaries: [112, 130, 149, 167], recomputeQueued: true });
      return server;
    };
    const user = userEvent.setup();
    await open();
    await user.clear(maxInput());
    await user.type(maxInput(), '186');
    await user.click(screen.getByRole('button', { name: t('settings.training_max_save') }));

    expect(await screen.findByText(t('settings.training_saved_recompute'))).toBeInTheDocument();
    expect(putCalls()).toHaveLength(1);
    expect(maxInput()).toHaveValue('186');
    expect([2, 3, 4, 5].map((zone) => boundaryInput(zone).value)).toEqual(['112', '130', '149', '167']);
    expect(screen.getByText(t('settings.training_max_source_profile'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('settings.training_max_clear') })).toBeInTheDocument();
  });

  it('refuses a max heart rate outside the limits without calling the server', async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(maxInput());
    await user.type(maxInput(), '300');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.training_max_invalid', { min: 120, max: 230 }));
    expect(maxInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: t('settings.training_max_save') })).toBeDisabled();
    await user.clear(maxInput());
    await user.type(maxInput(), '19x');
    expect(screen.getByRole('button', { name: t('settings.training_max_save') })).toBeDisabled();
    expect(putCalls()).toHaveLength(0);
  });

  it('saves a max heart rate that leaves the zones as they are without announcing a recalculation', async () => {
    server.afterPut = (body) => {
      expect(body).toEqual({ maxHeartRateBpm: 191 });
      server = zones({ maxBpm: 191, maxSource: 'PROFILE', recomputeQueued: false });
      return server;
    };
    const user = userEvent.setup();
    await open();
    await user.clear(maxInput());
    await user.type(maxInput(), '191{Enter}');
    expect(await screen.findByText(t('settings.training_max_saved'))).toBeInTheDocument();
    expect(putCalls()).toHaveLength(1);
  });

  it('goes back to the default max heart rate', async () => {
    server = zones({ maxBpm: 186, maxSource: 'PROFILE' });
    server.afterPut = (body) => {
      expect(body).toEqual({ clearMaxHeartRate: true });
      server = zones({ recomputeQueued: true });
      return server;
    };
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: t('settings.training_max_clear') }));
    expect(await screen.findByText(t('settings.training_saved_recompute'))).toBeInTheDocument();
    expect(maxInput()).toHaveValue('190');
    expect(screen.queryByRole('button', { name: t('settings.training_max_clear') })).not.toBeInTheDocument();
  });

  it('offers the max heart rate the runs point to and uses it only when asked', async () => {
    server = zones({ suggestion: { bpm: 188, basedOnRuns: 24 } });
    server.afterPut = (body) => {
      expect(body).toEqual({ maxHeartRateBpm: 188 });
      server = zones({ maxBpm: 188, maxSource: 'PROFILE', recomputeQueued: true });
      return server;
    };
    const user = userEvent.setup();
    await open();
    expect(screen.getByText(t('settings.training_suggestion', { bpm: 188, count: 24 }))).toBeInTheDocument();
    expect(putCalls()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: t('settings.training_suggestion_use', { bpm: 188 }) }));
    await screen.findByText(t('settings.training_saved_recompute'));
    expect(screen.queryByText(t('settings.training_suggestion', { bpm: 188, count: 24 }))).not.toBeInTheDocument();
  });

  it('does not offer a suggestion equal to the max heart rate in use', async () => {
    server = zones({ maxBpm: 188, maxSource: 'PROFILE', suggestion: { bpm: 188, basedOnRuns: 24 } });
    await open();
    expect(screen.queryByText(t('settings.training_suggestion', { bpm: 188, count: 24 }))).not.toBeInTheDocument();
  });
});

describe('zone boundaries', () => {
  async function type(user, zone, text) {
    await user.clear(boundaryInput(zone));
    if (text) await user.type(boundaryInput(zone), text);
  }

  it('previews valid edits as they are typed and saves them as the runner\'s own boundaries', async () => {
    server.afterPut = (body) => {
      expect(body).toEqual({ heartRateBoundaries: [120, 140, 160, 175] });
      server = zones({ source: 'MANUAL', boundaries: [120, 140, 160, 175], recomputeQueued: true });
      return server;
    };
    const user = userEvent.setup();
    await open();
    await type(user, 2, '120');
    await type(user, 3, '140');
    await type(user, 4, '160');
    await type(user, 5, '175');
    const rows = within(screen.getByRole('list', { name: t('settings.training_preview_title') })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('under 120 bpm');
    expect(rows[1]).toHaveTextContent('120–139 bpm');
    expect(rows[4]).toHaveTextContent('175 bpm and up');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('settings.training_boundaries_save') }));
    expect(await screen.findByText(t('settings.training_saved_recompute'))).toBeInTheDocument();
    expect(putCalls()).toHaveLength(1);
    expect(screen.getByText(t('settings.training_boundaries_manual'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('settings.training_boundaries_reset') })).toBeInTheDocument();
  });

  it.each([
    ['an empty box', 2, '', 'settings.training_boundaries_incomplete', {}],
    ['a value that is not a whole number', 3, '13.5', 'settings.training_boundaries_incomplete', {}],
    ['a value below the limit', 2, '39', 'settings.training_boundaries_range', { min: 40, max: 230 }],
    ['a value above the limit', 5, '231', 'settings.training_boundaries_range', { min: 40, max: 230 }],
    ['a zone that does not start higher than the one before', 3, '114', 'settings.training_boundaries_order', {}],
  ])('explains %s and does not allow saving it', async (_label, zone, text, key, params) => {
    const user = userEvent.setup();
    await open();
    await type(user, zone, text);
    expect(await screen.findByRole('alert')).toHaveTextContent(t(key, params));
    expect(screen.getByRole('button', { name: t('settings.training_boundaries_save') })).toBeDisabled();
    expect(boundaryInput(zone)).toHaveAttribute('aria-invalid', 'true');
    expect([2, 3, 4, 5].filter((n) => boundaryInput(n).getAttribute('aria-invalid') === 'true').length).toBeLessThan(4);
    // The preview keeps showing the zones that are really in force.
    const rows = within(screen.getByRole('list', { name: t('settings.training_preview_title') })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('under 114 bpm');
    expect(putCalls()).toHaveLength(0);
  });

  it('goes back to automatic boundaries', async () => {
    server = zones({ source: 'MANUAL', boundaries: [120, 140, 160, 175] });
    server.afterPut = (body) => {
      expect(body).toEqual({ resetHeartRateBoundaries: true });
      server = zones({ recomputeQueued: true });
      return server;
    };
    const user = userEvent.setup();
    await open();
    expect(screen.getByText(t('settings.training_boundaries_manual'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('settings.training_boundaries_reset') }));
    expect(await screen.findByText(t('settings.training_saved_recompute'))).toBeInTheDocument();
    expect([2, 3, 4, 5].map((zone) => boundaryInput(zone).value)).toEqual(['114', '133', '152', '171']);
    expect(screen.getByText(t('settings.training_boundaries_auto'))).toBeInTheDocument();
  });

  it('says nothing was recalculated when the zones did not change', async () => {
    server.afterPut = () => {
      server = zones({ source: 'MANUAL', boundaries: [115, 133, 152, 171], recomputeQueued: false });
      return server;
    };
    const user = userEvent.setup();
    await open();
    await type(user, 2, '115');
    await user.click(screen.getByRole('button', { name: t('settings.training_boundaries_save') }));
    expect(await screen.findByText(t('settings.training_saved_same'))).toBeInTheDocument();
  });

  it('says so when saving fails and keeps what was typed', async () => {
    server.afterPut = () => { throw Object.assign(new Error('Request failed'), { status: 500 }); };
    const user = userEvent.setup();
    await open();
    await type(user, 2, '120');
    await user.click(screen.getByRole('button', { name: t('settings.training_boundaries_save') }));
    expect(await screen.findByText(t('settings.training_save_error'))).toBeInTheDocument();
    expect(boundaryInput(2)).toHaveValue('120');
    expect(screen.getByRole('button', { name: t('settings.training_boundaries_save') })).toBeEnabled();
  });
});
