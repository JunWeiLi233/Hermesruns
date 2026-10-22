import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import translations from '../i18n/translations';
import { apiFetch } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';
import ImportActivityModal, { ImportActivityForm } from './ImportActivityModal';

vi.mock('../api', () => ({ apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));

const t = (key, params = {}) => {
  const value = key.split('.').reduce((result, part) => result?.[part], translations.en) ?? key;
  return Object.entries(params).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement), value);
};
const file = (name) => new File(['activity'], name, { type: 'application/octet-stream' });
const input = () => screen.getByLabelText(/Drop FIT\/GPX files/);
const renderModal = (props = {}) => render(<ImportActivityModal isOpen onClose={vi.fn()} onImported={vi.fn()} t={t} {...props} />);

beforeEach(() => { apiFetch.mockReset(); apiFetch.mockResolvedValue({ ok: true, json: async () => ({ importedActivities: 3, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: [] }) }); });
afterEach(cleanup);

describe('ImportActivityModal', () => {
  it('queues mixed sources and uploads the existing multipart field names before refreshing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onImported = vi.fn();
    const { container } = renderModal({ onClose, onImported });
    expect(screen.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
    await user.upload(input(), file('morning.fit'));
    await user.click(screen.getByRole('tab', { name: /COROS/ }));
    await user.upload(screen.getByLabelText(/Drop COROS files/), file('coros.gpx'));
    await user.click(screen.getByRole('tab', { name: /Huawei/ }));
    fireEvent.drop(container.ownerDocument.querySelector('.import-v2-drop'), { dataTransfer: { files: [file('huawei.tcx')] } });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Import 3 file(s)' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(apiFetch).toHaveBeenCalledOnce();
    const [endpoint, options] = apiFetch.mock.calls[0];
    expect(endpoint).toBe('/api/import/batch');
    expect(options.method).toBe('POST');
    expect([...options.body.entries()].map(([field, entry]) => [field, entry.name])).toEqual([
      ['exports', 'morning.fit'], ['coros', 'coros.gpx'], ['huawei', 'huawei.tcx'],
    ]);
    expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
    expect(invalidateResourceCache.mock.invocationCallOrder[0]).toBeLessThan(onImported.mock.invocationCallOrder[0]);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Import result')).toHaveTextContent('Activities imported: 3');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('accepts gzipped workout files, as in a Strava export, and labels them by what they hold', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(input()).toHaveAttribute('accept', expect.stringContaining('.gz'));
    await user.upload(input(), [file('12345.fit.gz'), file('678.gpx.gz'), file('plain.gz')]);
    expect(screen.getAllByRole('listitem').map((item) => item.querySelector('.import-v2-file-ext').textContent)).toEqual(['FIT', 'GPX', 'GZ']);
    await user.click(screen.getByRole('button', { name: 'Import 3 file(s)' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    expect([...apiFetch.mock.calls[0][1].body.entries()].map(([field, entry]) => [field, entry.name])).toEqual([
      ['exports', '12345.fit.gz'], ['exports', '678.gpx.gz'], ['exports', 'plain.gz'],
    ]);
  });

  it('freezes the queue and blocks closing or submitting twice during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload;
    apiFetch.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));
    const onClose = vi.fn();
    renderModal({ onClose });
    await user.upload(input(), file('morning.fit'));
    await user.click(screen.getByRole('button', { name: 'Import 1 file(s)' }));
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled();
    expect(screen.getAllByRole('tab').every((tab) => tab.disabled)).toBe(true);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.drop(document.querySelector('.import-v2-drop'), { dataTransfer: { files: [file('late.fit')] } });
    fireEvent.submit(document.querySelector('.import-v2'));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    resolveUpload({ ok: false, json: async () => ({ error: t('profile.import_failed') }) });
    expect(await screen.findByRole('alert')).toHaveTextContent(t('profile.import_failed'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retry selected files' })).toBeEnabled();
  });

  it('lets users remove and clear files, and opens with a fresh queue', async () => {
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onImported: vi.fn(), t };
    const view = render(<ImportActivityModal isOpen {...props} />);
    await user.upload(input(), [file('one.fit'), file('two.gpx')]);
    await user.click(screen.getByRole('button', { name: 'Remove one.fit' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    await user.upload(input(), file('again.fit'));
    view.rerender(<ImportActivityModal isOpen={false} {...props} />);
    view.rerender(<ImportActivityModal isOpen {...props} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  });

  describe('what the server says about the batch', () => {
    const answer = (body, ok = true) => apiFetch.mockResolvedValue({ ok, json: async () => body });
    const submit = async (user, ...names) => {
      await user.upload(input(), names.map(file));
      await user.click(screen.getByRole('button', { name: `Import ${names.length} file(s)` }));
    };

    it('keeps the confirmed outcome until the runner acknowledges it', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onImported = vi.fn();
      answer({ importedActivities: 2, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: [] });
      renderModal({ onClose, onImported });
      await submit(user, 'a.gpx', 'b.gpx');
      await screen.findByText('Activities added');
      expect(onClose).not.toHaveBeenCalled();
      expect(onImported).toHaveBeenCalledOnce();
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('stays open and names each refused file, each duplicate and each activity that was not a run (BUG-019)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onImported = vi.fn();
      answer({
        importedActivities: 1,
        skippedDuplicates: 2,
        skippedNonRuns: 1,
        rejectedFiles: ['bad.gpx: Unable to parse XML workout file.', 'notes.fit: Unable to parse FIT workout file.'],
      });
      renderModal({ onClose, onImported });
      await submit(user, 'ok.gpx', 'bad.gpx', 'notes.fit', 'dup1.gpx', 'dup2.gpx', 'ride.gpx');
      expect(await screen.findByText('Activities imported: 1')).toBeInTheDocument();
      expect(screen.getByText('Duplicate activities skipped: 2')).toBeInTheDocument();
      expect(screen.getByText('Non-running activities skipped: 1')).toBeInTheDocument();
      expect(screen.getByText('Files rejected: 2')).toBeInTheDocument();
      expect(screen.getByText('bad.gpx: Unable to parse XML workout file.')).toBeInTheDocument();
      expect(screen.getByText('notes.fit: Unable to parse FIT workout file.')).toBeInTheDocument();
      // The runs list is refreshed at once; the dialog waits for the runner.
      expect(onImported).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: t('profile.cancel') }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('says so when nothing was imported, and does not claim a success', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onImported = vi.fn();
      answer({ importedActivities: 0, skippedDuplicates: 1, skippedNonRuns: 0, rejectedFiles: [] });
      renderModal({ onClose, onImported });
      await submit(user, 'again.gpx');
      expect(await screen.findByText('No new activities added')).toBeInTheDocument();
      expect(screen.getByText('Duplicate activities skipped: 1')).toBeInTheDocument();
      expect(onImported).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('lets the runner go back and add more files from the report', async () => {
      const user = userEvent.setup();
      answer({ importedActivities: 1, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: ['bad.gpx: Unable to parse XML workout file.'] });
      renderModal();
      await submit(user, 'ok.gpx', 'bad.gpx');
      await screen.findByText('Activities imported: 1');
      await user.upload(input(), [file('another.gpx')]);
      expect(screen.queryByText('Activities imported: 1')).not.toBeInTheDocument();
      expect(input()).toBeVisible();
    });

    it('shows the reason the server gives when every file was refused', async () => {
      const user = userEvent.setup();
      apiFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'bad.gpx: Unable to parse XML workout file.' }) });
      renderModal();
      await submit(user, 'bad.gpx');
      expect(await screen.findByRole('alert')).toHaveTextContent('bad.gpx: Unable to parse XML workout file.');
    });

    it('passes the number of runs that really went in, not the number of files chosen, to onSuccess', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      answer({ importedActivities: 3, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: [] });
      render(<ImportActivityForm t={t} onCancel={vi.fn()} onSuccess={onSuccess} />);
      await user.upload(input(), [file('one.gpx')]);
      await user.click(screen.getByRole('button', { name: 'Import 1 file(s)' }));
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(3));
    });
  });

  it('supports arrow-key source selection with an associated panel', async () => {
    const user = userEvent.setup();
    renderModal();
    screen.getByRole('tab', { name: /FIT/ }).focus();
    await user.keyboard('{ArrowRight}');
    const coros = screen.getByRole('tab', { name: /COROS/ });
    expect(coros).toHaveFocus();
    expect(coros).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', coros.id);
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Huawei/ })).toHaveFocus();
  });
});
