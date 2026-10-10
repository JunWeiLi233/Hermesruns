import { useEffect, useState } from 'react';
import { apiJson } from '../../api';
import Modal from '../../components/Modal';

/**
 * Confirms a Strava disconnect before it happens. Disconnecting is not a toggle: Strava's rules for
 * connected apps require HermesRuns to delete the runs it synced from Strava, so the runner is told that
 * first. The confirmation look is shared with the Runs delete dialog.
 */
export default function StravaDisconnectDialog({ t, isOpen, onClose, onDisconnected }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setBusy(false);
      setError('');
    }
  }, [isOpen]);

  function requestClose() {
    if (!busy) onClose();
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiJson('/api/auth/strava/unlink', { method: 'DELETE' });
      setBusy(false);
      onDisconnected(result || {});
    } catch {
      setBusy(false);
      setError(t('settings.stitch_strava_disconnect_error'));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title={t('settings.strava_disconnect_title')}
      closeLabel={t('profile.close')}
      shellClassName="runs-delete-modal-shell"
      cardClassName="runs-delete-modal-card"
    >
      <p className="runs-delete-modal-copy">{t('settings.strava_disconnect_copy')}</p>
      <p className="runs-delete-modal-warning">{t('settings.strava_disconnect_warning')}</p>
      {error ? <p className="st-dialog-error" role="alert">{error}</p> : null}
      <div className="runs-delete-modal-actions">
        <button type="button" className="btn-secondary" onClick={requestClose} disabled={busy}>
          {t('settings.dialog_cancel')}
        </button>
        <button type="button" className="runs-delete-modal-confirm" onClick={disconnect} disabled={busy}>
          {busy ? t('settings.strava_disconnecting') : t('settings.strava_disconnect_confirm')}
        </button>
      </div>
    </Modal>
  );
}
