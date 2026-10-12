import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ensureLocaleMessages, translate } from '../../i18n/translationRuntime.js';
import zhPages from '../../i18n/locales/zh-CN/pages.js';
import { SUPPORT_MAILTO } from '../../utils/supportContact';
import Landing from './Landing';

const zh = zhPages.landing;

// The page reads its copy through t(). These tests use the real en and zh-CN dictionaries and fail on any key that
// resolves to nothing, so a missing translation cannot hide behind a mock.
const state = vi.hoisted(() => ({
  lang: 'en',
  overrides: {},
  missing: [],
  auth: { isAuthenticated: false, isAdmin: false, authHydrated: true },
  navigate: vi.fn(),
}));

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: (key, replacements) => (key in state.overrides
      ? state.overrides[key]
      : translate(state.lang, key, replacements, (missingKey) => state.missing.push(missingKey))),
  }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('react-router', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => state.navigate }));

const mount = () => render(<MemoryRouter><Landing /></MemoryRouter>);

beforeAll(() => ensureLocaleMessages('zh-CN'));
beforeEach(() => {
  state.lang = 'en';
  state.overrides = {};
  state.missing = [];
  state.auth = { isAuthenticated: false, isAdmin: false, authHydrated: true };
  state.navigate.mockClear();
});
afterEach(() => {
  cleanup();
  expect(state.missing).toEqual([]);
});

describe('landing page', () => {
  it('has one h1, one banner, one main and one footer, with the actions leading to sign-up and sign-in', () => {
    mount();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Run the race you trained for.');
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    const build = screen.getAllByRole('link', { name: 'Build my free plan' });
    expect(build).toHaveLength(2);
    expect(build.every((link) => link.getAttribute('href') === '/signup')).toBe(true);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'Start free' }).every((link) => link.getAttribute('href') === '/signup')).toBe(true);
  });

  it('points every in-page link at a section that exists', () => {
    const { container } = mount();
    const anchors = [...container.querySelectorAll('a[href^="#"]')].map((link) => link.getAttribute('href'));
    expect(anchors).toEqual(expect.arrayContaining(['#landing-main', '#plans', '#coaching', '#promises', '#pricing']));
    for (const href of new Set(anchors)) expect(container.querySelector(href), `no element for ${href}`).not.toBeNull();
  });

  it('shows no testimonial, rating or user count', () => {
    const { container } = mount();
    expect(container.textContent).not.toMatch(/★|loved by|\d[\d,]*\+\s*runners/i);
    expect(container.querySelector('blockquote, figcaption')).toBeNull();
  });

  it('lets a visitor pick a goal and says which one is picked', async () => {
    const user = userEvent.setup();
    mount();
    const goals = within(screen.getByRole('group', { name: 'Choose a goal' }));
    expect(goals.getByRole('button', { name: /Marathon/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Your best marathon')).toBeInTheDocument();
    await user.click(goals.getByRole('button', { name: /^5K/ }));
    expect(goals.getByRole('button', { name: /^5K/ })).toHaveAttribute('aria-pressed', 'true');
    expect(goals.getByRole('button', { name: /Marathon/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Your fastest 5K yet')).toBeInTheDocument();
    expect(screen.queryByText('Your best marathon')).not.toBeInTheDocument();
  });

  it('opens the first question and keeps every answer in the page', () => {
    const { container } = mount();
    const items = [...container.querySelectorAll('details.lv3-faq-item')];
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.open)).toEqual([true, false, false, false, false]);
    expect(items.every((item) => item.querySelector('.lv3-faq-a')?.textContent.length > 20)).toBe(true);
  });

  it('labels the invented example cards and the sample phone screen as examples', () => {
    mount();
    expect(screen.getAllByText('Example')).toHaveLength(3);
    expect(screen.getByText('Example data')).toBeInTheDocument();
  });

  it('shows the Supporter payments status while the string is set, and drops it when the owner clears the string', () => {
    const view = mount();
    expect(screen.getByText('Payments open soon.')).toBeInTheDocument();
    view.unmount();
    // The owner sets landing.studio_pricing_supporter_status to '' when payments go live.
    state.overrides = { 'landing.studio_pricing_supporter_status': '' };
    mount();
    expect(screen.queryByText('Payments open soon.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Become a supporter' })).toBeInTheDocument();
  });

  it('keeps the support address in the footer', () => {
    mount();
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Support' })).toHaveAttribute('href', SUPPORT_MAILTO);
  });

  it('sends a signed-in runner on to the app instead of showing the landing page', () => {
    state.auth = { isAuthenticated: true, isAdmin: false, authHydrated: true };
    mount();
    expect(state.navigate).toHaveBeenCalledWith('/profile');
    cleanup();
    state.navigate.mockClear();
    state.auth = { isAuthenticated: true, isAdmin: true, authHydrated: true };
    mount();
    expect(state.navigate).toHaveBeenCalledWith('/dashboard');
    cleanup();
    state.navigate.mockClear();
    state.auth = { isAuthenticated: true, isAdmin: false, authHydrated: false };
    mount();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it.each([['en'], ['zh-CN']])('resolves every string it shows in %s', (lang) => {
    state.lang = lang;
    const { container } = mount();
    expect(container.textContent).not.toMatch(/landing\.|home_|studio_/);
    // afterEach fails the test if any key was missing.
  });

  it('is written in Chinese for a Chinese reader, with the headline on two lines', () => {
    state.lang = 'zh-CN';
    mount();
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe(zh.home_hero_title);
    expect(title.textContent).toMatch(/\p{Script=Han}+.*\n.*\p{Script=Han}+/su);
    expect(screen.getByRole('link', { name: zh.home_nav_signin })).toHaveAttribute('href', '/login');
    expect(screen.getByText(zh.studio_pricing_supporter_status)).toBeInTheDocument();
    expect(screen.getByText(zh.home_plan_free_scans)).toBeInTheDocument();
  });
});
