function joinClassNames(...values) {
  return values.filter(Boolean).join(' ');
}

export default function PageActionHero({
  kicker,
  title,
  copy,
  titleSlot = null,
  copySlot = null,
  actions = null,
  topSlot = null,
  children = null,
  wrapperClassName = '',
  stackClassName = 'page-intro-stack',
  kickerClassName = 'page-intro-kicker',
  titleClassName = 'page-intro-title',
  copyClassName = 'page-intro-text',
  actionsClassName = 'page-intro-actions',
}) {
  return (
    <>
      {topSlot}
      <div className={joinClassNames('page-action-hero', wrapperClassName)}>
        <div className={stackClassName}>
          {kicker ? <span className={kickerClassName}>{kicker}</span> : null}
          {titleSlot || (title ? <h1 className={titleClassName}>{title}</h1> : null)}
          {copySlot || (copy ? <p className={copyClassName}>{copy}</p> : null)}
        </div>
        {actions ? <div className={actionsClassName}>{actions}</div> : null}
      </div>
      {children}
    </>
  );
}
