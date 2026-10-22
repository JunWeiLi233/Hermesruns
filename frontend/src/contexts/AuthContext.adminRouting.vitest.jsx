import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { lazy, Suspense } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AuthProvider, useAuth } from './AuthContext';
import { apiFetch, apiJson } from '../api';
import { rememberTrainingAuthReturn } from '../utils/trainingAuthReturn';

vi.mock('../api', async original => ({ ...await original(), apiFetch: vi.fn(), apiJson: vi.fn() }));

function SessionProbe({ visited }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  visited?.push(location.pathname);
  return <>
    <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>
    <output data-testid="role">{auth.role || 'unknown'}</output>
    <output data-testid="hydrated">{String(auth.authHydrated)}</output>
    <button onClick={() => navigate('/privacy')}>Open public page</button>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => auth.login('replacement-session', 'admin@example.test')}>Replace session</button>
    <button onClick={() => auth.logout()}>Sign out</button>
    <button onClick={() => auth.logout({ redirectTo: '/profile' })}>Sign out with runner return</button>
  </>;
}

function mountSession(path = '/dashboard/course-maps', options = {}) {
  return render(<MemoryRouter initialEntries={options.entries || [path]}>
    <AuthProvider><SessionProbe visited={options.visited} /></AuthProvider>
  </MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  localStorage.setItem('hermes_jwt', 'existing-session');
  apiJson.mockResolvedValue({ role: 'ADMIN' });
  apiFetch.mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

it.each(['/', '/login', '/signup', '/forgot-password', '/terms', '/privacy', '/profile', '/races/details/tokyo-marathon', '/training/activity', '/dashboard-other'])('keeps a verified admin inside the portal from %s', async path => {
  mountSession(path);
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/dashboard$/));
});

it('preserves a selected admin page, query and fragment during session hydration', async () => {
  mountSession('/dashboard/course-maps?race=tokyo#pending');
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('ADMIN'));
  expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/course-maps?race=tokyo#pending');
});

it('replaces an attempted public navigation so Back returns to the previous admin page', async () => {
  mountSession('/dashboard/course-maps');
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('ADMIN'));
  fireEvent.click(screen.getByRole('button', { name: 'Open public page' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/dashboard$/));
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/course-maps'));
});

it.each(['Sign out', 'Sign out with runner return'])('sends admin %s to the landing page and invalidates the existing session', async button => {
  mountSession();
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('ADMIN'));
  fireEvent.click(screen.getByRole('button', { name: button, exact: true }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  expect(localStorage.getItem('hermes_jwt')).toBeNull();
  expect(localStorage.getItem('hermes_role')).toBeNull();
  expect(screen.getByTestId('role')).toHaveTextContent('unknown');
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
    method: 'POST', headers: { Authorization: 'Bearer existing-session' },
  }));
});

it('keeps the admin signed out on the landing page if server invalidation fails', async () => {
  apiFetch.mockImplementation(path => path === '/api/auth/logout' ? Promise.reject(new Error('Offline')) : Promise.resolve({ ok: true }));
  mountSession();
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('ADMIN'));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  expect(localStorage.getItem('hermes_jwt')).toBeNull();
});

it('does not let the old protected page redirect logout to login while the landing chunk loads', async () => {
  let loadLanding;
  const Landing = lazy(() => new Promise(resolve => { loadLanding = () => resolve({ default: () => <h1>Public landing</h1> }); }));
  function ProtectedAdmin() {
    const auth = useAuth();
    return auth.isAuthenticated
      ? <button onClick={() => auth.logout()}>Sign out admin</button>
      : <Navigate to="/login" replace />;
  }
  function RoleReady() {
    const auth = useAuth();
    return <output>{auth.authHydrated && auth.role === 'ADMIN' ? 'Admin verified' : 'Waiting'}</output>;
  }
  render(<MemoryRouter initialEntries={['/dashboard']}><AuthProvider>
    <RoleReady />
    <Suspense fallback={<span>Loading destination</span>}><Routes>
      <Route path="/dashboard" element={<ProtectedAdmin />} />
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<h1>Sign-in page</h1>} />
    </Routes></Suspense>
  </AuthProvider></MemoryRouter>);
  await screen.findByText('Admin verified');
  fireEvent.click(screen.getByRole('button', { name: 'Sign out admin' }));
  await waitFor(() => expect(loadLanding).toBeTypeOf('function'));
  await act(async () => loadLanding());
  expect(await screen.findByRole('heading', { name: 'Public landing' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Sign-in page' })).not.toBeInTheDocument();
});

it('does not reuse the previous account role while a replacement credential is being verified', async () => {
  apiJson.mockResolvedValueOnce({ role: 'USER' });
  mountSession('/profile');
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('USER'));
  let resolveRole;
  apiJson.mockImplementation(() => new Promise(resolve => { resolveRole = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Replace session' }));
  expect(screen.getByTestId('role')).toHaveTextContent('unknown');
  expect(screen.getByTestId('hydrated')).toHaveTextContent('false');
  await act(async () => resolveRole({ role: 'ADMIN' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/dashboard$/));
});

it('waits for the verified OAuth role and never sends an admin to a remembered runner destination', async () => {
  localStorage.clear();
  rememberTrainingAuthReturn('/training/activity?id=example', window.location.origin);
  window.history.replaceState({}, '', '/profile#token=synthetic-oauth-session&source=google');
  let resolveRole;
  apiJson.mockImplementation(() => new Promise(resolve => { resolveRole = resolve; }));
  const visited = [];
  mountSession('/profile', { visited });
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/profile$/);
  expect(sessionStorage.getItem('hermes_training_auth_return')).not.toBeNull();
  await act(async () => resolveRole({ role: 'ADMIN' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/dashboard$/));
  expect(visited).not.toContain('/training/activity');
  expect(sessionStorage.getItem('hermes_training_auth_return')).toBeNull();
});

it('does not mistake a saved role or an incomplete MFA login for a verified admin session', async () => {
  localStorage.removeItem('hermes_jwt');
  localStorage.setItem('hermes_role', 'ADMIN');
  mountSession('/login?adminMfa=required');
  expect(screen.getByTestId('location')).toHaveTextContent('/login?adminMfa=required');
  expect(apiJson).not.toHaveBeenCalled();
});

it('preserves normal runner navigation and logout behavior', async () => {
  apiJson.mockResolvedValue({ role: 'USER' });
  mountSession('/profile');
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('USER'));
  expect(screen.getByTestId('location')).toHaveTextContent('/profile');
  fireEvent.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
});
