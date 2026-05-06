export function Field({ label, hint, error, required, children, htmlFor }) {
  return (
    <div className={`ui-field ${error ? "ui-field--error" : ""}`}>
      {label ? (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ui-field__req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="ui-field__error">{error}</span> : hint ? (
        <span className="ui-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }) {
  return <input className={`ui-input ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`ui-select ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`ui-input ui-input--area ${className}`} {...props} />;
}
