import { expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ExplorerProvider } from '../context.jsx';
import { createLocalApi } from '../core/api.js';
import { memoryStore } from '../core/store.js';
import Access from '../ui/Access.jsx';
function setup(){const api=createLocalApi(memoryStore());const result=render(<MemoryRouter><ExplorerProvider service={api}><Access/></ExplorerProvider></MemoryRouter>);return {api,...result};}
it('focuses invalid account email before attempting authentication',async()=>{const {api,unmount}=setup();const user=userEvent.setup();await user.type(screen.getByLabelText('Email address'),'incomplete');await user.click(screen.getByRole('button',{name:'Sign in',exact:true}));await waitFor(()=>expect(screen.getByLabelText('Email address')).toHaveFocus());expect((await api.bootstrap()).opened).toBe(false);unmount();api.dispose();});
it('does not show a recovery success when the mail service is unavailable',async()=>{const {api,unmount}=setup();const user=userEvent.setup();await user.click(screen.getByRole('radio',{name:'Recover access',exact:true}));await user.type(screen.getByLabelText('Email address'),'person@example.invalid');await user.click(screen.getByRole('button',{name:'Request recovery instructions',exact:true}));expect(await screen.findByRole('alert')).toHaveTextContent('No message was sent');expect(screen.queryByText('If this address is eligible, account recovery instructions will be sent.')).not.toBeInTheDocument();unmount();api.dispose();});
