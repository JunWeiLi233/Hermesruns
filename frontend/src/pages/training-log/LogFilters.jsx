import { useId, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { tagKey } from '../../utils/runLabels';

const KNOWN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];
/** How many of the runner's tags show before "show all"; the ones that are chosen always show. */
export const TAGS_SHOWN = 8;

/**
 * What the log can be narrowed to: a run type, and tags (a run must have every tag chosen). Only the types and tags the
 * runner has actually used are offered, so there is never a filter that can match nothing; a tag that is in the address
 * but not among the most used is still shown, so it can be taken off.
 */
export default function LogFilters({ runTypes, tags, selected, busy, onRunType, onToggleTag, onClear }) {
  const { t, formatNumber } = useI18n();
  const typeLabelId = useId();
  const tagLabelId = useId();
  const [allTags, setAllTags] = useState(false);
  const chosen = new Set(selected.tags.map(tagKey));
  const offered = new Set(tags.map((use) => tagKey(use.tag)));
  const extra = selected.tags.filter((tag) => !offered.has(tagKey(tag)));
  const visibleTags = tags.filter((use, index) => allTags || index < TAGS_SHOWN || chosen.has(tagKey(use.tag)));
  const typeName = (type) => (KNOWN_TYPES.includes(type) ? t(`run_labels.type_${type}`) : type);
  // A type in the address that the runner has not used is still shown, so that it can be taken off.
  const types = selected.runType && !runTypes.includes(selected.runType) ? [...runTypes, selected.runType] : runTypes;
  const active = Boolean(selected.runType) || selected.tags.length > 0;

  return (
    <section className="training-log-v2__filters" aria-label={t('training_log.filters_label')} aria-busy={busy ? 'true' : undefined}>
      {types.length > 0 ? (
        <div className="training-log-v2__filter-row">
          <span id={typeLabelId} className="training-log-v2__filter-label">{t('training_log.filter_type')}</span>
          <div className="training-log-v2__chips" role="group" aria-labelledby={typeLabelId}>
            <button type="button" aria-pressed={selected.runType === ''} onClick={() => onRunType('')}>{t('training_log.filter_all')}</button>
            {types.map((type) => (
              <button key={type} type="button" aria-pressed={selected.runType === type} onClick={() => onRunType(type)}>{typeName(type)}</button>
            ))}
          </div>
        </div>
      ) : null}

      {tags.length > 0 || extra.length > 0 ? (
        <div className="training-log-v2__filter-row">
          <span id={tagLabelId} className="training-log-v2__filter-label">{t('training_log.filter_tags')}</span>
          <div className="training-log-v2__chips" role="group" aria-labelledby={tagLabelId}>
            {[...extra.map((tag) => ({ tag, runs: null })), ...visibleTags].map((use) => (
              <button key={tagKey(use.tag)} type="button" title={use.tag} aria-pressed={chosen.has(tagKey(use.tag))} onClick={() => onToggleTag(use.tag)}>
                <span className="training-log-v2__chip-text">{use.tag}</span>
                {use.runs != null ? <small>{formatNumber(use.runs)}</small> : null}
              </button>
            ))}
            {tags.length > TAGS_SHOWN ? (
              <button type="button" className="training-log-v2__link" aria-expanded={allTags} onClick={() => setAllTags((current) => !current)}>
                {allTags ? t('training_log.tags_fewer') : t('training_log.tags_all', { count: formatNumber(tags.length) })}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {types.length === 0 && tags.length === 0 && extra.length === 0 ? (
        <p className="training-log-v2__note">{t('training_log.filter_hint')}</p>
      ) : null}

      {selected.tags.length > 1 ? <p className="training-log-v2__note">{t('training_log.filter_tags_note')}</p> : null}
      {active ? (
        <button type="button" className="training-log-v2__link" onClick={onClear}>{t('training_log.clear_filters')}</button>
      ) : null}
    </section>
  );
}
