import { useState } from 'react';
import { apiFetch } from '../api';
import { downloadBlob, filenameFromDisposition } from '../utils/downloadBlob';

/** The runner's rights over their own data: download a copy, or delete the account. */
export default function SettingsDataCard({ t, onRequestDeleteAccount }) {
  const [includeTracks, setIncludeTracks] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function downloadExport() {
    setExporting(true);
    setMessage('');
    setFailed(false);
    try {
      const response = await apiFetch(`/api/account/export?tracks=${includeTracks ? 'true' : 'false'}`);
      if (!response.ok) {
        setFailed(true);
        setMessage(response.status === 429 ? t('settings.export_busy') : t('settings.export_error'));
        return;
      }
      const blob = await response.blob();
      downloadBlob(blob, filenameFromDisposition(response.headers.get('content-disposition'), 'hermes-export.zip'));
      setMessage(t('settings.export_started'));
    } catch {
      setFailed(true);
      setMessage(t('settings.export_error'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <h3 className="st-v2-group-label st-v2-subgroup-label">{t('settings.data_group_title')}</h3>
      <div className="st-v2-card">
        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <strong>{t('settings.export_title')}</strong>
            <span>{t('settings.export_copy')}</span>
            <label className="st-v2-option">
              <input
                type="checkbox"
                checked={includeTracks}
                disabled={exporting}
                onChange={(event) => setIncludeTracks(event.target.checked)}
              />
              {t('settings.export_tracks')}
            </label>
            {message ? <span role={failed ? 'alert' : 'status'}>{message}</span> : null}
          </div>
          <button type="button" className="st-v2-btn" onClick={downloadExport} disabled={exporting}>
            {exporting ? t('settings.export_preparing') : t('settings.export_button')}
          </button>
        </div>
        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <strong className="st-v2-danger">{t('settings.delete_title')}</strong>
            <span>{t('settings.delete_copy')}</span>
          </div>
          <button type="button" className="st-v2-btn is-danger" onClick={onRequestDeleteAccount}>
            {t('settings.delete_button')}
          </button>
        </div>
      </div>
    </>
  );
}
