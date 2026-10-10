import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import GoalsCard from '../../components/goals/GoalsCard';
import { useI18n } from '../../contexts/I18nContext';
import { tagKey } from '../../utils/runLabels';
import { formatWeekRange, isCurrentWeek, listWeeks, longestDay, readFilters, showsLatestWeek, writeFilters } from '../../utils/trainingLog';
import LogFilters from './LogFilters';
import LogView from './LogView';
import LogWeek from './LogWeek';
import useTrainingLog from './useTrainingLog';

const NO_WEEKS = [];

function Skeleton() {
  return (
    <div className="training-log-v2__skeleton" aria-hidden="true">
      <span className="page-skeleton__block training-log-v2__skeleton-filters" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="training-log-v2__skeleton-week">
          <span className="page-skeleton__block" />
          <span className="page-skeleton__block is-short" />
          <span className="page-skeleton__block" />
        </div>
      ))}
    </div>
  );
}

/**
 * The training log (S11): the runner's runs laid out by week and day, with what each week added up to, narrowed by run
 * type and tags. The filters, the metric the log looks at and the day it was jumped to all live in the address, so a view
 * of the log can be bookmarked and the back button leaves it. Earlier weeks are added to the end on request, twelve at a
 * time, and so are later weeks to the start after a jump.
 */
export default function TrainingLog() {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const { status, log, more, newer, loadMore, loadNewer, reload } = useTrainingLog(filters);
  const weeksRef = useRef(null);
  const pendingFocus = useRef(null);

  const setFilters = useCallback((next) => {
    setSearchParams(writeFilters(next), { replace: true });
  }, [setSearchParams]);
  const chooseType = useCallback((runType) => setFilters({ ...filters, runType }), [filters, setFilters]);
  const toggleTag = useCallback((tag) => {
    const has = filters.tags.some((existing) => tagKey(existing) === tagKey(tag));
    setFilters({ ...filters, tags: has ? filters.tags.filter((existing) => tagKey(existing) !== tagKey(tag)) : [...filters.tags, tag] });
  }, [filters, setFilters]);
  const clearFilters = useCallback(() => setFilters({ ...filters, runType: '', tags: [] }), [filters, setFilters]);
  const chooseMetric = useCallback((metric) => setFilters({ ...filters, metric }), [filters, setFilters]);
  const jumpTo = useCallback((to) => setFilters({ ...filters, to }), [filters, setFilters]);
  const backToLatest = useCallback(() => setFilters({ ...filters, to: '' }), [filters, setFilters]);

  const filtered = Boolean(filters.runType) || filters.tags.length > 0;
  const weeks = log?.weeks ?? NO_WEEKS;
  const scale = useMemo(() => longestDay(weeks, filters.metric), [weeks, filters.metric]);
  const totalRuns = weeks.reduce((sum, week) => sum + week.runs, 0);
  const listed = useMemo(() => listWeeks(weeks, { foldEmpty: filtered }), [weeks, filtered]);
  const busy = status === 'refreshing';
  // Whether the weeks on screen reach the runner's today: if not, the log was jumped to a day and later weeks are to be had.
  const latest = log ? showsLatestWeek(log.weeks, log.today) : true;

  // After more weeks are loaded the keyboard goes to the first of them: the button that was pressed may be gone by then.
  const showEarlier = async () => {
    pendingFocus.current = { kind: 'earlier', after: weeks.length > 0 ? weeks[weeks.length - 1].start : '' };
    if (!(await loadMore())) pendingFocus.current = null;
  };
  const showLater = async () => {
    pendingFocus.current = { kind: 'later' };
    if (!(await loadNewer())) pendingFocus.current = null;
  };
  useEffect(() => {
    const want = pendingFocus.current;
    if (!want || !weeksRef.current) return;
    pendingFocus.current = null;
    const cards = [...weeksRef.current.querySelectorAll('[data-week]')];
    const target = want.kind === 'later' ? cards[0] : cards.find((card) => card.dataset.week < want.after);
    target?.querySelector('h2')?.focus({ preventScroll: true });
  }, [weeks]);

  let body;
  if (log) {
    const nothingAtAll = totalRuns === 0 && !log.olderRuns && latest;
    let emptyNote = t('training_log.empty_recent_body');
    if (!log.olderRuns) emptyNote = filtered ? t('training_log.empty_window_filtered') : t('training_log.empty_window_body');
    body = (
      <>
        {nothingAtAll && !filtered ? null : (
          <>
            <LogView
              metric={filters.metric}
              onMetric={chooseMetric}
              jumpedTo={filters.to}
              today={log.today}
              showLatest={Boolean(filters.to) && !latest}
              busy={busy}
              onJump={jumpTo}
              onLatest={backToLatest}
            />
            <LogFilters
              runTypes={log.runTypes}
              tags={log.tags}
              selected={filters}
              busy={busy}
              onRunType={chooseType}
              onToggleTag={toggleTag}
              onClear={clearFilters}
            />
          </>
        )}

        {nothingAtAll ? (
          <section className="training-log-v2__empty">
            <h2>{filtered ? t('training_log.empty_filtered_title') : t('training_log.empty_title')}</h2>
            <p>{filtered ? t('training_log.empty_filtered_body') : t('training_log.empty_body')}</p>
            {filtered
              ? <button type="button" className="training-log-v2__button" onClick={clearFilters}>{t('training_log.clear_filters')}</button>
              : <Link className="training-log-v2__button" to="/settings/import-data">{t('training_log.empty_action')}</Link>}
          </section>
        ) : (
          <>
            {latest ? null : (
              <div className="training-log-v2__more">
                {newer === 'error' ? <p className="training-log-v2__error" role="alert">{t('training_log.load_later_error')}</p> : null}
                <button type="button" className="training-log-v2__button" disabled={newer === 'loading' || busy} onClick={showLater}>
                  {newer === 'loading' ? t('training_log.loading_later') : t('training_log.load_later')}
                </button>
              </div>
            )}
            {totalRuns === 0 ? <p className="training-log-v2__note">{emptyNote}</p> : null}
            <div className="training-log-v2__weeks" ref={weeksRef} aria-busy={busy ? 'true' : undefined}>
              {listed.map((item) => (item.gap ? (
                <p key={`gap-${item.start}`} className="training-log-v2__gap">
                  <span>{formatWeekRange(item.start, item.end, lang)}</span>
                  {t('training_log.gap_weeks', { count: item.count })}
                </p>
              ) : (
                <LogWeek
                  key={item.week.start}
                  week={item.week}
                  current={isCurrentWeek(item.week, log.today)}
                  scale={scale}
                  metric={filters.metric}
                  filtered={filtered}
                  activeTags={filters.tags}
                  onToggleTag={toggleTag}
                />
              )))}
            </div>

            <div className="training-log-v2__more">
              {log.olderRuns ? (
                <>
                  {more === 'error' ? <p className="training-log-v2__error" role="alert">{t('training_log.load_earlier_error')}</p> : null}
                  <button type="button" className="training-log-v2__button" disabled={more === 'loading' || busy} onClick={showEarlier}>
                    {more === 'loading' ? t('training_log.loading_earlier') : t('training_log.load_earlier')}
                  </button>
                </>
              ) : null}
              {!log.olderRuns && totalRuns > 0
                ? <p className="training-log-v2__note">{filtered ? t('training_log.all_loaded_filtered') : t('training_log.all_loaded')}</p>
                : null}
            </div>
          </>
        )}

        <p className="training-log-v2__basis">
          {t('training_log.basis', { zone: log.timeZone === 'Z' ? 'UTC' : log.timeZone })}
        </p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="training-log-v2__state">
        <p className="training-log-v2__error" role="alert">{t('training_log.error')}</p>
        <button type="button" className="training-log-v2__button" onClick={reload}>{t('training_log.retry')}</button>
      </div>
    );
  } else {
    body = (
      <>
        <p className="sr-only" role="status">{t('training_log.loading')}</p>
        <Skeleton />
      </>
    );
  }

  return (
    <AuthenticatedPageChrome
      bodyClassName="training-log-page"
      title={t('training_log.title')}
      parentLabel={t('profile.dashboard_nav_activities')}
      parentRoute="/runs"
      activeKey="activities"
    >
      <div className="training-log-v2" aria-busy={status === 'loading' || busy ? 'true' : undefined}>
        <header className="training-log-v2__head">
          <div>
            <h1>{t('training_log.title')}</h1>
            <p>{t('training_log.subtitle')}</p>
          </div>
          <nav className="training-log-v2__links" aria-label={t('training_log.links_label')}>
            <Link to="/runs">{t('training_log.link_runs')}</Link>
            <Link to="/analysis/load-balance#load-fitness">{t('training_log.link_fitness')}</Link>
          </nav>
        </header>
        <GoalsCard />
        {body}
      </div>
    </AuthenticatedPageChrome>
  );
}
