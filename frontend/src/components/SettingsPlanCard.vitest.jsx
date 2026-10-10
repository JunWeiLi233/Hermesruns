import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SettingsPlanCard from './SettingsPlanCard';
import { apiJson } from '../api';
import en from '../i18n/locales/en';

vi.mock('../api', () => ({ apiJson: vi.fn() }));

const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

function respond({ quota = { pro: false }, billing = { configured: false }, checkout } = {}) {
  apiJson.mockImplementation(async (url) => {
    if (url === '/api/profile/quota') return quota;
    if (url === '/api/billing/config') return billing;
    if (url === '/api/billing/checkout') {
      if (checkout instanceof Error) throw checkout;
      return checkout;
    }
    throw new Error(`unexpected ${url}`);
  });
}

beforeEach(() => {
  apiJson.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('says payments are not open, offers no button, and keeps everything free', async () => {
  respond();
  render(<SettingsPlanCard t={t} />);
  expect(await screen.findByText(en.settings.plan_closed)).toBeVisible();
  expect(screen.getByText(en.settings.plan_free_title)).toBeVisible();
  expect(screen.queryByRole('button', { name: en.settings.plan_buy_button })).toBeNull();
});

it('shows the price and that nothing renews, then sends the chosen months to checkout', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
  respond({ billing: { configured: true, priceLabel: '$4 a month' }, checkout: { url: 'https://checkout.stripe.com/c/pay/test' } });
  render(<SettingsPlanCard t={t} />);

  expect(await screen.findByText('$4 a month, paid once for the months you choose.')).toBeVisible();
  expect(screen.getByText(en.settings.plan_no_renewal)).toBeVisible();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: en.settings.plan_buy_button }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/test'));
  const [, options] = apiJson.mock.calls.find(([url]) => url === '/api/billing/checkout');
  expect(JSON.parse(options.body)).toEqual({ months: 6 });
});

it('shows an active Supporter plan and lets the runner add months', async () => {
  respond({ quota: { pro: true }, billing: { configured: true, priceLabel: '$4 a month' } });
  render(<SettingsPlanCard t={t} />);
  expect(await screen.findByText(en.settings.plan_supporter_active)).toBeVisible();
  expect(screen.getByText(en.settings.plan_extend_title)).toBeVisible();
});

it('says nothing was charged when the payment page does not open', async () => {
  respond({ billing: { configured: true }, checkout: new Error('Payment provider error') });
  render(<SettingsPlanCard t={t} />);
  fireEvent.click(await screen.findByRole('button', { name: en.settings.plan_buy_button }));
  expect(await screen.findByRole('alert')).toHaveTextContent(en.settings.plan_checkout_error);
});
