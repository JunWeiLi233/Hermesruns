import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './AuthContext';
import { apiJson, apiFetch } from '../api';
import { rememberTrainingAuthReturn } from '../utils/trainingAuthReturn';
vi.mock('../api',async original=>({...await original(),apiJson:vi.fn(),apiFetch:vi.fn()}));
function Probe(){const location=useLocation(),auth=useAuth();return <output data-testid="auth-location">{auth.authHydrated?`${auth.role}:${location.pathname}${location.search}`:'loading'}</output>;}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();apiJson.mockResolvedValue({role:'USER'});apiFetch.mockResolvedValue({ok:true});});
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();window.history.replaceState({},'','/');});
it('restores the native training route after the existing OAuth token callback and role hydration',async()=>{
  const origin=window.location.origin;rememberTrainingAuthReturn('/training/activity?id=session-1',origin);
  window.history.replaceState({},'','/profile#token=synthetic-unit-test-session&source=google');
  render(<MemoryRouter initialEntries={['/profile']}><AuthProvider><Probe/></AuthProvider></MemoryRouter>);
  expect(await screen.findByText('USER:/training/activity?id=session-1')).toBeInTheDocument();
  expect(sessionStorage.getItem('hermes_training_auth_return')).toBeNull();expect(window.location.hash).toBe('');
});
