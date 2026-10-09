import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson } from '../api';
import { boundaryProblem, boundaryValues, invalidBoundaryIndexes, parseMaxHeartRate, zonesFromBoundaries } from '../utils/heartRateZones';
import { zoneName, zoneNumberLabel, zoneRangeLabel } from './heartRateZoneLabels';

const BOUNDARY_ZONES = [2, 3, 4, 5];

function toTexts(numbers) {
  return numbers.map((value) => String(value));
}

/**
 * Heart-rate zones: the max heart rate they are built on and, if the runner wants them, their own zone
 * boundaries. It loads the first time the Training tab opens (`active`), not when Settings opens.
 */
export default function SettingsTrainingZones({ t, active }) {
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const requested = useRef(false);
  const [maxText, setMaxText] = useState('');
  const [boundaryTexts, setBoundaryTexts] = useState(['', '', '', '']);
  const [maxTouched, setMaxTouched] = useState(false);
  const [boundariesTouched, setBoundariesTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', failed: false });

  const adopt = useCallback((zones) => {
    setData(zones);
    setMaxText(String(zones.maxHeartRate.bpm));
    setBoundaryTexts(toTexts(zones.heartRate.boundaries));
    setMaxTouched(false);
    setBoundariesTouched(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const zones = await apiJson('/api/training/zones');
      if (!zones?.heartRate || !zones?.maxHeartRate || !zones?.limits) throw new Error('Unexpected response');
      adopt(zones);
    } catch {
      setLoadFailed(true);
    }
  }, [adopt]);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    load();
  }, [active, load]);

  const save = useCallback(async (body, successText) => {
    setSaving(true);
    setMessage({ text: '', failed: false });
    try {
      const zones = await apiJson('/api/training/zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      adopt(zones);
      const recalculating = zones.recomputeQueued === true;
      setMessage({ text: recalculating ? t('settings.training_saved_recompute') : successText, failed: false });
    } catch {
      setMessage({ text: t('settings.training_save_error'), failed: true });
    } finally {
      setSaving(false);
    }
  }, [adopt, t]);

  const limits = data?.limits;
  const maxValue = limits ? parseMaxHeartRate(maxText, limits) : null;
  const maxChanged = data != null && maxValue != null && maxValue !== data.maxHeartRate.bpm;
  const problem = limits ? boundaryProblem(boundaryTexts, limits) : null;
  const invalidBoxes = limits && problem ? invalidBoundaryIndexes(boundaryTexts, limits) : new Set();
  const boundariesChanged = data != null && problem == null
    && boundaryValues(boundaryTexts).some((value, index) => value !== data.heartRate.boundaries[index]);
  const previewZones = useMemo(() => {
    if (!data) return [];
    return problem == null ? zonesFromBoundaries(boundaryValues(boundaryTexts)) : data.heartRate.zones;
  }, [data, problem, boundaryTexts]);

  if (!data) {
    return (
      <div className="st-v2-card">
        <div className="st-v2-row">
          {loadFailed ? (
            <>
              <div className="st-v2-row-copy"><span role="alert">{t('settings.training_load_error')}</span></div>
              <button type="button" className="st-v2-btn" onClick={() => { setLoadFailed(false); load(); }}>{t('settings.training_retry')}</button>
            </>
          ) : (
            <div className="st-v2-row-copy"><span role="status">{t('settings.training_loading')}</span></div>
          )}
        </div>
      </div>
    );
  }

  const suggestion = data.suggestedMaxHeartRate;
  const maxInvalid = maxTouched && maxValue == null;
  const problemText = {
    incomplete: t('settings.training_boundaries_incomplete'),
    range: t('settings.training_boundaries_range', { min: limits.minBoundary, max: limits.maxBoundary }),
    order: t('settings.training_boundaries_order'),
  }[problem];
  const manual = data.heartRate.source === 'MANUAL';

  return (
    <>
      <div className="st-v2-card">
        <div className="st-v2-row st-v2-zones-row">
          <div className="st-v2-row-copy">
            <strong>{t('settings.training_max_title')}</strong>
            <span>{t('settings.training_max_copy')}</span>
            <span>
              {data.maxHeartRate.source === 'PROFILE'
                ? t('settings.training_max_source_profile')
                : t('settings.training_max_source_default', { bpm: data.maxHeartRate.bpm })}
            </span>
          </div>
          <form
            className="st-v2-zones-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (maxValue != null) save({ maxHeartRateBpm: maxValue }, t('settings.training_max_saved'));
            }}
          >
            <input
              className="st-v2-input st-v2-zones-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={t('settings.training_max_label')}
              aria-invalid={maxInvalid ? 'true' : undefined}
              value={maxText}
              disabled={saving}
              onChange={(event) => { setMaxText(event.target.value); setMaxTouched(true); }}
            />
            <button type="submit" className="st-v2-btn is-dark" disabled={saving || !maxChanged}>{t('settings.training_max_save')}</button>
            {data.maxHeartRate.source === 'PROFILE' ? (
              <button
                type="button"
                className="st-v2-btn is-quiet"
                disabled={saving}
                onClick={() => save({ clearMaxHeartRate: true }, t('settings.training_max_cleared'))}
              >
                {t('settings.training_max_clear')}
              </button>
            ) : null}
          </form>
          {maxInvalid ? (
            <span className="st-v2-zones-error" role="alert">
              {t('settings.training_max_invalid', { min: limits.minMaxHeartRate, max: limits.maxMaxHeartRate })}
            </span>
          ) : null}
        </div>
        {suggestion && suggestion.bpm !== data.maxHeartRate.bpm ? (
          <div className="st-v2-row">
            <div className="st-v2-row-copy">
              <span>{t('settings.training_suggestion', { bpm: suggestion.bpm, count: suggestion.basedOnRuns })}</span>
            </div>
            <button
              type="button"
              className="st-v2-btn"
              disabled={saving}
              onClick={() => save({ maxHeartRateBpm: suggestion.bpm }, t('settings.training_max_saved'))}
            >
              {t('settings.training_suggestion_use', { bpm: suggestion.bpm })}
            </button>
          </div>
        ) : null}
      </div>

      <h3 className="st-v2-group-label st-v2-subgroup-label">{t('settings.training_boundaries_title')}</h3>
      <div className="st-v2-card">
        <form
          className="st-v2-row st-v2-zones-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (problem == null) {
              save({ heartRateBoundaries: boundaryValues(boundaryTexts) }, t('settings.training_saved_same'));
            }
          }}
        >
          <div className="st-v2-row-copy">
            <span>{t('settings.training_boundaries_copy')}</span>
            <span>{manual ? t('settings.training_boundaries_manual') : t('settings.training_boundaries_auto')}</span>
          </div>
          <div className="st-v2-zones-form is-boundaries">
            {BOUNDARY_ZONES.map((zone, index) => (
              <label key={zone} className="st-v2-zones-field">
                <span>{t('settings.training_boundary_label', { n: zone })}</span>
                <input
                  className="st-v2-input st-v2-zones-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={boundariesTouched && invalidBoxes.has(index) ? 'true' : undefined}
                  value={boundaryTexts[index]}
                  disabled={saving}
                  onChange={(event) => {
                    const next = [...boundaryTexts];
                    next[index] = event.target.value;
                    setBoundaryTexts(next);
                    setBoundariesTouched(true);
                  }}
                />
              </label>
            ))}
          </div>
          {boundariesTouched && problemText ? <span className="st-v2-zones-error" role="alert">{problemText}</span> : null}
          <div className="st-v2-zones-actions">
            <button type="submit" className="st-v2-btn is-dark" disabled={saving || !boundariesChanged}>{t('settings.training_boundaries_save')}</button>
            {manual ? (
              <button
                type="button"
                className="st-v2-btn is-quiet"
                disabled={saving}
                onClick={() => save({ resetHeartRateBoundaries: true }, t('settings.training_saved_same'))}
              >
                {t('settings.training_boundaries_reset')}
              </button>
            ) : null}
          </div>
        </form>

        <div className="st-v2-row st-v2-zones-preview">
          <ul aria-label={t('settings.training_preview_title')}>
            {previewZones.map((zone) => (
              <li key={zone.zone} className={`is-zone-${zone.zone}`}>
                <i aria-hidden="true" />
                <span>{zoneNumberLabel(t, zone.zone)} · {zoneName(t, zone.zone)}</span>
                <strong>{zoneRangeLabel(t, zone)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <span>{t('settings.training_recalc_note')}</span>
            {message.text ? <span role={message.failed ? 'alert' : 'status'}>{message.text}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
