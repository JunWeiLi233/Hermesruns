import { useCallback, useId, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';
import AppIcon from './AppIcon';
import Modal from './Modal';

/*
 * Shared "Import training data" modal (design 13a).
 * Source tabs (FIT/GPX · COROS · Huawei) + one drop zone + a mixed file queue.
 * Posts to the same endpoint and field names as the old per-page modals:
 *   POST /api/import/batch  with fields `exports`, `coros`, `huawei`.
 *
 * `ImportActivityForm` is the same flow without the modal chrome; /settings/import-data renders it inline (design 24a).
 */

const SOURCES = [
  { key: 'fit', field: 'exports', tag: 'FIT/GPX', titleKey: 'profile.fit_export_source_title', hintKey: 'profile.fit_export_source_hint', ext: '.fit .gpx .tcx .zip .gz' },
  { key: 'coros', field: 'coros', tag: 'COROS', titleKey: 'profile.coros_source_title', hintKey: 'profile.coros_source_hint', ext: '.fit .gpx .tcx .zip .gz' },
  { key: 'huawei', field: 'huawei', tag: 'HUAWEI', titleKey: 'profile.huawei_source_title', hintKey: 'profile.huawei_source_hint', ext: '.gpx .tcx .fit .zip .gz' },
];
// .gz is a gzipped workout file (run.fit.gz), the form Strava's account export uses.
const ACCEPT = '.gpx,.tcx,.fit,.zip,.gz';

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileExt(name) {
  const parts = String(name || '').split('.');
  if (parts.length < 2) return 'FILE';
  let ext = parts.pop();
  if (ext.toLowerCase() === 'gz' && parts.length > 1) ext = parts.pop(); // run.fit.gz is a FIT file
  return ext ? ext.toUpperCase().slice(0, 4) : 'FILE';
}

export default function ImportActivityModal({ isOpen, onClose, onImported, t }) {
  return isOpen ? <ImportActivityDialog onClose={onClose} onImported={onImported} t={t} /> : null;
}

function ImportActivityDialog({ onClose, onImported, t }) {
  const busyRef = useRef(false);
  return (
    <Modal
      isOpen
      onClose={() => { if (!busyRef.current) onClose?.(); }}
      title={t('profile.import_modal_title')}
      closeLabel={t('profile.close')}
      shellClassName="import-v2-shell"
      cardClassName="import-v2-card"
      portalToBody
    >
      <ImportActivityForm
        t={t}
        onCancel={onClose}
        onBusyChange={(busy) => { busyRef.current = busy; }}
        onImportedSome={() => onImported?.()}
        onSuccess={() => { onClose?.(); onImported?.(); }}
      />
    </Modal>
  );
}

/** What the server said about a batch, reduced to what the runner needs to know; null when it said nothing readable. */
function readReport(body) {
  if (!body || typeof body !== 'object') return null;
  return {
    imported: Number(body.importedActivities) || 0,
    duplicates: Number(body.skippedDuplicates) || 0,
    nonRuns: Number(body.skippedNonRuns) || 0,
    rejected: Array.isArray(body.rejectedFiles) ? body.rejectedFiles.map(String) : [],
  };
}

const needsReview = (report) => report.rejected.length > 0 || report.duplicates > 0 || report.nonRuns > 0 || report.imported === 0;

export function ImportActivityForm({ t, onCancel, onSuccess, onImportedSome, onBusyChange, onSourceChange, className = '' }) {
  const [source, setSource] = useState('fit');
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  // Set when the server's answer has something the runner should know: files refused, duplicates, activities that are not runs.
  const [report, setReport] = useState(null);
  const tabsRef = useRef([]);
  const uploadingRef = useRef(false);
  const panelId = useId();
  const idRef = useRef(0);

  const activeSource = SOURCES.find((item) => item.key === source) || SOURCES[0];

  function selectSource(key) {
    setSource(key);
    onSourceChange?.(key);
  }

  const addFiles = useCallback((fileList) => {
    if (uploadingRef.current) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setStatus('');
    const added = files.map((file) => {
      idRef.current += 1;
      return { id: idRef.current, source, file };
    });
    setQueue((current) => [...current, ...added]);
  }, [source]);

  const removeFile = (id) => setQueue((current) => current.filter((item) => item.id !== id));

  function handleSourceKeyDown(event, index) {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % SOURCES.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + SOURCES.length - 1) % SOURCES.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = SOURCES.length - 1;
    else return;
    event.preventDefault();
    selectSource(SOURCES[nextIndex].key);
    tabsRef.current[nextIndex]?.focus();
  }

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer?.files);
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!queue.length || uploadingRef.current) return;
    uploadingRef.current = true;
    onBusyChange?.(true);
    const formData = new FormData();
    queue.forEach(({ source: key, file }) => {
      const field = SOURCES.find((item) => item.key === key)?.field || 'exports';
      formData.append(field, file);
    });
    setUploading(true);
    setStatus('');
    let answer;
    try {
      const response = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!response.ok) {
        // The server says why (a corrupt file, a type it does not read); show that instead of a bare "failed".
        const body = typeof response.json === 'function' ? await response.json().catch(() => null) : null;
        const reason = body && typeof body.error === 'string' ? body.error : '';
        setStatus(reason ? `${t('profile.import_failed')}: ${reason}` : t('profile.import_failed'));
        return;
      }
      answer = typeof response.json === 'function' ? readReport(await response.json().catch(() => null)) : null;
    } catch {
      setStatus(t('profile.import_failed'));
      return;
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onBusyChange?.(false);
    }
    invalidateResourceCache('/api/activities');
    const submitted = queue.length;
    setQueue([]);
    if (answer && needsReview(answer)) {
      // Not a clean import: say what happened to each file and let the runner close it when they have read it.
      setReport(answer);
      if (answer.imported > 0) onImportedSome?.();
      return;
    }
    const importedCount = answer ? answer.imported : submitted;
    onSuccess?.(importedCount);
  }

  const countLabel = queue.length ? t('profile.upload_file_count', { count: queue.length }) : t('components.import_v2.import_empty');
  const dropTitle = t('components.import_v2.drop_title', { source: activeSource.tag });

  return (
      <form className={`import-v2${className ? ` ${className}` : ''}`} onSubmit={handleSubmit} aria-busy={uploading}>
        <div className="import-v2-body">
          <p className="import-v2-lede">{t('profile.import_batch_hint')}</p>

          <div className="import-v2-sources" role="tablist" aria-label={t('components.import_v2.source_label')}>
            {SOURCES.map((item, index) => (
              <button
                key={item.key}
                ref={(element) => { tabsRef.current[index] = element; }}
                id={`${panelId}-${item.key}`}
                type="button"
                role="tab"
                aria-selected={source === item.key}
                aria-controls={panelId}
                tabIndex={source === item.key ? 0 : -1}
                disabled={uploading}
                className={`import-v2-source${source === item.key ? ' is-active' : ''}`}
                onClick={() => selectSource(item.key)}
                onKeyDown={(event) => handleSourceKeyDown(event, index)}
              >
                <strong>{t(item.titleKey)}</strong>
                <span>{item.ext}</span>
              </button>
            ))}
          </div>

          {report ? <ImportReport report={report} t={t} /> : null}

          <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${source}`} hidden={Boolean(report)}>
            <label
              className={`import-v2-drop${isDragging ? ' is-dragging' : ''}${uploading ? ' is-busy' : ''}`}
              onDragOver={(event) => { event.preventDefault(); if (!uploadingRef.current) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={ACCEPT}
                multiple
                disabled={uploading}
                className="import-v2-input"
                aria-label={dropTitle}
                aria-describedby={`${panelId}-hint`}
                onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
              />
              <span className="import-v2-drop-mark" aria-hidden="true"><AppIcon name="upload" /></span>
              <strong>{dropTitle}</strong>
              <span id={`${panelId}-hint`}>{t(activeSource.hintKey)}</span>
            </label>
          </div>

          <div className="import-v2-queue-head" hidden={Boolean(report)}>
            <span role="status" aria-live="polite">{t('components.import_v2.queue_title', { count: queue.length })}</span>
            {queue.length > 0 && (
              <button type="button" className="import-v2-text-btn" onClick={() => setQueue([])} disabled={uploading}>
                {t('components.import_v2.clear_all')}
              </button>
            )}
          </div>

          {report ? null : queue.length === 0 ? (
            <div className="import-v2-empty">{t('components.import_v2.queue_empty')}</div>
          ) : (
            <ul className="import-v2-queue">
              {queue.map((item) => {
                const meta = SOURCES.find((entry) => entry.key === item.source) || SOURCES[0];
                return (
                  <li key={item.id} className="import-v2-file">
                    <span className="import-v2-file-ext" aria-hidden="true">{fileExt(item.file.name)}</span>
                    <span className="import-v2-file-copy">
                      <strong>{item.file.name}</strong>
                      <span>{formatSize(item.file.size)}</span>
                    </span>
                    <span className={`import-v2-file-tag is-${item.source}`}>{meta.tag}</span>
                    <button
                      type="button"
                      className="import-v2-file-remove"
                      onClick={() => removeFile(item.id)}
                      disabled={uploading}
                      aria-label={t('components.import_v2.remove_file', { name: item.file.name })}
                    >
                      <AppIcon name="close" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {status ? <div className="import-v2-error" role="alert">{status}</div> : null}

        </div>

        <div className="import-v2-actions">
          {report ? (
            <>
              <span className="import-v2-selection-status" />
              <button type="button" className="import-v2-cancel" onClick={() => setReport(null)}>
                {t('components.import_v2.result_more')}
              </button>
              <button type="button" className="import-v2-submit" onClick={() => onSuccess?.(report.imported)}>
                {t('components.import_v2.result_done')}
              </button>
            </>
          ) : (
            <>
              <span className="import-v2-selection-status">{queue.length ? t('profile.selected_files_count', { count: queue.length }) : t('profile.no_file_selected')}</span>
              <button type="button" className="import-v2-cancel" onClick={onCancel} disabled={uploading}>
                {t('profile.cancel')}
              </button>
              <button type="submit" className="import-v2-submit" disabled={!queue.length || uploading}>
                {uploading ? t('components.import_v2.uploading') : countLabel}
              </button>
            </>
          )}
        </div>
      </form>
  );
}

function ImportReport({ report, t }) {
  const plural = (count, key) => t(`components.import_v2.${key}_${count === 1 ? 'one' : 'other'}`, { count });
  return (
    <div className="import-v2-report" role="status" aria-live="polite">
      <strong>{report.imported > 0 ? plural(report.imported, 'result_imported') : t('components.import_v2.result_none')}</strong>
      <ul>
        {report.duplicates > 0 ? <li>{plural(report.duplicates, 'result_duplicates')}</li> : null}
        {report.nonRuns > 0 ? <li>{plural(report.nonRuns, 'result_non_runs')}</li> : null}
        {report.rejected.length > 0 ? (
          <li>
            {plural(report.rejected.length, 'result_rejected')}
            <ul className="import-v2-report-files">
              {report.rejected.map((entry) => <li key={entry}>{entry}</li>)}
            </ul>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
