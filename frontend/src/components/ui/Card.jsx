export function Card({ title, subtitle, actions, icon, children, padded = true, className = "" }) {
  const hasHeader = title || subtitle || actions || icon;
  return (
    <section className={`ui-card ${padded ? "ui-card--padded" : ""} ${className}`}>
      {hasHeader ? (
        <header className="ui-card__header">
          {icon ? <div className="ui-card__icon">{icon}</div> : null}
          <div className="ui-card__heading">
            {title ? <h3 className="ui-card__title">{title}</h3> : null}
            {subtitle ? <p className="ui-card__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="ui-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}
