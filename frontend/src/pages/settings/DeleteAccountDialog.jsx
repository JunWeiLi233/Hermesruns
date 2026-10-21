import { useEffect, useState } from 'react';
import { apiJson } from '../../api';
import Modal from '../../components/Modal';

/** The word the server insists on; it is not translated because the API compares it exactly. */
const CONFIRMATION_WORD = 'DELETE';

/**
 * Deletes the signed-in account and everything in it. The runner has to type DELETE, so a stray click
 * cannot do it. The confirmation look is shared with the Runs delete dialog.
 */
export default function DeleteAccountDialog({ t, isOpen, onClose, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTyped('');
      setBusy(false);
      setError('');
    }
  }, [isOpen]);

  const confirmed = typed.trim() === CONFIRMATION_WORD;

  function requestClose() {
    if (!busy) onClose();
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiJson('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: CONFIRMATION_WORD }),
      });
      onDeleted();
    } catch (failure) {
      setBusy(false);
      setError(failure?.status === 403 ? t('settings.delete_admin_refused') : t('settings.delete_error'));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title={t('settings.delete_dialog_title')}
      closeLabel={t('profile.close')}
      shellClassName="runs-delete-modal-shell"
      cardClassName="runs-delete-modal-card"
    >
      <form onSubmit={deleteAccount}>
        <p className="runs-delete-modal-copy">{t('settings.delete_dialog_copy')}</p>
        <p className="runs-delete-modal-warning">{t('settings.delete_dialog_warning')}</p>
        <label className="st-dialog-field" htmlFor="st-delete-confirmation">
          <span>{t('settings.delete_type_prompt')}</span>
          <input
            id="st-delete-confirmation"
            className="st-dialog-input"
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={busy}
          />
        </label>
        {error ? <p className="st-dialog-error" role="alert">{error}</p> : null}
        <div className="runs-delete-modal-actions">
          <button type="button" className="btn-secondary" onClick={requestClose} disabled={busy}>
            {t('settings.dialog_cancel')}
          </button>
          <button type="submit" className="runs-delete-modal-confirm" disabled={!confirmed || busy}>
            {busy ? t('settings.delete_in_progress') : t('settings.delete_confirm_button')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
