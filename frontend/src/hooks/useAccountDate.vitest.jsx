import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as hook from './useAccountDate';

afterEach(() => { cleanup(); vi.useRealTimers(); });
it('refreshes an account midnight while mounted and on returning to the page', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T14:59:30Z'));
  function Calendar() { return <span>{hook.useAccountDate('Asia/Tokyo')}</span>; }
  render(<Calendar />);
  expect(screen.getByText('2026-10-10')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(screen.getByText('2026-10-11')).toBeInTheDocument();
  vi.setSystemTime(new Date('2026-10-11T15:01:00Z'));
  act(() => window.dispatchEvent(new Event('focus')));
  expect(screen.getByText('2026-10-12')).toBeInTheDocument();
});
