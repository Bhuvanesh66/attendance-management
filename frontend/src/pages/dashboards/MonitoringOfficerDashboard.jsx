import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "var(--sb-radius-sm)",
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
      }}
    >
      <div className="sb-muted" style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#14532d" }}>
        {value}
      </div>
    </div>
  );
}

export function MonitoringOfficerDashboard() {
  const { getToken } = useAuth();
  const [state, setState] = useState({ loading: true, summary: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch("/programme/summary", { token });
        if (!alive) return;
        setState({ loading: false, summary: data.summary, error: null });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, summary: null, error: e });
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  const s = state.summary;

  return (
    <div className="sb-dashboard-grid">
      <div>
        <h1 className="sb-section-title" style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>
          Monitoring officer
        </h1>
        <p className="sb-muted" style={{ margin: 0 }}>
          Read-only programme-wide attendance overview (same aggregate endpoint as programme manager).
        </p>
      </div>

      <div className="sb-card">
        <p className="sb-muted" style={{ margin: 0 }}>
          Same data as programme manager, read-only. No onboarding steps — use <strong>Trainer</strong> /{" "}
          <strong>Institution</strong> dashboards to run day-to-day batch work.
        </p>
      </div>

      {state.loading ? (
        <div className="sb-loading-screen" style={{ minHeight: 120 }}>
          <div className="sb-spinner" aria-hidden />
          <p className="sb-muted" style={{ margin: 0 }}>
            Loading overview…
          </p>
        </div>
      ) : null}

      {state.error ? (
        <div className="sb-error-card" style={{ maxWidth: "100%", margin: 0 }}>
          <h2 style={{ fontSize: "1rem" }}>Could not load summary</h2>
          <p style={{ margin: 0 }}>{formatApiError(state.error)}</p>
        </div>
      ) : null}

      {s ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <Stat label="Institutions" value={s.total_institutions ?? "—"} />
            <Stat label="Batches" value={s.total_batches ?? "—"} />
            <Stat label="Sessions" value={s.total_sessions ?? "—"} />
            <Stat label="Students" value={s.total_students ?? "—"} />
            <Stat label="Marks" value={s.total_marks ?? "—"} />
            <Stat label="Present" value={s.present_count ?? "—"} />
            <Stat label="Absent" value={s.absent_count ?? "—"} />
            <Stat label="Late" value={s.late_count ?? "—"} />
          </div>
          <details className="sb-card" style={{ cursor: "pointer" }}>
            <summary style={{ fontWeight: 600 }}>Raw JSON</summary>
            <pre
              style={{
                marginTop: "1rem",
                marginBottom: 0,
                fontSize: "0.8125rem",
                overflow: "auto",
              }}
            >
              {JSON.stringify(s, null, 2)}
            </pre>
          </details>
        </>
      ) : null}
    </div>
  );
}
