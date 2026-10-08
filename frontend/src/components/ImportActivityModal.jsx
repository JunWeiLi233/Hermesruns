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
 */

const SOURCES = [
  { key: 'fit', field: 'exports', tag: 'FIT/GPX', titleKey: 'profile.fit_export_source_title', hintKey: 'profile.fit_export_source_hint', ext: '.fit .gpx .tcx .zip' },
  { key: 'coros', field: 'coros', tag: 'COROS', titleKey: 'profile.coros_source_title', hintKey: 'profile.coros_source_hint', ext: '.fit .gpx .tcx .zip' },
  { key: 'huawei', field: 'huawei', tag: 'HUAWEI', titleKey: 'profile.huawei_source_title', hintKey: 'profile.huawei_source_hint', ext: '.gpx .tcx .fit .zip' },
];
const ACCEPT = '.gpx,.tcx,.fit,.zip';

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileExt(name) {
  const part = String(name || '').split('.').pop();
  return part && part !== name ? part.toUpperCase().slice(0, 4) : 'FILE';
}

export default function ImportActivityModal({ isOpen, onClose, onImported, t }) {
  return isOpen ? <ImportActivityDialog onClose={onClose} onImported={onImported} t={t} /> : null;
}

function ImportActivityDialog({ onClose, onImported, t }) {
  const [source, setSource] = useState('fit');
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const tabsRef = useRef([]);
  const uploadingRef = useRef(false);
  const panelId = useId();
  const idRef = useRef(0);

  const activeSource = SOURCES.find((item) => item.key === source) || SOURCES[0];

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
    setSource(SOURCES[nextIndex].key);
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
    const formData = new FormData();
    queue.forEach(({ source: key, file }) => {
      const field = SOURCES.find((item) => item.key === key)?.field || 'exports';
      formData.append(field, file);
    });
    setUploading(true);
    setStatus('');
    try {
      const response = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('import failed');
    } catch {
      setStatus(t('profile.import_failed'));
      return;
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
    invalidateResourceCache('/api/activities');
    onClose?.();
    onImported?.();
  }

  const countLabel = queue.length ? t('profile.upload_file_count', { count: queue.length }) : t('components.import_v2.import_empty');
  const dropTitle = t('components.import_v2.drop_title', { source: activeSource.tag });

  return (
    <Modal
      isOpen
      onClose={() => { if (!uploadingRef.current) onClose?.(); }}
      title={t('profile.import_modal_title')}
      closeLabel={t('profile.close')}
      shellClassName="import-v2-shell"
      cardClassName="import-v2-card"
      portalToBody
    >
      <form className="import-v2" onSubmit={handleSubmit} aria-busy={uploading}>
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
                onClick={() => setSource(item.key)}
                onKeyDown={(event) => handleSourceKeyDown(event, index)}
              >
                <strong>{t(item.titleKey)}</strong>
                <span>{item.ext}</span>
              </button>
            ))}
          </div>

          <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${source}`}>
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

          <div className="import-v2-queue-head">
            <span role="status" aria-live="polite">{t('components.import_v2.queue_title', { count: queue.length })}</span>
            {queue.length > 0 && (
              <button type="button" className="import-v2-text-btn" onClick={() => setQueue([])} disabled={uploading}>
                {t('components.import_v2.clear_all')}
              </button>
            )}
          </div>

          {queue.length === 0 ? (
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
          <button type="button" className="import-v2-cancel" onClick={onClose} disabled={uploading}>
            {t('profile.cancel')}
          </button>
          <button type="submit" className="import-v2-submit" disabled={!queue.length || uploading}>
            {uploading ? t('components.import_v2.uploading') : countLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
