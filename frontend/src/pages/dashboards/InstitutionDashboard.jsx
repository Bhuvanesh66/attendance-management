import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";

export function InstitutionDashboard({ profile }) {
  const { getToken } = useAuth();
  const [batches, setBatches] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [state, setState] = useState({ loading: false, summary: null, error: null });
  const [orgId, setOrgId] = useState(profile?.institution_id || "");
  const [orgState, setOrgState] = useState({ loading: false, data: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch("/my/batches", { token });
        if (!alive) return;
        setBatches(data.batches || []);
      } catch {
        if (!alive) return;
        setBatches([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  useEffect(() => {
    setOrgId(profile?.institution_id || "");
  }, [profile?.institution_id]);

  async function loadOrganisationDetails() {
    setOrgState({ loading: true, data: null, error: null });
    try {
      const token = await getToken();
      const id = orgId.trim();
      const data = await apiFetch(`/institutions/${id}/details`, { token });
      setOrgState({ loading: false, data, error: null });
    } catch (e) {
      setOrgState({ loading: false, data: null, error: e });
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch("/my/trainers", { token });
        if (!alive) return;
        setTrainers(data.trainers || []);
      } catch {
        if (!alive) return;
        setTrainers([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  async function loadBatchSummary() {
    setState({ loading: true, summary: null, error: null });
    try {
      const token = await getToken();
      const id = batchId.trim();
      const data = await apiFetch(`/batches/${id}/summary`, { token });
      setState({ loading: false, summary: data, error: null });
    } catch (e) {
      setState({ loading: false, summary: null, error: e });
    }
  }

  const summaryErr = state.error ? formatApiError(state.error) : "";

  return (
    <div className="sb-dashboard-grid">
      <div>
        <h1 className="sb-section-title" style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>
          Institution
        </h1>
        <p className="sb-muted" style={{ margin: 0 }}>
          See every batch that belongs to your organisation, then open aggregated attendance for one batch at a time.
        </p>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Your organisation</h2>
        <p className="sb-muted" style={{ margin: "0 0 0.5rem" }}>
          Institution accounts get an organisation automatically. Trainers with separate accounts also get a demo org —
          batches only appear here if they were created under <strong>your</strong> institution id.
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem" }}>
          <strong>Organisation id:</strong>{" "}
          <code style={{ wordBreak: "break-all" }}>
            {profile?.institution_id || "Loading… refresh if empty"}
          </code>
        </p>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Institution overview (batches + sessions)</h2>
        <p className="sb-muted">
          Paste your institution UUID and load everything under it (no manual batch ids needed).
        </p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Institution id (UUID)</span>
            <input
              className="sb-input"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={!orgId.trim() || orgState.loading}
            onClick={loadOrganisationDetails}
          >
            {orgState.loading ? "Loading…" : "Load institution details"}
          </button>
        </div>

        {orgState.error ? (
          <p style={{ color: "var(--sb-danger)", marginTop: "1rem", marginBottom: 0 }}>
            {formatApiError(orgState.error)}
          </p>
        ) : null}

        {orgState.data ? (
          <>
            <div style={{ marginTop: "1rem", fontWeight: 700 }}>
              {orgState.data.institution?.name || "Institution"}
            </div>
            <div className="sb-muted" style={{ fontSize: "0.875rem" }}>
              <strong>Batches:</strong> {(orgState.data.batches || []).length} ·{" "}
              <strong>Sessions:</strong> {(orgState.data.sessions || []).length} ·{" "}
              <strong>Trainers:</strong> {(orgState.data.trainers || []).length}
            </div>

            <details className="sb-card" style={{ marginTop: "0.75rem", cursor: "pointer" }}>
              <summary style={{ fontWeight: 600 }}>Batches</summary>
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
                {(orgState.data.batches || []).map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: "0.65rem 0.75rem",
                      borderRadius: "var(--sb-radius-sm)",
                      border: "1px solid var(--sb-border)",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div className="sb-muted" style={{ fontSize: "0.8125rem", wordBreak: "break-all" }}>
                      <strong>ID:</strong> {b.id}
                    </div>
                    <div className="sb-muted" style={{ fontSize: "0.8125rem" }}>
                      <strong>Sessions:</strong>{" "}
                      {(orgState.data.sessions || []).filter((s) => String(s.batch_id) === String(b.id)).length}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="sb-card" style={{ marginTop: "0.75rem", cursor: "pointer" }}>
              <summary style={{ fontWeight: 600 }}>Sessions</summary>
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
                {(orgState.data.sessions || []).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: "0.65rem 0.75rem",
                      borderRadius: "var(--sb-radius-sm)",
                      border: "1px solid var(--sb-border)",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{s.title || "Session"}</div>
                    <div className="sb-muted" style={{ fontSize: "0.8125rem" }}>
                      <strong>Batch:</strong> {s.batch_name || "—"}
                    </div>
                    <div className="sb-muted" style={{ fontSize: "0.8125rem" }}>
                      <strong>When:</strong> {String(s.date).slice(0, 10)} {String(s.start_time || "").slice(0, 5)}–{String(s.end_time || "").slice(0, 5)}
                    </div>
                    <div className="sb-muted" style={{ fontSize: "0.8125rem", wordBreak: "break-all" }}>
                      <strong>ID:</strong> {s.id}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="sb-card" style={{ marginTop: "0.75rem", cursor: "pointer" }}>
              <summary style={{ fontWeight: 600 }}>Raw JSON</summary>
              <pre style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.8125rem", overflow: "auto" }}>
                {JSON.stringify(orgState.data, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Batches in your institution</h2>
        <p className="sb-muted">
          UUID format: <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>. Pick a batch to analyse, or paste an id
          manually below.
        </p>
        {batches.length === 0 ? (
          <p className="sb-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            No batches yet — ask trainers to create batches (they must belong to this institution in the database).
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {batches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBatchId(String(b.id));
                  setState({ loading: false, summary: null, error: null });
                }}
                style={{
                  textAlign: "left",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "var(--sb-radius-sm)",
                  border: "1px solid var(--sb-border)",
                  background: batchId === String(b.id) ? "#eef2ff" : "#fff",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.85, wordBreak: "break-all" }}>{b.id}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Trainers in your institution</h2>
        <p className="sb-muted">This is pulled from the database (users with role Trainer under your institution_id).</p>
        {trainers.length === 0 ? (
          <p className="sb-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            No trainers linked yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {trainers.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "0.65rem 0.75rem",
                  borderRadius: "var(--sb-radius-sm)",
                  border: "1px solid var(--sb-border)",
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.name || "Trainer"}</div>
                <div className="sb-muted" style={{ fontSize: "0.8125rem", wordBreak: "break-all" }}>
                  <strong>ID:</strong> {t.id}
                </div>
                {t.email ? (
                  <div className="sb-muted" style={{ fontSize: "0.8125rem", wordBreak: "break-all" }}>
                    <strong>Email:</strong> {t.email}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Batch attendance summary</h2>
        <p className="sb-muted">Loads aggregate counts for sessions, students, and marks for the batch UUID.</p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Batch id</span>
            <input
              className="sb-input"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={!batchId.trim() || state.loading}
            onClick={loadBatchSummary}
          >
            {state.loading ? "Loading…" : "Load summary"}
          </button>
        </div>

        {state.error ? (
          <p style={{ color: "var(--sb-danger)", marginTop: "1rem", marginBottom: 0 }}>{summaryErr}</p>
        ) : null}

        {state.summary ? (
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
            {JSON.stringify(state.summary, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
