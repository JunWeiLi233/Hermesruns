import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import GoalsCard from '../../components/goals/GoalsCard';
import { useI18n } from '../../contexts/I18nContext';
import { tagKey } from '../../utils/runLabels';
import { formatWeekRange, isCurrentWeek, listWeeks, longestDayKm, readFilters, writeFilters } from '../../utils/trainingLog';
import LogFilters from './LogFilters';
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
 * type and tags. The filters live in the address, so a filtered log can be bookmarked and the back button undoes a filter.
 * Earlier weeks are added to the end on request, twelve at a time.
 */
export default function TrainingLog() {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const { status, log, more, loadMore, reload } = useTrainingLog(filters);

  const setFilters = useCallback((next) => {
    setSearchParams(writeFilters(next), { replace: true });
  }, [setSearchParams]);
  const chooseType = useCallback((runType) => setFilters({ ...filters, runType }), [filters, setFilters]);
  const toggleTag = useCallback((tag) => {
    const has = filters.tags.some((existing) => tagKey(existing) === tagKey(tag));
    setFilters({ ...filters, tags: has ? filters.tags.filter((existing) => tagKey(existing) !== tagKey(tag)) : [...filters.tags, tag] });
  }, [filters, setFilters]);
  const clearFilters = useCallback(() => setFilters({ runType: '', tags: [] }), [setFilters]);

  const filtered = Boolean(filters.runType) || filters.tags.length > 0;
  const weeks = log?.weeks ?? NO_WEEKS;
  const scaleKm = useMemo(() => longestDayKm(weeks), [weeks]);
  const totalRuns = weeks.reduce((sum, week) => sum + week.runs, 0);
  const listed = useMemo(() => listWeeks(weeks, { foldEmpty: filtered }), [weeks, filtered]);
  const busy = status === 'refreshing';

  let body;
  if (log) {
    const nothingAtAll = totalRuns === 0 && !log.olderRuns;
    body = (
      <>
        {nothingAtAll && !filtered ? null : (
          <LogFilters
            runTypes={log.runTypes}
            tags={log.tags}
            selected={filters}
            busy={busy}
            onRunType={chooseType}
            onToggleTag={toggleTag}
            onClear={clearFilters}
          />
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
            {totalRuns === 0 ? <p className="training-log-v2__note">{t('training_log.empty_recent_body')}</p> : null}
            <div className="training-log-v2__weeks" aria-busy={busy ? 'true' : undefined}>
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
                  scaleKm={scaleKm}
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
                  <button type="button" className="training-log-v2__button" disabled={more === 'loading' || busy} onClick={loadMore}>
                    {more === 'loading' ? t('training_log.loading_earlier') : t('training_log.load_earlier')}
                  </button>
                </>
              ) : (
                <p className="training-log-v2__note">{filtered ? t('training_log.all_loaded_filtered') : t('training_log.all_loaded')}</p>
              )}
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
