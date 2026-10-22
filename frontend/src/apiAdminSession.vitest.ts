import { afterEach, expect, it, vi } from 'vitest';
import { apiJson } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

function rejectAdmin(code = 'admin_required') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    error: 'Admin privileges required.', code,
  }), { status: 403, headers: { 'content-type': 'application/json' } })));
}

function atPath(path: string) {
  vi.stubGlobal('window', { location: { pathname: path, href: path } });
}

it.each(['/dashboard', '/dashboard/users', '/admin', '/workflows'])(
  'returns an expired admin session to sign-in from %s', async (path) => {
    atPath(path);
    localStorage.setItem('hermes_jwt', 'expired-admin');
    localStorage.setItem('hermes_email', 'admin@example.test');
    localStorage.setItem('hermes_role', 'ADMIN');
    localStorage.setItem('hermes_admin', 'true');
    rejectAdmin();

    await expect(apiJson('/api/admin/overview')).rejects.toThrow('Unauthorized');

    expect(localStorage.getItem('hermes_jwt')).toBeNull();
    expect(localStorage.getItem('hermes_email')).toBeNull();
    expect(localStorage.getItem('hermes_role')).toBeNull();
    expect(localStorage.getItem('hermes_admin')).toBeNull();
    expect(window.location.href).toBe('/login');
  },
);

it('preserves a newer session when an expired admin request finishes late', async () => {
  atPath('/dashboard');
  localStorage.setItem('hermes_jwt', 'expired-admin');
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
  const request = apiJson('/api/admin/overview');
  localStorage.setItem('hermes_jwt', 'new-admin');
  finish(new Response('{"code":"admin_required"}', {
    status: 403, headers: { 'content-type': 'application/json' },
  }));

  await expect(request).rejects.toThrow('Unauthorized');
  expect(localStorage.getItem('hermes_jwt')).toBe('new-admin');
  expect(window.location.href).toBe('/dashboard');
});

it('keeps normal permission errors in the dashboard without signing out', async () => {
  atPath('/dashboard');
  localStorage.setItem('hermes_jwt', 'valid-admin');
  rejectAdmin('operation_forbidden');
  await expect(apiJson('/api/admin/overview')).rejects.toMatchObject({ status: 403 });
  expect(localStorage.getItem('hermes_jwt')).toBe('valid-admin');
  expect(window.location.href).toBe('/dashboard');
});

it('does not sign a runner out when an admin endpoint denies access', async () => {
  atPath('/profile');
  localStorage.setItem('hermes_jwt', 'valid-runner');
  rejectAdmin();
  await expect(apiJson('/api/admin/overview')).rejects.toMatchObject({ status: 403 });
  expect(localStorage.getItem('hermes_jwt')).toBe('valid-runner');
  expect(window.location.href).toBe('/profile');
});
