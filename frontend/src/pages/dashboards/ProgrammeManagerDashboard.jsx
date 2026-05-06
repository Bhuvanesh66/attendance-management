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
        background: "#f8fafc",
        border: "1px solid var(--sb-border)",
      }}
    >
      <div className="sb-muted" style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

export function ProgrammeManagerDashboard() {
  const { getToken } = useAuth();
  const [state, setState] = useState({ loading: true, summary: null, error: null });
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState("");
  const [instState, setInstState] = useState({ loading: false, summary: null, error: null });

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch("/institutions", { token });
        if (!alive) return;
        setInstitutions(data.institutions || []);
      } catch {
        if (!alive) return;
        setInstitutions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  async function loadInstitutionSummary() {
    setInstState({ loading: true, summary: null, error: null });
    try {
      const token = await getToken();
      const id = institutionId.trim();
      const data = await apiFetch(`/institutions/${id}/summary`, { token });
      setInstState({ loading: false, summary: data.summary, error: null });
    } catch (e) {
      setInstState({ loading: false, summary: null, error: e });
    }
  }

  const s = state.summary;

  return (
    <div className="sb-dashboard-grid">
      <div>
        <h1 className="sb-section-title" style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>
          Programme manager
        </h1>
        <p className="sb-muted" style={{ margin: 0 }}>Cross-institution programme overview.</p>
      </div>

      <div className="sb-card">
        <p className="sb-muted" style={{ margin: 0 }}>
          This page calls <code>/programme/summary</code> and shows totals across the whole demo dataset.
          There is nothing to configure here — open it anytime you want programme-wide stats.
        </p>
      </div>

      {state.loading ? (
        <div className="sb-loading-screen" style={{ minHeight: 120 }}>
          <div className="sb-spinner" aria-hidden />
          <p className="sb-muted" style={{ margin: 0 }}>
            Loading programme stats…
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

      <div className="sb-card">
        <h2 className="sb-section-title">Institution summary</h2>
        <p className="sb-muted">
          Pick an institution to see its batch/session/student/attendance totals (calls <code>/institutions/:id/summary</code>).
        </p>

        {institutions.length > 0 ? (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {institutions.slice(0, 8).map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  setInstitutionId(String(i.id));
                  setInstState({ loading: false, summary: null, error: null });
                }}
                style={{
                  textAlign: "left",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "var(--sb-radius-sm)",
                  border: "1px solid var(--sb-border)",
                  background: institutionId === String(i.id) ? "#eef2ff" : "#fff",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: 600 }}>{i.name}</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.85, wordBreak: "break-all" }}>{i.id}</div>
              </button>
            ))}
          </div>
        ) : (
          <p className="sb-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            No institutions found yet.
          </p>
        )}

        <div className="sb-dashboard-grid" style={{ marginTop: "0.75rem" }}>
          <label className="sb-field">
            <span>Institution id (UUID)</span>
            <input
              className="sb-input"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={!institutionId.trim() || instState.loading}
            onClick={loadInstitutionSummary}
          >
            {instState.loading ? "Loading…" : "Load institution summary"}
          </button>
        </div>

        {instState.error ? (
          <p style={{ color: "var(--sb-danger)", marginTop: "1rem", marginBottom: 0 }}>{formatApiError(instState.error)}</p>
        ) : null}

        {instState.summary ? (
          <pre
            style={{
              marginTop: "1rem",
              marginBottom: 0,
              padding: "1rem",
              borderRadius: "var(--sb-radius-sm)",
              background: "#f8fafc",
              border: "1px solid var(--sb-border)",
              overflow: "auto",
              fontSize: "0.8125rem",
            }}
          >
            {JSON.stringify(instState.summary, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
