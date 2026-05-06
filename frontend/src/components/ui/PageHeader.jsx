export function PageHeader({ eyebrow, title, subtitle, actions, badge }) {
  return (
    <header className="ui-pageheader">
      <div className="ui-pageheader__main">
        {eyebrow ? <div className="ui-pageheader__eyebrow">{eyebrow}</div> : null}
        <div className="ui-pageheader__titlerow">
          <h1 className="ui-pageheader__title">{title}</h1>
          {badge ? <span className="ui-pageheader__badge">{badge}</span> : null}
        </div>
        {subtitle ? <p className="ui-pageheader__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ui-pageheader__actions">{actions}</div> : null}
    </header>
  );
}
