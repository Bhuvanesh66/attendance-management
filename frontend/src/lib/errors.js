/** Turns API validation payloads into readable copy for dashboards. */
export function formatApiError(err) {
  const msg = err?.message || String(err || "Unknown error");
  const win = err?.payload?.window;
  if (win && typeof win === "object") {
    const hint = err?.payload?.hint ? String(err.payload.hint) : "";
    const parts = [
      msg,
      win.start && win.end ? `Window: ${String(win.start)} → ${String(win.end)}` : "",
      win.now ? `Now: ${String(win.now)}` : "",
      hint,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  const issues = err?.payload?.issues;
  if (!issues) return msg;

  const lines = [];
  const form = issues.formErrors;
  if (Array.isArray(form)) lines.push(...form.filter(Boolean));
  const fields = issues.fieldErrors;
  if (fields && typeof fields === "object") {
    for (const [key, vals] of Object.entries(fields)) {
      if (Array.isArray(vals) && vals.length) lines.push(`${key}: ${vals.join(", ")}`);
    }
  }
  return lines.length ? lines.join(" · ") : msg;
}
