import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation as useHostLocation } from 'react-router';
import { expect, it } from 'vitest';
import { ExplorerRoutesProvider, Link, useLocation, useNavigate } from './router.jsx';

function Content() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><span>{location.pathname}</span><Link to="/map">Map</Link><Link to="/activity/42">Activity</Link><button onClick={() => navigate('/settings')}>Preferences</button></>;
}
function Address() { return <output>{useHostLocation().pathname}</output>; }

it('keeps workspace links and actions under the native heatmap route', () => {
  render(<MemoryRouter initialEntries={['/heatmap/statistics']}><Address/><Routes><Route path="/heatmap/*" element={<ExplorerRoutesProvider basePath="/heatmap"><Content/></ExplorerRoutesProvider>}/></Routes></MemoryRouter>);
  expect(screen.getByRole('link', {name: 'Map'})).toHaveAttribute('href', '/heatmap');
  expect(screen.getByRole('link', {name: 'Activity'})).toHaveAttribute('href', '/heatmap/activity/42');
  expect(screen.getByText('/statistics')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name: 'Preferences'}));
  expect(screen.getByRole('status')).toHaveTextContent('/heatmap/settings');
});

it('maps the native heatmap root to the workspace map without a redirect loop', () => {
  render(<MemoryRouter initialEntries={['/heatmap']}><ExplorerRoutesProvider basePath="/heatmap"><Content/></ExplorerRoutesProvider></MemoryRouter>);
  expect(screen.getByText('/map')).toBeVisible();
});

it('preserves standalone route behavior', () => {
  render(<MemoryRouter initialEntries={['/statistics']}><Content/></MemoryRouter>);
  expect(screen.getByRole('link', {name: 'Map'})).toHaveAttribute('href', '/map');
});
