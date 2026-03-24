import { Link } from 'react-router-dom';

const LOGO_SRC = '/hermesruns-logo.svg';

/**
 * Site wordmark: red bar + "Hermesruns" (see /public/hermesruns-logo.svg).
 * @param {string} [to] - If set, wraps the image in a React Router Link.
 * @param {string} [className] - Extra classes on the link or wrapper.
 * @param {'sm'|'md'|'lg'|'hero'} [size] - Visual height preset (`hero` = landing nav).
 */
export default function BrandLogo({ to, className = '', size = 'md' }) {
  const img = (
    <img
      src={LOGO_SRC}
      alt="Hermesruns"
      className={`site-brand-logo site-brand-logo--${size}`.trim()}
      decoding="async"
    />
  );

  if (to) {
    return (
      <Link to={to} className={`site-brand-logo-link ${className}`.trim()}>
        {img}
      </Link>
    );
  }

  return <span className={`site-brand-logo-wrap ${className}`.trim()}>{img}</span>;
}
