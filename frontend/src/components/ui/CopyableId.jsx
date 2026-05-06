import { useState } from "react";

export function CopyableId({ value, label, truncate = true }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="ui-muted">—</span>;
  const display = truncate && value.length > 12
    ? `${String(value).slice(0, 8)}…${String(value).slice(-4)}`
    : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  }

  return (
    <button type="button" className="ui-copyable" onClick={copy} title={value}>
      {label ? <span className="ui-copyable__label">{label}</span> : null}
      <code className="ui-copyable__value">{display}</code>
      <span className="ui-copyable__icon">{copied ? "✓" : "⧉"}</span>
    </button>
  );
}

export function CopyButton({ value, children = "Copy" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  }
  return (
    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={copy}>
      {copied ? "Copied!" : children}
    </button>
  );
}
