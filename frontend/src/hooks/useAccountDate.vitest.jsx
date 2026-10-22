import { useLayoutEffect } from 'react';
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

it('keeps a focus clock update when the account timezone changes in the same commit', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T14:59:30Z'));
  function Calendar({ timeZone }) {
    const day = hook.useAccountDate(timeZone);
    useLayoutEffect(() => {
      if (timeZone !== 'Asia/Tokyo') return;
      // A focus can arrive after the profile's new timezone commits but before
      // the passive effect replaces the listener that captured the old zone.
      vi.setSystemTime(new Date('2026-10-10T15:01:00Z'));
      window.dispatchEvent(new Event('focus'));
    }, [timeZone]);
    return <span>{day}</span>;
  }
  const { rerender } = render(<Calendar timeZone="UTC" />);
  rerender(<Calendar timeZone="Asia/Tokyo" />);
  expect(screen.getByText('2026-10-11')).toBeInTheDocument();
});
