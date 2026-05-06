export function EmptyState({ title, hint, action, icon }) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon">{icon || "📭"}</div>
      <h4 className="ui-empty__title">{title}</h4>
      {hint ? <p className="ui-empty__hint">{hint}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}
