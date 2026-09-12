import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import Signup from '../Signup';
import { apiFetch, apiJson } from '../../../api';

const { setLang } = vi.hoisted(() => ({ setLang: vi.fn() }));
const t = key => key;
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t, lang: 'en', setLang }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), getBackendBaseUrl: () => '' }));
vi.mock('../../../components/AuthDotField', () => ({ default: () => null }));
vi.mock('../../../components/AuthBrandCarousel', () => ({ default: () => null }));
vi.mock('../../../utils/passwordRules', async importOriginal => ({
  ...await importOriginal(), fetchPasswordRules: async () => ({ minLength: 10 }),
}));

beforeEach(() => { apiJson.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mount = async () => { render(<MemoryRouter><Signup /></MemoryRouter>); await act(async () => {}); };
const fill = (password, confirmation = password) => {
  fireEvent.change(screen.getByLabelText('signup.email_label'), { target: { value: 'runner@example.com' } });
  fireEvent.change(screen.getByLabelText('signup.password_label'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('signup.confirm_password_label'), { target: { value: confirmation } });
};

it('only offers configured providers while keeping account and language navigation', async () => {
  apiJson.mockResolvedValue({ googleConfigured: true, stravaConfigured: false });
  await mount();
  expect(screen.getByRole('button', { name: 'signup.google' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Strava/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'signup.signin_link' })).toHaveAttribute('href', '/login');
  fireEvent.click(screen.getByRole('button', { name: 'landing.studio_language' }));
  expect(setLang).toHaveBeenCalledWith('zh-CN');
});

it('shows password guidance after its field and prevents invalid submissions', async () => {
  await mount();
  fill('short');
  const password = screen.getByLabelText('signup.password_label');
  const rules = document.getElementById(password.getAttribute('aria-describedby'));
  expect(password.compareDocumentPosition(rules) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.submit(document.querySelector('form'));
  expect(screen.getByRole('alert')).toHaveTextContent('signup.password_rules_title');
  fill('TestOnly-Route!24', 'Different-Route!24');
  fireEvent.submit(document.querySelector('form'));
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  expect(apiFetch).not.toHaveBeenCalled();
});

it('keeps the signup payload and shows one clear email-verification confirmation', async () => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ verificationRequired: true, message: 'Check your inbox to verify your email.' }) });
  await mount();
  fill('TestOnly-Route!24');
  fireEvent.submit(document.querySelector('form'));
  expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to Hermes' })).toBeVisible();
  expect(screen.getAllByText('Check your inbox to verify your email.')).toHaveLength(1);
  expect(apiFetch.mock.calls[0][0]).toBe('/api/auth/signup');
  expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ email: 'runner@example.com', password: 'TestOnly-Route!24' });
  expect(screen.getByRole('button', { name: 'signup.signin_link' })).toBeEnabled();
  expect(document.querySelector('form')).toBeNull();
});

it('still blocks signup when captcha is required but unavailable', async () => {
  apiJson.mockResolvedValue({ recaptchaRequired: true, recaptchaSiteKey: '' });
  await mount();
  fill('TestOnly-Route!24');
  fireEvent.submit(document.querySelector('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('common.recaptcha_failed');
  expect(apiFetch).not.toHaveBeenCalled();
});
