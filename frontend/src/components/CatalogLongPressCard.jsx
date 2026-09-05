import { useCallback, useState } from 'react';
import { getCatalogTargetKey, useCatalogLongPress } from '../hooks/useCatalogLongPress.js';

export default function CatalogLongPressCard({
  target,
  children,
  deleteLabel,
  confirmMessage,
  onDelete,
  onRequestDelete,
  onError,
  deleteMode = false,
  footerAction = null,
}) {
  const [busy, setBusy] = useState(false);
  const targetKey = getCatalogTargetKey(target);

  const handleDelete = useCallback(async (deleteTarget) => {
    if (!deleteTarget || busy) return;
    if (onRequestDelete) {
      onRequestDelete(deleteTarget, onDelete);
      return;
    }
    if (!window.confirm(confirmMessage)) return;

    setBusy(true);
    try {
      await onDelete(deleteTarget);
    } catch {
      onError?.();
    } finally {
      setBusy(false);
    }
  }, [busy, confirmMessage, onDelete, onError, onRequestDelete]);

  const gesture = useCatalogLongPress(handleDelete);
  const isDeleteReady = Boolean(deleteMode || (targetKey && gesture.readyKey === targetKey));

  const isCatalogAction = (event) => event.target.closest?.('[data-catalog-delete-action], [data-catalog-card-action]');
  const handlePointerDown = (event) => {
    if (isCatalogAction(event)) return;
    gesture.begin(target, event);
  };
  const handlePointerMove = (event) => {
    if (isCatalogAction(event)) return;
    gesture.move(target, event);
  };
  const handlePointerUp = (event) => {
    if (isCatalogAction(event)) return;
    gesture.finish(target, event);
  };
  const handlePointerCancel = (event) => {
    if (isCatalogAction(event)) return;
    gesture.cancel(target);
  };
  const handleContextMenu = (event) => {
    if (isCatalogAction(event)) return;
    event.preventDefault();
  };

  return (
    <div
      className={`admin-shoe-catalog-browser__card-shell${isDeleteReady ? ' is-delete-ready' : ''}`}
      role="listitem"
      onPointerDown={target ? handlePointerDown : undefined}
      onPointerMove={target ? handlePointerMove : undefined}
      onPointerUp={target ? handlePointerUp : undefined}
      onPointerCancel={target ? handlePointerCancel : undefined}
      onContextMenu={target ? handleContextMenu : undefined}
      onClickCapture={(event) => {
        if (isCatalogAction(event)) return;
        gesture.consumeClick(event);
      }}
    >
      {children}
      {footerAction}
      {(target || deleteMode) && (
        <button
          type="button"
          className={`admin-shoe-catalog-browser__delete-action${deleteMode ? ' is-visible' : ''}`}
          data-catalog-delete-action="true"
          aria-label={deleteLabel}
          disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleDelete(target);
          }}
        >
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
