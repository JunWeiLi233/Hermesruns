import { describe, expect, it, vi } from 'vitest';

import { apiFetch, resolveBackendBaseUrl } from './api';

describe('resolveBackendBaseUrl', () => {
  it('keeps development API calls same-origin so the Vite proxy handles them', () => {
    expect(resolveBackendBaseUrl({ hostname: 'localhost', port: '54904' }, true)).toBe('');
  });

  it('sends API requests through the frontend origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/auth/login', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.any(Object));
  });
});
