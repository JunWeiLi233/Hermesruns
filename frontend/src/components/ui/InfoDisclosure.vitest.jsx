import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import InfoDisclosure from './InfoDisclosure';

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: () => 'Show details' }),
}));

describe('InfoDisclosure', () => {
  it('reveals and hides supporting evidence through an accessible control', async () => {
    const user = userEvent.setup();
    render(
      <InfoDisclosure title="Training evidence">
        <p>Weather-adjusted effort evidence</p>
      </InfoDisclosure>,
    );

    const trigger = screen.getByRole('button', { name: 'Training evidence' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Weather-adjusted effort evidence')).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Weather-adjusted effort evidence')).toBeVisible();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Weather-adjusted effort evidence')).not.toBeInTheDocument();
  });
});
