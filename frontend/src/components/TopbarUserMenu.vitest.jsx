import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import TopbarUserMenu from './TopbarUserMenu';
import messages from '../i18n/locales/en.js';

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ logout }) }));
vi.mock('../contexts/I18nContext', () => ({ useI18n: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], messages) || key }) }));
afterEach(() => { cleanup(); logout.mockClear(); });
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function mount(props = {}) { return render(<MemoryRouter initialEntries={['/shoes']}><TopbarUserMenu initials="P" label="Preview runner" showProfile {...props} /><Location /><button>Outside</button></MemoryRouter>); }
async function openConfirmation(user) {
  await user.click(screen.getByRole('button', { name: 'Preview runner' }));
  await user.click(screen.getByRole('button', { name: 'Log Out' }));
  return screen.getByRole('dialog', { name: 'Log out of Hermes?' });
}
it('requires explicit confirmation and defaults focus to Cancel', async () => {
  const user = userEvent.setup(); mount();
  const dialog = await openConfirmation(user);
  expect(logout).not.toHaveBeenCalled();
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(logout).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preview runner' })).toHaveFocus();
  expect(document.body).not.toHaveClass('modal-open');
});
it('closes confirmation on Escape or backdrop without signing out', async () => {
  const user = userEvent.setup(); mount();
  await openConfirmation(user);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Preview runner' })).toHaveFocus();
  await openConfirmation(user);
  await user.click(document.querySelector('.logout-confirm-shell'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(logout).not.toHaveBeenCalled();
});
it('invokes the existing logout action only once on confirmation', async () => {
  const user = userEvent.setup(); mount();
  const dialog = await openConfirmation(user);
  const confirm = within(dialog).getByRole('button', { name: 'Log Out' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(logout).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps the profile destination and custom edit-profile action', async () => {
  const user = userEvent.setup(); const view = mount();
  await user.click(screen.getByRole('button', { name: 'Preview runner' }));
  await user.click(screen.getByRole('button', { name: messages.profile.change_name }));
  expect(screen.getByTestId('location')).toHaveTextContent('/profile');
  view.unmount();
  const onOpenProfile = vi.fn(); mount({ onOpenProfile });
  await user.click(screen.getByRole('button', { name: 'Preview runner' }));
  await user.click(screen.getByRole('button', { name: messages.profile.change_name }));
  expect(onOpenProfile).toHaveBeenCalledOnce();
  expect(logout).not.toHaveBeenCalled();
});
it('closes the avatar menu on outside touch and restores focus on Escape', async () => {
  const user = userEvent.setup(); mount();
  const avatar = screen.getByRole('button', { name: 'Preview runner' });
  await user.click(avatar);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }), { pointerType: 'touch' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(avatar);
  await user.keyboard('{Escape}');
  expect(avatar).toHaveFocus();
});
