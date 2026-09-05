import { useState, useEffect } from 'react';
import removeBackground, { bgRemovedCache } from '../../utils/removeBackground';
import {
  getShoePendingPhotoUrl,
  getShoeLivePhotoUrl,
  getShoeDisplayName,
  getShoeReviewState,
  getShoeAffinityScore,
  getShoeLastModifiedLabel,
  getCatalogImageUrl,
} from './catalogModels.js';
import { getAdminShoeCatalogImageState } from '../../utils/adminShoeCatalogStatus.js';
import { getCourseMapQueueRaceId as getCourseMapRaceId } from '../../utils/courseMapCatalogQueue.js';
import {
  getCourseMapStatus,
  getCourseMapPending,
  getCourseMapRenderableLive,
  getCourseMapRaceName,
  getCourseMapLocation,
} from './courseMapModels.js';
import AdminCourseMapPreview from '../../components/AdminCourseMapPreview';
import {
  formatAdminDate,
  getDashboardJobTone,
  getDashboardJobTraceId,
  getDashboardJobTypeLabel,
  getDashboardJobStatusLabel,
} from './operationsModels.js';
import AppIcon from '../../components/AppIcon';

export function ShoeImage({ src, alt, className, noImageLabel }) {
  const encodedSrc = src ? encodeURI(src) : '';
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!encodedSrc) {
      setProcessed(null);
      return undefined;
    }
    if (bgRemovedCache[encodedSrc]) {
      setProcessed(bgRemovedCache[encodedSrc]);
      return undefined;
    }
    removeBackground(encodedSrc).then(result => {
      if (cancelled) return;
      bgRemovedCache[encodedSrc] = result;
      setProcessed(result);
    }).catch(() => {
      if (!cancelled) setProcessed(encodedSrc);
    });
    return () => { cancelled = true; };
  }, [encodedSrc]);

  if (!encodedSrc) return <div className="admin-shoe-img-empty">{noImageLabel || alt || 'No image'}</div>;
  if (!processed) return <div className="admin-shoe-img-loading" />;
  return <img className={className} src={processed} alt={alt} width="800" height="800" loading="lazy" decoding="async" />;
}

export function Sparkline({ trend }) {
  const max = Math.max(1, ...(trend || []).map(item => Number(item.value || 0)));
  return (
    <div className="sparkline">
      {(trend || []).map(item => (
        <div
          key={item.label}
          title={`${item.label}: ${item.value}`}
          className="sparkline-bar"
          style={{ height: `${Math.max(10, Math.round((item.value / max) * 32))}px` }}
        />
      ))}
    </div>
  );
}

export function ShoeQueueRowComponent({ ariaAttributes, index, style, items, selectedId, selectedIds, onSelect, onToggle, t }) {
  const shoe = items[index];
  if (!shoe) return null;
  return (
    <div style={style}>
      <button
        type="button"
        className={`admin-shoe-workbench__queue-item${selectedId === shoe.id ? ' is-active' : ''}`}
        onClick={() => onSelect(shoe.id)}
        {...ariaAttributes}
      >
        <div className="admin-shoe-workbench__queue-thumb">
          <input
            type="checkbox"
            className="admin-shoe-select"
            checked={selectedIds.includes(shoe.id)}
            onChange={() => onToggle(shoe.id)}
            onClick={(event) => event.stopPropagation()}
          />
          <ShoeImage
            src={getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe)}
            alt={getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}
            className="admin-shoe-img"
            noImageLabel={t('dashboard.img_no_image')}
          />
        </div>
        <div className="admin-shoe-workbench__queue-body">
          <strong>{getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}</strong>
          <span>{shoe.runnerEmail}</span>
          <div className="admin-shoe-badges">
            <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${getShoeReviewState(shoe)}`}>
              {t(`dashboard.review_state_${getShoeReviewState(shoe)}`)}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

export function ShoeRepositoryRowComponent({ ariaAttributes, index, style, items, selectedId, onSelect, t }) {
  const shoe = items[index];
  if (!shoe) return null;
  const state = getShoeReviewState(shoe);
  const affinity = getShoeAffinityScore(shoe);
  const lastModified = getShoeLastModifiedLabel(shoe);
  return (
    <div style={style}>
      <button
        type="button"
        className={`admin-shoe-stitch-repository__row${selectedId === shoe.id ? ' is-active' : ''}`}
        onClick={() => onSelect(shoe.id)}
        {...ariaAttributes}
      >
        <span className="admin-shoe-stitch-repository__identity">
          <span className="admin-shoe-stitch-repository__thumb">
            <ShoeImage
              src={getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe)}
              alt={getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}
              className="admin-shoe-stitch-repository__thumb-image"
              noImageLabel={t('dashboard.img_no_image')}
            />
          </span>
          <span className="admin-shoe-stitch-repository__identity-copy">
            <strong>{getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}</strong>
            <small>{shoe.runnerEmail}</small>
          </span>
        </span>
        <span className="admin-shoe-stitch-repository__status">
          <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${state}`}>
            {t(`dashboard.review_state_${state}`)}
          </span>
        </span>
        <span className="admin-shoe-stitch-repository__affinity">
          <span className="admin-shoe-stitch-repository__meter">
            <span className="admin-shoe-stitch-repository__meter-fill" style={{ width: `${affinity}%` }} />
          </span>
          <strong>{affinity}%</strong>
        </span>
        <span className="admin-shoe-stitch-repository__modified">
          {lastModified !== '-' ? lastModified : t('dashboard.shoe_stitch_modified_fallback')}
        </span>
      </button>
    </div>
  );
}

export const CATALOG_ROW_HEIGHT = 300;

export function CatalogRowComponent({ ariaAttributes, index, style, items, onOpenImage, onDelete, t }) {
  const item = items[index];
  if (!item) return null;
  const imageState = getAdminShoeCatalogImageState(item);
  return (
    <div style={style} {...ariaAttributes}>
      <div className="admin-shoe-card" tabIndex={0} role="group" aria-label={`${item.brand || ''} ${item.model || ''}`.trim()}>
        <div className="admin-shoe-card-actions" aria-label={`${item.brand || ''} ${item.model || ''}`}>
          <button
            type="button"
            className="admin-shoe-card-action"
            onClick={() => onOpenImage(item)}
            aria-label={t('dashboard.catalog_card_edit')}
          >
            {t('dashboard.catalog_card_edit')}
          </button>
          <button
            type="button"
            className="admin-shoe-card-action admin-shoe-card-action--danger"
            onClick={() => onDelete(item)}
            aria-label={t('dashboard.catalog_card_delete')}
          >
            {t('dashboard.catalog_card_delete')}
          </button>
        </div>
        <div className="admin-shoe-img-wrap">
          <ShoeImage
            src={getCatalogImageUrl(item)}
            alt={`${item.brand || ''} ${item.model || ''}`.trim()}
            className="admin-shoe-img"
            noImageLabel={item.brand?.slice(0, 1) || '?'}
          />
        </div>
        <div className="admin-shoe-info">
          <span className="admin-shoe-name">{item.model}</span>
          <span className="admin-shoe-owner">{item.brand}</span>
          {(item.modelZh || item.modelEn) && (
            <div className="admin-shoe-badges">
              {item.modelZh && <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.catalog_lang_zh')}: {item.modelZh}</span>}
              {item.modelEn && <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.catalog_lang_en')}: {item.modelEn}</span>}
            </div>
          )}
          <div className="admin-shoe-badges">
            <span className="admin-shoe-status-badge admin-shoe-verified">{t(`dashboard.type_${item.type}`)}</span>
            <span className={`admin-shoe-status-badge admin-shoe-image-state admin-shoe-image-state--${imageState}`}>
              {t(`dashboard.catalog_image_state_${imageState}`)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CourseMapQueueRowComponent({ ariaAttributes, index, style, items, selectedId, onSelect, t }) {
  const item = items[index];
  if (!item) return null;
  const raceId = getCourseMapRaceId(item);
  const status = getCourseMapStatus(item);
  const pending = getCourseMapPending(item);
  const live = getCourseMapRenderableLive(item);
  const raceName = getCourseMapRaceName(item);

  return (
    <div style={style} className="admin-coursemap-rail__row" {...ariaAttributes}>
      <button
        type="button"
        className={`admin-coursemap-rail__item${selectedId === raceId ? ' is-active' : ''}`}
        onClick={() => onSelect(item)}
      >
        <div className="admin-coursemap-rail__preview">
          <AdminCourseMapPreview
            preview={pending || live}
            title={raceName}
            emptyLabel={raceName.slice(0, 1)}
            variant="card"
            allowImageFallback
            renderMap={false}
          />
        </div>
        <div className="admin-coursemap-rail__body">
          <div className="admin-coursemap-rail__head">
            <strong>{raceName}</strong>
            <span>{getCourseMapLocation(item) || t('dashboard.course_maps_location_fallback')}</span>
          </div>
          <div className="admin-coursemap-rail__badges">
            <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${status}`}>{t(`dashboard.review_state_${status}`)}</span>
          </div>
          <p className="admin-coursemap-rail__meta">{formatAdminDate(item?.updatedAt || pending?.updatedAt || live?.updatedAt)}</p>
        </div>
      </button>
    </div>
  );
}

export function JobQueueRowComponent({ ariaAttributes, index, style, items, selectedId, onSelect, t }) {
  const job = items[index];
  if (!job) return null;
  const tone = getDashboardJobTone(job.status);
  const processed = Number(job.successCount || 0) + Number(job.failureCount || 0);
  const total = Number(job.totalCount || 0);
  return (
    <div style={style} className="admin-jobs-terminal__row-shell" {...ariaAttributes}>
      <button
        type="button"
        className={`admin-jobs-terminal__row is-${tone}${selectedId === job.id ? ' is-active' : ''}`}
        onClick={() => onSelect(job.id)}
      >
        <div className="admin-jobs-terminal__trace">{getDashboardJobTraceId(job)}</div>
        <div className="admin-jobs-terminal__primary">
          <strong>{getDashboardJobTypeLabel(job.jobType, t)}</strong>
          <small>{job.triggerSource || t('dashboard.jobs_deck_trigger_unknown')}</small>
        </div>
        <div className="admin-jobs-terminal__status">
          <span className={`admin-jobs-terminal__status-badge is-${tone}`}>
            {getDashboardJobStatusLabel(job.status, t)}
          </span>
          <small>{formatAdminDate(job.createdAt)}</small>
        </div>
        <div className="admin-jobs-terminal__summary">
          <span>{job.summary || '-'}</span>
          <small>{job.createdByEmail || t('dashboard.jobs_deck_unassigned')}</small>
        </div>
        <div className="admin-jobs-terminal__counts">
          <strong>{processed.toLocaleString()}</strong>
          <small>{total > 0 ? t('dashboard.jobs_deck_processed_of_total', { processed, total }) : t('dashboard.jobs_deck_processed_only', { processed })}</small>
        </div>
        <div className="admin-jobs-terminal__ops">
          <AppIcon name="terminal" className="material-symbols-outlined" />
        </div>
      </button>
    </div>
  );
}

export function Pagination({ pageData, onPageChange, t }) {
  if (!pageData || (pageData.totalPages || 0) <= 1) return null;
  return (
    <div className="pagination-row pagination-row--arrows">
      <button
        type="button"
        className="pagination-arrow"
        disabled={pageData.page <= 0}
        onClick={() => onPageChange(pageData.page - 1)}
        aria-label={t('dashboard.pagination_prev')}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <span className="pagination-page-indicator">
        {t('dashboard.pagination_page', { current: pageData.page + 1, total: pageData.totalPages })}
      </span>
      <button
        type="button"
        className="pagination-arrow pagination-arrow--next"
        disabled={pageData.page + 1 >= pageData.totalPages}
        onClick={() => onPageChange(pageData.page + 1)}
        aria-label={t('dashboard.pagination_next')}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
