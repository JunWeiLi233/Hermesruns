import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import Modal from './Modal';

afterEach(() => {
  cleanup();
  document.body.classList.remove('modal-open');
});

function FocusHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open profile editor</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit profile">
        <label htmlFor="display-name">Display name</label>
        <input id="display-name" />
        <button type="button">Save profile</button>
      </Modal>
    </>
  );
}

function NestedModalHarness() {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOuterOpen(true)}>Open settings</button>
      <Modal isOpen={outerOpen} onClose={() => setOuterOpen(false)} title="Settings">
        <button type="button" onClick={() => setInnerOpen(true)}>Open confirmation</button>
        <Modal
          isOpen={innerOpen}
          onClose={() => setInnerOpen(false)}
          title="Confirm change"
          portalToBody
        >
          <button type="button">Confirm</button>
        </Modal>
      </Modal>
    </>
  );
}

function SynchronousNestedModalHarness({ onOuterClose, onInnerClose }) {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(true);

  return (
    <Modal
      isOpen={outerOpen}
      onClose={() => flushSync(() => {
        onOuterClose();
        setOuterOpen(false);
      })}
      title="Outer dialog"
    >
      <button type="button">Outer action</button>
      <Modal
        isOpen={innerOpen}
        onClose={() => flushSync(() => {
          onInnerClose();
          setInnerOpen(false);
        })}
        title="Inner dialog"
        portalToBody
      >
        <button type="button">Inner action</button>
      </Modal>
    </Modal>
  );
}

describe('Modal', () => {
  it('associates each dialog with its own visible title', () => {
    render(
      <>
        <Modal isOpen onClose={() => {}} title="First dialog" headerContent={<span>Current selection</span>}>
          First body
        </Modal>
        <Modal isOpen onClose={() => {}} title="Second dialog">Second body</Modal>
      </>,
    );

    const firstDialog = screen.getByRole('dialog', { name: 'First dialog' });
    const secondDialog = screen.getByRole('dialog', { name: 'Second dialog' });
    const firstTitleId = firstDialog.getAttribute('aria-labelledby');
    const secondTitleId = secondDialog.getAttribute('aria-labelledby');

    expect(firstDialog).toHaveAttribute('aria-modal', 'true');
    expect(firstTitleId).toBeTruthy();
    expect(secondTitleId).toBeTruthy();
    expect(firstTitleId).not.toBe(secondTitleId);
    expect(document.getElementById(firstTitleId)).toHaveTextContent('First dialog');
    expect(document.getElementById(secondTitleId)).toHaveTextContent('Second dialog');
  });

  it('moves focus into the form, contains keyboard focus, and restores the trigger on close', async () => {
    const user = userEvent.setup();
    render(<FocusHarness />);

    const trigger = screen.getByRole('button', { name: 'Open profile editor' });
    await user.click(trigger);

    const input = screen.getByRole('textbox', { name: 'Display name' });
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const saveButton = screen.getByRole('button', { name: 'Save profile' });
    expect(input).toHaveFocus();

    saveButton.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(saveButton).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('skips controls hidden by CSS when choosing and containing focus', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={() => {}} title="Visibility test">
        <button type="button" style={{ display: 'none' }}>Display hidden</button>
        <div style={{ display: 'none' }}>
          <button type="button">Display ancestor hidden</button>
        </div>
        <button type="button" style={{ visibility: 'hidden' }}>Visibility hidden</button>
        <div style={{ visibility: 'hidden' }}>
          <button type="button">Ancestor hidden</button>
        </div>
        <button type="button">Visible action</button>
      </Modal>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close' });
    const visibleButton = screen.getByRole('button', { name: 'Visible action' });
    expect(visibleButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(visibleButton).toHaveFocus();
  });

  it('lets only the topmost dialog handle Escape and keeps scroll locked until all dialogs close', async () => {
    const user = userEvent.setup();
    render(<NestedModalHarness />);

    const outerTrigger = screen.getByRole('button', { name: 'Open settings' });
    await user.click(outerTrigger);
    const innerTrigger = screen.getByRole('button', { name: 'Open confirmation' });
    await user.click(innerTrigger);

    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(document.body).toHaveClass('modal-open');
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Confirm change' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(document.body).toHaveClass('modal-open');
    expect(innerTrigger).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('modal-open');
    expect(outerTrigger).toHaveFocus();
  });

  it('does not pass one Escape press to a parent after the top dialog closes synchronously', async () => {
    const user = userEvent.setup();
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(
      <SynchronousNestedModalHarness
        onOuterClose={onOuterClose}
        onInnerClose={onInnerClose}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Outer dialog' })).toBeInTheDocument();
  });

  it('closes for the close button and backdrop, but not for clicks inside the card', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose} title="Click behavior">
        <button type="button">Inside action</button>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Inside action' }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.querySelector('.modal-shell'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
