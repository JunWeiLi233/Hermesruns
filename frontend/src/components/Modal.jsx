import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const openModals = [];
const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let bodyHadModalOpenClass = false;

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function isHiddenByCss(element) {
  let currentElement = element;

  while (currentElement) {
    const styles = currentElement.ownerDocument.defaultView?.getComputedStyle(currentElement);
    if (styles?.display === 'none' || styles?.visibility === 'hidden' || styles?.visibility === 'collapse') {
      return true;
    }
    currentElement = currentElement.parentElement;
  }

  return false;
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(focusableSelector)).filter((element) => (
    !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && !element.matches(':disabled')
    && !isHiddenByCss(element)
    && element.tabIndex >= 0
  ));
}

function sortOpenModalsByDocumentOrder() {
  openModals.sort((left, right) => {
    const leftCard = left.cardRef.current;
    const rightCard = right.cardRef.current;
    if (!leftCard || !rightCard || leftCard === rightCard) return 0;

    const position = leftCard.compareDocumentPosition(rightCard);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

function isTopmostModal(modalEntry) {
  return openModals[openModals.length - 1] === modalEntry;
}

function registerOpenModal(modalEntry) {
  if (openModals.length === 0) {
    bodyHadModalOpenClass = document.body.classList.contains('modal-open');
  }

  openModals.push(modalEntry);
  sortOpenModalsByDocumentOrder();
  document.body.classList.add('modal-open');
}

function unregisterOpenModal(modalEntry) {
  const modalIndex = openModals.indexOf(modalEntry);
  if (modalIndex >= 0) {
    openModals.splice(modalIndex, 1);
  }

  if (openModals.length === 0) {
    if (!bodyHadModalOpenClass) {
      document.body.classList.remove('modal-open');
    }
    bodyHadModalOpenClass = false;
  }
}

export default function Modal({ isOpen, onClose, title, children, icon = null, headerContent = null, closeLabel = 'Close', shellClassName = '', cardClassName = '', portalToBody = false, adminDashboard = false }) {
  const cardRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const modalEntryRef = useRef({ cardRef });
  const reactTitleId = useId();
  const titleId = `modal-title-${reactTitleId.replace(/:/g, '')}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const modalEntry = modalEntryRef.current;
    const previouslyFocused = document.activeElement;
    registerOpenModal(modalEntry);

    const card = cardRef.current;
    if (card && isTopmostModal(modalEntry) && !card.contains(document.activeElement)) {
      const preferredFocus = card.querySelector('[autofocus], [data-modal-initial-focus]');
      const formFocus = getFocusableElements(card.querySelector('.modal-form'))[0];
      const cardFocusables = getFocusableElements(card);
      const firstFocus = cardFocusables[0];
      const initialFocus = cardFocusables.includes(preferredFocus) ? preferredFocus : formFocus || firstFocus || card;
      initialFocus.focus();
    }

    function handleKeyDown(event) {
      if (!isTopmostModal(modalEntry)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const currentCard = cardRef.current;
      const focusableElements = getFocusableElements(currentCard);
      if (focusableElements.length === 0) {
        event.preventDefault();
        currentCard?.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!currentCard?.contains(activeElement) || !focusableElements.includes(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastFocusable : firstFocusable).focus();
      } else if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const wasTopmost = isTopmostModal(modalEntry);
      unregisterOpenModal(modalEntry);

      if (wasTopmost && previouslyFocused?.isConnected && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const content = (
    <div className={joinClasses('modal-shell', adminDashboard && 'admin-dashboard-modal-shell', shellClassName)} onClick={handleOverlayClick} role="presentation">
      <div ref={cardRef} className={joinClasses('modal-card', adminDashboard && 'admin-dashboard-modal-card', cardClassName)} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-header">
          {headerContent ? (
            <div className="modal-header-main">
              {headerContent}
              <h3 id={titleId}>{title}</h3>
            </div>
          ) : (
            <>
              {icon ? <div className="modal-header-icon" aria-hidden="true">{icon}</div> : null}
              <h3 id={titleId}>{title}</h3>
            </>
          )}
          <button type="button" className="modal-close" onClick={onClose} aria-label={closeLabel}>
            &times;
          </button>
        </div>
        <div className="modal-form">
          {children}
        </div>
      </div>
    </div>
  );

  return portalToBody && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
}
