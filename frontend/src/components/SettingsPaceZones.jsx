import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson } from '../api';
import { cachedApiJson } from '../api/resourceCache';
import { formatCalendarDate } from '../utils/bestEfforts';
import { todayKey } from '../utils/calendarDays';
import { getDistanceUnitLabel } from '../utils/format';
import { paceZoneBands } from '../utils/paceAnalysis';
import {
  RACE_PRESETS,
  STALE_RACE_DAYS,
  customDistanceMeters,
  distanceInUnit,
  formatRaceTime,
  parseRaceTime,
  presetFor,
  raceAgeDays,
  raceProblems,
  raceVdot,
} from '../utils/paceZoneRace';
import { estimateCurrentVdot } from '../utils/vdot';
import { PACE_ZONE_NAME_KEYS, paceZoneRangeLabel } from './paceZoneLabels';

const OTHER = 'other';
const NOTHING_SHOWN = { distance: false, time: false, date: false };

/**
 * Pace zones: the six zones the run page counts time in, and the way to cut them from a recent race or time trial instead of from
 * the runner's best runs of the last 90 days. The race is one distance, one time and the day it was run; the zones from it apply to
 * runs from that day on, and earlier runs keep the zones they had. It loads the first time the Training tab opens (`active`).
 */
export default function SettingsPaceZones({ t, lang, unit, active }) {
  // runs: the runner's runs, or null when they could not be loaded (the automatic zones cannot be shown then).
  const [loaded, setLoaded] = useState({ status: 'idle', race: null, limits: null, runs: null });
  const requested = useRef(false);
  const [choice, setChoice] = useState('10k');
  const [customText, setCustomText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [dateText, setDateText] = useState('');
  // A field's problems are said once the runner has been at it, and all of them once they try to save.
  const [shown, setShown] = useState(NOTHING_SHOWN);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', failed: false });
  const today = todayKey();

  const fill = useCallback((race) => {
    if (!race) {
      setChoice('10k');
      setCustomText('');
      setTimeText('');
      setDateText('');
    } else {
      const preset = presetFor(race.distanceMeters);
      setChoice(preset ? preset.key : OTHER);
      setCustomText(preset ? '' : String(distanceInUnit(race.distanceMeters, unit)));
      setTimeText(formatRaceTime(race.seconds));
      setDateText(race.date);
    }
    setShown(NOTHING_SHOWN);
  }, [unit]);

  // A distance typed in kilometres stays the same distance when the runner switches to miles.
  const lastUnit = useRef(unit);
  useEffect(() => {
    if (lastUnit.current === unit) return;
    const meters = customDistanceMeters(customText, lastUnit.current);
    lastUnit.current = unit;
    if (choice === OTHER && meters != null) setCustomText(String(distanceInUnit(meters, unit)));
  }, [unit, choice, customText]);

  const load = useCallback(async () => {
    try {
      const [answer, runs] = await Promise.all([
        apiJson('/api/training/pace-zones'),
        cachedApiJson('/api/activities/analysis').catch(() => null),
      ]);
      if (!answer || typeof answer !== 'object' || !answer.limits) throw new Error('Unexpected response');
      setLoaded({ status: 'ready', race: answer.race ?? null, limits: answer.limits, runs: Array.isArray(runs) ? runs : null });
      fill(answer.race ?? null);
    } catch {
      setLoaded((current) => ({ ...current, status: 'error' }));
    }
  }, [fill]);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    load();
  }, [active, load]);

  const { race, limits } = loaded;
  const meters = choice === OTHER ? customDistanceMeters(customText, unit) : RACE_PRESETS.find((preset) => preset.key === choice)?.meters ?? null;
  const seconds = parseRaceTime(timeText);
  const problems = limits ? raceProblems({ meters, seconds, date: dateText }, limits, today) : [];
  const typed = limits && problems.length === 0 ? { distanceMeters: meters, seconds, date: dateText } : null;
  const typedVdot = typed ? raceVdot(typed) : null;
  const unchanged = race != null && typed != null
    && Math.abs(race.distanceMeters - typed.distanceMeters) < 0.5 && race.seconds === typed.seconds && race.date === typed.date;

  // What the six zones are now (the race, else the runner's best runs of the last 90 days), and what they would be with the race typed.
  const runsVdot = useMemo(() => {
    if (!loaded.runs) return null;
    const vdot = Number(estimateCurrentVdot(loaded.runs).representativeVdot);
    return vdot > 0 ? vdot : null;
  }, [loaded.runs]);
  const currentVdot = race ? raceVdot(race) : runsVdot;
  const previewing = typedVdot != null && !unchanged;
  const shownVdot = previewing ? typedVdot : currentVdot;
  const bands = paceZoneBands(shownVdot);

  const touch = (field) => setShown((current) => (current[field] ? current : { ...current, [field]: true }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!typed) {
      setShown({ distance: true, time: true, date: true });
      return;
    }
    setSaving(true);
    setMessage({ text: '', failed: false });
    try {
      const answer = await apiJson('/api/training/pace-zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typed),
      });
      setLoaded((current) => ({ ...current, race: answer.race ?? null }));
      fill(answer.race ?? null);
      setMessage({ text: t('settings.pace_race_saved'), failed: false });
    } catch (error) {
      setMessage({ text: error?.status === 400 ? t('settings.pace_race_refused') : t('settings.pace_race_save_error'), failed: true });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setMessage({ text: '', failed: false });
    try {
      await apiJson('/api/training/pace-zones', { method: 'DELETE' });
      setLoaded((current) => ({ ...current, race: null }));
      fill(null);
      setMessage({ text: t('settings.pace_race_removed'), failed: false });
    } catch {
      setMessage({ text: t('settings.pace_race_remove_error'), failed: true });
    } finally {
      setSaving(false);
    }
  };

  if (loaded.status !== 'ready') {
    return (
      <>
        <h3 className="st-v2-group-label st-v2-subgroup-label">{t('settings.pace_zones_title')}</h3>
        <div className="st-v2-card">
          <div className="st-v2-row">
            {loaded.status === 'error' ? (
              <>
                <div className="st-v2-row-copy"><span role="alert">{t('settings.pace_zones_load_error')}</span></div>
                <button
                  type="button"
                  className="st-v2-btn"
                  onClick={() => { setLoaded((current) => ({ ...current, status: 'idle' })); load(); }}
                >
                  {t('settings.training_retry')}
                </button>
              </>
            ) : (
              <div className="st-v2-row-copy"><span role="status">{t('settings.pace_zones_loading')}</span></div>
            )}
          </div>
        </div>
      </>
    );
  }

  const distanceLabel = getDistanceUnitLabel(lang, unit);
  const distanceWords = (value) => {
    const preset = presetFor(value);
    return preset ? t(`settings.pace_race_distance_${preset.key}`) : `${distanceInUnit(value, unit)} ${distanceLabel}`;
  };
  const age = race ? raceAgeDays(race.date, today) : null;
  const stale = age != null && age >= STALE_RACE_DAYS;
  const problemText = (problem) => (problem.key === 'distance_range'
    ? t('settings.pace_race_problem_distance_range', {
      min: distanceInUnit(limits.minDistanceMeters, unit),
      max: distanceInUnit(limits.maxDistanceMeters, unit),
      unit: distanceLabel,
    })
    : t(`settings.pace_race_problem_${problem.key}`));
  const said = problems.filter((problem) => shown[problem.field]);
  const invalid = (field) => (said.some((problem) => problem.field === field) ? 'true' : undefined);

  let basis;
  if (race) {
    basis = t('settings.pace_zones_basis_race', {
      race: t('settings.pace_race_words', { distance: distanceWords(race.distanceMeters), time: formatRaceTime(race.seconds) }),
      date: formatCalendarDate(race.date, lang),
      vdot: currentVdot ?? '--',
    });
  } else if (currentVdot != null) {
    basis = t('settings.pace_zones_basis_runs', { vdot: Math.round(currentVdot * 10) / 10 });
  } else {
    basis = t(loaded.runs ? 'settings.pace_zones_basis_none' : 'settings.pace_zones_basis_unknown');
  }

  return (
    <>
      <h3 className="st-v2-group-label st-v2-subgroup-label">{t('settings.pace_zones_title')}</h3>
      <div className="st-v2-card">
        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <span>{t('settings.pace_zones_copy')}</span>
            <span data-testid="pace-zones-basis">{basis}</span>
            {stale ? <span role="status">{t('settings.pace_race_stale', { days: age })}</span> : null}
          </div>
        </div>

        <form className="st-v2-row st-v2-zones-row st-v2-pace-race" onSubmit={submit} noValidate>
          <div className="st-v2-row-copy">
            <strong>{t('settings.pace_race_title')}</strong>
            <span>{t('settings.pace_race_copy')}</span>
          </div>
          <div className="st-v2-zones-form is-boundaries">
            <label className="st-v2-zones-field">
              <span>{t('settings.pace_race_distance')}</span>
              <select
                className="st-v2-select"
                value={choice}
                disabled={saving}
                onChange={(event) => { setChoice(event.target.value); touch('distance'); }}
              >
                {RACE_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{t(`settings.pace_race_distance_${preset.key}`)}</option>)}
                <option value={OTHER}>{t('settings.pace_race_distance_other')}</option>
              </select>
            </label>
            {choice === OTHER ? (
              <label className="st-v2-zones-field">
                <span>{t('settings.pace_race_distance_custom', { unit: distanceLabel })}</span>
                <input
                  className="st-v2-input st-v2-zones-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={customText}
                  disabled={saving}
                  aria-invalid={invalid('distance')}
                  onChange={(event) => { setCustomText(event.target.value); touch('distance'); }}
                />
              </label>
            ) : null}
            <label className="st-v2-zones-field">
              <span>{t('settings.pace_race_time')}</span>
              <input
                className="st-v2-input st-v2-zones-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="45:00"
                value={timeText}
                disabled={saving}
                aria-invalid={invalid('time')}
                onChange={(event) => { setTimeText(event.target.value); touch('time'); }}
              />
            </label>
            <label className="st-v2-zones-field">
              <span>{t('settings.pace_race_date')}</span>
              <input
                className="st-v2-input st-v2-zones-input"
                type="date"
                max={today}
                value={dateText}
                disabled={saving}
                aria-invalid={invalid('date')}
                onChange={(event) => { setDateText(event.target.value); touch('date'); }}
              />
            </label>
          </div>
          {said.length ? (
            <span className="st-v2-zones-error" role="alert">
              {said.map((problem) => <span key={problem.key}>{problemText(problem)}</span>)}
            </span>
          ) : null}
          <div className="st-v2-zones-actions">
            <button type="submit" className="st-v2-btn is-dark" disabled={saving || unchanged}>
              {race ? t('settings.pace_race_replace') : t('settings.pace_race_save')}
            </button>
            {race ? (
              <button type="button" className="st-v2-btn is-quiet" disabled={saving} onClick={remove}>{t('settings.pace_race_remove')}</button>
            ) : null}
          </div>
        </form>

        <div className="st-v2-row st-v2-zones-preview st-v2-pace-zones">
          {bands.length ? (
            <>
              {previewing ? <p className="st-v2-pace-preview-note">{t('settings.pace_zones_preview', { vdot: typedVdot })}</p> : null}
              <ul aria-label={t('settings.pace_zones_list')}>
                {bands.map((band, index) => ({ band, index })).reverse().map(({ band, index }) => (
                  <li key={band.key} className={`is-zone-${index + 1}`} data-pace-zone={band.key}>
                    <i aria-hidden="true" />
                    <span>{t(PACE_ZONE_NAME_KEYS[band.key])}</span>
                    <strong>{paceZoneRangeLabel(band, t)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="st-v2-row-copy">{t('settings.pace_zones_none')}</p>
          )}
        </div>

        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <span>{t('settings.pace_zones_applies')}</span>
            {message.text ? <span role={message.failed ? 'alert' : 'status'}>{message.text}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
