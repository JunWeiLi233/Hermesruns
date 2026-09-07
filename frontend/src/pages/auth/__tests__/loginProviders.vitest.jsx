import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import Login from '../Login';
import { apiJson } from '../../../api';

const t = (key) => key;
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), getBackendBaseUrl: () => '' }));
vi.mock('../../../components/AuthDotField', () => ({ default: () => null }));
vi.mock('../../../components/AuthBrandCarousel', () => ({ default: () => null }));
afterEach(cleanup);

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
