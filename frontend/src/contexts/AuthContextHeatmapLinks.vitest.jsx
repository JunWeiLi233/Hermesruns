import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../api', async original => ({...await original(), apiFetch: vi.fn(async () => new Response('{}', {status: 401})), apiJson: vi.fn(async () => ({}))}));
function Probe() {return <span>{useAuth().isAuthenticated ? 'signed in' : 'anonymous'}</span>;}
afterEach(() => {window.history.replaceState({}, '', '/');localStorage.clear();});
it.each(['unsubscribe', 'verify-report-email', 'reset-password', 'deletion'])('never treats a heatmap %s capability as an OAuth login', path => {
  localStorage.clear();
  const token='a'.repeat(64);
  window.history.replaceState({}, '', `/heatmap/${path}?token=${token}`);
  render(<MemoryRouter><AuthProvider><Probe/></AuthProvider></MemoryRouter>);
  expect(localStorage.getItem('hermes_jwt')).not.toBe(token);
  expect(screen.getByText('anonymous')).toBeVisible();
});
it('does not probe an expired saved session before a public opt-out can run', async () => {
  const {apiJson}=await import('../api');vi.mocked(apiJson).mockClear();
  localStorage.setItem('hermes_jwt','existing-session');
  window.history.replaceState({}, '', '/heatmap/unsubscribe?token='+'a'.repeat(64));
  render(<MemoryRouter initialEntries={['/heatmap/unsubscribe']}><AuthProvider><Probe/></AuthProvider></MemoryRouter>);
  expect(localStorage.getItem('hermes_jwt')).toBe('existing-session');
  expect(apiJson).not.toHaveBeenCalled();
});
