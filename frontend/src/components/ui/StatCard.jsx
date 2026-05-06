export function StatCard({ label, value, hint, tone = "neutral", icon }) {
  return (
    <div className={`ui-stat ui-stat--${tone}`}>
      <div className="ui-stat__top">
        {icon ? <div className="ui-stat__icon">{icon}</div> : null}
        <div className="ui-stat__label">{label}</div>
      </div>
      <div className="ui-stat__value">{value ?? "—"}</div>
      {hint ? <div className="ui-stat__hint">{hint}</div> : null}
    </div>
  );
}

export function StatGrid({ children, min = 160 }) {
  return (
    <div
      className="ui-stat-grid"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}
    >
      {children}
    </div>
  );
}
