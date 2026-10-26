import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import useSectionSearchParams from './useSectionSearchParams';

afterEach(cleanup);

function Filters() {
  const [params, setParams] = useSectionSearchParams();
  const location = useLocation();
  return <>
    <output>{location.pathname}{location.search}{location.hash}</output>
    <button type="button" onClick={() => setParams(current => {
      current.set('metric', 'cadence');
      return current;
    }, { replace: true })}>{params.get('metric') || 'pace'}</button>
  </>;
}

it('changes an embedded filter without dropping the parent page, another feature’s choice, or its anchor', () => {
  render(<MemoryRouter initialEntries={['/analysis?days=90&view=totals#analysis-trends']}><Filters /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'pace' }));
  expect(screen.getByRole('status')).toHaveTextContent('/analysis?days=90&view=totals&metric=cadence#analysis-trends');
});
