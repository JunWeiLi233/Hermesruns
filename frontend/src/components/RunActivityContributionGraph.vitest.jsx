import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RunActivityContributionGraph from './RunActivityContributionGraph';

vi.mock('../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
const t = (key, values = {}) => `${key} ${values.count ?? values.weeks ?? ''}`.trim();
afterEach(cleanup);

it('shows the requested 12-week muscle history without older or future check-ins', () => {
  const { container } = render(<RunActivityContributionGraph
    runs={[{ trainingDate: '2026-07-19' }, { trainingDate: '2026-08-03' }, { trainingDate: '2026-10-07' }, { trainingDate: '2026-10-08' }]}
    status="ready" lang="en" t={t} activityType="muscle" weeks={12} compact referenceDate="2026-10-07"
  />);
  expect(screen.getByRole('heading')).toHaveTextContent('muscle_training.v3_history_title 12');
  expect(screen.getByRole('img')).toHaveAccessibleName('muscle_training.activity_title: muscle_training.activity_summary 2');
  expect(container.querySelectorAll('.st-activity-cell[data-level="4"]')).toHaveLength(2);
  expect(container.querySelectorAll('.st-activity-cell')).toHaveLength(84);
  expect(container.querySelector('.st-activity-legend')).not.toBeInTheDocument();
});

it('keeps the annual calendar and legend for existing callers', () => {
  const { container } = render(<RunActivityContributionGraph runs={[]} lang="en" t={t} referenceDate="2026-10-07" />);
  expect(container.querySelectorAll('.st-activity-week')).toHaveLength(53);
  expect(container.querySelector('.st-activity-legend')).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('settings.stitch_activity_title');
});
