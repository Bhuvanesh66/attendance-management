export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`ui-tab ${active === t.key ? "ui-tab--active" : ""}`}
          onClick={() => onChange?.(t.key)}
        >
          {t.icon ? <span className="ui-tab__icon">{t.icon}</span> : null}
          <span>{t.label}</span>
          {t.badge != null ? <span className="ui-tab__badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
