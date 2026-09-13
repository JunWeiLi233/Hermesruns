import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TopbarNotifications from './TopbarNotifications';

const copy = {
  'components.training_tips.open': 'Open training tips',
  'components.training_tips.close': 'Close training tips',
  'components.training_tips.title': 'Training tips',
  'components.training_tips.subtitle': 'Useful checks before your next run.',
  'components.training_tips.open_runs': 'Open runs',
  'components.training_tips.dismiss': 'Dismiss tip',
  'components.training_tips.empty_title': "You're all caught up",
  'components.training_tips.empty_body': 'Review your recent activities in Runs whenever you need them.',
  'components.training_tips.load_label': 'Training load',
  'components.training_tips.load_title': 'Review your recent workload',
  'components.training_tips.load_body': 'Use Analysis to compare recent effort and recovery before increasing your training.',
  'components.training_tips.routes_label': 'Your routes',
  'components.training_tips.routes_title': 'Explore where you run',
  'components.training_tips.routes_body': 'Open Heatmap to see the routes recorded in your imported activities.',
  'components.training_tips.connections_label': 'Connected accounts',
  'components.training_tips.connections_title': 'Check your activity connections',
  'components.training_tips.connections_body': 'Review Strava and Garmin connections in Settings if an activity is missing.',
};

vi.mock('../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: 'en',
    t: (key) => copy[key] ?? key,
  }),
}));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderNotifications({ onOpenRuns = vi.fn() } = {}) {
  return render(
    <>
      <TopbarNotifications onOpenRuns={onOpenRuns} />
      <button type="button">Outside control</button>
    </>,
  );
}

describe('TopbarNotifications', () => {
  it('dismisses on an outside touch without preventing the outside control action', async () => {
    const user = userEvent.setup();
    renderNotifications();
    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside control' }), { pointerType: 'touch' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps opening and dismissing functional when browser storage is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    renderNotifications();
    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    await user.click(screen.getAllByRole('button', { name: /Dismiss tip:/ })[0]);
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('keeps dismissed tips gone after remount and hides the unread dot when none remain', async () => {
    const user = userEvent.setup();
    const mounted = renderNotifications();
    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    for (const button of screen.getAllByRole('button', { name: /Dismiss tip:/ })) await user.click(button);
    mounted.unmount();
    window.localStorage.removeItem('hermes.topbar_notifications_seen.v1');
    const next = renderNotifications();
    expect(next.container.querySelector('.runner-shell-notification-dot')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    expect(screen.getByRole('status')).toHaveTextContent("You're all caught up");
  });

  it('opens the existing Runs destination once and closes the sheet', async () => {
    const user = userEvent.setup();
    const onOpenRuns = vi.fn();
    renderNotifications({ onOpenRuns });
    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    await user.click(screen.getByRole('button', { name: 'Open runs' }));
    expect(onOpenRuns).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('moves focus into the close control when opened', async () => {
    const user = userEvent.setup();
    renderNotifications();

    const trigger = screen.getByRole('button', { name: 'Open training tips' });
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Training tips' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close training tips' })).toHaveFocus();
  });

  it('closes on Escape and restores focus to the notification trigger', async () => {
    const user = userEvent.setup();
    renderNotifications();

    const trigger = screen.getByRole('button', { name: 'Open training tips' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Training tips' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes from the close button and restores focus to the notification trigger', async () => {
    const user = userEvent.setup();
    renderNotifications();

    const trigger = screen.getByRole('button', { name: 'Open training tips' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close training tips' }));

    expect(screen.queryByRole('dialog', { name: 'Training tips' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when Tab moves focus outside without stealing focus from the outside control', async () => {
    const user = userEvent.setup();
    renderNotifications();

    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    const actionButton = screen.getByRole('button', { name: 'Open runs' });
    const outsideButton = screen.getByRole('button', { name: 'Outside control' });
    actionButton.focus();

    await user.tab();

    expect(outsideButton).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Training tips' })).not.toBeInTheDocument();
  });

  it('shows the empty state and keeps a valid close-control focus after deleting all static tips', async () => {
    const user = userEvent.setup();
    renderNotifications();

    await user.click(screen.getByRole('button', { name: 'Open training tips' }));
    const closeButton = screen.getByRole('button', { name: 'Close training tips' });
    const deleteButtons = screen.getAllByRole('button', { name: /Dismiss tip:/ });
    expect(deleteButtons).toHaveLength(3);

    for (const deleteButton of deleteButtons) {
      await user.click(deleteButton);
    }

    expect(screen.getByRole('status')).toHaveTextContent("You're all caught up");
    expect(screen.getByText('Review your recent activities in Runs whenever you need them.')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Dismiss tip:/ })).toHaveLength(0);
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveFocus();
  });
});
