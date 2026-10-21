import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SettingsPlanCard from './SettingsPlanCard';
import { apiJson } from '../api';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';

vi.mock('../api', () => ({ apiJson: vi.fn() }));

const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

function respond({ quota = { pro: false }, billing = { configured: false }, checkout } = {}) {
  apiJson.mockImplementation(async (url) => {
    if (url === '/api/profile/quota') {
      if (quota instanceof Error) throw quota;
      return quota;
    }
    if (url === '/api/billing/config') {
      if (billing instanceof Error) throw billing;
      return billing;
    }
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
  vi.useRealTimers();
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

it.each(['quota', 'billing'])('shows a recoverable load error when %s fails instead of inventing a free account or closed payments', async (endpoint) => {
  respond({ [endpoint]: new TypeError('offline') });
  render(<SettingsPlanCard t={t} />);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(en.settings.plan_load_error);
  expect(screen.queryByText(en.settings.plan_free_title)).toBeNull();
  expect(screen.queryByText(en.settings.plan_closed)).toBeNull();
  expect(screen.queryByRole('button', { name: en.settings.plan_buy_button })).toBeNull();
  respond({ quota: { pro: true }, billing: { configured: true } });
  fireEvent.click(screen.getByRole('button', { name: en.settings.training_retry }));
  expect(await screen.findByText(en.settings.plan_supporter_active)).toBeVisible();
});

it.each([null, {}, { configured: 'false' }])('offers retry for an empty or invalid successful config response: %o', async (billing) => {
  respond({ billing });
  render(<SettingsPlanCard t={t} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(en.settings.plan_load_error);
  expect(screen.queryByText(en.settings.plan_closed)).toBeNull();
});

it('announces loading without labelling an unknown account free', async () => {
  apiJson.mockReturnValue(new Promise(() => {}));
  render(<SettingsPlanCard t={t} />);
  expect(screen.getByRole('status')).toHaveTextContent(en.settings.plan_loading);
  expect(screen.queryByText(en.settings.plan_free_title)).toBeNull();
});

it('stops a hanging plan load and lets the runner retry in Chinese', async () => {
  vi.useFakeTimers();
  apiJson.mockReturnValue(new Promise(() => {}));
  const translate = key => key.split('.').reduce((value, part) => value?.[part], zh) || key;
  render(<SettingsPlanCard t={translate} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(screen.getByRole('alert')).toHaveTextContent(zh.settings.plan_load_error);
  expect(screen.getByRole('button', { name: zh.settings.training_retry })).toBeEnabled();
  expect(apiJson.mock.calls.every(([, options]) => options?.signal?.aborted)).toBe(true);
});

it('keeps checkout and month selection disabled while opening and sends only one request', async () => {
  let finish;
  const payment = new Promise(resolve => { finish = resolve; });
  respond({ billing: { configured: true }, checkout: payment });
  render(<SettingsPlanCard t={t} />);
  const button = await screen.findByRole('button', { name: en.settings.plan_buy_button });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(apiJson.mock.calls.filter(([url]) => url === '/api/billing/checkout')).toHaveLength(1);
  await act(async () => finish({}));
  expect(button).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent(en.settings.plan_checkout_error);
});

it('does not open a late checkout response after leaving settings', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
  let finish;
  respond({ billing: { configured: true }, checkout: new Promise(resolve => { finish = resolve; }) });
  const view = render(<SettingsPlanCard t={t} />);
  fireEvent.click(await screen.findByRole('button', { name: en.settings.plan_buy_button }));
  view.unmount();
  await act(async () => finish({ url: 'https://checkout.stripe.com/c/pay/late' }));
  expect(assign).not.toHaveBeenCalled();
});

it('does not open a late checkout when the browser path changes before a lazy page unmounts', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
  let finish;
  respond({ billing: { configured: true }, checkout: new Promise(resolve => { finish = resolve; }) });
  render(<SettingsPlanCard t={t} />);
  fireEvent.click(await screen.findByRole('button', { name: en.settings.plan_buy_button }));
  window.location.pathname = '/runs';
  await act(async () => finish({ url: 'https://checkout.stripe.com/c/pay/late' }));
  expect(assign).not.toHaveBeenCalled();
});

it('recovers from a hanging checkout without redirecting when its abandoned response arrives', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
  let finish;
  respond({ billing: { configured: true }, checkout: new Promise(resolve => { finish = resolve; }) });
  render(<SettingsPlanCard t={t} />);
  const button = await screen.findByRole('button', { name: en.settings.plan_buy_button });
  vi.useFakeTimers();
  fireEvent.click(button);
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(button).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent(en.settings.plan_checkout_error);
  const [, options] = apiJson.mock.calls.find(([url]) => url === '/api/billing/checkout');
  expect(options.signal.aborted).toBe(true);
  await act(async () => finish({ url: 'https://checkout.stripe.com/c/pay/late' }));
  expect(assign).not.toHaveBeenCalled();
  respond({ billing: { configured: true }, checkout: {} });
  fireEvent.click(button);
  await act(async () => {});
  expect(apiJson.mock.calls.filter(([url]) => url === '/api/billing/checkout')).toHaveLength(2);
});
