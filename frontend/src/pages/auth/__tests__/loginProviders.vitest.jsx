import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import Login from '../Login';
import { apiJson, apiFetch } from '../../../api';

const t = (key) => key;
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), getBackendBaseUrl: () => '' }));
vi.mock('../../../components/AuthDotField', () => ({ default: () => null }));
vi.mock('../../../components/AuthBrandCarousel', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('reserves provider space while loading and only exposes configured actions', async () => {
  let resolveProviders;
  apiJson.mockReturnValue(new Promise((resolve) => { resolveProviders = resolve; }));
  const { container } = render(<MemoryRouter><Login /></MemoryRouter>);
  const region = container.querySelector('.auth-flow-social');
  expect(region).toBeInTheDocument();
  expect(region).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByRole('button', { name: 'index.google' })).not.toBeInTheDocument();

  await act(async () => resolveProviders({ googleConfigured: true, stravaConfigured: false }));
  expect(container.querySelector('.auth-flow-social')).toBe(region);
  expect(region).toHaveAttribute('aria-busy', 'false');
  expect(screen.getByRole('button', { name: 'index.google' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'index.stitch_strava_cta' })).not.toBeInTheDocument();
});

it('keeps password login and the reserved space when provider discovery fails', async () => {
  apiJson.mockRejectedValue(new Error('Offline'));
  const { container } = render(<MemoryRouter><Login /></MemoryRouter>);
  await act(async () => {});
  expect(container.querySelector('.auth-flow-social')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'index.submit' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'index.google' })).not.toBeInTheDocument();
});

it('keeps credential submission and server errors intact inside the new layout', async () => {
  apiJson.mockResolvedValue({});
  apiFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Check your email and password.' }) });
  render(<MemoryRouter><Login /></MemoryRouter>);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText('index.email_label'), { target: { value: 'runner@example.com' } });
  fireEvent.change(screen.getByLabelText('index.password_label'), { target: { value: 'test-only-password' } });
  fireEvent.submit(document.querySelector('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check your email and password.');
  expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ email: 'runner@example.com', password: 'test-only-password' });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('index.stitch_welcome');
  expect(screen.getByRole('link', { name: 'index.studio_home' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'index.forgot_password' })).toHaveAttribute('href', '/forgot-password');
});

it('still replaces credentials with the required admin verification actions', async () => {
  apiJson.mockResolvedValue({ googleConfigured: true });
  apiFetch.mockResolvedValue({ ok: true, status: 202, json: async () => ({ code: 'ADMIN_MFA_REQUIRED' }) });
  render(<MemoryRouter><Login /></MemoryRouter>);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText('index.email_label'), { target: { value: 'runner@example.com' } });
  fireEvent.change(screen.getByLabelText('index.password_label'), { target: { value: 'test-only-password' } });
  fireEvent.submit(document.querySelector('form'));
  expect(await screen.findByRole('button', { name: 'index.admin_mfa_use_passkey' })).toBeEnabled();
  expect(screen.queryByLabelText('index.password_label')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'index.google' })).not.toBeInTheDocument();
});
