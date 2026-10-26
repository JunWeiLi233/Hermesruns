import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import HeatmapDatasetSync from '../HeatmapDatasetSync.jsx';

const state=vi.hoisted(()=>({revision: 1, resource: vi.fn(), map: vi.fn(async()=>{})}));
vi.mock('../../../features/heatmap-explorer/context.jsx',()=>({useExplorer:()=>({view:{revision:state.revision}})}));
vi.mock('../../../api/resourceCache',()=>({invalidateResourceCache:state.resource}));
vi.mock('../../../utils/heatmap/cache.js',()=>({invalidateHeatmapCache:state.map}));
it('invalidates the owning Hermes history once per committed revision and resets on identity change',()=>{
  const listener=vi.fn();window.addEventListener('hermes-recommendations-changed',listener);
  const view=render(<HeatmapDatasetSync email="owner@example.test"/>);
  expect(state.resource).not.toHaveBeenCalled();
  state.revision=2;view.rerender(<HeatmapDatasetSync email="owner@example.test"/>);
  expect(state.resource.mock.calls).toEqual([['/api/activities'],['/api/profile']]);
  expect(state.map).toHaveBeenCalledWith('owner@example.test');
  expect(listener).toHaveBeenCalledOnce();
  view.rerender(<HeatmapDatasetSync email="owner@example.test"/>);
  view.rerender(<HeatmapDatasetSync email="other@example.test"/>);
  expect(listener).toHaveBeenCalledOnce();
  window.removeEventListener('hermes-recommendations-changed',listener);
});
