import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ExplorerProvider } from '../context.jsx';
import { createLocalApi } from '../core/api.js';
import { memoryStore } from '../core/store.js';
import Filters from '../ui/Filters.jsx';
describe('filter interaction',()=>{
  async function setup(units='km'){const api=createLocalApi(memoryStore());await api.openWorkspace();await api.loadExamples();await api.updatePreferences({...api.defaults,units});const result=render(<MemoryRouter><ExplorerProvider service={api}><ReadyFilters/></ExplorerProvider></MemoryRouter>);return {api,...result};}
  function ReadyFilters(){return <Consumer/>;}
  it('focuses the first invalid range and does not commit its draft',async()=>{const {api,unmount}=await setup();const user=userEvent.setup();await user.type(await screen.findByLabelText('Minimum distance (km)'),'9');await user.type(screen.getByLabelText('Maximum distance (km)'),'2');await user.click(screen.getByRole('button',{name:'Apply filters'}));expect(screen.getByLabelText('Minimum distance (km)')).toHaveFocus();expect((await api.getView()).filter.min).toBe('');unmount();api.dispose();});
  it('converts imperial criteria once and commits them as kilometres',async()=>{const {api,unmount}=await setup('mi');const user=userEvent.setup();await user.type(await screen.findByLabelText('Minimum distance (mi)'),'1');await user.click(screen.getByRole('button',{name:'Apply filters'}));expect(Number((await api.getView()).filter.min)).toBeCloseTo(1.609344);unmount();api.dispose();});
});
import { useExplorer } from '../context.jsx';
function Consumer(){const {view}=useExplorer();return view?<Filters onDone={()=>{}}/>:null;}
