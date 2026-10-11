import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en';
import AuthenticatedPageChrome from './AuthenticatedPageChrome';

const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../api/resourceCache', () => ({ cachedApiJson: vi.fn(async () => ({ displayName: 'Ada Runner', email: 'ada@example.com' })) }));
vi.mock('../contexts/I18nContext', () => ({ useI18n: () => ({ t, lang: 'en' }) }));
vi.mock('./TopbarNotifications', () => ({ default: () => <span data-testid="notifications" /> }));
vi.mock('./TopbarUserMenu', () => ({ default: ({ initials }) => <span data-testid="user-menu">{initials}</span> }));
vi.mock('./HermesLogo', () => ({ default: () => <span data-testid="logo" /> }));

function Where() {
  const location = useLocation();
  return <span data-testid="where">{location.pathname}</span>;
}

function renderChrome(props = {}, path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <AuthenticatedPageChrome {...props}><p>page body</p></AuthenticatedPageChrome>
    </MemoryRouter>,
  );
}

const sidebar = () => screen.getByRole('navigation', { hidden: true });
const settingsButton = () => screen.getByRole('button', { name: t('analysis.stitch_open_settings') });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('as the Settings pages use it', () => {
  it('names the page after Settings and puts Settings above it, with no sidebar item marked', () => {
    const { container } = renderChrome();

    const crumb = container.querySelector('.runner-shell-topnav');
    expect(within(crumb).getByRole('button', { name: t('settings.heading') })).toBeInTheDocument();
    expect(within(crumb).getByText(t('settings.heading'), { selector: 'strong' })).toBeInTheDocument();
    expect(within(sidebar()).queryByRole('button', { current: 'page' })).not.toBeInTheDocument();
    expect(settingsButton()).toHaveAttribute('aria-current', 'page');
  });

  it('names the import page as itself, still under Settings', () => {
    const { container } = renderChrome({}, '/settings/import-data');

    const crumb = container.querySelector('.runner-shell-topnav');
    expect(within(crumb).getByText(t('profile.import_data'), { selector: 'strong' })).toBeInTheDocument();
    expect(within(crumb).getByRole('button', { name: t('settings.heading') })).toBeInTheDocument();
  });

  it('takes the runner back to Settings from the crumb', async () => {
    const { container } = renderChrome({}, '/settings/import-data');

    await userEvent.click(within(container.querySelector('.runner-shell-topnav')).getByRole('button', { name: t('settings.heading') }));

    expect(screen.getByTestId('where')).toHaveTextContent('/settings');
  });

  it('shows the page it is given', () => {
    renderChrome();
    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});

describe('as another page uses it', () => {
  const props = { title: 'Training log', parentLabel: 'Runs', parentRoute: '/runs', activeKey: 'activities' };

  it('says the title it is given and the page it sits under, not Settings', () => {
    const { container } = renderChrome(props, '/training-log');

    const crumb = container.querySelector('.runner-shell-topnav');
    expect(within(crumb).getByText('Training log', { selector: 'strong' })).toBeInTheDocument();
    expect(within(crumb).getByRole('button', { name: 'Runs' })).toBeInTheDocument();
    expect(within(crumb).queryByRole('button', { name: t('settings.heading') })).not.toBeInTheDocument();
  });

  it('takes the runner to the parent from the crumb', async () => {
    const { container } = renderChrome(props, '/training-log');

    await userEvent.click(within(container.querySelector('.runner-shell-topnav')).getByRole('button', { name: 'Runs' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/runs');
  });

  it('marks the sidebar item it is given, and only that one', () => {
    renderChrome(props, '/training-log');

    const current = within(sidebar()).getAllByRole('button', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(t('profile.dashboard_nav_activities'));
    expect(current[0]).toHaveClass('is-active');
  });

  it('does not call the settings button the current page', () => {
    renderChrome(props, '/training-log');
    expect(settingsButton()).not.toHaveAttribute('aria-current');
  });

  it('still takes the runner to Settings from the settings button', async () => {
    renderChrome(props, '/training-log');

    await userEvent.click(settingsButton());

    expect(screen.getByTestId('where')).toHaveTextContent('/settings');
  });
});

describe('around every page', () => {
  it('gives the runner\'s initial from their profile', async () => {
    renderChrome();
    expect(await screen.findByText('A', { selector: '[data-testid="user-menu"]' })).toBeInTheDocument();
  });

  it('starts a workout from the sidebar', async () => {
    renderChrome();
    await userEvent.click(screen.getByRole('button', { name: t('profile.dashboard_start_workout') }));
    expect(screen.getByTestId('where')).toHaveTextContent('/today-run');
  });
});
