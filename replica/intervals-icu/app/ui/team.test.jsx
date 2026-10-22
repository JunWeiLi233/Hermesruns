import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Team from '../screens/S24.jsx';
const { updateMember } = vi.hoisted(() => ({ updateMember: vi.fn() }));
vi.mock('./workspace.jsx', () => ({
  useWorkspace: () => ({ api: { updateMember } }),
  useResource: () => ({ data: { items: [{ id: 'team', name: 'Sample group', ownRole: 'admin', scopeRevision: 1, revision: 1, posting: 'members', visibility: 'members', members: [{ userId: 'new', name: 'New member', role: 'member', state: 'pending' }] }] } }),
  useCommand: () => ({ run: fn => fn() })
}));
afterEach(cleanup);
it('offers explicit approval for a pending membership with its existing role', () => {
  render(<MemoryRouter><Team /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Approve New member' }));
  expect(updateMember).toHaveBeenCalledWith({ teamId: 'team', userId: 'new', role: 'member' });
});
