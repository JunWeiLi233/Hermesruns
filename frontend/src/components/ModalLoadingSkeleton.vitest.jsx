import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Modal from './Modal';
import ModalLoadingSkeleton from './ModalLoadingSkeleton';
import { I18nProvider } from '../contexts/I18nContext';

beforeEach(() => localStorage.setItem('hermes_lang', 'en'));
afterEach(() => { cleanup(); localStorage.clear(); });

it('retains the real dialog title, close action, and focus trap during structured loading', async () => {
  const close = vi.fn();
  await act(async () => render(<I18nProvider><Modal isOpen title="Compare sessions" onClose={close}><ModalLoadingSkeleton variant="session-comparison" /></Modal></I18nProvider>));
  const dialog = screen.getByRole('dialog', { name: 'Compare sessions' });
  const closeButton = within(dialog).getByRole('button', { name: 'Close' });
  expect(dialog).toContainElement(document.activeElement);
  expect(within(dialog).getAllByRole('status')).toHaveLength(1);
  expect(dialog.querySelector('[aria-busy="true"] .hr-sk')).toBeInTheDocument();
  expect(dialog.querySelector('input, select, textarea')).toBeNull();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(closeButton).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
