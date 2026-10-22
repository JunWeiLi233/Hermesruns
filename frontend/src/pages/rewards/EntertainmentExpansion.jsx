import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import CompanionCloset from './CompanionCloset';
import PrivateMemories from './PrivateMemories';
import FlexibleMissions from './FlexibleMissions';
import PrivateMosaic from './PrivateMosaic';
import useEntertainmentExpansion from './useEntertainmentExpansion';
import './entertainment-expansion.css';

export default function EntertainmentExpansion() {
  const { isAuthenticated, token, email } = useAuth();
  return isAuthenticated ? <ExpansionSession key={`${token}:${email}`} /> : null;
}

function ExpansionSession() {
  const { t } = useI18n();
  const resource = useEntertainmentExpansion();
  const { data, phase, disabled, commit } = resource;
  const errorFocus = useRef(null);
  useLayoutEffect(() => {
    if (phase === 'save-error' || phase === 'load-error') errorFocus.current?.focus();
  }, [phase]);
  const text = (key, params) => t(`entertainment_expansion.${key}`, params);
  if (!data) return <section className="entertainment-expansion" aria-label={text('title')}>
    {phase === 'load-error' ? <div role="alert" ref={errorFocus} tabIndex={-1}><p>{text('load_failed')}</p><button type="button" onClick={resource.load}>{text('retry_load')}</button></div>
      : <p role="status">{text('loading')}</p>}
  </section>;
  return <section className="entertainment-expansion" aria-labelledby="entertainment-expansion-title">
    <header><h2 id="entertainment-expansion-title">{text('title')}</h2><p>{text('intro')}</p></header>
    <div className="entertainment-status" aria-live="polite" aria-atomic="true">
      {(phase === 'loading' || phase === 'saving') && <p>{text(phase)}</p>}
      {phase === 'saved' && <p>{text('saved')}</p>}
      {phase === 'removed' && <p role="status">{text(commit?.removedKind === 'group' ? 'mosaic_outcome_removed' : 'memory_outcome_removed')}</p>}
      {phase === 'unavailable' && <p role="status">{text('mosaic_outcome_unavailable')}</p>}
      {phase === 'save-error' && <div role="alert" ref={errorFocus} tabIndex={-1}><p>{text(resource.errorStatus === 409 ? 'conflict_failed' : resource.errorStatus === 410 ? 'invite_unavailable' : [400, 404].includes(resource.errorStatus) ? 'request_rejected' : 'save_failed')}</p>
        <div className="entertainment-actions">
          {![400, 404, 409, 410].includes(resource.errorStatus) && <button type="button" onClick={resource.retry}>{text('retry_save')}</button>}
          <button type="button" onClick={resource.reconcile}>{text('check_saved')}</button>
          {[400, 404, 409, 410].includes(resource.errorStatus) && <button type="button" onClick={resource.review}>{text('review_saved')}</button>}
        </div>
      </div>}
    </div>
    <section className="entertainment-card" aria-label={text('companion_title')}><CompanionCloset state={data.companion} text={text} disabled={disabled}
      savedRequestId={commit?.scope === 'companion' ? commit.requestId : null} onSave={arrangement => resource.save({
        path: '/companion', method: 'PUT', scope: 'companion', body: { ...arrangement, expectedVersion: data.companion.version },
        matches: result => result?.accessory === arrangement.accessory && result?.background === arrangement.background && result?.hidden === arrangement.hidden,
      })} /></section>
    <section className="entertainment-card" aria-label={text('memories_title')}><PrivateMemories rows={data.memories} text={text} disabled={disabled} commit={commit}
      onSave={(id, payload, version) => resource.save({ path: `/memories${id ? `/${id}` : ''}`, method: id ? 'PUT' : 'POST', scope: 'memory',
        body: { ...payload, ...(id ? { expectedVersion: version } : {}) },
        matches: result => Boolean(result?.id && (!id || result.id === id) && result.title === payload.title && result.body === payload.body && result.date === payload.date),
      })} onDelete={row => resource.save({ path: `/memories/${row.id}`, method: 'DELETE', scope: 'memory', body: { expectedVersion: row.version }, matches: result => result?.id === row.id && result.deleted === true })} /></section>
    <section className="entertainment-card" aria-label={text('missions_title')}><FlexibleMissions rows={data.missions} text={text} disabled={disabled} onAction={(row, action) => resource.save({
      path: `/missions/${row.missionId}`, scope: 'mission', body: { expectedVersion: row.version, action },
      matches: result => result?.missionId === row.missionId && result.completionSource === 'self-marked',
    })} /></section>
    <section className="entertainment-card" aria-label={text('mosaic_title')}><PrivateMosaic data={data} text={text} disabled={disabled} onCommand={resource.save} commit={commit} /></section>
  </section>;
}
