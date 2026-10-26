import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import AnalysisFeatureRedirect from './AnalysisFeatureRedirect';

afterEach(cleanup);

function ExistingPage() {
  const { pathname, search, hash } = useLocation();
  return <output>{pathname}{search}{hash}</output>;
}

it.each([
  ['/analysis/trends', '/analysis', 'analysis-trends'],
  ['/analysis/vo2max-estimates', '/analysis', 'vo2max-estimates'],
  ['/analysis/pace-curve', '/analysis', 'pace-curve'],
  ['/analysis/quality-sessions', '/analysis/intensity', 'quality-sessions'],
  ['/training-log', '/runs', 'training-log'],
])('moves saved %s links into an existing page while retaining their filters', async (old, pathname, anchor) => {
  render(<MemoryRouter initialEntries={[`${old}?range=1y&metric=pace`]}><Routes>
    <Route path={old} element={<AnalysisFeatureRedirect pathname={pathname} anchor={anchor} />} />
    <Route path={pathname} element={<ExistingPage />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByRole('status')).toHaveTextContent(`${pathname}?range=1y&metric=pace#${anchor}`);
});
