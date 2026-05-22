import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import ImportDataGuide from '../components/ImportDataGuide';
import { useI18n } from '../contexts/I18nContext';

function countFiles(fileList) {
  return fileList ? fileList.length : 0;
}

export default function ImportDataSettings() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [importStatusTone, setImportStatusTone] = useState('ready');
  const [importing, setImporting] = useState(false);

  const totalSelectedFiles = countFiles(fitExportFiles) + countFiles(corosFiles) + countFiles(huaweiFiles);
  const activeSources = [fitExportFiles, corosFiles, huaweiFiles].filter((files) => countFiles(files) > 0).length;

  const sourceCards = useMemo(() => ([
    {
      key: 'fit-export',
      title: t('profile.fit_export_source_title'),
      hint: t('profile.fit_export_source_hint'),
      label: t('profile.fit_export_file_label'),
      tag: 'FIT / GPX',
      files: fitExportFiles,
      onChange: setFitExportFiles,
    },
    {
      key: 'coros',
      title: t('profile.coros_source_title'),
      hint: t('profile.coros_source_hint'),
      label: t('profile.coros_file_label'),
      tag: 'COROS',
      files: corosFiles,
      onChange: setCorosFiles,
    },
    {
      key: 'huawei',
      title: t('profile.huawei_source_title'),
      hint: t('profile.huawei_source_hint'),
      label: t('profile.huawei_file_label'),
      tag: 'HUAWEI',
      files: huaweiFiles,
      onChange: setHuaweiFiles,
    },
  ]), [corosFiles, fitExportFiles, huaweiFiles, t]);

  async function handleImport(event) {
    event.preventDefault();
    if (totalSelectedFiles === 0 || importing) return;

    const formData = new FormData();

    Array.from(fitExportFiles || []).forEach((file) => formData.append('exports', file));
    Array.from(corosFiles || []).forEach((file) => formData.append('coros', file));
    Array.from(huaweiFiles || []).forEach((file) => formData.append('huawei', file));

    setImporting(true);
    setImportStatus('');
    setImportStatusTone('active');

    try {
      const response = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!response.ok) throw new Error();
      setImportStatus(t('settings.stitch_import_success'));
      setImportStatusTone('success');
    } catch {
      setImportStatus(t('profile.import_failed'));
      setImportStatusTone('error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <AuthenticatedPageChrome bodyClassName="import-data-page-shell">
      <section className="import-data-page">
        <header className="import-data-page-header">
          <button type="button" className="import-data-page-back" onClick={() => navigate('/settings')}>
            <span aria-hidden="true">&larr;</span>
            <span>{t('profile.settings')}</span>
          </button>

          <div className="import-data-page-heading">
            <div className="import-data-page-kicker-row">
              <span className="import-data-page-kicker-line" aria-hidden="true" />
              <span>{t('settings.heading')}</span>
            </div>
            <h1>{t('profile.import_modal_title')}</h1>
            <p>{t('profile.import_hint')}</p>
          </div>

          <div className={`import-data-page-status import-data-page-status--${importStatus ? importStatusTone : 'ready'}`}>
            <span>{t('profile.import_data')}</span>
            <strong>{importStatus || t('settings.stitch_manual_import_ready')}</strong>
          </div>
        </header>

        <form onSubmit={handleImport} className="import-data-page-card">
          <section className="import-data-page-hero">
            <div className="import-data-page-hero-main">
              <div className="import-data-page-hero-copy">
                <div className="import-data-page-kicker-row">
                  <span className="import-data-page-kicker-line" aria-hidden="true" />
                  <span>{t('settings.stitch_data_ecosystem')}</span>
                </div>
                <strong>{t('settings.stitch_manual_import_hint')}</strong>
                <p>{t('profile.import_batch_hint')}</p>
              </div>

              <div className="import-data-page-hero-metrics">
                <article className="import-data-page-metric">
                  <span>{t('profile.upload_file')}</span>
                  <strong>{totalSelectedFiles}</strong>
                </article>
                <article className="import-data-page-metric">
                  <span>{t('settings.stitch_data_ecosystem')}</span>
                  <strong>{activeSources}</strong>
                </article>
                <article className="import-data-page-metric">
                  <span>{t('profile.import_data')}</span>
                  <strong>{importing ? t('profile.heatmap_loading') : t('settings.stitch_ready_short')}</strong>
                </article>
              </div>
            </div>
          </section>

          <section className="import-data-page-lanes">
            <div className="import-data-page-lane-grid">
              {sourceCards.map((card) => (
                <article key={card.key} className="import-source-card import-data-source-card">
                  <div className="import-source-header">
                    <div className="import-source-copy">
                      <span className="import-source-title">{card.title}</span>
                      <span className="import-source-hint">{card.hint}</span>
                    </div>
                    <span className="import-source-tag">{card.tag}</span>
                  </div>

                  <label className="modal-label" htmlFor={`import-data-${card.key}`}>{card.label}</label>
                  <input
                    id={`import-data-${card.key}`}
                    type="file"
                    accept=".gpx,.tcx,.fit,.zip"
                    multiple
                    onChange={(event) => card.onChange(event.target.files)}
                    disabled={importing}
                  />
                  <p className="selected-file-name">
                    {countFiles(card.files) ? t('profile.selected_files_count', { count: countFiles(card.files) }) : t('profile.no_file_selected')}
                  </p>
                </article>
              ))}

              <article className="import-data-command-lane">
                <div className="import-data-command-copy">
                  <div className="import-data-page-kicker-row">
                    <span className="import-data-page-kicker-line" aria-hidden="true" />
                    <span>{t('profile.import_data')}</span>
                  </div>
                  <strong>{t('profile.upload_file')}</strong>
                  <p>{t('profile.import_hint')}</p>
                </div>

                <div className="import-data-command-stats">
                  <div>
                    <span>{t('profile.fit_export_file_label')}</span>
                    <strong>{countFiles(fitExportFiles)}</strong>
                  </div>
                  <div>
                    <span>{t('profile.coros_file_label')}</span>
                    <strong>{countFiles(corosFiles)}</strong>
                  </div>
                  <div>
                    <span>{t('profile.huawei_file_label')}</span>
                    <strong>{countFiles(huaweiFiles)}</strong>
                  </div>
                </div>

                <p className="import-summary-line">{t('profile.import_batch_hint')}</p>
                {importStatus ? <div className={`modal-status import-data-command-status is-${importStatusTone}`}>{importStatus}</div> : null}

                <div className="import-data-command-actions">
                  <button type="button" className="btn-secondary modal-button" onClick={() => navigate('/settings')} disabled={importing}>
                    {t('profile.cancel')}
                  </button>
                  <button type="submit" className="btn-primary modal-button" disabled={importing || totalSelectedFiles === 0}>
                    {importing ? t('profile.heatmap_loading') : t('profile.upload_file')}
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section className="import-data-page-guide">
            <ImportDataGuide />
          </section>
        </form>
      </section>
    </AuthenticatedPageChrome>
  );
}
