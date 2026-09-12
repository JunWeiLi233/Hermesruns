import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingFeatureOverview from './LandingFeatureOverview';

vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ t: key => key }) }));

const mount = () => render(<LandingFeatureOverview trend={<svg role="img" aria-label="Fitness preview" />} shoeSrc="shoe-preview.webp" />);

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(cleanup);

describe('landing feature overview', () => {
  it('shows one feature instead of all three previews at once', () => {
    mount();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('landing.studio_training');
    expect(screen.getByText('5:42')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('landing.studio_example')).toBeVisible();
  });

  it('supports keyboard selection, focus movement, and wraparound', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('tab', { name: 'landing.studio_training' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'landing.studio_progress' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'landing.studio_progress' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'landing.studio_training' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('img', { name: 'Fitness preview' })).toBeVisible();
    await user.keyboard('{End}');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('landing.studio_shoes');
    expect(screen.getByRole('img', { name: 'landing.studio_daily_trainer' })).toHaveAttribute('src', 'shoe-preview.webp');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'landing.studio_training' })).toHaveFocus();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('preserves links to individual feature anchors', () => {
    window.history.replaceState(null, '', '/#answer-03');
    mount();
    expect(screen.getByRole('tab', { name: 'landing.studio_shoes' })).toHaveAttribute('aria-selected', 'true');
    act(() => {
      window.history.replaceState(null, '', '/#answer-02');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('landing.studio_progress');
  });
});
