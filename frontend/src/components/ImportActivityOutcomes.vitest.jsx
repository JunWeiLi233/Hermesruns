import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import { apiFetch } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';
import ImportActivityModal, { ImportActivityForm } from './ImportActivityModal';

vi.mock('../api', () => ({ apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
const translate = (dictionary) => (key, params = {}) => Object.entries(params).reduce(
  (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
  key.split('.').reduce((copy, part) => copy?.[part], dictionary) ?? key,
);
const result = (overrides = {}) => ({ importedActivities: 0, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: [], ...overrides });
const response = (body, ok = true) => ({ ok, json: async () => body });
beforeEach(() => { apiFetch.mockReset(); invalidateResourceCache.mockClear(); });
afterEach(cleanup);
async function upload(names = ['runs.zip']) {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText(/Drop FIT\/GPX|拖入 FIT\/GPX/), names.map(name => new File(['run'], name)));
  await user.click(screen.getByRole('button', { name: /Import \d+ file|导入 \d+ 个文件/ }));
  return user;
}

it('reports activities inside one ZIP and preserves the numeric success callback', async () => {
  const onSuccess = vi.fn();
  apiFetch.mockResolvedValue(response(result({ importedActivities: 4 })));
  render(<ImportActivityForm t={translate(en)} onSuccess={onSuccess} />);
  await upload();
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(4));
  expect(screen.getByLabelText('Import result')).toHaveTextContent('Activities imported: 4');
  expect(screen.getByLabelText('Import result')).toHaveTextContent('Files rejected: 0');
  expect(invalidateResourceCache.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0]);
});

it('keeps the modal result visible until acknowledged while refreshing existing consumers', async () => {
  const onImported = vi.fn();
  const onClose = vi.fn();
  apiFetch.mockResolvedValue(response(result({ importedActivities: 2 })));
  render(<ImportActivityModal isOpen t={translate(en)} onImported={onImported} onClose={onClose} />);
  const user = await upload();
  await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveTextContent('Activities imported: 2');
  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('does not signal imported activities for a duplicate-only HTTP 200', async () => {
  const onSuccess = vi.fn();
  apiFetch.mockResolvedValue(response(result({ skippedDuplicates: 3 })));
  render(<ImportActivityForm t={translate(en)} onSuccess={onSuccess} />);
  await upload();
  const feedback = await screen.findByLabelText('Import result');
  expect(feedback).toHaveTextContent('No new activities added');
  expect(feedback).toHaveTextContent('Activities imported: 0');
  expect(feedback).toHaveTextContent('Duplicate activities skipped: 3');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidateResourceCache).not.toHaveBeenCalled();
});

it('preserves mixed rejection details and allows retry without guessing per-file successes', async () => {
  const onSuccess = vi.fn();
  apiFetch.mockResolvedValueOnce(response(result({ importedActivities: 2, skippedDuplicates: 1, rejectedFiles: ['bad.fit: Parse error'] })));
  render(<ImportActivityForm t={translate(en)} onSuccess={onSuccess} />);
  const user = await upload(['runs.zip', 'bad.fit']);
  const feedback = await screen.findByLabelText('Import result');
  expect(feedback).toHaveTextContent('Activities imported: 2');
  expect(feedback).toHaveTextContent('Duplicate activities skipped: 1');
  expect(feedback).toHaveTextContent('Files rejected: 1');
  expect(within(feedback).getByText('bad.fit: Parse error')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove bad.fit' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Remove bad.fit' }));
  apiFetch.mockResolvedValueOnce(response(result({ skippedDuplicates: 2 })));
  await user.click(screen.getByRole('button', { name: 'Retry selected files' }));
  expect([...apiFetch.mock.calls[1][1].body.values()].map(file => file.name)).toEqual(['runs.zip']);
  await waitFor(() => expect(screen.getByLabelText('Import result')).toHaveTextContent('No new activities added'));
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith(2);
});

it('retains all server rejection details and counts on HTTP 400', async () => {
  apiFetch.mockResolvedValue(response({ error: 'bad.fit: Parse error', ...result({ skippedDuplicates: 1, rejectedFiles: ['bad.fit: Parse error', 'other.gpx: Empty upload file.'] }) }, false));
  render(<ImportActivityForm t={translate(en)} />);
  await upload(['bad.fit', 'other.gpx']);
  const feedback = await screen.findByLabelText('Import result');
  expect(feedback).toHaveTextContent('Activities imported: 0');
  expect(feedback).toHaveTextContent('Files rejected: 2');
  expect(feedback).toHaveTextContent('other.gpx: Empty upload file.');
  expect(screen.getByRole('button', { name: 'Retry selected files' })).toBeEnabled();
});

it.each([{}, null, { importedActivities: 1 }, { importedActivities: -1, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: [] }])('does not turn an incomplete HTTP 200 response into success: %j', async body => {
  const onSuccess = vi.fn();
  apiFetch.mockResolvedValue(response(body));
  render(<ImportActivityForm t={translate(en)} onSuccess={onSuccess} />);
  await upload();
  expect(await screen.findByRole('alert')).toHaveTextContent('The import outcome could not be confirmed');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Remove runs.zip' })).toBeEnabled();
});

it('shows batch validation errors without fabricating rejection counts', async () => {
  apiFetch.mockResolvedValue(response({ error: 'Batch limit is 50 files.' }, false));
  render(<ImportActivityForm t={translate(en)} />);
  await upload();
  expect(await screen.findByRole('alert')).toHaveTextContent('Batch limit is 50 files.');
  expect(screen.queryByLabelText('Import result')).not.toBeInTheDocument();
});

it.each(['lost connection', 'unexpected body'])('lets the runner check fresh history after an unconfirmed import: %s', async failure => {
  const onSuccess = vi.fn();
  const onViewRuns = vi.fn();
  if (failure === 'lost connection') apiFetch.mockRejectedValue(new TypeError('Connection closed'));
  else apiFetch.mockResolvedValue(response({ message: 'OK' }));
  render(<ImportActivityForm t={translate(en)} onSuccess={onSuccess} onViewRuns={onViewRuns} />);
  const user = await upload();
  expect(await screen.findByRole('alert')).toHaveTextContent(en.components.import_v2.outcome_unknown);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
  await user.click(screen.getByRole('button', { name: /View runs/ }));
  expect(onViewRuns).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Retry selected files' })).toBeEnabled();
});

it('shows non-running activities separately and translates the result into Chinese', async () => {
  apiFetch.mockResolvedValue(response(result({ skippedNonRuns: 2 })));
  render(<ImportActivityForm t={translate(zh)} />);
  await upload();
  const feedback = await screen.findByLabelText('导入结果');
  expect(feedback).toHaveTextContent('未添加新活动');
  expect(feedback).toHaveTextContent('跳过 2 个非跑步活动');
  expect(feedback.textContent).not.toMatch(/components\.|\{count\}/);
});
