import { useEffect } from "react";

export function Modal({ open, title, onClose, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`ui-modal ui-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ui-modal__header">
          <h3>{title}</h3>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
