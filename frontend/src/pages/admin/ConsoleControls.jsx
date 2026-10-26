import AppIcon from "../../components/AppIcon";

export function ConsoleHeading({ title, description, children }) {
  return (
    <div className="admin-ref-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function ConsoleSearch({ label, value, onChange }) {
  return (
    <label className="admin-ref-search">
      <AppIcon name="search" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ConsoleSegments({ label, items, value, onChange }) {
  return (
    <div className="admin-ref-segments" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count != null && <small>{item.count.toLocaleString()}</small>}
        </button>
      ))}
    </div>
  );
}

export function ConsoleEmpty({ children }) {
  return (
    <div className="admin-ref-empty" role="status">
      {children}
    </div>
  );
}
