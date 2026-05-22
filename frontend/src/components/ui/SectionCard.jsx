export default function SectionCard({
  title,
  subtitle,
  actions,
  className = '',
  bodyClassName = '',
  children,
}) {
  const classes = ['card', 'section-card', className].filter(Boolean).join(' ');
  const bodyClasses = ['section-card-body', bodyClassName].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {(title || subtitle || actions) && (
        <header className="section-card-header">
          <div className="section-card-copy">
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="section-card-actions">{actions}</div> : null}
        </header>
      )}
      <div className={bodyClasses}>{children}</div>
    </section>
  );
}
