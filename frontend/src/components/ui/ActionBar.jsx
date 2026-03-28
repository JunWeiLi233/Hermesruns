export default function ActionBar({ className = '', children }) {
  const classes = ['action-bar', className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
