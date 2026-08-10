import { useEffect, useState } from 'react';
import authBrandSlides from '../data/authBrandSlides';

const MIN_SLIDE_DURATION_MS = 6800;
const MAX_SLIDE_DURATION_MS = 9800;

function randomIndex(length, previousIndex = -1) {
  if (length < 2) return 0;

  let nextIndex = previousIndex;
  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }
  return nextIndex;
}

function randomDuration() {
  return MIN_SLIDE_DURATION_MS + Math.floor(
    Math.random() * (MAX_SLIDE_DURATION_MS - MIN_SLIDE_DURATION_MS),
  );
}

export default function AuthBrandCarousel({ t }) {
  const [activeIndex, setActiveIndex] = useState(() => randomIndex(authBrandSlides.length));
  const activeSlide = authBrandSlides[activeIndex] || authBrandSlides[0];

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return undefined;

    const timer = window.setTimeout(() => {
      setActiveIndex((currentIndex) => randomIndex(authBrandSlides.length, currentIndex));
    }, randomDuration());

    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  if (!activeSlide) return null;

  return (
    <div className="auth-flow-copy auth-flow-copy--carousel" aria-label={t('index.stitch_slides_label')}>
      <div className="auth-flow-slide-viewport">
        <div className="auth-flow-slide-track">
          <article className="auth-flow-slide" key={activeSlide.id}>
            <span className="auth-flow-kicker">{t(activeSlide.kickerKey)}</span>
            <h2 className="auth-flow-hero">
              <span>{t(activeSlide.lineOneKey)}</span>
              <span className="is-accent">{t(activeSlide.lineTwoKey)}</span>
            </h2>
            <p className="auth-flow-text">{t(activeSlide.copyKey)}</p>

            {activeSlide.details?.length > 0 && (
              <div className="auth-flow-slide-details" aria-label={t('index.stitch_slide_details_label')}>
                {activeSlide.details.map((detail) => (
                  <span className="auth-flow-slide-detail" key={detail.value}>
                    <strong>{detail.value}</strong>
                    <small>{t(detail.labelKey)}</small>
                  </span>
                ))}
              </div>
            )}

            <div className="auth-flow-stats">
              {activeSlide.stats.map((stat) => (
                <div key={stat.labelKey}>
                  <strong>{stat.value}</strong>
                  <span>{t(stat.labelKey)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
