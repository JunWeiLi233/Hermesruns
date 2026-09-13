import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import MobileRunnerNavigation from './MobileRunnerNavigation';
import en from '../i18n/locales/en.js';

vi.mock('../contexts/I18nContext', () => ({
  useI18n: () => ({ lang: 'en', t: key => key.split('.').reduce((value, part) => value?.[part], en) || key }),
}));

let compact;
let listeners;
beforeEach(() => {
  compact = true;
  listeners = new Set();
  vi.stubGlobal('matchMedia', () => ({ matches: compact, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function RouteEcho() { return <output data-testid="route">{useLocation().pathname}</output>; }
function mount(route = '/profile') {
  return render(<MemoryRouter initialEntries={[route]}><RouteEcho /><MobileRunnerNavigation /></MemoryRouter>);
}

it('makes the three frequent destinations accessible and marks nested run routes active', async () => {
  const user = userEvent.setup();
  mount('/runs/21');
  expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('link', { name: 'Today' }));
  expect(screen.getByTestId('route')).toHaveTextContent('/today-run');
  expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
});

it('exposes every existing runner destination and closes after navigation', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'All pages' }));
  const dialog = screen.getByRole('dialog', { name: 'All pages' });
  const destinations = within(dialog).getAllByRole('link').map(link => link.getAttribute('href'));
  expect(destinations).toEqual(expect.arrayContaining(['/analysis', '/shoes', '/races', '/schedule', '/weather', '/heatmap', '/muscle-training', '/settings']));
  await user.click(within(dialog).getByRole('link', { name: 'Settings' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('route')).toHaveTextContent('/settings');
  expect(document.body).not.toHaveClass('modal-open');
});

it('contains keyboard focus and restores the menu trigger after Escape', async () => {
  const user = userEvent.setup();
  mount();
  const trigger = screen.getByRole('button', { name: 'All pages' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog');
  expect(dialog.contains(document.activeElement)).toBe(true);
  const links = within(dialog).getAllByRole('link');
  links.at(-1).focus();
  await user.tab();
  expect(within(dialog).getByRole('button', { name: 'Close menu' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('removes mobile controls and scroll locking when resizing to desktop', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'All pages' }));
  act(() => { compact = false; listeners.forEach(listener => listener()); });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body).not.toHaveClass('has-mobile-runner-navigation', 'modal-open');
});
