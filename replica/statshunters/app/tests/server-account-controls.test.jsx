import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ExplorerProvider, useExplorer } from '../context.jsx';
import { DEFAULT_PREFS, EMPTY_FILTER } from '../core/model.js';
import ServerAccountControls from '../ui/ServerAccountControls.jsx';
import Settings from '../ui/Settings.jsx';
function ReadyControls(){const {prefs}=useExplorer();return prefs?<ServerAccountControls/>:null;}
function ReadySettings(){const {prefs}=useExplorer();return prefs?<Settings/>:null;}

describe('confirmed account controls',()=>{
  it('keeps the requested report checkbox state visible while saving, then confirms it',async()=>{
    let finish;let prefs={...DEFAULT_PREFS,reportEmail:'invented@example.test',reportEmailVerified:true};
    const saved=new Promise(resolve=>{finish=()=>{prefs={...prefs,reportsEnabled:true};resolve({enabled:true});};});
    const service={mode:'server',bootstrap:async()=>({opened:true,preferences:prefs}),getView:async()=>({preferences:prefs,filter:EMPTY_FILTER}),subscribe:()=>()=>{},getConnections:async()=>({capabilities:{email:true}}),updateEmailPreferences:()=>saved};
    render(<ExplorerProvider service={service}><ReadyControls/></ExplorerProvider>);
    const checkbox=await screen.findByRole('checkbox',{name:'Receive reports when available'});await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();expect(checkbox).toBeDisabled();
    await act(async()=>{finish();await saved;});await waitFor(()=>expect(checkbox).not.toBeDisabled());expect(checkbox).toBeChecked();
  });
  it('reverts a pending privacy choice when the server rejects it',async()=>{
    let fail;const saving=new Promise((_resolve,reject)=>{fail=()=>reject(new Error('Changes were not saved.'));});const prefs={...DEFAULT_PREFS};
    const service={mode:'server',bootstrap:async()=>({opened:true,preferences:prefs}),getView:async()=>({preferences:prefs,filter:EMPTY_FILTER}),subscribe:()=>()=>{},getConnections:async()=>({capabilities:{email:true}}),updatePreferences:()=>saving};
    render(<ExplorerProvider service={service}><ReadyControls/></ExplorerProvider>);
    const checkbox=await screen.findByRole('checkbox',{name:'Keep my history out of club maps'});await userEvent.click(checkbox);expect(checkbox).not.toBeChecked();
    await act(async()=>{fail();});await waitFor(()=>expect(checkbox).toBeChecked());expect(screen.getByText('Changes were not saved.')).toBeVisible();
  });
  it('saving display preferences never overwrites a separately confirmed club privacy choice',async()=>{
    let prefs={...DEFAULT_PREFS,hideFromClubs:false};
    const updatePreferences=vi.fn(async patch=>{prefs={...prefs,...patch};return prefs;});
    const service={mode:'server',bootstrap:async()=>({opened:true,preferences:prefs}),getView:async()=>({preferences:prefs,filter:EMPTY_FILTER}),subscribe:()=>()=>{},getConnections:async()=>({capabilities:{email:true}}),updatePreferences};
    render(<MemoryRouter><ExplorerProvider service={service}><ReadySettings/></ExplorerProvider></MemoryRouter>);
    const privacy=await screen.findByRole('checkbox',{name:'Keep my history out of club maps'});await userEvent.click(privacy);await waitFor(()=>expect(privacy).not.toBeDisabled());expect(privacy).toBeChecked();
    await userEvent.click(screen.getByRole('button',{name:'Save preferences',exact:true}));await waitFor(()=>expect(updatePreferences).toHaveBeenCalledTimes(2));
    expect(updatePreferences.mock.calls[1][0]).not.toHaveProperty('hideFromClubs');expect(prefs.hideFromClubs).toBe(true);
  });
});
