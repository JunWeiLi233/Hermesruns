import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import usePaceProfile from '../usePaceProfile';
import { NO_STREAM, paceProfile } from './paceFixtures';

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));

beforeEach(() => {
  apiJson.mockReset();
});

describe('usePaceProfile', () => {
  it('loads the profile of the run it is given', async () => {
    apiJson.mockResolvedValue(paceProfile());
    const { result } = renderHook(() => usePaceProfile(41));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.splits).toHaveLength(4);
    expect(apiJson).toHaveBeenCalledWith('/api/activities/41/pace-profile', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('holds the request back until it is enabled', async () => {
    apiJson.mockResolvedValue(paceProfile());
    const { result, rerender } = renderHook(({ enabled }) => usePaceProfile(41, { enabled }), { initialProps: { enabled: false } });

    expect(result.current.status).toBe('loading');
    expect(apiJson).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it('asks again when the refresh token changes, keeping what it has meanwhile', async () => {
    apiJson.mockResolvedValueOnce(paceProfile());
    const { result, rerender } = renderHook(({ token }) => usePaceProfile(41, { refreshToken: token }), { initialProps: { token: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let release;
    apiJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(paceProfile({ hasElevation: false })); }));
    rerender({ token: 1 });
    await waitFor(() => expect(result.current.status).toBe('refreshing'));
    expect(result.current.data.hasElevation).toBe(true);

    release();
    await waitFor(() => expect(result.current.data.hasElevation).toBe(false));
    expect(result.current.status).toBe('ready');
  });

  it('marks the numbers stale when a refresh fails, and clears the mark when the next one works', async () => {
    apiJson.mockResolvedValueOnce(paceProfile());
    const { result, rerender } = renderHook(({ token }) => usePaceProfile(41, { refreshToken: token }), { initialProps: { token: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.stale).toBe(false);

    apiJson.mockRejectedValueOnce(new Error('down'));
    rerender({ token: 1 });
    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.status).toBe('ready');
    expect(result.current.data.splits).toHaveLength(4);

    apiJson.mockResolvedValueOnce(paceProfile({ hasElevation: false }));
    rerender({ token: 2 });
    await waitFor(() => expect(result.current.stale).toBe(false));
    expect(result.current.data.hasElevation).toBe(false);
  });

  it('marks the numbers stale when a refresh answers with something that cannot be drawn', async () => {
    apiJson.mockResolvedValueOnce(paceProfile());
    const { result, rerender } = renderHook(({ token }) => usePaceProfile(41, { refreshToken: token }), { initialProps: { token: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    apiJson.mockResolvedValueOnce({});
    rerender({ token: 1 });
    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.data.hasStream).toBe(true);
  });

  it('is not stale when there is nothing to show at all, that is an error', async () => {
    apiJson.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => usePaceProfile(41));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.stale).toBe(false);
  });

  it('never hands the numbers of one run to another, even when the first answer arrives last', async () => {
    let release;
    apiJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(paceProfile({ hasElevation: false })); }));
    const { result, rerender } = renderHook(({ id }) => usePaceProfile(id), { initialProps: { id: 41 } });
    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1));

    apiJson.mockResolvedValueOnce(paceProfile({ hasElevation: true }));
    rerender({ id: 42 });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.hasElevation).toBe(true);

    await act(async () => { release(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.data.hasElevation).toBe(true);
    expect(apiJson).toHaveBeenLastCalledWith('/api/activities/42/pace-profile', expect.anything());
  });

  it('accepts a run with no stream as an answer', async () => {
    apiJson.mockResolvedValue(NO_STREAM);
    const { result } = renderHook(() => usePaceProfile(41));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.hasStream).toBe(false);
  });

  it.each([
    ['an empty answer', {}],
    ['a stream without its summary', { hasStream: true, splits: [], smoothed: { t: [] } }],
    ['a stream without its series', { hasStream: true, summary: {}, splits: [] }],
    ['a stream whose splits are not a list', { hasStream: true, summary: {}, splits: null, smoothed: { t: [] } }],
    ['text', 'nope'],
  ])('treats %s as a failed load instead of drawing it', async (_label, answer) => {
    apiJson.mockResolvedValue(answer);
    const { result } = renderHook(() => usePaceProfile(41));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('reports an error when the request fails and there is nothing to show', async () => {
    apiJson.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));
    const { result } = renderHook(() => usePaceProfile(41));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('does not ask for a run it does not have', () => {
    renderHook(() => usePaceProfile(null));
    expect(apiJson).not.toHaveBeenCalled();
  });
});
