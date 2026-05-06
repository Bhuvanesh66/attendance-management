import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++_id;
      const t = {
        id,
        tone: toast.tone || "info",
        title: toast.title || "",
        message: toast.message || "",
        duration: toast.duration ?? 4000,
      };
      setToasts((prev) => [...prev, t]);
      if (t.duration > 0) {
        setTimeout(() => dismiss(id), t.duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, title = "Done") => push({ tone: "success", title, message }),
      error: (message, title = "Something went wrong") => push({ tone: "error", title, message, duration: 6000 }),
      info: (message, title = "") => push({ tone: "info", title, message }),
    }),
    [push, dismiss]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="ui-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast--${t.tone}`}>
            <div className="ui-toast__body">
              {t.title ? <div className="ui-toast__title">{t.title}</div> : null}
              {t.message ? <div className="ui-toast__msg">{t.message}</div> : null}
            </div>
            <button
              type="button"
              className="ui-toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return {
      push: () => {},
      dismiss: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
