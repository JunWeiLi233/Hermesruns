import { useId, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';

/** More than this many characters or lines is folded to a few lines until the runner asks for all of it. */
const FOLD_CHARACTERS = 280;
const FOLD_LINES = 4;

/**
 * What the runner wrote about the run, under its title. Nothing when there is nothing to show. Their line breaks are kept and
 * long notes are folded, so a page of thoughts does not push the numbers off the screen.
 */
export default function RunNotes({ notes }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (typeof notes !== 'string' || notes.trim() === '') return null;
  const folds = notes.length > FOLD_CHARACTERS || notes.split('\n').length > FOLD_LINES;
  return (
    <section className="run-detail-v2__notes" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="run-detail-v2__notes-title">{t('run_detail.notes_title')}</h2>
      <p id={`${id}-text`} className={`run-detail-v2__notes-text${folds && !open ? ' is-folded' : ''}`}>{notes}</p>
      {folds ? (
        <button type="button" className="run-detail-v2__link" aria-expanded={open} aria-controls={`${id}-text`} onClick={() => setOpen((current) => !current)}>
          {open ? t('run_detail.notes_less') : t('run_detail.notes_more')}
        </button>
      ) : null}
    </section>
  );
}
