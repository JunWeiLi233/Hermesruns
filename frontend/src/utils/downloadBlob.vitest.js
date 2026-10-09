import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { downloadBlob, filenameFromDisposition } from './downloadBlob';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

it('reads the filename from a Content-Disposition header and falls back when there is none', () => {
  expect(filenameFromDisposition('attachment; filename="hermes-export-2026-10-09.zip"', 'x.zip')).toBe('hermes-export-2026-10-09.zip');
  expect(filenameFromDisposition('attachment; filename=plain.zip', 'x.zip')).toBe('plain.zip');
  expect(filenameFromDisposition('attachment', 'x.zip')).toBe('x.zip');
  expect(filenameFromDisposition(null, 'x.zip')).toBe('x.zip');
});

it('clicks a temporary link to the blob, removes it, and frees the URL shortly afterwards', () => {
  const create = vi.fn(() => 'blob:hermes-test');
  const revoke = vi.fn();
  URL.createObjectURL = create;
  URL.revokeObjectURL = revoke;
  const clicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordClick() {
    clicks.push({ href: this.href, download: this.download, attached: document.body.contains(this) });
  });
  const blob = new Blob(['zip']);

  downloadBlob(blob, 'export.zip');

  expect(create).toHaveBeenCalledWith(blob);
  expect(clicks).toEqual([{ href: 'blob:hermes-test', download: 'export.zip', attached: true }]);
  expect(document.querySelector('a[download]')).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledWith('blob:hermes-test');
});
