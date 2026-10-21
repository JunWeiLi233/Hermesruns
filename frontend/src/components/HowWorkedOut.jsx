import { useI18n } from '../contexts/I18nContext';
import { methodsDocUrl } from '../utils/methodsDoc';

/** The link alone, for a card that already says in its own words how a number is worked out (inside its "basis" line). */
export function MethodsLink({ anchor }) {
  const { t } = useI18n();
  return (
    <a className="how-worked-out__link" href={methodsDocUrl(anchor)} target="_blank" rel="noreferrer">
      {t('methods.link')}
    </a>
  );
}

/**
 * One line under a number: how it is worked out in a sentence, and a link to the rule in the methods document
 * (docs/README-ANALYSIS.md, at the heading `anchor`). The sentence is the rule in short; the link is the rule in full.
 * `className` lets a page use its own muted style.
 */
export default function HowWorkedOut({ textKey, anchor, className = '' }) {
  const { t } = useI18n();
  return (
    <p className={`how-worked-out${className ? ` ${className}` : ''}`}>
      {t(textKey)} <MethodsLink anchor={anchor} />
    </p>
  );
}
