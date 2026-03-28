export default function DataTable({ className = '', children }) {
  const wrapClass = ['table-card', 'data-table-wrap', className].filter(Boolean).join(' ');
  return <div className={wrapClass}>{children}</div>;
}
