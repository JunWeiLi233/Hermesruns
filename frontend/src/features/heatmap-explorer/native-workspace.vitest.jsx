import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, it, vi } from 'vitest';
import App from './App.jsx';
import { ExplorerRoutesProvider } from './router.jsx';
import { createLocalApi } from './core/api.js';
import { memoryStore } from './core/store.js';

vi.mock('./ui/TrackMap.jsx', () => ({default: () => <div role="region" aria-label="Recorded geometry"/>}));

async function mount(path = '/heatmap') {
  const api = createLocalApi(memoryStore());
  await api.openWorkspace();
  await api.loadExamples();
  const result = render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/heatmap/*" element={<ExplorerRoutesProvider basePath="/heatmap"><App service={api} embedded/></ExplorerRoutesProvider>}/></Routes></MemoryRouter>);
  return {...result, api};
}

it('opens the real workspace inside the native route and keeps history/statistics navigation there', async () => {
  const {unmount, api} = await mount();
  expect(await screen.findByRole('heading', {name: 'Places become familiar.'})).toBeVisible();
  expect(screen.getByRole('link', {name: 'Activities', exact: true})).toHaveAttribute('href', '/heatmap/activities');
  fireEvent.click(screen.getByRole('link', {name: 'Activities', exact: true}));
  expect(await screen.findByRole('table')).toBeVisible();
  fireEvent.click(screen.getByRole('link', {name: 'Statistics', exact: true}));
  expect(await screen.findByRole('heading', {name: 'Small days add up.'})).toBeVisible();
  expect(screen.queryByText('HERMES')).not.toBeInTheDocument();
  expect(document.querySelector('iframe')).toBeNull();
  unmount(); api.dispose();
});

it('opens a descendant directly after refresh without leaving /heatmap', async () => {
  const {unmount, api} = await mount('/heatmap/statistics');
  expect(await screen.findByRole('heading', {name: 'Small days add up.'})).toBeVisible();
  expect(screen.getByRole('link', {name: 'Map', exact: true})).toHaveAttribute('href', '/heatmap');
  unmount(); api.dispose();
});
it('consumes an anonymous capability under the same parent heatmap route', async () => {
  const token='a'.repeat(64), unsubscribe=vi.fn(async()=>({enabled: false}));
  const service={mode: 'server', bootstrap: async()=>({opened: false, preferences: {language: 'en'}}), subscribe: ()=>()=>{}, unsubscribe};
  render(<MemoryRouter initialEntries={[`/heatmap/unsubscribe?token=${token}`]}><Routes><Route path="/heatmap/*" element={<ExplorerRoutesProvider basePath="/heatmap"><App service={service} embedded/></ExplorerRoutesProvider>}/></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', {name: 'Unsubscribe', exact: true}));
  expect(await screen.findByText('Report email is turned off.')).toBeVisible();
  expect(unsubscribe).toHaveBeenCalledWith(token);
});
